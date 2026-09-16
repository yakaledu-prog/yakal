// What each way a lesson can go does to the money.
//
// The completion job decides two things:
//
//   nobody in the room            a no-show, and nobody is paid
//   somebody there, no tutor      completes, but the pay is held and reported
//
// and deliberately does not judge the rest:
//
//   only the tutor turned up      the family paid for a lesson nobody attended
//   Zoom never reported           no evidence either way, and it still pays
//
// Those two complete and pay, and the way either gets put right is a family
// reporting it and an admin deciding, on the attendance in v_open_disputes.
//
// The held case used to pay like the others, on the theory that a tutor missing
// an hour was a judgement for a person. It still is: the job holds the money and
// opens the report rather than refusing the pay outright, because Zoom gives no
// email for somebody joining through the Meeting SDK, and a tutor who joined
// from the Zoom app must not lose their pay to a guess.
//
// So this pins what the job does on its own, and that the evidence an admin
// needs is actually there.
//
// The attendance rows are written the way the meeting page writes them, through
// record_attendance_event as the person themselves, so the guard on that
// function is exercised too rather than bypassed with an insert.
//
// Needs the local Supabase, the seeded accounts, and STRIPE_SECRET_KEY.
import 'dotenv/config';
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.JOBS_TOKEN = process.env.JOBS_TOKEN || 'verify-jobs-token';
const runJobs = (await import('../../api/_handlers/run-jobs.js')).default;

// Through a file rather than -c, because several of these statements carry
// JSON and the shell eats the quoting.
const SQL_FILE = join(tmpdir(), 'yakal-session-outcomes.sql');
const psql = (sql: string) => {
  writeFileSync(SQL_FILE, sql);
  return execSync(
    `PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -v ON_ERROR_STOP=1 -tAq -f ${SQL_FILE}`,
    { stdio: ['pipe', 'pipe', 'pipe'] }
  )
    .toString()
    .trim();
};

// Wrapped in a transaction: set local only lasts for one, and psql running a
// file commits each statement on its own, so without this the role is dropped
// before the statement that needs it.
const asUser = (userId: string, sql: string) =>
  psql(
    `begin;\n` +
      `set local role authenticated;\n` +
      `set local request.jwt.claims = '{"sub":"${userId}","role":"authenticated"}';\n` +
      sql +
      `\ncommit;`
  );

let failures = 0;
const pass = (s: string, ok: boolean, d = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${s}${d ? '  -> ' + d : ''}`);
};

const tutor = psql("select id from profiles where email='tutor@yakal.com';");
const student = psql("select id from profiles where role='student' and email='student@yakal.com';");
const parent = psql("select id from profiles where email='parent@yakal.com';");

const clean = () => {
  psql("delete from earnings where session_id in (select id from sessions where subject like 'outcome-%');");
  psql("delete from session_attendance where session_id in (select id from sessions where subject like 'outcome-%');");
  psql("delete from sessions where subject like 'outcome-%';");
  psql("delete from invoices where description like 'outcome-fixture%';");
};
clean();

const invoiceId = psql(
  `insert into invoices (parent_id, student_id, tutor_id, description, amount_cents, tutor_earning_cents, kind, status, stripe_charge_id)
   values ('${parent}','${student}','${tutor}','outcome-fixture',9999,3500,'tutoring','paid','ch_outcome_fixture')
   returning id;`
);

/** A lesson that finished an hour ago, so the job picks it up. */
const makeSession = (label: string) =>
  psql(
    `insert into sessions (student_id, tutor_id, invoice_id, subject, date, start_time, duration_minutes, status, tutor_earning_cents)
     select '${student}','${tutor}','${invoiceId}','outcome-${label}',(t)::date,(t)::time,60,'upcoming',3500
       from (select (now() at time zone 'America/New_York') - interval '2 hours' as t) s
     returning id;`
  );

/** Zoom's own answer, which is what the job actually reads. */
const zoomSaw = (id: string, participants: string) =>
  psql(
    `update sessions set attendance = '${participants}'::jsonb, attendance_checked_at = now() where id = '${id}';`
  );

const bothIn = makeSession('both');
const nobodyIn = makeSession('nobody');
const tutorOnly = makeSession('tutor-only');
const studentOnly = makeSession('student-only');
const unchecked = makeSession('unchecked');

// Attendance written the way the meeting page writes it, as the people
// themselves, so the window and role guards on the function are exercised.
for (const [id, who] of [
  [bothIn, 'both'],
  [tutorOnly, 'tutor'],
  [studentOnly, 'student'],
] as const) {
  if (who === 'both' || who === 'tutor') asUser(tutor, `select public.record_attendance_event('${id}','join');`);
  if (who === 'both' || who === 'student') asUser(student, `select public.record_attendance_event('${id}','join');`);
}

pass(
  'the meeting page can record a join for a lesson that has just finished',
  psql(`select count(*) from session_attendance where session_id='${bothIn}';`) === '2'
);

// Zoom's verdict on each.
zoomSaw(bothIn, '[{"name":"Bethlehem Alemu"},{"name":"Amen Worku"}]');
zoomSaw(nobodyIn, '[]');
zoomSaw(tutorOnly, '[{"name":"Bethlehem Alemu"}]');
zoomSaw(studentOnly, '[{"name":"Amen Worku"}]');
// unchecked stays null on purpose

const res = () => {
  const out: any = {};
  return {
    out,
    res: {
      status(c: number) { out.status = c; return this; },
      json(b: any) { out.body = b; return this; },
      end() { return this; },
    } as any,
  };
};
const { res: r } = res();
await runJobs({ method: 'POST', headers: { 'x-jobs-token': process.env.JOBS_TOKEN }, body: {} } as any, r);

const statusOf = (id: string) => psql(`select status from sessions where id='${id}';`);
const earningOf = (id: string) => psql(`select coalesce((select status from earnings where session_id='${id}' limit 1),'none');`);

pass('a lesson both sides attended completes', statusOf(bothIn) === 'completed', statusOf(bothIn));
pass('and the tutor is owed for it, on hold', earningOf(bothIn) === 'pending', earningOf(bothIn));

pass('a lesson Zoom found empty is a no-show', statusOf(nobodyIn) === 'no-show', statusOf(nobodyIn));
pass('and nobody is owed anything for it', earningOf(nobodyIn) === 'none', earningOf(nobodyIn));

// The three the job deliberately does not judge. Pinned as they are, so a
// change of policy here is a decision somebody made rather than a drift.
pass('only the tutor turning up still completes', statusOf(tutorOnly) === 'completed', statusOf(tutorOnly));
pass('and still pays, for a family to dispute', earningOf(tutorOnly) === 'pending', earningOf(tutorOnly));

pass('a lesson the tutor never joined still completes', statusOf(studentOnly) === 'completed', statusOf(studentOnly));
pass('but the pay is held rather than sent', earningOf(studentOnly) === 'held', earningOf(studentOnly));
pass(
  'and the job opened the report itself',
  psql(
    `select coalesce((select 'yes' from session_disputes
       where session_id='${studentOnly}' and status='open' and reason='no_show' and raised_by is null limit 1),'no');`
  ) === 'yes'
);

pass('a lesson Zoom never reported on still completes', statusOf(unchecked) === 'completed', statusOf(unchecked));
pass('and pays, because no evidence is not evidence of absence', earningOf(unchecked) === 'pending', earningOf(unchecked));

// ---- and the evidence an admin needs to put any of that right ----
const summary = psql(
  `select tutor_present || '/' || student_present from v_session_attendance_summary where session_id='${bothIn}';`
);
pass('the attendance summary knows both were there', summary === 'true/true', summary);

const tutorOnlySummary = psql(
  `select tutor_present || '/' || coalesce(student_present::text,'null') from v_session_attendance_summary where session_id='${tutorOnly}';`
);
pass('and knows when only one of them was', tutorOnlySummary === 'true/false', tutorOnlySummary);

// The dispute view is the screen an admin decides on, and it exists to carry
// that attendance. It joined to an empty table for as long as the meeting page
// never recorded a join, which is the bug this pins. The report here is the one
// the job raised above, so this also checks that a report with no author reaches
// that screen the same way a family's does.
const evidence = psql(
  `select coalesce(tutor_present::text,'null') || '/' || coalesce(student_present::text,'null')
     from v_open_disputes where session_id='${studentOnly}';`
);
pass(
  'an open report carries the attendance an admin judges on',
  evidence === 'false/true',
  evidence + ' (tutor/student present)'
);

clean();

console.log(failures === 0 ? '\nall checks passed' : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
