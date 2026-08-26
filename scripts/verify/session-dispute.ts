// A family reporting a lesson, and an admin deciding.
//
// The 72 hour hold exists so a complaint can arrive while the money is still
// ours. This drives the thing that arrives in it, through the real handler.
//
// What it pins:
//
//   reporting holds the earning rather than cancelling it
//   the release job will not pay a held earning
//   only the family can report, and only their own lesson
//   one open report per lesson
//   upholding cancels the earning and refunds
//   rejecting puts it back where it was
//
// Needs the local Supabase and the seeded accounts.
import 'dotenv/config';
import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { releaseDueEarnings } from '../../api/_utils/earnings.js';
import { getServiceClient } from '../../api/_utils/supabase.js';

const psql = (sql: string) =>
  execSync(`PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -tAq -c "${sql}"`)
    .toString()
    .trim();

let failures = 0;
const pass = (s: string, ok: boolean, d = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${s}${d ? '  -> ' + d : ''}`);
};

const handler = (await import('../../api/_handlers/session-dispute.js')).default;

async function call(token: string, body: Record<string, unknown>) {
  const out: any = {};
  const res: any = {
    status(c: number) { out.code = c; return res; },
    json(b: any) { out.body = b; return out; },
    end() { return out; },
  };
  await handler(
    { method: 'POST', headers: { authorization: `Bearer ${token}` }, body } as any,
    res
  );
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

const tutorId = psql("select id from profiles where email='tutor@yakal.com';");
const studentId = psql("select id from profiles where email='student@yakal.com';");
const parentId = psql("select id from profiles where email='parent@yakal.com';");

const clean = () => {
  psql("delete from session_disputes where session_id in (select id from sessions where subject like 'dispute-fixture%');");
  psql("delete from earnings where session_id in (select id from sessions where subject like 'dispute-fixture%');");
  psql("delete from sessions where subject like 'dispute-fixture%';");
  psql("delete from invoices where description like 'dispute-fixture%';");
};
clean();

const invoiceId = psql(
  `insert into invoices (parent_id, student_id, tutor_id, description, amount_cents, tutor_earning_cents, kind, status)
   values ('${parentId}','${studentId}','${tutorId}','dispute-fixture purchase',6000,4200,'tutoring','paid') returning id;`
);
const sessionId = psql(
  `insert into sessions (student_id, tutor_id, invoice_id, subject, date, start_time, duration_minutes, status, tutor_earning_cents, completed_at)
   values ('${studentId}','${tutorId}','${invoiceId}','dispute-fixture lesson',(now() - interval '9 days')::date,'16:00',60,'completed',4200, now() - interval '9 days') returning id;`
);
const earningId = psql(
  `insert into earnings (payee_id, kind, session_id, invoice_id, amount_cents, status, releasable_at)
   values ('${tutorId}','tutoring_session','${sessionId}','${invoiceId}',4200,'pending', now() - interval '1 hour') returning id;`
);

const parentToken = await signIn('parent@yakal.com');
const tutorToken = await signIn('tutor@yakal.com');
const adminToken = await signIn('admin@yakal.com');

// A tutor stopping their own payout is the thing this must never allow.
const byTutor = await call(tutorToken, {
  op: 'raise', sessionId, reason: 'no_show', detail: 'let me pause my own money',
});
pass('a tutor cannot report their own session', byTutor.code === 403, String(byTutor.code));

const noDetail = await call(parentToken, { op: 'raise', sessionId, reason: 'no_show', detail: '  ' });
pass('a report needs to say what happened', noDetail.code === 400, String(noDetail.code));

const raised = await call(parentToken, {
  op: 'raise', sessionId, reason: 'no_show', detail: 'Nobody joined the room.',
});
pass('the parent can report it', raised.code === 200, JSON.stringify(raised.body));
pass('and the payment is held', raised.body?.paymentHeld === true, JSON.stringify(raised.body));

const afterRaise = psql(`select status from earnings where id='${earningId}';`);
pass('held, not cancelled', afterRaise === 'held', afterRaise);

// The whole point of holding: the job must not pay it while it is argued about.
const released = await releaseDueEarnings(getServiceClient());
pass(
  'the release job will not pay a held earning',
  !released.skipped.some((s) => s.earningId === earningId) &&
    !released.errors.some((e) => e.includes(earningId)),
  JSON.stringify(released.transferred)
);
pass('and it is still held afterwards', psql(`select status from earnings where id='${earningId}';`) === 'held');

const twice = await call(parentToken, {
  op: 'raise', sessionId, reason: 'quality', detail: 'again',
});
pass('one open report per lesson', twice.code === 409, String(twice.code));

const disputeId = psql(`select id from session_disputes where session_id='${sessionId}' and status='open';`);

const byParent = await call(parentToken, { op: 'resolve', disputeId, verdict: 'upheld', note: 'me' });
pass('a parent cannot decide their own report', byParent.code === 403, String(byParent.code));

const noNote = await call(adminToken, { op: 'resolve', disputeId, verdict: 'rejected', note: '' });
pass('a verdict needs a reason', noNote.code === 400, String(noNote.code));

// ---- rejecting puts it back ----
const rejected = await call(adminToken, {
  op: 'resolve', disputeId, verdict: 'rejected', note: 'Attendance shows both present for 52 minutes.',
});
pass('an admin can reject it', rejected.code === 200, JSON.stringify(rejected.body));
pass('and the earning goes back to pending', psql(`select status from earnings where id='${earningId}';`) === 'pending');
pass('the report is closed', psql(`select status from session_disputes where id='${disputeId}';`) === 'rejected');

const again = await call(adminToken, { op: 'resolve', disputeId, verdict: 'upheld', note: 'twice' });
pass('and cannot be decided twice', again.code === 409, String(again.code));

// ---- upholding cancels and refunds ----
const second = await call(parentToken, {
  op: 'raise', sessionId, reason: 'no_show', detail: 'Still nobody.',
});
pass('it can be reported again once closed', second.code === 200, JSON.stringify(second.body));

const secondId = psql(`select id from session_disputes where session_id='${sessionId}' and status='open';`);
const upheld = await call(adminToken, {
  op: 'resolve', disputeId: secondId, verdict: 'upheld', note: 'Tutor never joined.',
});
pass('an admin can uphold it', upheld.code === 200, JSON.stringify(upheld.body));
pass('the earning is cancelled', psql(`select status from earnings where id='${earningId}';`) === 'cancelled');
pass(
  'the session is marked a no-show',
  psql(`select status from sessions where id='${sessionId}';`) === 'no-show'
);
pass(
  'and a refund was recorded',
  Number(psql(`select count(*) from refunds where session_id='${sessionId}';`)) >= 1
);

clean();
console.log(failures === 0 ? '\nall checks passed' : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
