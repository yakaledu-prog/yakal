// Drive and Zoom answer only to the right person.
//
// Both endpoints ran for anybody. Drive took a studentId and an email from the
// body and used Yakal's own Google credential, so anyone could list, read,
// upload to or delete any student's transcripts and essays, or share them with
// any address. Zoom's signature endpoint signed whatever meeting and role it
// was asked for, and role 1 is host.
//
// This drives the real handlers with real local sessions. It never reaches
// Google: every Google variable is removed before the handler loads, so a
// request the access check lets through stops at "not configured", which is
// exactly how it proves the check passed. It writes nothing.
//
// Needs the local Supabase and the seeded accounts (student@ has an active
// plan with counselor@, and is linked to parent@).

// Before anything imports the handler. The local .env can hold the client's
// real Drive credential, and a verify script must never write to it.
delete process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
delete process.env.GOOGLE_SHARED_DRIVE_ID;

import { createClient } from '@supabase/supabase-js';

const drive = (await import('../../api/_handlers/drive.js')).default;
const signature = (await import('../../api/_handlers/zoom-signature.js')).default;
const meetings = (await import('../../api/_handlers/zoom-meetings.js')).default;

const URL = 'http://127.0.0.1:54321';
const ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SERVICE =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const opts = { auth: { persistSession: false } };
const admin = createClient(URL, SERVICE, opts);

let failures = 0;
const pass = (s: string, ok: boolean, d = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${s}${d ? '  -> ' + d : ''}`);
};

async function tokenFor(email: string) {
  const c = createClient(URL, ANON, opts);
  const { data, error } = await c.auth.signInWithPassword({ email, password: 'demo123' });
  if (error || !data.session) throw new Error(`could not sign in as ${email}: ${error?.message}`);
  return data.session.access_token;
}

async function call(handler: any, body: any, token?: string, method = 'POST') {
  const out: { code?: number; body?: any } = {};
  const res: any = {
    status(c: number) { out.code = c; return res; },
    json(b: any) { out.body = b; return res; },
    end() { return res; },
    headersSent: false,
  };
  await handler(
    { method, headers: token ? { authorization: `Bearer ${token}` } : {}, body, query: {} } as any,
    res
  );
  return out;
}

/** Let through: the next thing it did was ask for Google, which is not configured here. */
const letThrough = (r: { code?: number; body?: any }) =>
  r.code === 500 && /not configured/i.test(r.body?.error ?? '');

const idOf = async (email: string) =>
  (await admin.from('profiles').select('id').eq('email', email).single()).data?.id as string;

const studentId = await idOf('student@yakal.com');
const [student, otherStudent, parent, counselor, tutor] = await Promise.all([
  tokenFor('student@yakal.com'),
  tokenFor('student2@yakal.com'),
  tokenFor('parent@yakal.com'),
  tokenFor('counselor@yakal.com'),
  tokenFor('tutor@yakal.com'),
]);

// ---- Drive ----
let r = await call(drive, { action: 'list', studentId });
pass('Drive refuses a caller with no token', r.code === 401, `${r.code}`);

r = await call(drive, { action: 'list', studentId }, otherStudent);
pass("another student cannot list this student's documents", r.code === 403, `${r.code}`);

r = await call(drive, { action: 'list', studentId }, tutor);
pass('a tutor with no plan for them cannot either', r.code === 403, `${r.code}`);

r = await call(drive, { action: 'list', studentId }, student);
pass('the student can list their own', letThrough(r), `${r.code} ${r.body?.error ?? ''}`);

r = await call(drive, { action: 'list', studentId }, parent);
pass('a linked parent can list their child\'s', letThrough(r), `${r.code}`);

r = await call(drive, { action: 'upload', studentId, filename: 'x.pdf', dataBase64: 'eA==' }, parent);
pass('but a parent cannot upload', r.code === 403, `${r.code}`);

r = await call(drive, { action: 'list', studentId }, counselor);
pass('the assigned counsellor can list', letThrough(r), `${r.code}`);

r = await call(drive, { action: 'delete', studentId, fileId: 'any' }, counselor);
pass('a counsellor cannot delete a student\'s file', r.code === 403, `${r.code}`);

r = await call(drive, { action: 'delete', studentId, fileId: 'any' }, student);
pass('the student can delete their own', letThrough(r), `${r.code}`);

r = await call(drive, { action: 'doc', essayId: '00000000-0000-0000-0000-000000000000' }, student);
pass('a Doc is opened by essay, and an unknown essay is not found', r.code === 404, `${r.code}`);

r = await call(drive, { action: 'repairAccess', studentId }, student);
pass('repairing access is for admins', r.code === 403, `${r.code}`);

// ---- Zoom ----
r = await call(signature, { sessionId: 'x', meetingNumber: '123', role: 1 });
pass('a Zoom signature needs a signed-in caller', r.code === 401, `${r.code}`);

r = await call(meetings, { meetingId: '123' });
pass('so does moving a meeting', r.code === 401, `${r.code}`);

for (const method of ['GET', 'DELETE']) {
  r = await call(meetings, { meetingId: '123' }, student, method);
  pass(`${method} on meetings is gone`, r.code === 405, `${r.code}`);
}

const { data: someSession } = await admin
  .from('sessions')
  .select('id, student_id, tutor_id')
  .eq('student_id', studentId)
  .limit(1)
  .maybeSingle();
if (someSession) {
  r = await call(signature, { sessionId: someSession.id, role: 1 }, otherStudent);
  pass('a stranger cannot get a signature for somebody else\'s session', r.code === 403, `${r.code}`);

  r = await call(signature, { sessionId: someSession.id, role: 1 }, student);
  pass(
    'the student is let in to their own session, and never as host',
    (r.code === 200 && r.body?.role === 0) || r.code === 409 || letThroughZoom(r),
    `${r.code} role=${r.body?.role ?? '-'}`
  );
} else {
  console.log('skip  no seeded session for student@, so the per-session Zoom checks did not run');
}

function letThroughZoom(res: { code?: number; body?: any }) {
  return res.code === 500 && /not configured/i.test(res.body?.error ?? '');
}

console.log(failures === 0 ? '\nall passed' : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
