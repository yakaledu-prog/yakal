// ============================================================
// The ledger of money owed to tutors and counsellors.
//
// One rule underneath all of it: nothing is transferred to a payee before the
// work is delivered. Stripe does not reverse a transfer when the charge that
// funded it is refunded, and funds that have reached a connected account's bank
// cannot be clawed back at all. So an earning is written when a lesson
// completes, not when a parent pays, and it waits out a hold before it moves.
// Undelivered money stays in the platform balance, where a refund costs one
// call and reverses nothing.
//
// Every function here is safe to call twice. Stripe redelivers webhooks and the
// release job is expected to run again after a failure, so repeating a step has
// to be a no-op rather than a second payment.
// ============================================================

import type Stripe from 'stripe';
import { getStripe } from './billing.js';

/**
 * How long an earning sits before it can move.
 *
 * The window exists so a dispute, a refund or a "the tutor never showed"
 * arrives while the money is still ours. Three days is at the short end for a
 * marketplace, and it costs a tutor nothing in practice: payouts to their bank
 * run on a schedule, so a lesson taught on the 3rd reaches them on the 15th
 * whether the hold is one day or three.
 */
export const HOLD_HOURS = 72;

export interface SessionEarningInput {
  sessionId: string;
  payeeId: string;
  amountCents: number;
  currency?: string;
  invoiceId?: string | null;
  sourceChargeId?: string | null;
  /** Defaults to now + HOLD_HOURS. A late cancellation fee releases sooner. */
  releasableAt?: Date;
}

/**
 * Record what a delivered lesson owes its tutor.
 *
 * Returns false when the row already existed, which is the ordinary answer to a
 * repeated job run rather than a fault. The partial unique index on session_id
 * is what makes that true, so this does not check first and then insert: two
 * runs overlapping would both pass the check.
 */
export async function recordSessionEarning(
  db: any,
  input: SessionEarningInput
): Promise<{ created: boolean; error?: string }> {
  if (input.amountCents <= 0) {
    // A session nobody paid for cannot pay anybody. Seeded and hand-made rows
    // look exactly like this, and a zero-value earning would sit in the queue
    // forever asking to be transferred.
    return { created: false };
  }

  const releasableAt =
    input.releasableAt ?? new Date(Date.now() + HOLD_HOURS * 60 * 60 * 1000);

  const { error } = await db.from('earnings').insert({
    payee_id: input.payeeId,
    kind: 'tutoring_session',
    session_id: input.sessionId,
    amount_cents: input.amountCents,
    currency: input.currency ?? 'usd',
    invoice_id: input.invoiceId ?? null,
    source_charge_id: input.sourceChargeId ?? null,
    status: 'pending',
    releasable_at: releasableAt.toISOString(),
  });

  // 23505 is the unique index doing its job on a repeated run.
  if (error && error.code === '23505') return { created: false };
  if (error) return { created: false, error: error.message };

  return { created: true };
}

export interface CounsellingEarningInput {
  planId: string;
  payeeId: string;
  /** First day of the month this pays for. One earning per plan per period. */
  periodStart: string;
  amountCents: number;
  currency?: string;
  invoiceId?: string | null;
  sourceChargeId?: string | null;
}

/** The same, for one month of a counselling subscription. */
export async function recordCounsellingEarning(
  db: any,
  input: CounsellingEarningInput
): Promise<{ created: boolean; error?: string }> {
  if (input.amountCents <= 0) return { created: false };

  const { error } = await db.from('earnings').insert({
    payee_id: input.payeeId,
    kind: 'counselling_month',
    plan_id: input.planId,
    period_start: input.periodStart,
    amount_cents: input.amountCents,
    currency: input.currency ?? 'usd',
    invoice_id: input.invoiceId ?? null,
    source_charge_id: input.sourceChargeId ?? null,
    status: 'pending',
    releasable_at: new Date(Date.now() + HOLD_HOURS * 60 * 60 * 1000).toISOString(),
  });

  if (error && error.code === '23505') return { created: false };
  if (error) return { created: false, error: error.message };
  return { created: true };
}

/**
 * The counsellor's cut of one month's payment.
 *
 * A percentage rather than a stored amount, because the price is already on the
 * tier and a second number drifts out of step the first time somebody reprices
 * without remembering. Null share is not zero: it means nobody has decided yet,
 * and the caller records that rather than confidently paying nothing.
 */
export function counsellorShare(
  monthlyPriceCents: number,
  sharePercent: number | null | undefined
): number {
  if (sharePercent == null || sharePercent <= 0) return 0;
  if (monthlyPriceCents <= 0) return 0;
  return Math.round((monthlyPriceCents * sharePercent) / 100);
}

/** An earning as the release job needs it. */
interface DueEarning {
  id: string;
  payee_id: string;
  amount_cents: number;
  currency: string;
  source_charge_id: string | null;
  session_id: string | null;
  plan_id: string | null;
}

export interface ReleaseResult {
  transferred: number;
  amountCents: number;
  skipped: { earningId: string; reason: string }[];
  errors: string[];
}

/**
 * Move every earning whose hold has expired.
 *
 * Called by the scheduled job. The order matters: the transfer is created with
 * an idempotency key derived from the earning id, then the row is marked
 * settled. If the process dies between the two, the next run asks Stripe for
 * the same key and is handed back the transfer that already exists rather than
 * making a second one, so the row catches up without anybody being paid twice.
 * The opposite order would mark it settled and then fail to pay.
 */
export async function releaseDueEarnings(db: any): Promise<ReleaseResult> {
  const result: ReleaseResult = { transferred: 0, amountCents: 0, skipped: [], errors: [] };

  const { data: due, error } = await db
    .from('earnings')
    .select('id, payee_id, amount_cents, currency, source_charge_id, session_id, plan_id')
    .eq('status', 'pending')
    .is('voided_at', null)
    .lte('releasable_at', new Date().toISOString())
    .order('releasable_at', { ascending: true })
    .limit(200);

  if (error) {
    result.errors.push(`could not list due earnings: ${error.message}`);
    return result;
  }
  if (!due || due.length === 0) return result;

  // One query rather than one per row. A payee who has not connected a bank is
  // the common case early on, and it must not cost a round trip each time.
  const payeeIds = [...new Set(due.map((e: DueEarning) => e.payee_id))];
  const { data: payees } = await db
    .from('profiles')
    .select('id, stripe_account_id, stripe_payouts_enabled')
    .in('id', payeeIds);

  const byId = new Map<string, any>((payees ?? []).map((p: any) => [p.id, p]));

  // Fetched on first use, not up front. When every due earning belongs to
  // somebody who has not connected a bank there is nothing to pay and no
  // reason to need a Stripe key to work that out.
  let stripe: ReturnType<typeof getStripe> | null = null;

  for (const earning of due as DueEarning[]) {
    const payee = byId.get(earning.payee_id);

    // Left pending, not failed. The money is still owed; they simply have
    // nowhere for it to go yet, and it moves on its own the day they finish
    // connecting a bank. An admin can also settle it by hand.
    if (!payee?.stripe_account_id || !payee.stripe_payouts_enabled) {
      result.skipped.push({ earningId: earning.id, reason: 'no connected account' });
      continue;
    }

    try {
      stripe ??= getStripe();
      const transfer = await stripe.transfers.create(
        {
          amount: earning.amount_cents,
          currency: earning.currency || 'usd',
          destination: payee.stripe_account_id,
          // Draws on the charge that funded this rather than the platform's
          // general balance. Without it the transfer fails whenever the balance
          // has not settled, and a reversal has nothing to attach to.
          ...(earning.source_charge_id ? { source_transaction: earning.source_charge_id } : {}),
          metadata: {
            earning_id: earning.id,
            payee_id: earning.payee_id,
            ...(earning.session_id ? { session_id: earning.session_id } : {}),
            ...(earning.plan_id ? { plan_id: earning.plan_id } : {}),
          },
        },
        { idempotencyKey: `earning:${earning.id}` }
      );

      const { error: updateErr } = await db
        .from('earnings')
        .update({
          status: 'settled',
          method: 'stripe_connect',
          reference: transfer.id,
          settled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', earning.id)
        // Only from pending. A row an admin settled by hand in the meantime
        // must not be overwritten.
        .eq('status', 'pending');

      if (updateErr) {
        // The transfer went through. Saying so loudly matters more than the
        // return value, because the row and Stripe now disagree until the next
        // run reconciles them through the idempotency key.
        result.errors.push(
          `earning ${earning.id}: transferred as ${transfer.id} but not recorded: ${updateErr.message}`
        );
        continue;
      }

      result.transferred += 1;
      result.amountCents += earning.amount_cents;
    } catch (err: any) {
      const message: string = err?.message ?? 'transfer failed';
      // Insufficient balance is a wait, not a fault: the charge has not settled
      // yet and the next run will find it again.
      if (/insufficient/i.test(message)) {
        result.skipped.push({ earningId: earning.id, reason: 'platform balance not settled' });
        continue;
      }
      result.errors.push(`earning ${earning.id}: ${message}`);
    }
  }

  return result;
}

/**
 * Stop paying for something that was refunded or disputed.
 *
 * Only rows that have not moved. An earning already settled needs a transfer
 * reversal, which is a different operation with a different failure mode, and
 * quietly marking it cancelled here would say the money came back when it did
 * not.
 */
export async function cancelEarningsForCharge(
  db: any,
  chargeId: string,
  note: string
): Promise<{ cancelled: number; alreadySettled: number }> {
  const { data: affected } = await db
    .from('earnings')
    .select('id, status')
    .eq('source_charge_id', chargeId)
    .is('voided_at', null);

  const rows = (affected ?? []) as { id: string; status: string }[];
  const alreadySettled = rows.filter((r) => r.status === 'settled').length;

  const { data: cancelled } = await db
    .from('earnings')
    .update({ status: 'cancelled', note, updated_at: new Date().toISOString() })
    .eq('source_charge_id', chargeId)
    .eq('status', 'pending')
    .is('voided_at', null)
    .select('id');

  return { cancelled: (cancelled ?? []).length, alreadySettled };
}

/** Cancel the earning for one session, if it has not moved. Used when a lesson is cancelled. */
export async function cancelSessionEarning(
  db: any,
  sessionId: string,
  note: string
): Promise<void> {
  await db
    .from('earnings')
    .update({ status: 'cancelled', note, updated_at: new Date().toISOString() })
    .eq('session_id', sessionId)
    .eq('status', 'pending')
    .is('voided_at', null);
}

/**
 * Pull back money that has already moved.
 *
 * Reverses the Stripe transfer, which takes the funds out of the connected
 * account's Stripe balance. This fails when they have already been paid out to
 * their bank, and that failure is the whole reason for the hold: the answer
 * then is a conversation, not an API call.
 */
export async function reverseEarning(
  db: any,
  earningId: string,
  note: string
): Promise<{ reversed: boolean; error?: string }> {
  const { data: earning } = await db
    .from('earnings')
    .select('id, status, reference, method, amount_cents')
    .eq('id', earningId)
    .maybeSingle();

  if (!earning) return { reversed: false, error: 'No such earning' };
  if (earning.status !== 'settled') return { reversed: false, error: 'That has not been paid out' };
  if (earning.method !== 'stripe_connect' || !earning.reference) {
    return { reversed: false, error: 'Paid outside Stripe, so it has to be recovered by hand' };
  }

  try {
    const stripe = getStripe();
    await stripe.transfers.createReversal(
      earning.reference,
      { amount: earning.amount_cents, metadata: { earning_id: earningId } },
      { idempotencyKey: `reverse:${earningId}` }
    );
  } catch (err: any) {
    return { reversed: false, error: err?.message ?? 'Stripe refused the reversal' };
  }

  await db
    .from('earnings')
    .update({ status: 'reversed', note, updated_at: new Date().toISOString() })
    .eq('id', earningId);

  return { reversed: true };
}

/** The transfer reversal arriving as a webhook, for reversals begun in the Stripe dashboard. */
export async function markReversedByTransfer(
  db: any,
  transfer: Stripe.Transfer,
  note: string
): Promise<void> {
  await db
    .from('earnings')
    .update({ status: 'reversed', note, updated_at: new Date().toISOString() })
    .eq('reference', transfer.id)
    .eq('status', 'settled');
}
