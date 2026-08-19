import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getStripe } from '../_utils/billing.js';
import { getServiceClient, requireUser } from '../_utils/supabase.js';

// ============================================================
// An admin settling what somebody is owed, by hand.
//
// The ordinary path is the scheduled job: an earning is written when a lesson
// completes, waits out its hold, and transfers itself. This is the exception,
// and there are two real ones.
//
//   Paying early    the hold has not expired but somebody has decided to pay
//                   anyway, usually because a tutor asked.
//   Paying off Stripe  the payee has no connected account. Money moved by ACH,
//                   Zelle or cheque still has to appear in the ledger, or the
//                   annual total that goes on a 1099 is wrong.
//
// Every figure is read from the database. The request says which earnings to
// settle; it does not get to say who is paid or how much.
// ============================================================

/** Rails a person can record. stripe_connect is never chosen by hand: it records itself. */
const MANUAL_METHODS = ['ach', 'zelle', 'paypal', 'venmo', 'check', 'wire', 'other'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const user = await requireUser(req);
    const db = getServiceClient();

    const { data: me } = await db.from('profiles').select('role').eq('id', user.id).single();
    if (me?.role !== 'admin') return res.status(403).json({ error: 'Admins only' });

    const earningIds: string[] = Array.isArray(req.body?.earningIds) ? req.body.earningIds : [];
    if (earningIds.length === 0) return res.status(400).json({ error: 'Nothing selected' });

    const method: string | null = req.body?.method ?? null;
    const reference: string = (req.body?.reference ?? '').toString().trim();
    const note: string | null = (req.body?.note ?? '').toString().trim() || null;
    // When the money actually left, which is rarely the moment somebody sits
    // down to record it. Only meaningful on the manual path.
    const paidOn: string | null = (req.body?.paidOn ?? '').toString().slice(0, 10) || null;

    // Only rows that are still owed. Asking twice must not pay twice, and the
    // status filter is what makes that true rather than a check the caller
    // could race.
    const { data: earnings, error: readErr } = await db
      .from('earnings')
      .select('id, payee_id, amount_cents, currency, source_charge_id')
      .in('id', earningIds)
      .eq('status', 'pending')
      .is('voided_at', null);

    if (readErr) throw new Error(readErr.message);
    if (!earnings || earnings.length === 0) {
      return res.status(400).json({ error: 'Nothing here is still owed' });
    }

    // One transfer goes to one account, and one recorded payment has one payee.
    // A batch covering two people is a request that cannot be honoured as asked.
    const payeeIds = [...new Set(earnings.map((e: any) => e.payee_id))];
    if (payeeIds.length > 1) {
      return res.status(400).json({ error: 'Settle one person at a time' });
    }

    const payeeId = payeeIds[0];
    const amountCents = earnings.reduce((n: number, e: any) => n + e.amount_cents, 0);
    const currency = (earnings[0] as any).currency || 'usd';
    const now = new Date().toISOString();

    // ---- recorded, not moved ----
    //
    // The platform writing down that somebody moved money elsewhere. The
    // reference is not optional: every rail a US platform uses produces an
    // identifier the payee can look up in their own bank, and an admin who
    // cannot produce one has not paid anybody.
    if (method && MANUAL_METHODS.includes(method)) {
      if (!reference) {
        return res.status(400).json({ error: 'A reference is required to record a payment.' });
      }

      const { error: settleErr } = await db
        .from('earnings')
        .update({
          status: 'settled',
          method,
          reference,
          settled_at: paidOn ? new Date(`${paidOn}T12:00:00Z`).toISOString() : now,
          note,
          recorded_by: user.id,
          updated_at: now,
        })
        .in('id', earnings.map((e: any) => e.id))
        .eq('status', 'pending');

      if (settleErr) throw new Error(settleErr.message);

      await tellThem(db, payeeId, amountCents, currency, reference);
      return res.status(200).json({ settled: earnings.length, amountCents, reference });
    }

    if (method && method !== 'stripe_connect') {
      return res.status(400).json({ error: `Unknown payment method: ${method}` });
    }

    // ---- moved, through Stripe ----
    const { data: payee } = await db
      .from('profiles')
      .select('id, full_name, stripe_account_id, stripe_payouts_enabled')
      .eq('id', payeeId)
      .single();

    if (!payee?.stripe_account_id || !payee.stripe_payouts_enabled) {
      return res.status(400).json({
        error: `${payee?.full_name ?? 'They'} have not finished connecting a bank. Pay another way and record it here with a reference.`,
      });
    }

    // One transfer covering several earnings rather than one each: fewer moving
    // parts, and one reference the payee can match to one line on a statement.
    //
    // source_transaction is deliberately not set on a batch. It names a single
    // charge, and these earnings can come from several, so this one draws on
    // the platform balance instead.
    const stripe = getStripe();
    const transfer = await stripe.transfers.create(
      {
        amount: amountCents,
        currency,
        destination: payee.stripe_account_id,
        description: `${earnings.length} item${earnings.length === 1 ? '' : 's'}`,
        metadata: {
          payee_id: payeeId,
          earning_ids: earnings.map((e: any) => e.id).join(','),
          settled_by: user.id,
        },
      },
      // Settling the same set twice produces the same transfer rather than a
      // second one. Paying somebody twice is the expensive mistake here, so it
      // is the one guarded hardest.
      { idempotencyKey: `settle:${[...earningIds].sort().join(',')}` }
    );

    const { error: settleErr } = await db
      .from('earnings')
      .update({
        status: 'settled',
        method: 'stripe_connect',
        reference: transfer.id,
        settled_at: now,
        note,
        recorded_by: user.id,
        updated_at: now,
      })
      .in('id', earnings.map((e: any) => e.id))
      .eq('status', 'pending');

    if (settleErr) {
      // The money has moved. Saying so plainly beats a generic failure, because
      // the ledger and Stripe now disagree and a retry would look like the fix.
      console.error('connect-transfer: transfer sent but not recorded:', settleErr.message);
      return res.status(500).json({
        error: 'The transfer went through but could not be recorded. Do not retry, tell a developer.',
        transferId: transfer.id,
      });
    }

    await tellThem(db, payeeId, amountCents, currency, transfer.id);
    return res.status(200).json({ transferId: transfer.id, settled: earnings.length, amountCents });
  } catch (err: any) {
    console.error('connect-transfer error:', err);
    return res
      .status(err.message?.includes('session') ? 401 : 500)
      .json({ error: err.message || 'Server error' });
  }
}

async function tellThem(
  db: any,
  payeeId: string,
  amountCents: number,
  currency: string,
  reference: string
): Promise<void> {
  const { data: payee } = await db.from('profiles').select('role').eq('id', payeeId).single();
  const { error } = await db.from('notifications').insert({
    user_id: payeeId,
    type: 'payout',
    title: 'You have been paid',
    message: `${(amountCents / 100).toFixed(2)} ${currency.toUpperCase()} is on its way. Reference ${reference}.`,
    link: payee?.role === 'counselor' ? '/counselor/earnings' : '/tutor/earnings',
  });
  if (error) console.error('connect-transfer: could not notify the payee:', error.message);
}
