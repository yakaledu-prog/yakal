// A full refund ends what the payment bought; a dispute cancels what is still to come.
//
// Before this, a refund only undid the money. The family got their card
// credited and kept the upcoming lessons, the course and the counselling plan.
// This drives endAccessForInvoice against real local rows: a tutoring purchase
// refunded, another disputed, and a counselling plan refunded.
//
// Needs the local Supabase. Makes no Stripe call (the plan here has no
// subscription), sends admin notices to Mailpit only, and removes its rows.
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const { endAccessForInvoice } = await import('../../api/_utils/refunds.js');

const SERVICE =
  process.env.SUPABASE_LOCAL_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const db = createClient('http://127.0.0.1:54321', SERVICE, { auth: { persistSession: false } });

let failures = 0;
const pass = (s: string, ok: boolean, d = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${s}${d ? '  -> ' + d : ''}`);
};

const MARK = `[verify refund-ends-access ${Date.now()}]`;
const one = async (q: PromiseLike<{ data: any; error: any }>) => {
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data;
};

// A student with no live plan, so a plan can be made for them.
const students: any[] = await one(db.from('profiles').select('id').eq('role', 'student'));
const live: any[] = await one(db.from('admissions_plans').select('student_id').in('status', ['active', 'past_due']));
const studentId = students.map((s) => s.id).find((id) => !live.some((p) => p.student_id === id));
const parentId = (await one(db.from('profiles').select('id').eq('role', 'parent').limit(1).single())).id;
const tutorId = (await one(db.from('profiles').select('id').eq('role', 'tutor').limit(1).single())).id;
const tierId = (await one(db.from('admissions_tiers').select('id').limit(1).single())).id;
const enrolled: any[] = await one(db.from('enrolments').select('course_id').eq('student_id', studentId).eq('status', 'active'));
const courses: any[] = await one(db.from('courses').select('id'));
const courseIds = courses.map((c) => c.id).filter((id) => !enrolled.some((e) => e.course_id === id));
if (!studentId || courseIds.length < 2) throw new Error('need a student with no plan and two courses they are not on');

const invoiceIds: string[] = [];
async function purchase(courseId: string, day: string) {
  const inv = await one(
    db.from('invoices')
      .insert({ parent_id: parentId, student_id: studentId, description: MARK, amount_cents: 7000, kind: 'tutoring', status: 'paid', course_id: courseId, tutor_id: tutorId })
      .select('id').single()
  );
  invoiceIds.push(inv.id);
  await one(db.from('enrolments').insert({ course_id: courseId, student_id: studentId, purchased_by: parentId, invoice_id: inv.id }).select('id'));
  // Far in the future and at odd minutes, clear of anybody's real slots.
  const lesson = (date: string, status: string) => ({
    student_id: studentId, tutor_id: tutorId, subject: MARK, date, start_time: '03:17', status, invoice_id: inv.id, kind: 'lesson',
  });
  const rows = await one(
    db.from('sessions').insert([lesson(`2099-01-${day}`, 'upcoming'), lesson(`2099-02-${day}`, 'upcoming'), lesson(`2020-01-${day}`, 'completed')]).select('id, status')
  );
  const upcoming = rows.find((r: any) => r.status === 'upcoming');
  await one(db.from('earnings').insert({ payee_id: tutorId, kind: 'tutoring_session', amount_cents: 3000, status: 'pending', session_id: upcoming.id, invoice_id: inv.id }).select('id'));
  return inv.id as string;
}

const statusOf = async (invoiceId: string) => ({
  sessions: ((await one(db.from('sessions').select('status, date').eq('invoice_id', invoiceId).order('date'))) as any[]).map((s) => s.status),
  enrolment: (await one(db.from('enrolments').select('status').eq('invoice_id', invoiceId).single())).status,
  earning: (await one(db.from('earnings').select('status').eq('invoice_id', invoiceId).single())).status,
});

try {
  // ---- a tutoring purchase, refunded in full ----
  const refunded = await purchase(courseIds[0], '05');
  let r = await endAccessForInvoice(db, refunded, 'refund');
  let s = await statusOf(refunded);
  pass('both upcoming lessons are cancelled', r.sessionsCancelled === 2 && s.sessions.filter((x) => x === 'cancelled').length === 2, JSON.stringify(s.sessions));
  pass('the lesson that already happened is left alone', s.sessions.includes('completed'));
  pass('the course access ends', s.enrolment === 'cancelled', s.enrolment);
  pass("and the tutor's pending pay for it is cancelled", s.earning === 'cancelled', s.earning);

  r = await endAccessForInvoice(db, refunded, 'refund');
  pass('running it again changes nothing', r.sessionsCancelled === 0 && r.enrolmentsEnded === 0, JSON.stringify(r));

  // ---- a tutoring purchase, disputed ----
  const disputed = await purchase(courseIds[1], '06');
  r = await endAccessForInvoice(db, disputed, 'dispute');
  s = await statusOf(disputed);
  pass('a dispute cancels the upcoming lessons', r.sessionsCancelled === 2, JSON.stringify(s.sessions));
  pass('but leaves the course, since a dispute can be won', s.enrolment === 'active', s.enrolment);

  // ---- a counselling plan, refunded ----
  const planInvoice = await one(
    db.from('invoices')
      .insert({ parent_id: parentId, student_id: studentId, description: MARK, amount_cents: 12000, kind: 'admissions', status: 'paid', admissions_tier_id: tierId })
      .select('id').single()
  );
  invoiceIds.push(planInvoice.id);
  const plan = await one(
    db.from('admissions_plans').insert({ student_id: studentId, tier_id: tierId, purchased_by: parentId, invoice_id: planInvoice.id, status: 'active' }).select('id').single()
  );
  r = await endAccessForInvoice(db, planInvoice.id, 'refund');
  const planNow = (await one(db.from('admissions_plans').select('status').eq('id', plan.id).single())).status;
  pass('a refunded plan ends now, not at the end of the month', r.planEnded && planNow === 'canceled', planNow);
} finally {
  await db.from('earnings').delete().in('invoice_id', invoiceIds);
  await db.from('sessions').delete().in('invoice_id', invoiceIds);
  await db.from('enrolments').delete().in('invoice_id', invoiceIds);
  await db.from('admissions_plans').delete().in('invoice_id', invoiceIds);
  await db.from('invoices').delete().in('id', invoiceIds);
}

console.log(failures === 0 ? '\nall passed' : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
