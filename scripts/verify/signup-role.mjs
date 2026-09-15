// Nobody signs up as an admin, and no parent claims a child they were not given.
//
// handle_new_user copied the role out of the signup request, so a public signUp
// with role "admin" created an active admin. And "Parents can create link
// requests" never checked the status, so a parent could insert an active link to
// any student and be treated as their parent everywhere. 20260915000100 closes
// both.
//
// This asserts the holes are shut and that the legitimate paths still work: a
// tutor still waits for approval, a parent can still ask, and a student can
// still accept. Local stack only; every row it makes is removed.
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

async function idOf(email) {
  const { data } = await admin.from('profiles').select('id').eq('email', email).single();
  return data?.id;
}

const created = [];

/** A fresh public signup asking for a role, and the profile it produced. */
async function signUpAs(role) {
  const email = `verify-signup-${role}-${Date.now()}@example.com`;
  const anon = createClient(URL, ANON, opts);
  const { data, error } = await anon.auth.signUp({
    email,
    password: `Verify-${Date.now()}!`,
    options: { data: { role, full_name: `Verify ${role}` } },
  });
  if (error || !data.user) return { error: error?.message ?? 'no user' };
  created.push(data.user.id);
  const { data: profile } = await admin
    .from('profiles')
    .select('role, status')
    .eq('id', data.user.id)
    .maybeSingle();
  return { profile };
}

async function main() {
  // ---- signup ----
  const asAdmin = await signUpAs('admin');
  check(
    'a signup asking for admin becomes an active student',
    asAdmin.profile?.role === 'student' && asAdmin.profile?.status === 'active',
    JSON.stringify(asAdmin.profile ?? asAdmin.error)
  );

  const asTutor = await signUpAs('tutor');
  check(
    'a tutor signup still waits for approval',
    asTutor.profile?.role === 'tutor' && asTutor.profile?.status === 'pending',
    JSON.stringify(asTutor.profile ?? asTutor.error)
  );

  const { data: seededAdmin } = await admin
    .from('profiles')
    .select('role')
    .eq('email', 'admin@yakal.com')
    .maybeSingle();
  check('the seeded admin is still an admin', seededAdmin?.role === 'admin', `role=${seededAdmin?.role}`);

  // ---- parent links ----
  // A parent and a student with no link between them, so nothing seeded is
  // disturbed and a unique pair constraint cannot get in the way.
  const parentId = await idOf('parent@yakal.com');
  const studentId = await idOf('student2@yakal.com');
  const otherParentId = await idOf('binyam2537+parent@gmail.com');
  if (!parentId || !studentId || !otherParentId) {
    check('seeded parent and students exist', false, 'run npm run db:reset first');
    return;
  }
  const { data: existingLink } = await admin
    .from('parent_student_links')
    .select('id')
    .eq('parent_id', parentId)
    .eq('student_id', studentId)
    .maybeSingle();
  if (existingLink) {
    check('the test pair starts unlinked', false, 'parent@ and student2@ are already linked');
    return;
  }

  const parent = await signIn('parent@yakal.com');
  const student = await signIn('student2@yakal.com');

  const cleanupLinks = () =>
    admin.from('parent_student_links').delete().eq('parent_id', parentId).eq('student_id', studentId);

  try {
    // The hole: an active link straight away.
    await parent.from('parent_student_links').insert({ parent_id: parentId, student_id: studentId, status: 'active' });
    const { data: forged } = await admin
      .from('parent_student_links')
      .select('status')
      .eq('parent_id', parentId)
      .eq('student_id', studentId)
      .maybeSingle();
    check('a parent cannot give themselves an active link', !forged, `stored=${JSON.stringify(forged)}`);
    await cleanupLinks();

    // The legitimate ask.
    const { error: askErr } = await parent
      .from('parent_student_links')
      .insert({ parent_id: parentId, student_id: studentId, status: 'pending' });
    const { data: pending } = await admin
      .from('parent_student_links')
      .select('id, status, parent_id')
      .eq('parent_id', parentId)
      .eq('student_id', studentId)
      .maybeSingle();
    check('a parent can still ask to link', !askErr && pending?.status === 'pending', askErr?.message ?? '');

    // The student cannot hand the request to somebody else.
    if (pending) {
      await student.from('parent_student_links').update({ parent_id: otherParentId }).eq('id', pending.id);
      const { data: afterMove } = await admin
        .from('parent_student_links')
        .select('parent_id')
        .eq('id', pending.id)
        .single();
      check('a student cannot move a link to another parent', afterMove?.parent_id === parentId, `parent_id=${afterMove?.parent_id}`);

      // And can still say yes.
      const { error: acceptErr } = await student
        .from('parent_student_links')
        .update({ status: 'active' })
        .eq('id', pending.id);
      const { data: accepted } = await admin
        .from('parent_student_links')
        .select('status')
        .eq('id', pending.id)
        .single();
      check('a student can still accept a request', !acceptErr && accepted?.status === 'active', acceptErr?.message ?? '');
    }
  } finally {
    await cleanupLinks();
    await parent.auth.signOut();
    await student.auth.signOut();
  }
}

try {
  await main();
} catch (e) {
  check('ran to the end', false, e.message);
} finally {
  for (const id of created) await admin.auth.admin.deleteUser(id);
}

console.log(failures === 0 ? '\nall passed' : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
