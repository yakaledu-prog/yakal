// ============================================================
// Giving money back.
//
// Almost always cheap, because of the rule the ledger is built on: nothing is
// transferred to a payee before the work is delivered. A lesson that has not
// happened has its money sitting in the platform balance, so refunding it is
// one Stripe call with nothing to unwind.
//
// The expensive case is a refund after the money has already moved on. It is
// not handled silently: `costToUs` says what it would cost before anybody
// presses anything, because the honest answer at that point is a number, not a
// spinner.
// ============================================================

import { getStripe } from './billing.js';

export type RefundReason = 'in_notice' | 'late' | 'tutor_cancelled' | 'admin';

export interface RefundInput {
  invoiceId: string;
  sessionId?: string | null;
  amountCents: number;
  currency?: string;
  reason: RefundReason;
  note?: string | null;
  requestedBy?: string | null;
}

export interface RefundResult {
  refunded: boolean;
  amountCents?: number;
  stripeRefundId?: string;
  error?: string;
}

/**
 * What a refund would cost the platform beyond the money itself.
 *
 * Every earning that charge funded and has already been paid out is money the
 * platform gave somebody for work they did. Refunding the family does not take
 * it back, and clawing it out of a tutor's bank is not an API call. So the
 * amount is surfaced to whoever is deciding, and they can decide knowing it.
 *
 * Pending earnings are not counted: those are cancelled along with the refund
 * and cost nothing.
 */
export async function costToUs(
  db: any,
  chargeId: string | null
): Promise<{ alreadyPaidCents: number; count: number }> {
  if (!chargeId) return { alreadyPaidCents: 0, count: 0 };

  const { data } = await db
    .from('earnings')
    .select('amount_cents')
    .eq('source_charge_id', chargeId)
    .eq('status', 'settled')
    .is('voided_at', null);

  const rows = (data ?? []) as { amount_cents: number }[];
  return {
    alreadyPaidCents: rows.reduce((n, r) => n + r.amount_cents, 0),
    count: rows.length,
  };
}

/**
 * Refund part or all of an invoice.
 *
 * The row is written first, as pending, and only then does the money move. The
 * opposite order would let a refund succeed at Stripe and leave no trace here
 * if the process died in between, and a refund nobody recorded is one somebody
 * issues again.
 *
 * The unique index on session_id is what makes this safe to call twice: a
 * second attempt for the same lesson is refused by the database rather than
 * giving the money back again.
 */
export async function refundInvoice(db: any, input: RefundInput): Promise<RefundResult> {
  if (input.amountCents <= 0) return { refunded: false, amountCents: 0 };

  const { data: invoice } = await db
    .from('invoices')
    .select('id, amount_cents, currency, stripe_charge_id, stripe_payment_intent_id, status')
    .eq('id', input.invoiceId)
    .maybeSingle();

  if (!invoice) return { refunded: false, error: 'That invoice no longer exists.' };
  if (invoice.status !== 'paid') {
    // Nothing was taken, so there is nothing to give back. Cancelling an unpaid
    // booking is a different operation and does not come through here.
    return { refunded: false, amountCents: 0 };
  }

  const { data: row, error: rowErr } = await db
    .from('refunds')
    .insert({
      invoice_id: invoice.id,
      session_id: input.sessionId ?? null,
      amount_cents: input.amountCents,
      currency: input.currency ?? invoice.currency ?? 'usd',
      reason: input.reason,
      note: input.note ?? null,
      requested_by: input.requestedBy ?? null,
      status: 'pending',
    })
    .select('id')
    .single();

  // 23505 is the unique index refusing a second refund for one lesson.
  if (rowErr?.code === '23505') {
    return { refunded: false, error: 'That has already been refunded.' };
  }
  if (rowErr) return { refunded: false, error: rowErr.message };

  try {
    const stripe = getStripe();
    const refund = await stripe.refunds.create(
      {
        ...(invoice.stripe_charge_id
          ? { charge: invoice.stripe_charge_id }
          : { payment_intent: invoice.stripe_payment_intent_id }),
        amount: input.amountCents,
        metadata: {
          invoice_id: invoice.id,
          refund_id: row.id,
          ...(input.sessionId ? { session_id: input.sessionId } : {}),
        },
      },
      // Asking twice produces the same refund rather than a second one.
      { idempotencyKey: `refund:${row.id}` }
    );

    await db
      .from('refunds')
      .update({
        status: 'succeeded',
        stripe_refund_id: refund.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id);

    return { refunded: true, amountCents: input.amountCents, stripeRefundId: refund.id };
  } catch (err: any) {
    // Left as a failed row rather than deleted. Somebody has to know a refund
    // was attempted and did not happen, and the partial unique index lets the
    // corrected attempt through.
    await db
      .from('refunds')
      .update({
        status: 'failed',
        note: [input.note, err?.message].filter(Boolean).join(' - ').slice(0, 500),
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id);

    return { refunded: false, error: err?.message ?? 'Stripe refused the refund.' };
  }
}
