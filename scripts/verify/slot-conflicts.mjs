// A slot cannot be sold twice.
//
// Run it with tsx, not node: it imports api/_utils/fulfil.ts, whose own imports
// carry .js extensions because the deployed functions are ESM. Node's type
// stripping does not map those back to .ts, so plain node fails on email.js
// rather than on anything to do with slots.
//
//   npx tsx scripts/verify/slot-conflicts.mjs
//
// Slots are chosen per course, so nothing used to stop a parent buying
// Chemistry at Monday 4pm and Physics at Monday 4pm for the same child. Three
// layers now stop it, and this checks all three:
//
//   the database  a unique index refuses the second session
//   the query     the booking grid can see which hours are gone
//   fulfilment    a purchase that clashes loses only the clashing session
//
// The UI layer is checked in the browser; this is everything underneath it.
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'node:child_process';

const psql = (sql) =>
  execSync(`PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -tAq -c "${sql}"`)
    .toString()
    .trim();

let failures = 0;
const pass = (s, ok, d = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${s}${d ? '  -> ' + d : ''}`);
};

const SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const db = createClient('http://127.0.0.1:54321', SERVICE_KEY, { auth: { persistSession: false } });

const studentId = psql("select id from profiles where email='student@yakal.com';");
const parentId = psql("select id from profiles where email='parent@yakal.com';");
const tutorId = psql("select id from profiles where email='tutor@yakal.com';");

// A date far enough out that nothing seeded is sitting on it.
const DATE = '2027-03-15';
const TIME = '14:00';
psql(`delete from sessions where date='${DATE}';`);
psql(`delete from invoices where description like 'slot-conflicts%';`);

// ---- the database refuses a second session in the same hour ----
const base = {
  student_id: studentId,
  tutor_id: tutorId,
  date: DATE,
  start_time: TIME,
  duration_minutes: 60,
  mode: 'online',
  status: 'upcoming',
};

const first = await db.from('sessions').insert({ ...base, subject: 'Chemistry' });
pass('the first booking of an hour is accepted', !first.error, first.error?.message ?? '');

const second = await db.from('sessions').insert({ ...base, subject: 'Physics' });
pass(
  'the same child cannot be booked again at that hour, in any subject',
  second.error?.code === '23505',
  second.error ? second.error.code : 'no error at all'
);

// Cancelling gives the hour back: the record stays, the block does not.
psql(`update sessions set status='cancelled' where date='${DATE}';`);
const afterCancel = await db.from('sessions').insert({ ...base, subject: 'Physics' });
pass(
  'a cancelled lesson frees the hour again',
  !afterCancel.error,
  afterCancel.error?.message ?? ''
);

// ---- a parent can see which of a tutor's hours are gone ----
const anon = createClient('http://127.0.0.1:54321', ANON_KEY, { auth: { persistSession: false } });
const signIn = await anon.auth.signInWithPassword({
  email: 'parent@yakal.com',
  password: 'demo123',
});
pass('the parent signs in', !signIn.error, signIn.error?.message ?? '');

const { data: busy, error: busyErr } = await anon.rpc('tutor_busy_slots', {
  p_tutor_id: tutorId,
  p_from: DATE,
  p_to: DATE,
});
pass('a parent can read a tutor busy hours', !busyErr, busyErr?.message ?? '');
pass(
  'the taken hour comes back',
  (busy ?? []).some((s) => String(s.busy_time).startsWith(TIME)),
  JSON.stringify(busy)
);
pass(
  'and nothing about whose lesson it is',
  (busy ?? []).every((s) => Object.keys(s).sort().join(',') === 'busy_date,busy_time'),
  Object.keys((busy ?? [])[0] ?? {}).join(',')
);

// ---- one clashing slot does not lose the rest of the purchase ----
const courseId = psql("select id from courses where tutor_id='" + tutorId + "' limit 1;");
psql(`delete from sessions where course_id='${courseId}' and date in ('${DATE}','2027-03-16');`);

const { data: invoice } = await db
  .from('invoices')
  .insert({
    parent_id: parentId,
    student_id: studentId,
    tutor_id: tutorId,
    course_id: courseId,
    booking: [
      { date: DATE, startTime: TIME, durationMinutes: 60 }, // already taken above
      { date: '2027-03-16', startTime: TIME, durationMinutes: 60 }, // free
    ],
    description: 'slot-conflicts fixture',
    amount_cents: 11000,
    tutor_earning_cents: 8000,
    kind: 'tutoring',
    status: 'paid',
  })
  .select('id')
  .single();

const { fulfilInvoices } = await import('../../api/_utils/fulfil.ts');
await fulfilInvoices(db, [invoice.id]);

pass(
  'the free slot in a part-clashing purchase is still booked',
  psql(`select count(*) from sessions where course_id='${courseId}' and date='2027-03-16';`) === '1'
);
pass(
  'and the clashing one is not written twice',
  psql(`select count(*) from sessions where date='${DATE}' and status<>'cancelled';`) === '1'
);

// ---- tidy up ----
psql(`delete from sessions where date in ('${DATE}','2027-03-16');`);
psql(`delete from invoices where description like 'slot-conflicts%';`);

console.log(failures === 0 ? '\nall checks passed' : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
