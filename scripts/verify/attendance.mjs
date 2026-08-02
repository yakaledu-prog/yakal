// Attendance: precise edges from the Zoom SDK, robust minutes from the beat.
//
// None of this touches the Zoom API, which is the point: participant reporting
// is a paid-plan feature, and everything here is either a client-side SDK event
// or a row in our own database. The tests run entirely against Postgres for the
// same reason a real meeting is not needed to trust it.
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const CONN = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const TMP = '/tmp/claude-1000/-home-binyam-products-yakal/470a1a43-cc42-4652-988d-ac4539a37912/scratchpad/att-verify.sql';

const psql = (sql) => {
  writeFileSync(TMP, sql);
  return execSync(`psql "${CONN}" -v ON_ERROR_STOP=1 -tAq -f ${TMP}`, {
    stdio: ['pipe', 'pipe', 'pipe'],
  }).toString().trim();
};

let failures = 0;
const pass = (s, ok, d = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${s}${d ? '  -> ' + d : ''}`);
};

const ids = psql(`
  select s.id, s.tutor_id, s.student_id
  from public.sessions s
  where s.tutor_id is not null and s.student_id is not null
  order by s.id limit 1`).split('|');
const [sessionId, tutorId, studentId] = ids;

/** Runs a script as one user, inside a transaction, and rolls it back. */
const asUser = (userId, body) =>
  psql(
    `begin;\n` +
    `update public.sessions set date = current_date,\n` +
    `  start_time = to_char(now() - interval '5 minutes', 'HH24:MI:SS')::time\n` +
    `  where id = '${sessionId}';\n` +
    `select set_config('request.jwt.claims',\n` +
    `  '{"sub":"${userId}","role":"authenticated"}', true);\n` +
    body +
    `\nrollback;`
  )
    .split('\n')
    // set_config echoes the claims it was given; that is plumbing, not a result.
    .filter((line) => line.trim() && !line.includes('"role":"authenticated"'));

// ---------- the edges ----------

let out = asUser(studentId, `
  select 'join   ' || public.record_attendance_event('${sessionId}', 'join');
  select 'joined_at set: ' || (first_joined_at is not null)::text
    from public.session_attendance where session_id = '${sessionId}';
`);
pass('a join opens the record at zero seconds', out[0] === 'join   0', out[0]);
pass('and stamps when they arrived', out[1] === 'joined_at set: true', out[1]);

// A leave banks the tail between the last beat and the meeting ending, which
// is exactly what a coarse heartbeat loses.
out = asUser(studentId, `
  select public.record_attendance_event('${sessionId}', 'join');
  update public.session_attendance set last_seen_at = last_seen_at - interval '95 seconds'
    where session_id = '${sessionId}';
  select 'leave  ' || public.record_attendance_event('${sessionId}', 'leave');
  select 'left_at set: ' || (last_left_at is not null)::text
    from public.session_attendance where session_id = '${sessionId}';
`);
pass('a leave banks the tail since the last beat', out[1] === 'leave  95', out[1]);
pass('and stamps when they went', out[2] === 'left_at set: true', out[2]);

// Rejoining must not rewrite when they first arrived, or a dropout at the end
// would read as a very short lesson.
out = asUser(studentId, `
  select public.record_attendance_event('${sessionId}', 'join');
  update public.session_attendance set first_joined_at = first_joined_at - interval '20 minutes'
    where session_id = '${sessionId}';
  select public.record_attendance_event('${sessionId}', 'join');
  select 'first join held: ' ||
    (extract(epoch from now() - first_joined_at) > 60)::text
    from public.session_attendance where session_id = '${sessionId}';
`);
pass('rejoining keeps the original arrival', out[2] === 'first join held: true', out[2]);

// The gap before a join is time they were not in the meeting.
out = asUser(studentId, `
  select public.record_attendance_event('${sessionId}', 'join');
  update public.session_attendance set last_seen_at = last_seen_at - interval '40 minutes'
    where session_id = '${sessionId}';
  select 'after long gap then join: ' || public.record_attendance_event('${sessionId}', 'join');
`);
pass('a gap before rejoining is not credited', out[1].endsWith(': 0'), out[1]);

// ---------- the same guards as the heartbeat ----------

out = asUser(studentId, `
  update public.sessions set date = current_date + 40 where id = '${sessionId}';
  select 'out of window: ' || public.record_attendance_event('${sessionId}', 'join');
`);
pass('an edge outside the booked window is refused', out[0] === 'out of window: 0', out[0]);

const stranger = psql(
  `select id from public.profiles where id not in ('${tutorId}','${studentId}') order by id limit 1`
);
out = asUser(stranger, `
  select 'stranger: ' || public.record_attendance_event('${sessionId}', 'join');
`);
pass('somebody else\'s session is refused', out[0] === 'stranger: 0', out[0]);

out = asUser(studentId, `
  select 'nonsense event: ' || public.record_attendance_event('${sessionId}', 'dancing');
`);
pass('an event that is not join or leave is refused', out[0] === 'nonsense event: 0', out[0]);

// ---------- did both sides turn up ----------

out = psql(
  `begin;\n` +
  `update public.sessions set date = current_date,\n` +
  `  start_time = to_char(now() - interval '5 minutes', 'HH24:MI:SS')::time where id = '${sessionId}';\n` +
  `select set_config('request.jwt.claims', '{"sub":"${studentId}","role":"authenticated"}', true);\n` +
  `select public.record_attendance_event('${sessionId}', 'join');\n` +
  `select set_config('request.jwt.claims', '{"sub":"${tutorId}","role":"authenticated"}', true);\n` +
  `select public.record_attendance_event('${sessionId}', 'join');\n` +
  `select 'both: ' || tutor_present::text || ',' || student_present::text\n` +
  `  from public.v_session_attendance_summary where session_id = '${sessionId}';\n` +
  `rollback;`
).split('\n').filter((l) => l.trim() && !l.includes('"role":"authenticated"'));
pass('the summary sees both sides', out[out.length - 1] === 'both: true,true', out[out.length - 1]);

out = psql(
  `begin;\n` +
  `update public.sessions set date = current_date,\n` +
  `  start_time = to_char(now() - interval '5 minutes', 'HH24:MI:SS')::time where id = '${sessionId}';\n` +
  `select set_config('request.jwt.claims', '{"sub":"${studentId}","role":"authenticated"}', true);\n` +
  `select public.record_attendance_event('${sessionId}', 'join');\n` +
  `select 'one side: ' || tutor_present::text || ',' || student_present::text\n` +
  `  from public.v_session_attendance_summary where session_id = '${sessionId}';\n` +
  `rollback;`
).split('\n').filter((l) => l.trim() && !l.includes('"role":"authenticated"'));
pass(
  'and reports a no-show as a no-show',
  out[out.length - 1] === 'one side: false,true',
  out[out.length - 1]
);

// ---------- the beat still works on its own ----------
//
// The case the events cannot cover: a browser killed outright, where nothing
// ever reports a leave. The minutes still have to be right.

out = asUser(studentId, `
  select public.record_attendance('${sessionId}');
  update public.session_attendance set last_seen_at = last_seen_at - interval '60 seconds'
    where session_id = '${sessionId}';
  select 'beat  ' || public.record_attendance('${sessionId}');
  update public.session_attendance set last_seen_at = last_seen_at - interval '3 hours'
    where session_id = '${sessionId}';
  select 'capped ' || public.record_attendance('${sessionId}');
`);
pass('the heartbeat still accrues without any event', out[1] === 'beat  60', out[1]);
pass('and a silent client is capped, not trusted', out[2] === 'capped 180', out[2]);

// ---------- nobody can write these rows directly ----------

let blocked = false;
try {
  psql(
    `begin;\n` +
    `set local role authenticated;\n` +
    `select set_config('request.jwt.claims', '{"sub":"${studentId}","role":"authenticated"}', true);\n` +
    `insert into public.session_attendance (session_id, user_id, role, seconds)\n` +
    `  values ('${sessionId}', '${studentId}', 'student', 999999);\n` +
    `commit;`
  );
} catch (e) {
  blocked = /row-level security|permission denied/i.test(e.stderr?.toString() ?? '');
}
pass('a client cannot write its own minutes', blocked);

console.log(failures === 0 ? '\nall good' : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
