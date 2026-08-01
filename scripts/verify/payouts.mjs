// Paying a tutor leaves a receipt they can check.
//
// The old flow flipped one column, so a tutor had to take the platform's word
// that money had moved. These check the two things that fixed it: a payment
// cannot be recorded without a reference, and the tutor can read it.
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

psql(`delete from tutor_payouts where tutor_id='${tutorId}';`);
psql("delete from invoices where description like 'payout-fixture%';");

const { data: inv } = await db.from('invoices').insert({
  parent_id: parentId, tutor_id: tutorId, description: 'payout-fixture session',
  amount_cents: 6000, payout_cents: 4200, kind: 'tutoring',
  status: 'paid', payout_status: 'pending',
}).select('id').single();

// ---- a reference is not optional ----
const noRef = await db.from('tutor_payouts').insert({
  tutor_id: tutorId, invoice_id: inv.id, amount_cents: 4200,
  method: 'ach', reference: '   ', paid_on: '2026-08-01', recorded_by: adminId,
});
pass('a payment cannot be recorded without a reference', !!noRef.error, noRef.error?.code ?? 'accepted it');

const badMethod = await db.from('tutor_payouts').insert({
  tutor_id: tutorId, invoice_id: inv.id, amount_cents: 4200,
  method: 'telebirr', reference: 'x', paid_on: '2026-08-01', recorded_by: adminId,
});
pass('an unknown rail is refused', !!badMethod.error, badMethod.error?.code ?? 'accepted it');

// ---- a good one ----
const good = await db.from('tutor_payouts').insert({
  tutor_id: tutorId, invoice_id: inv.id, amount_cents: 4200, currency: 'usd',
  method: 'ach', reference: '021000021398765', paid_on: '2026-08-01', recorded_by: adminId,
}).select('id').single();
pass('a payment with a reference is recorded', !good.error, good.error?.message ?? '');

// ---- the same invoice cannot be paid twice ----
const twice = await db.from('tutor_payouts').insert({
  tutor_id: tutorId, invoice_id: inv.id, amount_cents: 4200,
  method: 'zelle', reference: 'dup', paid_on: '2026-08-01', recorded_by: adminId,
});
pass('the same invoice cannot be paid out twice', twice.error?.code === '23505', twice.error?.code ?? 'accepted it');

// ---- the tutor can read their own receipt ----
const asTutor = createClient('http://127.0.0.1:54321', ANON, { auth: { persistSession: false } });
await asTutor.auth.signInWithPassword({ email: 'tutor@yakal.com', password: 'demo123' });
const mine = await asTutor.from('tutor_payouts').select('reference, amount_cents').eq('tutor_id', tutorId);
pass('the tutor can see it', (mine.data ?? []).length === 1, mine.error?.message ?? '');
pass('and the reference is there to check', mine.data?.[0]?.reference === '021000021398765', mine.data?.[0]?.reference);

// ---- another tutor cannot ----
const other = createClient('http://127.0.0.1:54321', ANON, { auth: { persistSession: false } });
await other.auth.signInWithPassword({ email: 'yared.mekonnen@yakal.demo', password: 'demo123' });
const theirs = await other.from('tutor_payouts').select('id').eq('tutor_id', tutorId);
pass('another tutor cannot see it', (theirs.data ?? []).length === 0);

// ---- a parent cannot record one ----
const asParent = createClient('http://127.0.0.1:54321', ANON, { auth: { persistSession: false } });
await asParent.auth.signInWithPassword({ email: 'parent@yakal.com', password: 'demo123' });
const sneaky = await asParent.from('tutor_payouts').insert({
  tutor_id: tutorId, amount_cents: 1, method: 'ach', reference: 'x',
  paid_on: '2026-08-01', recorded_by: parentId,
});
pass('a parent cannot record a payout', !!sneaky.error, sneaky.error?.code ?? 'accepted it');

// ---- voiding keeps the record and frees the invoice ----
psql(`update tutor_payouts set voided_at=now(), voided_by='${adminId}', void_reason='wrong tutor' where id='${good.data.id}';`);
pass('a voided payout is kept', psql(`select count(*) from tutor_payouts where id='${good.data.id}';`) === '1');
const after = await db.from('tutor_payouts').insert({
  tutor_id: tutorId, invoice_id: inv.id, amount_cents: 4200,
  method: 'wire', reference: 'IMAD-123', paid_on: '2026-08-02', recorded_by: adminId,
});
pass('and the corrected one can be recorded', !after.error, after.error?.message ?? '');

// ---- the annual total, for a 1099 ----
const total = psql(`select total_cents from tutor_payout_totals where tutor_id='${tutorId}' and tax_year=2026;`);
pass('the year total ignores voided payments', total === '4200', total);

psql(`delete from tutor_payouts where tutor_id='${tutorId}';`);
psql("delete from invoices where description like 'payout-fixture%';");

console.log(failures === 0 ? '\nall checks passed' : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
