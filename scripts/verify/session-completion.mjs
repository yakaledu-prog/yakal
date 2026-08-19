// Which lessons count as finished.
//
// Sessions store a naive date and a naive time, so "has this ended" is a
// timezone question. Answering it in Node would parse '2026-08-19T14:00'
// against whatever zone the process happens to run in, which on Render is UTC
// and on a developer's laptop is not, so the same row would be judged
// differently in the two places and a tutor would be paid early or late
// depending on where the job ran. sessions_due_for_completion does it in
// Postgres instead, and this pins that the zone argument is actually honoured
// rather than decorative.
//
// Needs the local Supabase and the seeded accounts.
import { execSync } from 'node:child_process';

const psql = (sql) =>
  execSync(`PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -tAq -c "${sql}"`)
    .toString().trim();

let failures = 0;
const pass = (s, ok, d = '') => { if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${s}${d ? '  -> ' + d : ''}`); };

const tutorId = psql("select id from profiles where email='tutor@yakal.com';");
const studentId = psql("select id from profiles where role='student' limit 1;");

const cleanup = () => psql("delete from sessions where subject like 'completion-fixture%';");
cleanup();

/**
 * A session at a naive wall-clock time, expressed as an offset from now in a
 * chosen zone. Building it in SQL keeps the arithmetic in the same place the
 * function does it, so the test cannot pass by making the same mistake twice
 * in JavaScript.
 */
const makeSession = (label, zone, offset, duration = 60, status = 'upcoming') => {
  psql(
    `insert into sessions (student_id, tutor_id, subject, date, start_time, duration_minutes, status, tutor_earning_cents)
     select '${studentId}', '${tutorId}', 'completion-fixture ${label}',
            (t)::date, (t)::time, ${duration}, '${status}', 4200
       from (select (now() at time zone '${zone}') + interval '${offset}' as t) s;`
  );
  return psql(`select id from sessions where subject='completion-fixture ${label}';`);
};

const dueIn = (zone) =>
  psql(
    `select coalesce(string_agg(subject, ',' order by subject), '')
       from sessions_due_for_completion('${zone}', 200)
      where subject like 'completion-fixture%';`
  );

// A lesson that has not started cannot have finished.
makeSession('future', 'America/New_York', '3 hours');
pass('a lesson still to come is not due', !dueIn('America/New_York').includes('future'));

// One that started three hours ago and ran for an hour has.
makeSession('past', 'America/New_York', '-3 hours');
pass('a lesson that has finished is due', dueIn('America/New_York').includes('past'));

// Started 30 minutes ago, runs for an hour: finished in neither reading.
makeSession('running', 'America/New_York', '-30 minutes');
pass('a lesson still running is not due', !dueIn('America/New_York').includes('running'));

// ---- the zone actually matters ----
//
// A naive time one hour before now-in-UTC. Read as UTC it ended half an hour
// ago; read as New York, which is four or five hours behind, it has not
// started. The same row, two answers, and only the zone tells them apart.
makeSession('zoned', 'UTC', '-1 hour', 30);
pass('read as UTC, it has finished', dueIn('UTC').includes('zoned'));
pass('read as New York, it has not', !dueIn('America/New_York').includes('zoned'));

// ---- only lessons nobody has judged ----

makeSession('already-done', 'America/New_York', '-3 hours', 60, 'completed');
pass('a lesson already completed is not picked up again',
  !dueIn('America/New_York').includes('already-done'));

makeSession('called-off', 'America/New_York', '-3 hours', 60, 'cancelled');
pass('nor a cancelled one', !dueIn('America/New_York').includes('called-off'));

// ---- and nobody but the server may ask ----
//
// The function is SECURITY DEFINER and returns every family's lessons, so
// execute is granted to nobody. A signed-in user reaching it would be reading
// the whole platform's timetable.
const granted = psql(
  `select coalesce(string_agg(grantee, ','), 'none')
     from information_schema.routine_privileges
    where routine_name = 'sessions_due_for_completion'
      and grantee in ('anon', 'authenticated', 'PUBLIC');`
);
pass('no signed-in role can call the completion query', granted === 'none', granted);

cleanup();

console.log(failures === 0 ? '\nall checks passed' : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
