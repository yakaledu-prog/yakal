// An advising hour gets a room of its own, and an empty one is not delivery.
//
// The bug this pins runs the whole length of the platform. book_advising_session
// is a database function, so it cannot call Zoom, and it wrote the row with no
// zoom_meeting_id. Joining fell back to the counsellor's personal room: one URL
// shared by every student they see. Both attendance systems are keyed on a
// meeting id the row did not have, the webhook because it matches on it and the
// in-app heartbeat because its page is only routed to when one exists. With no
// attendance the no-show branch of the scheduled job could never fire, so every
// advising hour completed itself, and a completed advising hour is the whole of
// what counselling_period_delivered asks before releasing a counsellor's month.
//
// A counsellor who never turned up was paid, and nothing could tell.
//
// What is asserted here:
//
//   the sweep picks up a booked session with no room, and leaves alone one that
//   already has one or has already happened
//   only the family, the counsellor on it, or an admin may ask for a room
//   asking twice does not book a second meeting
//   a no-show advising hour does not satisfy the delivery gate, which is the
//   property that makes all of the above worth having
//
// The sweep's choice of sessions is checked through an injected stand-in, so
// that half needs no Zoom. The handler is allowed to reach the real one, which
// books a real meeting when Zoom is configured; every fixture meeting is taken
// off the account again at the end, because a check that litters somebody's
// Zoom calendar is worse than no check.
//
// Needs the local Supabase and the seeded accounts.
import 'dotenv/config';
import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { getServiceClient } from '../../api/_utils/supabase.js';
import { attachMissingMeetings } from '../../api/_handlers/run-jobs.js';
import { deleteMeeting, zoomConfigured } from '../../api/_utils/zoom.js';

const psql = (sql: string) =>
  execSync(`PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -tAq -c "${sql}"`)
    .toString()
    .trim();

let failures = 0;
const pass = (s: string, ok: boolean, d = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${s}${d ? '  -> ' + d : ''}`);
};

const handler = (await import('../../api/_handlers/session-meeting.js')).default;

async function call(token: string, body: Record<string, unknown>) {
  const out: any = {};
  const res: any = {
    status(c: number) { out.code = c; return res; },
    json(b: any) { out.body = b; return out; },
    end() { return out; },
  };
  await handler({ method: 'POST', headers: { authorization: `Bearer ${token}` }, body } as any, res);
  return out;
}

const url = process.env.VITE_SUPABASE_LOCAL_URL!;
const anon = process.env.VITE_SUPABASE_LOCAL_ANON_KEY!;
const signIn = async (email: string) => {
  const c = createClient(url, anon, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: 'demo123' });
  if (error) throw new Error(`${email}: ${error.message}`);
  return data.session!.access_token;
};

const FIXTURE = 'advising-meeting-fixture';
const studentId = psql("select id from profiles where email='student@yakal.com';");
const counselorId = psql("select id from profiles where email='counselor@yakal.com';");

/**
 * Take every meeting this check booked back off the account, then drop the
 * rows. Meetings first: once the row is gone so is the id, and the meeting
 * sits on somebody's real Zoom calendar forever.
 */
async function clean() {
  const ids = psql(
    `select coalesce(string_agg(zoom_meeting_id, ','), '') from sessions
      where subject like '${FIXTURE}%' and zoom_meeting_id is not null;`
  );
  for (const id of ids.split(',').filter(Boolean)) {
    await deleteMeeting(id).catch(() => {});
  }
  psql(`delete from sessions where subject like '${FIXTURE}%';`);
}

/** One advising hour, however far ahead and in whatever state. */
function seed(tag: string, opts: { days: number; status?: string; meeting?: string | null }) {
  const meeting = opts.meeting ? `'${opts.meeting}'` : 'null';
  return psql(`
    insert into sessions (student_id, tutor_id, subject, date, start_time, duration_minutes,
                          status, kind, zoom_meeting_id)
    values ('${studentId}', '${counselorId}', '${FIXTURE}-${tag}',
            current_date + ${opts.days}, '10:00', 60,
            '${opts.status ?? 'upcoming'}', 'advising', ${meeting})
    returning id;`);
}

await clean();

// --- the sweep picks the right sessions ------------------------------------

const needsOne = seed('needs-room', { days: 3 });
const hasOne = seed('has-room', { days: 4, meeting: '123456789' });
const alreadyRan = seed('already-ran', { days: -3 });

const asked: string[] = [];
const fakeAttach = async (_db: any, session: any) => {
  asked.push(session.id);
  return true;
};

const swept = await attachMissingMeetings(getServiceClient(), fakeAttach as any);

pass('a booked session with no room is swept up', asked.includes(needsOne));
pass('one that already has a room is left alone', !asked.includes(hasOne));
pass('one that has already happened is left alone', !asked.includes(alreadyRan));
pass('the sweep counts what it attached', swept.attached === asked.length, String(swept.attached));

// --- who may ask for one ----------------------------------------------------

const studentToken = await signIn('student@yakal.com');
const counselorToken = await signIn('counselor@yakal.com');
const strangerToken = await signIn('tutor2@yakal.com');

const byStranger = await call(strangerToken, { sessionId: needsOne });
pass('a stranger cannot give somebody else a room', byStranger.code === 403, String(byStranger.code));

const missing = await call(studentToken, { sessionId: '00000000-0000-0000-0000-000000000000' });
pass('a session that does not exist is a 404', missing.code === 404, String(missing.code));

// Zoom is not configured locally, so this reaches attachMeeting and is told so.
// Reaching it at all is what is being checked: the authorisation passed.
const byStudent = await call(studentToken, { sessionId: needsOne });
pass('the student may ask', byStudent.code === 200, String(byStudent.code));
pass(
  zoomConfigured() ? 'and the hour is given a room' : 'and is told so when Zoom is not configured',
  byStudent.body?.attached === zoomConfigured(),
  String(byStudent.body?.attached)
);

const byCounselor = await call(counselorToken, { sessionId: needsOne });
pass('so may the counsellor on it', byCounselor.code === 200, String(byCounselor.code));

const onFilled = await call(studentToken, { sessionId: hasOne });
pass('a session that already has a room books no second meeting',
  onFilled.code === 200 && onFilled.body?.attached === false, String(onFilled.body?.reason));

const onPast = await call(studentToken, { sessionId: alreadyRan });
pass('an hour that has already happened is refused a room', onPast.code === 400, String(onPast.code));

// --- the reason any of this matters ----------------------------------------

const planId = psql(`select id from admissions_plans where counselor_id='${counselorId}' limit 1;`);
if (!planId) {
  console.log('SKIP  the delivery gate: no admissions plan seeded for this counsellor');
} else {
  const planStudent = psql(`select student_id from admissions_plans where id='${planId}';`);
  const delivered = (from: string, to: string) =>
    psql(`select public.counselling_period_delivered('${planId}', '${from}', '${to}');`);

  psql(`delete from sessions where subject like '${FIXTURE}-gate%';`);
  const from = psql("select (current_date - 10)::text;");
  const to = psql("select (current_date - 1)::text;");

  psql(`
    insert into sessions (student_id, tutor_id, subject, date, start_time, duration_minutes,
                          status, kind)
    values ('${planStudent}', '${counselorId}', '${FIXTURE}-gate',
            current_date - 5, '10:00', 60, 'no-show', 'advising');`);

  pass('an hour nobody joined is not delivery', delivered(from, to) === 'f', delivered(from, to));

  psql(`update sessions set status='completed' where subject='${FIXTURE}-gate';`);
  pass('the same hour, attended, is', delivered(from, to) === 't', delivered(from, to));
}

await clean();

console.log(failures === 0 ? '\nall checks passed' : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
