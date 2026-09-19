// Mock interviews can be booked, count per plan, and count as delivery.
//
// Premier and Elite sell mock interviews and the tier has carried a limit for
// months, but nothing could book one. This drives book_mock_interview as the
// family would, against a fixture tier whose limit it sets, and checks the
// two rules that ride along: a month whose only delivery was an interview
// releases the counsellor's pay, and only the student's own counsellor can log
// an essay review round.
//
// Needs the local Supabase and the seeded accounts (student@ has a live plan
// with counselor@; student2@ does not). Puts student@'s plan back on its own
// tier and removes everything it made.
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const URL = 'http://127.0.0.1:54321';
const ANON =
  process.env.VITE_SUPABASE_LOCAL_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SERVICE =
  process.env.SUPABASE_LOCAL_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const opts = { auth: { persistSession: false } };
const db = createClient(URL, SERVICE, opts);

let failures = 0;
const pass = (s: string, ok: boolean, d = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${s}${d ? '  -> ' + d : ''}`);
};

async function as(email: string) {
  const c = createClient(URL, ANON, opts);
  const { data, error } = await c.auth.signInWithPassword({ email, password: 'demo123' });
  if (error) throw new Error(`could not sign in as ${email}: ${error.message}`);
  return { c, id: data.user!.id };
}

const MARK = `mock-interviews-verify-${Date.now()}`;
const student = await as('student@yakal.com');
const student2 = await as('student2@yakal.com');
const counselor = await as('counselor@yakal.com');

const { data: plan } = await db
  .from('admissions_plans')
  .select('id, tier_id, counselor_id, created_at')
  .eq('student_id', student.id)
  .in('status', ['active', 'past_due'])
  .single();
if (!plan) throw new Error('student@ needs a live plan');

const { data: tier } = await db
  .from('admissions_tiers')
  .insert({ key: MARK, name: MARK, price_cents: 100, mock_interviews_limit: 1, is_active: false })
  .select('id')
  .single();

const essayIds: string[] = [];
// Far off, at an odd minute, so no real booking is in the way.
const slot = (month: number, day: number) => ({
  p_student: student.id,
  p_date: `2098-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
  p_start: '05:13',
  p_duration: 60,
});
const setLimit = (limit: number | null) =>
  db.from('admissions_tiers').update({ mock_interviews_limit: limit }).eq('id', tier!.id);

try {
  await db.from('admissions_plans').update({ tier_id: tier!.id }).eq('id', plan.id);

  // ---- a limit of one, over the plan ----
  let r = await student.c.rpc('book_mock_interview', slot(3, 2));
  pass('a student books a mock interview', !r.error && !!r.data, r.error?.message);
  const first = r.data as string;

  const { data: row } = await db.from('sessions').select('kind, tutor_id, subject').eq('id', first).single();
  pass('with their counsellor, as a mock interview', row?.kind === 'mock_interview' && row?.tutor_id === plan.counselor_id, JSON.stringify(row));

  r = await student.c.rpc('book_mock_interview', slot(3, 9));
  pass('a second is refused on a plan with one', !!r.error, r.error?.message ?? 'booked');
  r = await student.c.rpc('book_mock_interview', slot(7, 9));
  pass('in a later month too, since it does not refill', !!r.error, r.error?.message ?? 'booked');

  r = await student.c.rpc('cancel_advising_session', { p_session: first });
  pass('cancelling it before it starts works', !r.error, r.error?.message);
  r = await student.c.rpc('book_mock_interview', slot(3, 16));
  pass('and gives the interview back', !r.error, r.error?.message);

  // ---- none, and unlimited ----
  await setLimit(0);
  r = await student.c.rpc('book_mock_interview', slot(4, 2));
  pass('a plan with none is refused', !!r.error && /does not include/.test(r.error.message), r.error?.message ?? 'booked');

  await setLimit(null);
  r = await student.c.rpc('book_mock_interview', slot(4, 9));
  const r2 = await student.c.rpc('book_mock_interview', slot(4, 16));
  pass('an unlimited plan books as many as asked', !r.error && !r2.error, r.error?.message ?? r2.error?.message);

  // ---- who may book ----
  r = await student2.c.rpc('book_mock_interview', slot(5, 2));
  pass("another student cannot book on somebody else's plan", !!r.error, r.error?.message ?? 'booked');

  // ---- an interview is delivery ----
  const { data: held } = await db
    .from('sessions')
    .insert({
      student_id: student.id, tutor_id: plan.counselor_id, kind: 'mock_interview', subject: MARK,
      date: '2021-06-10', start_time: '05:13', duration_minutes: 60, mode: 'online', status: 'completed',
    })
    .select('id')
    .single();
  const { data: delivered, error: dErr } = await db.rpc('counselling_period_delivered', {
    p_plan: plan.id,
    p_from: '2021-06-01T00:00:00Z',
    p_to: '2021-07-01T00:00:00Z',
  });
  pass("a month whose only session was a mock interview counts as delivered", delivered === true, dErr?.message ?? String(delivered));
  await db.from('sessions').delete().eq('id', held!.id);

  // ---- essay reviews ----
  const { data: own } = await db.from('essays').insert({ student_id: student.id, title: MARK, kind: 'supplement' }).select('id').single();
  const { data: other } = await db.from('essays').insert({ student_id: student2.id, title: MARK, kind: 'supplement' }).select('id').single();
  essayIds.push(own!.id, other!.id);

  let e = await counselor.c.from('essay_reviews').insert({ essay_id: own!.id, counselor_id: counselor.id, action: 'returned', note: MARK });
  pass("a counsellor can review their own advisee's essay", !e.error, e.error?.message);
  e = await counselor.c.from('essay_reviews').insert({ essay_id: other!.id, counselor_id: counselor.id, action: 'returned', note: MARK });
  pass("but not a student who is not theirs", !!e.error, e.error?.message ?? 'inserted');

  await db.from('essay_reviews').insert({ essay_id: other!.id, counselor_id: counselor.id, action: 'returned', note: MARK });
  const seen = await counselor.c.from('essay_reviews').select('id').eq('essay_id', other!.id);
  pass("nor read that student's review history", (seen.data ?? []).length === 0, seen.error?.message ?? `${(seen.data ?? []).length} rows`);
  const family = await student2.c.from('essay_reviews').select('id').eq('essay_id', other!.id);
  pass('which the student still can', (family.data ?? []).length === 1, family.error?.message ?? `${(family.data ?? []).length} rows`);
} finally {
  await db.from('admissions_plans').update({ tier_id: plan.tier_id }).eq('id', plan.id);
  await db.from('sessions').delete().eq('student_id', student.id).eq('kind', 'mock_interview').gte('date', '2098-01-01');
  await db.from('sessions').delete().eq('subject', MARK);
  await db.from('essay_reviews').delete().eq('note', MARK);
  if (essayIds.length) await db.from('essays').delete().in('id', essayIds);
  await db.from('admissions_tiers').delete().eq('id', tier!.id);
}

console.log(failures === 0 ? '\nall passed' : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
