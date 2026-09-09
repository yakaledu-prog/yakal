// Who each role may start a conversation with.
//
// This exists because the function broke without anything noticing.
// 20260906000100_course_tutors dropped courses.tutor_id, and
// messageable_contacts still joined courses to read it. Postgres resolves a SQL
// function body at call time rather than at creation time, so the migration
// applied cleanly and every call afterwards raised
//
//   ERROR:  column c.tutor_id does not exist
//
// which reached the browser as a 400 and an empty contact list. A student with
// no conversations was shown "start a new chat with one of the people listed
// there" beside nothing at all, and could message nobody.
//
// So this asserts the shape of the answer for each role, and that the function
// runs at all, which is the part that was actually missing.
//
// Needs the local Supabase and the seeded accounts.
import { execSync } from 'node:child_process';

const psql = (sql: string) =>
  execSync(`PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -tAq -c "${sql}"`)
    .toString()
    .trim();

let failures = 0;
const pass = (s: string, ok: boolean, d = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${s}${d ? '  -> ' + d : ''}`);
};

const idOf = (email: string) => psql(`select id from profiles where email='${email}';`);

/** The function as a given user sees it. */
const contactsFor = (userId: string): string[] => {
  const out = psql(
    `set local role authenticated; ` +
      `set local request.jwt.claims = '{\\"sub\\":\\"${userId}\\",\\"role\\":\\"authenticated\\"}'; ` +
      `select full_name from public.messageable_contacts() order by full_name;`
  );
  return out.split('\n').map((l) => l.trim()).filter(Boolean);
};

const amen = idOf('student@yakal.com');       // enrolled, has a counsellor and a parent
const selam = idOf('student2@yakal.com');     // no relationships at all
const tutor = idOf('tutor@yakal.com');
const parent = idOf('parent@yakal.com');

// The regression itself: it used to throw here rather than return anything.
let ran = true;
let amenContacts: string[] = [];
try {
  amenContacts = contactsFor(amen);
} catch {
  ran = false;
}
pass('the function runs at all', ran);
if (!ran) {
  console.log('\n1 check(s) failed');
  process.exit(1);
}

pass('a student reaches their own tutor', amenContacts.includes('Bethlehem Alemu'), amenContacts.join(', '));
pass('a student reaches their counsellor', amenContacts.includes('Daniel Haile'));
pass('a student reaches their linked parent', amenContacts.includes('Tigist Worku'));
pass('a student never reaches another student', !amenContacts.includes('Selam Girma'));

const selamContacts = contactsFor(selam);
pass(
  'a student with no relationships still reaches support',
  selamContacts.length > 0 && selamContacts.every((n) => n.includes('admin') || n === 'Almaz Tadesse' || n === 'Yakal Education'),
  selamContacts.join(', ')
);
pass('and reaches nobody else', !selamContacts.includes('Bethlehem Alemu') && !selamContacts.includes('Daniel Haile'));

const tutorContacts = contactsFor(tutor);
pass('a tutor reaches their own student', tutorContacts.includes('Amen Worku'), tutorContacts.join(', '));
pass("a tutor reaches the parent of that student", tutorContacts.includes('Tigist Worku'));
pass('a tutor does not reach an unrelated student', !tutorContacts.includes('Selam Girma'));

const parentContacts = contactsFor(parent);
pass('a parent reaches their child', parentContacts.includes('Amen Worku'), parentContacts.join(', '));
pass('a parent reaches the people teaching their child', parentContacts.includes('Bethlehem Alemu'));

console.log(failures === 0 ? '\nall checks passed' : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
