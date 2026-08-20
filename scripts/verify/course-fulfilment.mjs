// What a paid course actually produces: an enrolment, the booked sessions,
// notifications for all three people, and the emails.
//
// Calls fulfilInvoices directly rather than driving Stripe Checkout: the card
// form is Stripe's and cannot be scripted, but everything after the payment is
// ours and is where the bugs live.
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'node:child_process';

const psql = (sql) =>
  execSync(`PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -tAq -c "${sql}"`).toString().trim();

let failures = 0;
const pass = (s, ok, d = '') => { if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${s}${d ? '  -> ' + d : ''}`); };

const db = createClient('http://127.0.0.1:54321',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU',
  { auth: { persistSession: false } });

const courseId  = psql("select id from courses where title like 'Chemistry%' limit 1;");
const studentId = psql("select id from profiles where email='student@yakal.com';");
const parentId  = psql("select id from profiles where email='parent@yakal.com';");
const tutorId   = psql("select id from profiles where email='tutor@yakal.com';");

// Clean slate for this course only.
psql(`delete from enrolments where course_id='${courseId}';`);
psql(`delete from sessions where course_id='${courseId}';`);
psql(`delete from invoices where course_id='${courseId}';`);
psql("delete from notifications where type='enrolment';");
await fetch('http://127.0.0.1:54324/api/v1/messages', { method: 'DELETE' });

const booking = [
  { date: '2026-08-10', startTime: '16:00', durationMinutes: 60 },
  { date: '2026-08-17', startTime: '16:00', durationMinutes: 60 },
];

const { data: invoice } = await db.from('invoices').insert({
  parent_id: parentId, student_id: studentId, tutor_id: tutorId,
  course_id: courseId, booking,
  description: 'Chemistry, Grade 11 Foundations', amount_cents: 5500,
  tutor_earning_cents: 4000, kind: 'tutoring', status: 'paid',
}).select('id').single();

const { fulfilInvoices } = await import('../../api/utils/fulfil.ts');
await fulfilInvoices(db, [invoice.id]);

pass('an enrolment is created', psql(`select count(*) from enrolments where course_id='${courseId}' and student_id='${studentId}';`) === '1');
pass('the booked slots become sessions', psql(`select count(*) from sessions where course_id='${courseId}';`) === '2');
pass('sessions carry the tutor', psql(`select count(*) from sessions where course_id='${courseId}' and tutor_id='${tutorId}';`) === '2');
pass('sessions keep the chosen time', psql(`select to_char(start_time,'HH24:MI') from sessions where course_id='${courseId}' limit 1;`) === '16:00');
pass('all three people are notified', psql("select count(*) from notifications where type='enrolment';") === '3');

const mail = await (await fetch('http://127.0.0.1:54324/api/v1/messages')).json();
pass('three emails are sent', mail.total === 3, `total=${mail.total}`);
const subjects = (mail.messages ?? []).map(m => m.Subject).join(' | ');
pass('the student is told they are enrolled', /You are enrolled on Chemistry/.test(subjects), subjects.slice(0, 90));
pass('the parent gets a receipt', /Payment received for Chemistry/.test(subjects));
pass('the tutor is told about the student', /joined Chemistry/.test(subjects));

// Stripe delivers a webhook and the browser also hits confirm, so this runs
// twice for one payment.
await fulfilInvoices(db, [invoice.id]);
pass('a second delivery does not enrol twice', psql(`select count(*) from enrolments where course_id='${courseId}';`) === '1');
pass('a second delivery does not duplicate sessions', psql(`select count(*) from sessions where course_id='${courseId}';`) === '2');
pass('a second delivery does not re-notify', psql("select count(*) from notifications where type='enrolment';") === '3');
const mail2 = await (await fetch('http://127.0.0.1:54324/api/v1/messages')).json();
pass('a second delivery does not re-email', mail2.total === 3, `total=${mail2.total}`);

console.log(failures === 0 ? '\nall checks passed' : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
