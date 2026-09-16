// Pay tutors for lessons they marked complete by hand.
//
// The tutor and counsellor session screens had a "Mark As Done" button that set
// status = 'completed' from the browser. The hourly job only pays lessons still
// marked upcoming, so every lesson completed that way was never paid. The button
// is gone; this writes the earnings those lessons should have had.
//
// Only a lesson whose invoice was actually paid, and only up to what that invoice
// holds for the tutor. Each earning goes through the normal 72-hour hold and the
// normal release, so nothing is paid out by this script directly.
//
//   npx tsx scripts/pay-hand-completed-lessons.ts                 local, dry run
//   npx tsx scripts/pay-hand-completed-lessons.ts --confirm       local, write
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//     npx tsx scripts/pay-hand-completed-lessons.ts --target=remote            dry run
//     npx tsx scripts/pay-hand-completed-lessons.ts --target=remote --confirm  write
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { recordSessionEarning } from '../api/_utils/earnings.js';

const args = process.argv.slice(2);
const remote = args.includes('--target=remote');
const confirm = args.includes('--confirm');

const LOCAL_SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const url = remote ? process.env.SUPABASE_URL : 'http://127.0.0.1:54321';
const key = remote ? process.env.SUPABASE_SERVICE_ROLE_KEY : LOCAL_SERVICE_KEY;
if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for --target=remote.');
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });
const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

const { data: sessions, error } = await db
  .from('sessions')
  .select('id, tutor_id, subject, date, tutor_earning_cents, invoice_id')
  .eq('kind', 'lesson')
  .eq('status', 'completed')
  .gt('tutor_earning_cents', 0);
if (error) {
  console.error(`could not list sessions: ${error.message}`);
  process.exit(1);
}

const ids = (sessions ?? []).map((s) => s.id);
const { data: earned } = ids.length
  ? await db.from('earnings').select('session_id').in('session_id', ids).is('voided_at', null)
  : { data: [] };
const hasEarning = new Set((earned ?? []).map((e) => e.session_id));
const unpaid = (sessions ?? []).filter((s) => !hasEarning.has(s.id));

const invoiceIds = [...new Set(unpaid.map((s) => s.invoice_id).filter(Boolean))];
const { data: invoices } = invoiceIds.length
  ? await db
      .from('invoices')
      .select('id, status, currency, stripe_charge_id, tutor_earning_cents')
      .in('id', invoiceIds)
  : { data: [] };
const invoiceById = new Map((invoices ?? []).map((i) => [i.id, i]));

console.log(`\n${remote ? url : 'local stack'}  ${confirm ? 'WRITING' : 'dry run'}\n`);

let payable = 0;
let payableCents = 0;
for (const s of unpaid) {
  const invoice = s.invoice_id ? invoiceById.get(s.invoice_id) : null;
  const reason = !invoice
    ? 'no invoice'
    : invoice.status !== 'paid'
      ? `invoice ${invoice.status}`
      : s.tutor_earning_cents > (invoice.tutor_earning_cents ?? 0)
        ? 'more than the invoice holds'
        : null;

  if (reason) {
    console.log(`  skip  ${s.date}  ${s.subject}  ${money(s.tutor_earning_cents)}  (${reason})`);
    continue;
  }

  payable += 1;
  payableCents += s.tutor_earning_cents;
  console.log(`  pay   ${s.date}  ${s.subject}  ${money(s.tutor_earning_cents)}`);

  if (confirm) {
    const { created, error: earnErr } = await recordSessionEarning(db, {
      sessionId: s.id,
      payeeId: s.tutor_id,
      amountCents: s.tutor_earning_cents,
      currency: invoice!.currency ?? 'usd',
      invoiceId: s.invoice_id,
      sourceChargeId: invoice!.stripe_charge_id ?? null,
    });
    if (earnErr) console.log(`        failed: ${earnErr}`);
    else if (!created) console.log('        already had one');
  }
}

console.log(
  `\n${payable} ${payable === 1 ? 'lesson' : 'lessons'}, ${money(payableCents)} owed.` +
    (confirm ? ' Written, on the normal hold.' : ' Re-run with --confirm to write.')
);
