// The browser can write a session's notes and nothing else.
//
// A student could insert a past lesson naming any tutor and any payout, and the
// hourly job paid it from the platform balance. A tutor could raise their own
// tutor_earning_cents, or write attendance so a lesson nobody attended was never
// a no-show. 20260915000200 takes the insert away and limits updates to notes.
//
// This asserts both holes are shut and that the paths that legitimately change
// sessions still do: a tutor saving notes, and the SECURITY DEFINER functions
// that reschedule and book, which must not be caught by the new privileges.
// Local stack only; every row it makes is removed.
import { createClient } from '@supabase/supabase-js';

const URL = process.env.VITE_SUPABASE_LOCAL_URL || 'http://127.0.0.1:54321';
const ANON =
  process.env.VITE_SUPABASE_LOCAL_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SERVICE =
  process.env.SUPABASE_LOCAL_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const opts = { auth: { persistSession: false } };
const admin = createClient(URL, SERVICE, opts);
const FIXTURE = 'writes-fixture';

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
  if (!ok) failures++;
}

async function signIn(email) {
  const client = createClient(URL, ANON, opts);
  const { error } = await client.auth.signInWithPassword({ email, password: 'demo123' });
  if (error) throw new Error(`could not sign in as ${email}: ${error.message}`);
  return client;
}

const idOf = async (email) =>
  (await admin.from('profiles').select('id').eq('email', email).single()).data?.id;

const inDays = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

/** A privilege refusal, as opposed to a business rule saying no. */
const refused = (error) => !!error && (error.code === '42501' || /permission denied|only notes/i.test(error.message));

async function stored(id) {
  return (await admin.from('sessions').select('*').eq('id', id).single()).data;
}

const extraSessions = [];

async function main() {
  const tutorId = await idOf('tutor@yakal.com');
  const studentId = await idOf('student@yakal.com');
  if (!tutorId || !studentId) {
    check('seeded tutor and student exist', false, 'run npm run db:reset first');
    return;
  }

  const { data: fixture, error: fixtureErr } = await admin
    .from('sessions')
    .insert({
      student_id: studentId,
      tutor_id: tutorId,
      subject: `${FIXTURE} lesson`,
      date: inDays(10),
      start_time: '10:00',
      duration_minutes: 60,
      status: 'upcoming',
      tutor_earning_cents: 4000,
    })
    .select('*')
    .single();
  if (fixtureErr) throw new Error(`fixture: ${fixtureErr.message}`);

  const student = await signIn('student@yakal.com');
  const tutor = await signIn('tutor@yakal.com');

  // ---- a student cannot create a lesson ----
  const { error: insertErr } = await student.from('sessions').insert({
    student_id: studentId,
    tutor_id: tutorId,
    subject: `${FIXTURE} forged`,
    date: inDays(-1),
    start_time: '09:00',
    status: 'upcoming',
    tutor_earning_cents: 500000,
  });
  const { count: forged } = await admin
    .from('sessions')
    .select('id', { count: 'exact', head: true })
    .eq('subject', `${FIXTURE} forged`);
  check('a student cannot insert a lesson', refused(insertErr) && forged === 0, insertErr?.message ?? 'inserted');

  // ---- a tutor cannot touch anything that moves money ----
  const attempts = [
    ['tutor_earning_cents', 999900],
    ['attendance', [{ name: 'fake' }]],
    ['status', 'completed'],
    ['invoice_id', '00000000-0000-0000-0000-000000000000'],
    ['date', inDays(11)],
  ];
  for (const [column, value] of attempts) {
    const { error } = await tutor.from('sessions').update({ [column]: value }).eq('id', fixture.id);
    const after = await stored(fixture.id);
    const unchanged = JSON.stringify(after[column]) === JSON.stringify(fixture[column]);
    check(`a tutor cannot change ${column}`, refused(error) && unchanged, error?.message ?? `now ${JSON.stringify(after[column])}`);
  }

  // ---- notes still work, for the tutor and only the tutor ----
  const note = `verify ${Date.now()}`;
  const { error: noteErr } = await tutor.from('sessions').update({ notes: note }).eq('id', fixture.id);
  check('a tutor can still save notes', !noteErr && (await stored(fixture.id)).notes === note, noteErr?.message ?? '');

  await student.from('sessions').update({ notes: 'student wrote this' }).eq('id', fixture.id);
  check('a student cannot write the notes', (await stored(fixture.id)).notes === note);

  // ---- the SECURITY DEFINER paths are not caught by the new privileges ----
  // They may still say no for their own reasons (availability, notice, the
  // monthly limit). What must not happen is a permission error.
  const { error: moveErr } = await student.rpc('reschedule_session', {
    p_session_id: fixture.id,
    p_date: inDays(12),
    p_start_time: '11:00',
  });
  check('reschedule_session is not blocked by the privileges', !refused(moveErr), moveErr?.message ?? 'moved');

  const { data: booked, error: bookErr } = await student.rpc('book_advising_session', {
    p_student: studentId,
    p_date: inDays(14),
    p_start: '09:00',
  });
  if (booked) extraSessions.push(booked);
  check('book_advising_session is not blocked by the privileges', !refused(bookErr), bookErr?.message ?? 'booked');

  await student.auth.signOut();
  await tutor.auth.signOut();
}

try {
  await main();
} catch (e) {
  check('ran to the end', false, e.message);
} finally {
  await admin.from('sessions').delete().like('subject', `${FIXTURE}%`);
  if (extraSessions.length) await admin.from('sessions').delete().in('id', extraSessions);
}

console.log(failures === 0 ? '\nall passed' : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
