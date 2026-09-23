// A profile is readable by the people it has something to do with, and nobody else.
//
// The policy was USING (true) for every signed-in user: one student account
// could read all 25 rows, names, emails and roles, other families included.
// Closing the five private columns (20260920000400) was the other half of the
// same job; this checks the rows themselves.
//
// What must keep working matters as much as what must stop: a family browsing
// the catalogue reads tutors they have no relationship with yet, and every
// dashboard reads the people it works with.
//
// Needs the local Supabase and the seeded accounts.
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
const anon = createClient(URL, ANON, opts);

let failures = 0;
const pass = (s: string, ok: boolean, d = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${s}${d ? '  -> ' + d : ''}`);
};

async function as(email: string) {
  const c = createClient(URL, ANON, opts);
  const { data, error } = await c.auth.signInWithPassword({ email, password: 'demo123' });
  if (error) throw new Error(`could not sign in as ${email}: ${error.message}`);
  return { c, id: data.user!.id, email };
}

const canSee = async (who: { c: any }, id: string) =>
  ((await who.c.from('profiles').select('id').eq('id', id)).data ?? []).length === 1;

const [student, parent, counselor, tutor, admin] = await Promise.all(
  ['student@yakal.com', 'parent@yakal.com', 'counselor@yakal.com', 'tutor@yakal.com', 'admin@yakal.com'].map(as)
);

const rows = (await db.from('profiles').select('id, email, role, status')).data ?? [];
const total = rows.length;

// Somebody with no tie to this student: another family's parent.
const otherParent = rows.find(
  (r: any) => r.role === 'parent' && r.id !== parent.id
) as any;

// ---- what must be hidden ----
const seen = (await student.c.from('profiles').select('id')).data ?? [];
pass(
  'a student no longer reads the whole table',
  seen.length < total,
  `${seen.length} of ${total} rows`
);
if (otherParent) {
  pass("a student cannot read another family's parent", !(await canSee(student, otherParent.id)));
}

const otherStudents = rows.filter((r: any) => r.role === 'student' && r.id !== student.id) as any[];
const unrelated: any[] = [];
for (const s of otherStudents) if (!(await canSee(student, s.id))) unrelated.push(s);
pass('students outside their own circle are hidden', unrelated.length > 0, `${unrelated.length} of ${otherStudents.length} hidden`);

// ---- what must keep working ----
pass('everybody reads their own profile', await canSee(student, student.id));
pass('a student reads their counsellor', await canSee(student, counselor.id));
pass('a student reads their linked parent', await canSee(student, parent.id));
pass('a parent reads their child', await canSee(parent, student.id));
pass("a parent reads their child's counsellor", await canSee(parent, counselor.id));
pass('a counsellor reads their advisee', await canSee(counselor, student.id));

// The catalogue: staff are already public on the marketing site.
const staff = rows.filter((r: any) => ['tutor', 'counselor'].includes(r.role) && r.status === 'active') as any[];
let staffVisible = 0;
for (const s of staff) if (await canSee(student, s.id)) staffVisible += 1;
pass('a family can still browse every active tutor and counsellor', staffVisible === staff.length, `${staffVisible} of ${staff.length}`);

const adminSees = ((await admin.c.from('profiles').select('id')).data ?? []).length;
pass('an admin still reads everyone', adminSees === total, `${adminSees} of ${total}`);

// Support: messageable_contacts offers every admin to everybody, so the row
// behind that name has to be readable or the contact panel comes up blank.
const admins = rows.filter((r: any) => r.role === 'admin' && r.status === 'active') as any[];
let adminsVisible = 0;
for (const a of admins) if (await canSee(student, a.id)) adminsVisible += 1;
pass('a student can see the admins they can write to', adminsVisible === admins.length, `${adminsVisible} of ${admins.length}`);

// A tutor and the student they teach.
const taught = (await db.from('sessions').select('student_id').eq('tutor_id', tutor.id).limit(1).maybeSingle()).data as any;
if (taught?.student_id) {
  pass('a tutor reads the student they teach', await canSee(tutor, taught.student_id));
} else {
  console.log('skip  this tutor has no booked lesson, so that pair was not checked');
}

// ---- the doors that were already shut ----
const { data: leaked } = await anon.from('profiles').select('id');
pass('signed out still reads nothing', (leaked ?? []).length === 0);
const { error: viewErr, data: tutors } = await anon.from('v_public_tutors').select('id, full_name');
pass('the public tutor list still works', !viewErr && (tutors ?? []).length > 0, viewErr?.message);

// Messaging is the same relationship set, so it must not have narrowed.
const { data: contacts, error: cErr } = await student.c.rpc('messageable_contacts');
pass('a student can still start the conversations they could before', !cErr && (contacts ?? []).length > 0, cErr?.message ?? `${(contacts ?? []).length} contacts`);

console.log(failures === 0 ? '\nall passed' : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
