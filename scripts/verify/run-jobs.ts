// The scheduled job, driven for real.
//
// Not the pieces: the actual handler, against the local database, with the same
// entry point Supabase Cron calls. The pieces each pass on their own and the
// bug worth catching is in how they are wired, so this asserts what the job
// leaves behind rather than what it returns.
//
// Three properties, and all three are things that would cost money to get
// wrong:
//
//   a lesson still to come earns nothing
//   a lesson that ran earns once, on hold, funded by a named charge
//   running it again adds nothing
//
// The release half runs too. No seeded tutor has a connected account, so it
// takes the skip path rather than making a transfer, which is the honest
// behaviour for somebody who has not connected a bank and is worth pinning.
//
// Needs the local Supabase, the seeded accounts, and STRIPE_SECRET_KEY.
import 'dotenv/config';
import { execSync } from 'node:child_process';

process.env.JOBS_TOKEN = process.env.JOBS_TOKEN || 'verify-jobs-token';

const handler = (await import('../../api/_handlers/run-jobs.js')).default;

const psql = (sql: string) =>
  execSync(`PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -tAq -c "${sql}"`)
    .toString()
    .trim();

let failures = 0;
const pass = (s: string, ok: boolean, d = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${s}${d ? '  -> ' + d : ''}`);
};

const tutorId = psql("select id from profiles where email='tutor@yakal.com';");
const studentId = psql("select id from profiles where role='student' limit 1;");
const parentId = psql("select id from profiles where email='parent@yakal.com';");

const clean = () => {
  psql("delete from earnings where session_id in (select id from sessions where subject like 'job-fixture%');");
  psql("delete from sessions where subject like 'job-fixture%';");
  psql("delete from invoices where description like 'job-fixture%';");
};
clean();

const invoiceId = psql(
  `insert into invoices (parent_id, student_id, tutor_id, description, amount_cents, tutor_earning_cents, kind, status, stripe_charge_id)
   values ('${parentId}','${studentId}','${tutorId}','job-fixture purchase',8400,5600,'tutoring','paid','ch_job_fixture')
   returning id;`
);

/** A session at a wall-clock offset from now, in the platform's zone. */
const makeSession = (label: string, offset: string, extra = '') =>
  psql(
    `insert into sessions (student_id, tutor_id, invoice_id, subject, date, start_time, duration_minutes, status, tutor_earning_cents${extra ? ', attendance, attendance_checked_at' : ''})
     select '${studentId}','${tutorId}','${invoiceId}','job-fixture ${label}',(t)::date,(t)::time,60,'upcoming',2800${extra}
       from (select (now() at time zone 'America/New_York') + interval '${offset}' as t) s
     returning id;`
  );

makeSession('done', '-3 hours');
makeSession('later', '5 hours');
// Zoom looked and found an empty room. The one signal it gives with confidence.
makeSession('empty', '-4 hours', ", '[]'::jsonb, now()");

function fakeRes() {
  const out: { code?: number; body?: any } = {};
  const res = {
    status(c: number) {
      out.code = c;
      return res;
    },
    json(b: any) {
      out.body = b;
      return out;
    },
    end() {
      return out;
    },
  };
  return { res, out };
}

async function run(token: string) {
  const { res, out } = fakeRes();
  await handler(
    { method: 'POST', headers: { 'x-jobs-token': token }, body: {} } as any,
    res as any
  );
  return out;
}

// An unauthenticated endpoint that moves money is not a thing to fail open on.
const refused = await run('not-the-token');
pass('a wrong token is refused', refused.code === 401, String(refused.code));

const first = await run(process.env.JOBS_TOKEN!);
pass('the job runs', first.code === 200, JSON.stringify(first.body));
pass('it completed the finished lesson', first.body?.sessions?.completed === 1, JSON.stringify(first.body?.sessions));
pass('and flagged the empty one', first.body?.sessions?.noShows === 1, JSON.stringify(first.body?.sessions));
pass('writing one earning', first.body?.sessions?.earningsWritten === 1, JSON.stringify(first.body?.sessions));
pass('and reporting no errors', (first.body?.errors ?? []).length === 0, JSON.stringify(first.body?.errors));

const statuses = psql(
  `select string_agg(subject || '=' || status, ', ' order by subject) from sessions where subject like 'job-fixture%';`
);
pass(
  'the lesson still to come is untouched',
  statuses.includes('job-fixture later=upcoming'),
  statuses
);
pass('the finished one is completed', statuses.includes('job-fixture done=completed'), statuses);
pass('the empty one is a no-show', statuses.includes('job-fixture empty=no-show'), statuses);

// A no-show earns nothing. That is the point of looking at attendance at all.
const rows = psql(
  `select coalesce(string_agg(s.subject || '|' || e.amount_cents || '|' || e.status || '|' || coalesce(e.source_charge_id,'-') || '|' || (e.releasable_at > now())::text, ', '), 'none')
     from earnings e join sessions s on s.id = e.session_id
    where s.subject like 'job-fixture%';`
);
pass('only the delivered lesson earned', rows === 'job-fixture done|2800|pending|ch_job_fixture|true', rows);

// The hold is what makes a refund cheap and a dispute survivable, so a fresh
// earning must not be releasable.
pass('the earning is held, not released', rows.endsWith('|true'), rows);

// Stripe redelivers, cron fires twice, and a retry after a timeout is expected.
// Every one of those has to be a no-op.
const second = await run(process.env.JOBS_TOKEN!);
pass('a second run completes nothing new', second.body?.sessions?.completed === 0, JSON.stringify(second.body?.sessions));
pass('and writes no second earning', second.body?.sessions?.earningsWritten === 0, JSON.stringify(second.body?.sessions));

const count = psql(
  `select count(*) from earnings e join sessions s on s.id = e.session_id where s.subject like 'job-fixture%';`
);
pass('leaving exactly one earning', count === '1', count);

// Past the hold, with no bank connected: still owed, not failed. The money has
// nowhere to go yet and moves on its own the day they connect.
psql(
  `update earnings set releasable_at = now() - interval '1 hour'
     where session_id in (select id from sessions where subject like 'job-fixture%');`
);
const third = await run(process.env.JOBS_TOKEN!);
pass('a payee with no bank is skipped, not failed', third.body?.payouts?.skipped === 1, JSON.stringify(third.body?.payouts));
pass('nothing was transferred', third.body?.payouts?.transferred === 0, JSON.stringify(third.body?.payouts));
pass('and it is still owed', psql(
  `select e.status from earnings e join sessions s on s.id = e.session_id where s.subject like 'job-fixture%';`
) === 'pending');

clean();

console.log(failures === 0 ? '\nall checks passed' : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
