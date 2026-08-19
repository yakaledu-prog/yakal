// The earnings ledger: what is owed, who may see it, and what may move.
//
// This replaces the tutor_payouts checks. Those pinned that a payment could
// not be recorded without a reference and that a tutor could read their own,
// and both still matter. What is new is the part that makes the whole design
// safe: nobody but the server can write a row, so a tutor cannot pay
// themselves, and a row carries a hold that has to expire before the money
// moves.
//
// Needs the local Supabase and the seeded accounts.
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'node:child_process';

const psql = (sql) =>
  execSync(`PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -tAq -c "${sql}"`)
    .toString().trim();

let failures = 0;
const pass = (s, ok, d = '') => { if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${s}${d ? '  -> ' + d : ''}`); };

const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SERVICE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const db = createClient('http://127.0.0.1:54321', SERVICE, { auth: { persistSession: false } });

const tutorId = psql("select id from profiles where email='tutor@yakal.com';");
const adminId = psql("select id from profiles where role='admin' limit 1;");
const parentId = psql("select id from profiles where email='parent@yakal.com';");
const studentId = psql("select id from profiles where role='student' limit 1;");

const cleanup = () => {
  psql(`delete from earnings where payee_id='${tutorId}';`);
  psql("delete from sessions where subject like 'earnings-fixture%';");
  psql("delete from invoices where description like 'earnings-fixture%';");
};
cleanup();

const { data: inv } = await db.from('invoices').insert({
  parent_id: parentId, student_id: studentId, tutor_id: tutorId,
  description: 'earnings-fixture purchase', amount_cents: 6000,
  tutor_earning_cents: 4200, kind: 'tutoring', status: 'paid',
  stripe_charge_id: 'ch_fixture_earnings',
}).select('id').single();

const { data: session } = await db.from('sessions').insert({
  student_id: studentId, tutor_id: tutorId, invoice_id: inv.id,
  subject: 'earnings-fixture lesson', date: '2026-08-01', start_time: '10:00',
  duration_minutes: 60, status: 'completed', tutor_earning_cents: 4200,
}).select('id').single();

const soon = new Date(Date.now() + 72 * 3600 * 1000).toISOString();

// ---- the shape of a row ----

const bothSources = await db.from('earnings').insert({
  payee_id: tutorId, kind: 'tutoring_session', session_id: session.id,
  plan_id: null, period_start: '2026-08-01', amount_cents: 100,
});
pass('an earning cannot name both a session and a period', !!bothSources.error,
  bothSources.error?.code ?? 'accepted it');

const noSource = await db.from('earnings').insert({
  payee_id: tutorId, kind: 'tutoring_session', amount_cents: 100,
});
pass('an earning must name what earned it', !!noSource.error, noSource.error?.code ?? 'accepted it');

// Claiming settlement with no way to check it is the state that makes a ledger
// unauditable, so the constraint refuses it rather than reporting it later.
const settledNoRef = await db.from('earnings').insert({
  payee_id: tutorId, kind: 'tutoring_session', session_id: session.id,
  amount_cents: 4200, status: 'settled', method: 'ach', settled_at: new Date().toISOString(),
});
pass('nothing can be marked paid without a reference', !!settledNoRef.error,
  settledNoRef.error?.code ?? 'accepted it');

const badMethod = await db.from('earnings').insert({
  payee_id: tutorId, kind: 'tutoring_session', session_id: session.id,
  amount_cents: 4200, status: 'settled', method: 'telebirr', reference: 'x',
  settled_at: new Date().toISOString(),
});
pass('an unknown rail is refused', !!badMethod.error, badMethod.error?.code ?? 'accepted it');

// ---- a good one ----

const owed = await db.from('earnings').insert({
  payee_id: tutorId, kind: 'tutoring_session', session_id: session.id,
  invoice_id: inv.id, source_charge_id: 'ch_fixture_earnings',
  amount_cents: 4200, currency: 'usd', status: 'pending', releasable_at: soon,
}).select('id').single();
pass('an earning is recorded', !owed.error, owed.error?.message ?? '');

// The unique index is what makes the release job safe to run twice, which it
// is expected to be after any failure.
const twice = await db.from('earnings').insert({
  payee_id: tutorId, kind: 'tutoring_session', session_id: session.id, amount_cents: 4200,
});
pass('one session cannot be earned from twice', twice.error?.code === '23505',
  twice.error?.code ?? 'accepted it');

// ---- the hold ----

const due = psql(
  `select count(*) from earnings where status='pending' and voided_at is null and releasable_at <= now() and payee_id='${tutorId}';`
);
pass('a fresh earning is not yet due to move', due === '0', `${due} due`);

psql(`update earnings set releasable_at = now() - interval '1 hour' where id='${owed.data.id}';`);
const dueNow = psql(
  `select count(*) from earnings where status='pending' and voided_at is null and releasable_at <= now() and payee_id='${tutorId}';`
);
pass('and it is due once the hold has passed', dueNow === '1', `${dueNow} due`);

// ---- who can see it ----

const asTutor = createClient('http://127.0.0.1:54321', ANON, { auth: { persistSession: false } });
await asTutor.auth.signInWithPassword({ email: 'tutor@yakal.com', password: 'demo123' });
const mine = await asTutor.from('earnings').select('id, amount_cents').eq('payee_id', tutorId);
pass('the payee can see their own', (mine.data ?? []).length === 1, mine.error?.message ?? '');

const other = createClient('http://127.0.0.1:54321', ANON, { auth: { persistSession: false } });
await other.auth.signInWithPassword({ email: 'yared.mekonnen@yakal.demo', password: 'demo123' });
const theirs = await other.from('earnings').select('id').eq('payee_id', tutorId);
pass('another tutor cannot', (theirs.data ?? []).length === 0);

// Earnings are the one number colleagues most want to compare and least should
// be able to, and a view answering as its definer would hand over every one.
const totals = await other.from('earnings_year_totals').select('payee_id').eq('payee_id', tutorId);
pass('nor read their annual total', (totals.data ?? []).length === 0, JSON.stringify(totals.data ?? []));

// ---- who can write one ----
//
// The whole point. A payee who can insert a row can pay themselves, and a payee
// who can update one can decide they have been paid.

const selfPay = await asTutor.from('earnings').insert({
  payee_id: tutorId, kind: 'tutoring_session', amount_cents: 999999, period_start: null,
});
pass('a tutor cannot write themselves an earning', !!selfPay.error, selfPay.error?.code ?? 'accepted it');

const { error: selfSettleErr } = await asTutor
  .from('earnings')
  .update({ status: 'settled', method: 'ach', reference: 'x', settled_at: new Date().toISOString() })
  .eq('id', owed.data.id);
const stillPending = psql(`select status from earnings where id='${owed.data.id}';`);
pass('nor mark themselves paid', stillPending === 'pending', `${stillPending}${selfSettleErr ? '' : ' (update was accepted)'}`);

const asParent = createClient('http://127.0.0.1:54321', ANON, { auth: { persistSession: false } });
await asParent.auth.signInWithPassword({ email: 'parent@yakal.com', password: 'demo123' });
const sneaky = await asParent.from('earnings').insert({
  payee_id: tutorId, kind: 'tutoring_session', session_id: session.id, amount_cents: 1,
});
pass('a parent cannot write one either', !!sneaky.error, sneaky.error?.code ?? 'accepted it');

// ---- settling, voiding, and the annual total ----

psql(
  `update earnings set status='settled', method='ach', reference='021000021398765', settled_at='2026-08-01T12:00:00Z' where id='${owed.data.id}';`
);
const total = psql(`select total_cents from earnings_year_totals where payee_id='${tutorId}' and tax_year=2026;`);
pass('the annual total counts a settled payment', total === '4200', total);

// A financial record that can vanish is not a record, so a mistake is voided
// and the corrected row takes its place.
psql(`update earnings set voided_at=now(), voided_by='${adminId}', void_reason='wrong tutor' where id='${owed.data.id}';`);
pass('a voided earning is kept', psql(`select count(*) from earnings where id='${owed.data.id}';`) === '1');

const corrected = await db.from('earnings').insert({
  payee_id: tutorId, kind: 'tutoring_session', session_id: session.id,
  amount_cents: 4200, status: 'settled', method: 'wire', reference: 'IMAD-123',
  settled_at: '2026-08-02T12:00:00Z',
});
pass('and the corrected one can be written', !corrected.error, corrected.error?.message ?? '');

const afterVoid = psql(`select total_cents from earnings_year_totals where payee_id='${tutorId}' and tax_year=2026;`);
pass('the annual total ignores the voided one', afterVoid === '4200', afterVoid);

cleanup();

console.log(failures === 0 ? '\nall checks passed' : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
