// Schedule the payout job on a Supabase project.
//
// Nothing completes and nobody is paid until something calls run-jobs on a
// schedule. That caller is Supabase Cron over pg_net, and setting it up by hand
// means pasting SQL with a token substituted into it. Getting the token wrong
// is silent: the job runs, gets a 401, and no money moves until somebody
// notices weeks later that no tutor has been paid.
//
// So it is a script. The token comes from the environment rather than being
// typed into SQL, and it verifies the job afterwards rather than trusting that
// the paste worked.
//
//   npx tsx scripts/setup-cron.ts                    # says what it would do
//   npx tsx scripts/setup-cron.ts --confirm          # actually does it
//   npx tsx scripts/setup-cron.ts --confirm --remove # unschedule it
//
// Reads SUPABASE_DB_URL (which project), JOBS_TOKEN (the shared secret the
// endpoint checks) and APP_BASE_URL (where run-jobs lives).
//
// This is not a migration on purpose. It carries one environment's URL and one
// environment's token, and migrations are committed to the repository.
import 'dotenv/config';
import { execSync } from 'node:child_process';

const JOB_NAME = 'yakal-payout-jobs';

// Hourly rather than daily, so a lesson finishing at 9am is not left until
// midnight and a failed run retries within the hour instead of the next day.
const SCHEDULE = '0 * * * *';

function fail(message: string): never {
  console.error(`\n${message}\n`);
  process.exit(1);
}

const dbUrl = (process.env.SUPABASE_DB_URL ?? '').trim();
const token = (process.env.JOBS_TOKEN ?? '').trim();
const appUrl = (process.env.APP_BASE_URL ?? 'https://yakal.me').trim().replace(/\/+$/, '');

if (!dbUrl) fail('SUPABASE_DB_URL is not set, so there is no project to schedule anything on.');
if (!token) fail('JOBS_TOKEN is not set. The endpoint refuses everyone without one, so scheduling a caller that has none would just fail hourly.');

const confirmed = process.argv.includes('--confirm');
const removing = process.argv.includes('--remove');

/** Which project this is about to write to, without printing the password. */
const host = (() => {
  try {
    return new URL(dbUrl).host;
  } catch {
    return 'an unparseable SUPABASE_DB_URL';
  }
})();

const run = (sql: string) =>
  execSync(`psql "${dbUrl}" -X -q -v ON_ERROR_STOP=1 -tAc ${JSON.stringify(sql)}`, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

// A local APP_BASE_URL against a hosted project is the failure this script
// exists to prevent, in its purest form: the schedule is created, cron fires
// every hour, pg_net cannot reach localhost from Supabase's network, and no
// money moves. Nothing errors anywhere a person would look.
//
// .env carries http://localhost:5173 for ordinary development, so this is not a
// hypothetical, it is what happens if you run --confirm on a developer machine.
const remoteProject = !/^(localhost|127\.0\.0\.1|\[::1\])/.test(host);
const localEndpoint = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])/.test(appUrl);

if (remoteProject && localEndpoint) {
  fail(
    `APP_BASE_URL is ${appUrl}, but ${host} is a hosted project.\n\n` +
      'Supabase cannot reach your machine, so the job would fire every hour and\n' +
      'reach nothing. Set APP_BASE_URL to the deployed URL before running this:\n\n' +
      '  APP_BASE_URL=https://yakal.me npx tsx scripts/setup-cron.ts --confirm'
  );
}

console.log(`\nProject:  ${host}`);
console.log(`Endpoint: ${appUrl}/api/connect?action=run-jobs`);
console.log(`Schedule: ${SCHEDULE} (hourly)`);
console.log(`Token:    ${token.slice(0, 4)}... (${token.length} characters)\n`);

if (!confirmed) {
  console.log('Nothing has been changed. This writes to a real project, so it needs --confirm:\n');
  console.log(`  npx tsx scripts/setup-cron.ts --confirm\n`);
  process.exit(0);
}

try {
  if (removing) {
    run(`select cron.unschedule('${JOB_NAME}');`);
    console.log(`Unscheduled ${JOB_NAME}.\n`);
    process.exit(0);
  }

  run('create extension if not exists pg_cron;');
  run('create extension if not exists pg_net;');

  // Unscheduled first, so running this again after rotating the token replaces
  // the old job rather than leaving two, one of which now 401s every hour.
  run(
    `do $$ begin
       perform cron.unschedule('${JOB_NAME}');
     exception when others then null;
     end $$;`
  );

  run(
    `select cron.schedule('${JOB_NAME}', '${SCHEDULE}', $job$
       select net.http_post(
         url     := '${appUrl}/api/connect?action=run-jobs',
         headers := jsonb_build_object(
                      'Content-Type', 'application/json',
                      'x-jobs-token', '${token}'
                    ),
         body    := '{}'::jsonb
       );
     $job$);`
  );

  // Read it back. A schedule nobody confirmed is the same class of thing as a
  // backup nobody restored.
  const check = run(
    `select jobname || ' | ' || schedule || ' | ' || case when active then 'active' else 'INACTIVE' end
       from cron.job where jobname = '${JOB_NAME}';`
  );

  if (!check) fail('Scheduled without error, but the job is not in cron.job. Something is wrong.');

  console.log(`Scheduled: ${check}`);
  console.log('\nAfter the next hour turns, check it ran:\n');
  console.log(`  select status, return_message, start_time from cron.job_run_details`);
  console.log(`   where jobname = '${JOB_NAME}' order by start_time desc limit 5;\n`);
  console.log('A 401 in return_message means JOBS_TOKEN here and JOBS_TOKEN in Render differ.\n');
} catch (err: any) {
  const detail = err?.stderr?.toString?.() || err?.message || String(err);
  fail(`Failed against ${host}:\n\n${detail}`);
}
