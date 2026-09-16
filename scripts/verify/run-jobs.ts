// The scheduled job, driven for real.
//
// Not the pieces: the actual handler, against the local database, with the same
// entry point Supabase Cron calls. The pieces each pass on their own and the
// bug worth catching is in how they are wired, so this asserts what the job
// leaves behind rather than what it returns.
//
// Every property here would cost money to get wrong:
//
//   a lesson still to come earns nothing
//   a lesson that ran earns once, on hold, funded by a named charge
//   a lesson whose purchase never completed earns nothing
//   a tutor who never joined a lesson somebody attended is held, and reported
//   a student who never joined does not cost the tutor
//   running it again adds nothing
//
// The release half runs too. No seeded tutor has a connected account, so it
// takes the skip path rather than making a transfer, which is the honest
// behaviour for somebody who has not connected a bank and is worth pinning.
//
// It runs the real job, so it also acts on rows that are not its fixtures: a
// seeded lesson whose slot has passed gets completed, because that is what the
// job is for and the row was stale. Correct, and worth knowing before wondering
// where a local earning came from.
//
// Needs the local Supabase, the seeded accounts, and STRIPE_SECRET_KEY.
import 'dotenv/config';
import { execSync } from 'node:child_process';

process.env.JOBS_TOKEN = process.env.JOBS_TOKEN || 'verify-jobs-token';

const handler = (await import('../../api/_handlers/run-jobs.js')).default;

// No double quotes in any SQL below: this wraps the statement in them.
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

const FIXTURES = "(select id from sessions where subject like 'job-fixture%')";
const clean = () => {
  psql(`delete from session_disputes where session_id in ${FIXTURES};`);
  psql(`delete from session_attendance where session_id in ${FIXTURES};`);
  psql(`delete from earnings where session_id in ${FIXTURES};`);
  psql("delete from sessions where subject like 'job-fixture%';");
  psql("delete from invoices where description like 'job-fixture%';");
};
clean();

const invoiceId = psql(
  `insert into invoices (parent_id, student_id, tutor_id, description, amount_cents, tutor_earning_cents, kind, status, stripe_charge_id)
   values ('${parentId}','${studentId}','${tutorId}','job-fixture purchase',8400,5600,'tutoring','paid','ch_job_fixture')
   returning id;`
);

// A checkout somebody started and never finished.
const openInvoiceId = psql(
  `insert into invoices (parent_id, student_id, tutor_id, description, amount_cents, tutor_earning_cents, kind, status)
   values ('${parentId}','${studentId}','${tutorId}','job-fixture unpaid',4200,2800,'tutoring','open')
   returning id;`
);

/** A lesson at a wall-clock offset from now, in the platform's zone. */
const makeSession = (label: string, offset: string, opts: { invoice?: string; attendance?: string } = {}) =>
  psql(
    `insert into sessions (student_id, tutor_id, invoice_id, subject, date, start_time, duration_minutes, status, tutor_earning_cents, mode${opts.attendance ? ', attendance, attendance_checked_at' : ''})
     select '${studentId}','${tutorId}','${opts.invoice ?? invoiceId}','job-fixture ${label}',(t)::date,(t)::time,60,'upcoming',2800,'online'${opts.attendance ? `, ${opts.attendance}, now()` : ''}
       from (select (now() at time zone 'America/New_York') + interval '${offset}' as t) s
     returning id;`
  );

makeSession('done', '-3 hours');
makeSession('later', '5 hours');

// An advising hour, carrying a payout amount it must ignore.
//
// Counselling is paid through the subscription, so this session completing must
// not also earn. The amount is deliberately non-zero: for a long time the only
// thing preventing a double payment was that book_advising_session never set
// this column, which is an accident rather than a rule. This fails if the job
// ever goes back to deciding on the amount instead of the kind.
psql(
  `insert into sessions (student_id, tutor_id, invoice_id, subject, date, start_time, duration_minutes, status, kind, tutor_earning_cents)
   select '${studentId}','${tutorId}','${invoiceId}','job-fixture advising',(t)::date,(t)::time,60,'upcoming','advising',2800
     from (select (now() at time zone 'America/New_York') - interval '3 hours' as t) s;`
);

// Zoom looked and found an empty room. The one signal it gives with confidence.
makeSession('empty', '-4 hours', { attendance: "'[]'::jsonb" });

// A lesson whose purchase never went through. Before, this earned like any other.
makeSession('unpaid', '-3 hours', { invoice: openInvoiceId });

// Somebody was in the room and it was not the tutor. Zoom lists one person with
// no email, which is what a Meeting SDK join looks like, and the app recorded
// only the student.
const someone = "jsonb_build_array(jsonb_build_object('name','Guest','minutes',50))";
const tutorAbsentId = makeSession('tutor-absent', '-5 hours', { attendance: someone });
psql(`insert into session_attendance (session_id, user_id, role) values ('${tutorAbsentId}','${studentId}','student');`);

// The mirror image: the tutor joined through the app and the student did not.
const studentAbsentId = makeSession('student-absent', '-6 hours', { attendance: someone });
psql(`insert into session_attendance (session_id, user_id, role) values ('${studentAbsentId}','${tutorId}','tutor');`);

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

/** "amount|status|charge" for a fixture's earnings, or "none". */
const earning = (label: string) =>
  psql(
    `select coalesce(string_agg(e.amount_cents || '|' || e.status || '|' || coalesce(e.source_charge_id,'-'), ','), 'none')
       from earnings e join sessions s on s.id = e.session_id
      where s.subject = 'job-fixture ${label}';`
  );

// An unauthenticated endpoint that moves money is not a thing to fail open on.
const refused = await run('not-the-token');
pass('a wrong token is refused', refused.code === 401, String(refused.code));

const first = await run(process.env.JOBS_TOKEN!);
pass('the job runs', first.code === 200, JSON.stringify(first.body));
// At least, not exactly: the job works on the whole database, so a seeded
// lesson whose slot has passed legitimately completes in the same run. What
// this check owns is the fixtures, and those are asserted by name below.
pass('it completed the finished sessions', (first.body?.sessions?.completed ?? 0) >= 5, JSON.stringify(first.body?.sessions));
pass('and flagged the empty one', first.body?.sessions?.noShows === 1, JSON.stringify(first.body?.sessions));
pass('and reporting no errors', (first.body?.errors ?? []).length === 0, JSON.stringify(first.body?.errors));

const statuses = psql(
  `select string_agg(subject || '=' || status, ', ' order by subject) from sessions where subject like 'job-fixture%';`
);
pass('the lesson still to come is untouched', statuses.includes('job-fixture later=upcoming'), statuses);
pass('the finished one is completed', statuses.includes('job-fixture done=completed'), statuses);
pass('the empty one is a no-show', statuses.includes('job-fixture empty=no-show'), statuses);
// It has to complete, because counselling_period_delivered reads exactly this.
// A counsellor whose sessions never complete looks like one who did nothing.
pass('the advising hour completed', statuses.includes('job-fixture advising=completed'), statuses);

pass('the delivered lesson earned, funded by its charge', earning('done') === '2800|pending|ch_job_fixture', earning('done'));
pass('a no-show earns nothing', earning('empty') === 'none', earning('empty'));
pass('the advising hour earned nothing', earning('advising') === 'none', earning('advising'));
pass('a lesson whose purchase never completed earned nothing', earning('unpaid') === 'none', earning('unpaid'));
pass('a tutor who never joined is held, not paid', earning('tutor-absent') === '2800|held|ch_job_fixture', earning('tutor-absent'));
pass('a student who never joined does not cost the tutor', earning('student-absent') === '2800|pending|ch_job_fixture', earning('student-absent'));

const report = psql(
  `select count(*) from session_disputes
    where session_id = '${tutorAbsentId}' and status = 'open' and reason = 'no_show' and raised_by is null;`
);
pass('the held one is in front of an admin as an open report', report === '1', report);
const noReport = psql(`select count(*) from session_disputes where session_id = '${studentAbsentId}';`);
pass('the lesson the student missed raised nothing', noReport === '0', noReport);

// The hold is what makes a refund cheap and a dispute survivable, so a fresh
// earning must not be releasable.
const onHold = psql(
  `select (e.releasable_at > now())::text from earnings e join sessions s on s.id = e.session_id
    where s.subject = 'job-fixture done';`
);
pass('the earning is held, not released', onHold === 'true', onHold);

// Stripe redelivers, cron fires twice, and a retry after a timeout is expected.
// Every one of those has to be a no-op.
const second = await run(process.env.JOBS_TOKEN!);
pass('a second run completes nothing new', second.body?.sessions?.completed === 0, JSON.stringify(second.body?.sessions));
pass('and writes no second earning', second.body?.sessions?.earningsWritten === 0, JSON.stringify(second.body?.sessions));

const count = psql(
  `select count(*) from earnings e join sessions s on s.id = e.session_id where s.subject like 'job-fixture%';`
);
pass('leaving exactly three earnings', count === '3', count);

// Past the hold, with no bank connected: still owed, not failed. The money has
// nowhere to go yet and moves on its own the day they connect.
psql(
  `update earnings set releasable_at = now() - interval '1 hour'
     where session_id in ${FIXTURES};`
);
const third = await run(process.env.JOBS_TOKEN!);
pass('a payee with no bank is skipped, not failed', (third.body?.payouts?.skipped ?? 0) >= 1, JSON.stringify(third.body?.payouts));
pass('nothing was transferred', third.body?.payouts?.transferred === 0, JSON.stringify(third.body?.payouts));
pass('the delivered one is still owed', earning('done') === '2800|pending|ch_job_fixture', earning('done'));
// Release only moves pending rows, so a held one waits for the admin's verdict.
pass('and release left the held one alone', earning('tutor-absent') === '2800|held|ch_job_fixture', earning('tutor-absent'));

clean();

console.log(failures === 0 ? '\nall checks passed' : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
