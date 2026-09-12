// A diagnostic is marked by the server, against a key the browser never sees.
//
// Three things used to be true at once, and together they meant a diagnostic
// score measured nothing:
//
//   diagnostics carried GRANT SELECT to anon with USING (published), and
//   questions is a jsonb blob with correctAnswer in it, so the whole key was
//   readable over REST while signed out
//
//   the student pages imported src/data/diagnostics.ts, so the key was in the
//   browser bundle regardless
//
//   saveResult() compared chosen to correct in the browser and inserted the
//   score it had worked out, and authenticated held INSERT on the results
//   table, so any score could be posted directly
//
// A tutor plans a term around these numbers. This pins that the numbers are the
// server's, not the caller's.
//
// Needs the local Supabase and the seeded diagnostics.
import { execSync } from 'node:child_process';

const psql = (sql: string) =>
  execSync(`PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -tAq -c "${sql}"`)
    .toString()
    .trim();

const asUser = (userId: string, sql: string) =>
  psql(
    `set local role authenticated; ` +
      `set local request.jwt.claims = '{\\"sub\\":\\"${userId}\\",\\"role\\":\\"authenticated\\"}'; ` +
      sql
  );

let failures = 0;
const pass = (s: string, ok: boolean, d = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${s}${d ? '  -> ' + d : ''}`);
};

const student = psql("select id from profiles where email='student@yakal.com';");
const tutor = psql("select id from profiles where email='tutor@yakal.com';");
const other = psql("select id from profiles where email='tutor2@yakal.com';");

psql(`delete from diagnostic_results where student_id='${student}' and diagnostic_slug='elem-math';`);

/**
 * The lesson that makes this tutor theirs.
 *
 * teaches_student() answers from sessions and enrolments, and the base seed
 * creates neither: this check only ever passed on whatever a previous
 * scenarios run had left lying around, so a clean db:reset failed it and a
 * scenarios clear failed it again. It sets up its own relationship now, and
 * takes it away at the end, the way it already does for the result rows.
 */
const FIXTURE = 'verify-diagnostic-scoring';
psql(`delete from sessions where subject='${FIXTURE}';`);
psql(`
  insert into sessions (student_id, tutor_id, subject, date, start_time, status)
  values ('${student}', '${tutor}', '${FIXTURE}', current_date - 7, '10:00', 'completed');
`);

// ---- the key does not leave the server ----
pass(
  'anon cannot read the diagnostics table',
  psql(
    "select has_table_privilege('anon','public.diagnostics','SELECT')::text;"
  ) === 'false'
);

const studentView = asUser(student, "select questions::text from public.student_diagnostics() where slug='elem-math';");
pass('a student is given the questions', studentView.includes('What is 15% of 200?'), studentView.slice(0, 70));
pass('but never the correct index', !studentView.includes('correctAnswer'));
pass('and never the explanation, which gives it away too', !studentView.toLowerCase().includes('explanation'));

// ---- the browser cannot write a result ----
let inserted = true;
try {
  asUser(student, `insert into diagnostic_results (student_id, diagnostic_slug, score, total, answers) values ('${student}','elem-math',2,2,'[]'::jsonb);`);
} catch {
  inserted = false;
}
pass('a student cannot insert a result directly', !inserted);

// ---- the server marks it ----
const honest = asUser(
  student,
  `select score || '/' || total from public.submit_diagnostic('elem-math', '[{\\"question_id\\":\\"q1\\",\\"chosen\\":2},{\\"question_id\\":\\"q2\\",\\"chosen\\":1}]'::jsonb);`
);
pass('two right answers score two', honest === '2/2', honest);

const lying = asUser(
  student,
  `select score || '/' || total from public.submit_diagnostic('elem-math', '[{\\"question_id\\":\\"q1\\",\\"chosen\\":0,\\"correct\\":0},{\\"question_id\\":\\"q2\\",\\"chosen\\":0,\\"correct\\":0}]'::jsonb);`
);
pass('claiming what is correct changes nothing', lying === '0/2', lying);

const padded = asUser(
  student,
  `select score || '/' || total from public.submit_diagnostic('elem-math', '[{\\"question_id\\":\\"q1\\",\\"chosen\\":2},{\\"question_id\\":\\"nope\\",\\"chosen\\":0}]'::jsonb);`
);
pass('invented questions do not pad the total', padded === '1/2', padded);

const short = asUser(
  student,
  `select score || '/' || total from public.submit_diagnostic('elem-math', '[{\\"question_id\\":\\"q1\\",\\"chosen\\":2}]'::jsonb);`
);
pass('leaving one out does not shorten the total', short === '1/2', short);

// ---- the stored row can answer the review on its own ----
const stored = psql(
  `select answers::text from diagnostic_results where student_id='${student}' and diagnostic_slug='elem-math' order by completed_at desc limit 1;`
);
pass('the correct index is stored with the answer', stored.includes('"correct"'));
pass('and the explanation, so review needs no key', stored.includes('"explanation"'));

// ---- who may read it ----
pass(
  'the tutor who teaches them can read it',
  asUser(tutor, `select count(*)::text from diagnostic_results where student_id='${student}';`) !== '0'
);
pass(
  'a tutor who does not cannot',
  asUser(other, `select count(*)::text from diagnostic_results where student_id='${student}';`) === '0'
);

psql(`delete from diagnostic_results where student_id='${student}' and diagnostic_slug='elem-math';`);
psql(`delete from sessions where subject='${FIXTURE}';`);

console.log(failures === 0 ? '\nall checks passed' : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
