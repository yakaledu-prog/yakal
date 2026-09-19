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
import { cancelSessionEarning } from './earnings.js';
import { syncPlanFromSubscription } from './subscriptions.js';
import { notifyAll } from './notify.js';

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

// ============================================================
// What a payment bought stops when the payment does.
//
// Access follows payment, and before this a refund only undid the money: the
// family got their card credited and kept the upcoming lessons, the course
// enrolment and the counselling plan it had paid for. Called once an invoice
// is refunded in full (admin-refund, and the charge.refunded webhook, which
// also catches a refund pressed in the Stripe dashboard), and in the lighter
// 'dispute' form when a card dispute opens.
//
// A dispute cancels the upcoming lessons and nothing else. It can still be
// won, and ending a plan over one would be deciding it; but a lesson taught
// while the money is contested is a lesson nobody may end up paying for, and
// its tutor would be the one to find out.
//
// Everything here is conditional on the current state, so a redelivered
// webhook or a second refund of the same invoice changes nothing.
// ============================================================

export interface EndedAccess {
  sessionsCancelled: number;
  enrolmentsEnded: number;
  planEnded: boolean;
}

export async function endAccessForInvoice(
  db: any,
  invoiceId: string,
  mode: 'refund' | 'dispute'
): Promise<EndedAccess> {
  const out: EndedAccess = { sessionsCancelled: 0, enrolmentsEnded: 0, planEnded: false };

  const { data: invoice } = await db
    .from('invoices')
    .select('id, student_id, description, admissions_tier_id, stripe_invoice_id')
    .eq('id', invoiceId)
    .maybeSingle();
  if (!invoice) return out;

  const why = mode === 'refund' ? 'The payment was refunded.' : 'The payment was disputed.';

  // ---- the lessons it bought that have not happened ----
  const { data: cancelled } = await db
    .from('sessions')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('invoice_id', invoice.id)
    .eq('status', 'upcoming')
    .select('id');
  for (const s of cancelled ?? []) {
    await cancelSessionEarning(db, s.id, why);
  }
  out.sessionsCancelled = (cancelled ?? []).length;

  if (mode === 'refund') {
    // ---- the course ----
    const { data: ended } = await db
      .from('enrolments')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('invoice_id', invoice.id)
      .eq('status', 'active')
      .select('id');
    out.enrolmentsEnded = (ended ?? []).length;

    // ---- the counselling plan ----
    //
    // Now, not at the end of the period. A family cancelling keeps what they
    // paid for until the month runs out; a family refunded has had the month
    // given back, so there is nothing left to run out.
    if (invoice.admissions_tier_id) out.planEnded = await endPlanForInvoice(db, invoice);
  }

  // Said out loud either way. A dispute in particular is somebody's evidence
  // to gather, and Stripe gives a deadline for it.
  if (out.sessionsCancelled + out.enrolmentsEnded > 0 || out.planEnded || mode === 'dispute') {
    const { data: admins } = await db.from('profiles').select('id').eq('role', 'admin');
    const facts = [
      { label: 'Invoice', value: String(invoice.description ?? invoice.id) },
      { label: 'Upcoming lessons cancelled', value: String(out.sessionsCancelled) },
      ...(mode === 'refund'
        ? [
            { label: 'Course access ended', value: out.enrolmentsEnded > 0 ? 'Yes' : 'No' },
            { label: 'Counselling plan ended', value: out.planEnded ? 'Yes' : 'No' },
          ]
        : []),
    ];
    await notifyAll(
      db,
      (admins ?? []).map((a: any) => ({
        userId: a.id,
        key: 'adminNotice' as const,
        vars: {
          title: mode === 'refund' ? 'A refunded purchase was ended' : 'A payment was disputed',
          summary:
            mode === 'refund'
              ? 'The payment came back in full, so what it bought has stopped.'
              : 'A card dispute opened. Upcoming lessons on it are cancelled; answer the dispute in Stripe.',
          detail: why,
          facts,
          link: '/admin/billing',
          linkLabel: 'Open billing',
        },
      }))
    );
  }

  return out;
}

/**
 * Find the plan an admissions invoice paid for and end it.
 *
 * The first month's invoice is on the plan itself; a later month is found
 * through the Stripe invoice's subscription. Guessing by student instead would
 * end the wrong plan the day a student has had two.
 */
async function endPlanForInvoice(
  db: any,
  invoice: { id: string; stripe_invoice_id: string | null }
): Promise<boolean> {
  const stripe = getStripe();

  let plan: { id: string; status: string; stripe_subscription_id: string | null; stripe_schedule_id: string | null } | null =
    (
      await db
        .from('admissions_plans')
        .select('id, status, stripe_subscription_id, stripe_schedule_id')
        .eq('invoice_id', invoice.id)
        .maybeSingle()
    ).data;

  if (!plan && invoice.stripe_invoice_id) {
    const stripeInvoice: any = await stripe.invoices.retrieve(invoice.stripe_invoice_id).catch(() => null);
    const subId =
      typeof stripeInvoice?.subscription === 'string'
        ? stripeInvoice.subscription
        : (stripeInvoice?.subscription?.id ?? stripeInvoice?.parent?.subscription_details?.subscription ?? null);
    if (subId) {
      plan = (
        await db
          .from('admissions_plans')
          .select('id, status, stripe_subscription_id, stripe_schedule_id')
          .eq('stripe_subscription_id', subId)
          .maybeSingle()
      ).data;
    }
  }

  if (!plan || plan.status === 'canceled') return false;

  // A pending downgrade is a schedule that owns the subscription; it has to
  // let go first, the same as the family's own cancel does.
  if (plan.stripe_schedule_id) {
    await stripe.subscriptionSchedules.release(plan.stripe_schedule_id).catch(() => undefined);
    await db
      .from('admissions_plans')
      .update({ stripe_schedule_id: null, pending_tier_id: null })
      .eq('id', plan.id);
  }

  if (plan.stripe_subscription_id) {
    try {
      const sub = await stripe.subscriptions.cancel(plan.stripe_subscription_id);
      // The deleted webhook does this too; doing it now means access ends with
      // the refund rather than whenever the event arrives.
      await syncPlanFromSubscription(db, sub);
    } catch (err: any) {
      // Already cancelled in Stripe is fine; anything else still ends access here.
      console.error(`endAccessForInvoice: cancelling ${plan.stripe_subscription_id} failed:`, err?.message);
    }
  }

  await db
    .from('admissions_plans')
    .update({ status: 'canceled', updated_at: new Date().toISOString() })
    .eq('id', plan.id)
    .neq('status', 'canceled');

  return true;
}
