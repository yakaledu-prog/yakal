import type { VercelRequest, VercelResponse } from '@vercel/node';
import type Stripe from 'stripe';
import { chargeIdFor, getStripe } from './_utils/billing.js';
import { getServiceClient } from './_utils/supabase.js';
import { fulfilInvoices } from './_utils/fulfil.js';
import {
  cancelEarningsForCharge,
  counsellorShare,
  markReversedByTransfer,
  recordCounsellingEarning,
} from './_utils/earnings.js';
import { syncPlanFromSubscription } from './_utils/subscriptions.js';

// Vercel: receive the raw body so we can verify the Stripe signature.
export const config = { api: { bodyParser: false } };

async function readRawBody(req: any): Promise<Buffer> {
  if (Buffer.isBuffer(req.body)) return req.body;                 // express.raw (local dev)
  if (typeof req.body === 'string') return Buffer.from(req.body);
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks);
}

/**
 * A month of counselling, paid for.
 *
 * Nobody is at a keyboard when these arrive: Stripe charges the saved card and
 * sends this. So it is the only record that the second month onward happened at
 * all, and it does three things that nothing else does.
 *
 *   writes the month's invoice row, so a parent's billing page keeps showing
 *   payments instead of going quiet after the first one
 *
 *   writes the counsellor's share into the earnings ledger, on the same hold as
 *   everybody else's money
 *
 *   brings the plan row back into line with the subscription
 *
 * All three are idempotent, because Stripe redelivers.
 */
export async function recordSubscriptionInvoice(event: Stripe.Event): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice;
  const subscriptionId =
    typeof (invoice as any).subscription === 'string'
      ? (invoice as any).subscription
      : (invoice as any).subscription?.id;
  if (!subscriptionId) return;

  const db = getServiceClient();
  const { data: plan } = await db
    .from('admissions_plans')
    .select(`id, student_id, purchased_by, status, counselor_id, tier_id,
             student:profiles!admissions_plans_student_id_fkey (full_name),
             tier:admissions_tiers!admissions_plans_tier_id_fkey (name, counselor_share_percent)`)
    .eq('stripe_subscription_id', subscriptionId)
    .maybeSingle();

  // Not one of ours. The Stripe account can carry subscriptions this platform
  // did not create.
  if (!plan) return;

  if (event.type === 'invoice.payment_failed') {
    await reportFailedPayment(db, plan);
    return;
  }

  // The month this invoice covers, from Stripe's own period rather than the
  // calendar. A plan billed on the 20th has months that run 20th to 20th, and
  // truncating to a calendar month would put two payments in one bucket.
  const line = invoice.lines?.data?.[0];
  const periodStart = line?.period?.start
    ? new Date(line.period.start * 1000).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  const amountPaid = invoice.amount_paid ?? 0;
  const chargeId =
    typeof (invoice as any).charge === 'string'
      ? (invoice as any).charge
      : ((invoice as any).charge?.id ?? null);

  // ---- the month's invoice row ----
  //
  // Under the old instalment model only the first payment produced one, so a
  // family paying for ten months saw a single line and no evidence of the other
  // nine. Keyed on the Stripe invoice id so a redelivery updates rather than
  // duplicates.
  const { data: invoiceRow } = await db
    .from('invoices')
    .upsert(
      {
        parent_id: plan.purchased_by,
        student_id: plan.student_id,
        description: `${(plan as any).tier?.name ?? 'Counselling'} - ${periodStart}`,
        amount_cents: amountPaid,
        currency: (invoice.currency ?? 'usd').toLowerCase(),
        kind: 'admissions',
        admissions_tier_id: plan.tier_id,
        status: 'paid',
        paid_at: new Date().toISOString(),
        stripe_invoice_id: invoice.id,
        stripe_charge_id: chargeId,
      },
      { onConflict: 'stripe_invoice_id' }
    )
    .select('id')
    .maybeSingle();

  // ---- the counsellor's share ----
  //
  // A percentage of what actually came in, not of the tier's list price: an
  // upgrade's proration invoice is a real payment and should pay a real share,
  // and a discounted month should not pay a full one.
  if (plan.counselor_id) {
    const share = counsellorShare(amountPaid, (plan as any).tier?.counselor_share_percent);
    if (share > 0) {
      await recordCounsellingEarning(db, {
        planId: plan.id,
        payeeId: plan.counselor_id,
        periodStart,
        amountCents: share,
        currency: (invoice.currency ?? 'usd').toLowerCase(),
        invoiceId: invoiceRow?.id ?? null,
        sourceChargeId: chargeId,
      });
    } else if ((plan as any).tier?.counselor_share_percent == null) {
      // Null is not zero: nobody has decided yet. Silence here is how a
      // counsellor works a year for nothing and finds out at the end.
      console.error(
        `plan ${plan.id} paid, but its tier has no counsellor share set, so nothing was recorded as owed`
      );
    }
  }

  // ---- the plan itself ----
  //
  // Refreshing the mirror is the least important thing this function does and
  // the only part that needs the network, so it does not get to fail the rest.
  // The payment is recorded and the counsellor is owed either way; a stale
  // period end is corrected by the next customer.subscription.updated.
  try {
    const sub = await getStripe().subscriptions.retrieve(subscriptionId);
    await syncPlanFromSubscription(db, sub);
  } catch (err: any) {
    console.error(`webhook: could not refresh plan ${plan.id} from Stripe:`, err?.message ?? err);
  }
}

/**
 * A card that did not go through.
 *
 * Marks the plan past_due and tells people. It revokes nothing, deliberately: a
 * card expiring in November must not lock a student out of their college list a
 * fortnight before a deadline. Stripe retries on its own schedule, and chasing
 * money is a job for a person who can ring the parent.
 */
async function reportFailedPayment(db: any, plan: any): Promise<void> {
  await db
    .from('admissions_plans')
    .update({ status: 'past_due', updated_at: new Date().toISOString() })
    .eq('id', plan.id);

  const studentName = plan.student?.full_name ?? 'a student';
  const tierName = plan.tier?.name ?? 'counselling';

  const { data: admins } = await db.from('profiles').select('id').eq('role', 'admin');
  const rows = (admins ?? []).map((a: any) => ({
    user_id: a.id,
    type: 'admissions_plan',
    title: 'A counselling payment failed',
    message: `${tierName} for ${studentName} could not be charged. Nothing has been switched off.`,
    link: '/admin/billing',
  }));

  if (plan.purchased_by) {
    rows.push({
      user_id: plan.purchased_by,
      type: 'admissions_plan',
      title: 'Your counselling payment did not go through',
      message: 'Your card was declined. Counselling carries on. Update your card when you can.',
      link: '/parent/billing',
    });
  }

  if (rows.length > 0) {
    const { error } = await db.from('notifications').insert(rows);
    if (error) console.error('webhook: could not report a failed payment:', error.message);
  }
}

/**
 * Verify against either endpoint's secret.
 *
 * Stripe splits events in two. Things that happen to this account, payments and
 * subscriptions and refunds, go to an ordinary endpoint. Things that happen to a
 * *connected* account, which is every tutor and counsellor who has attached a
 * bank, only arrive if there is a second endpoint marked for Connect. They are
 * separate endpoints with separate signing secrets, and one URL can serve both.
 *
 * account.updated is why it matters: it is the only thing that tells us a payee
 * finished Stripe's onboarding. Without it stripe_payouts_enabled never becomes
 * true, the release job skips them every run, and they are silently never paid
 * while nothing anywhere reports an error.
 *
 * So both secrets are tried. A payload only ever matches one, and trying the
 * other costs a string comparison.
 */
function verify(raw: Buffer, signature: string): Stripe.Event {
  const secrets = [
    process.env.STRIPE_WEBHOOK_SECRET,
    process.env.STRIPE_CONNECT_WEBHOOK_SECRET,
  ].filter((s): s is string => !!s && s.trim().length > 0);

  if (secrets.length === 0) throw new Error('No webhook signing secret is configured');

  const stripe = getStripe();
  let last: Error | null = null;

  for (const secret of secrets) {
    try {
      return stripe.webhooks.constructEvent(raw, signature, secret);
    } catch (err: any) {
      last = err;
    }
  }
  throw last ?? new Error('Signature did not match any configured secret');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const sig = req.headers['stripe-signature'] as string;

  let event: Stripe.Event;
  try {
    event = verify(await readRawBody(req), sig);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  try {
    if (
      event.type === 'checkout.session.completed' ||
      event.type === 'checkout.session.async_payment_succeeded'
    ) {
      const session = event.data.object as Stripe.Checkout.Session;
      const invoiceIds = (session.metadata?.invoice_ids || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      if (invoiceIds.length > 0) {
        const db = getServiceClient();
        const paymentIntentId =
          typeof session.payment_intent === 'string' ? session.payment_intent : null;

        const { error } = await db
          .from('invoices')
          .update({
            status: 'paid',
            paid_at: new Date().toISOString(),
            stripe_payment_intent_id: paymentIntentId,
            stripe_charge_id: await chargeIdFor(paymentIntentId),
          })
          .in('id', invoiceIds);
        if (error) console.error('Failed to mark invoices paid:', error.message);

        // Marking paid was the whole of it before, so a parent paid and
        // nothing appeared anywhere. Enrolment, sessions and telling people
        // happen here.
        await fulfilInvoices(db, invoiceIds);

        // Nothing is owed to the tutor yet. An earning is written when a lesson
        // is delivered, not when it is bought, so that money for an
        // undelivered session is still ours to refund. See _utils/earnings.ts.
      }
    }

    // Every month of a counselling subscription, including the first. Stripe
    // bills the saved card with nobody watching, so this is the only place the
    // second month onward is ever seen.
    if (event.type === 'invoice.paid' || event.type === 'invoice.payment_failed') {
      await recordSubscriptionInvoice(event);
    }

    // A tier change landing, a cancellation taking effect, or somebody editing
    // the subscription in the Stripe dashboard. The plan row is a mirror, so
    // every one of those arrives here rather than being a state the two can
    // disagree about.
    if (
      event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.deleted'
    ) {
      await syncPlanFromSubscription(
        getServiceClient(),
        event.data.object as Stripe.Subscription
      );
    }

    // Money going back to the payer, however it was started: our own refund
    // path, or an admin pressing refund in the Stripe dashboard. Either way
    // anything still owed on that charge stops being owed.
    //
    // This is the hold earning its keep. A pending earning is cancelled with a
    // single update; a settled one would need the money pulled back out of
    // somebody's account, which is why nothing settles for three days.
    if (event.type === 'charge.refunded' || event.type === 'charge.dispute.created') {
      const charge =
        event.type === 'charge.refunded'
          ? (event.data.object as Stripe.Charge)
          : ((event.data.object as Stripe.Dispute).charge as string | Stripe.Charge);
      const chargeId = typeof charge === 'string' ? charge : charge.id;

      const { cancelled, alreadySettled } = await cancelEarningsForCharge(
        getServiceClient(),
        chargeId,
        event.type === 'charge.refunded' ? 'The payment was refunded.' : 'The payment was disputed.'
      );

      // Named rather than swallowed. Money that has already moved is the case
      // a person has to chase, and it is invisible unless somebody says so.
      if (alreadySettled > 0) {
        console.error(
          `webhook: ${event.type} on ${chargeId}, but ${alreadySettled} earning(s) had already been paid out and need recovering by hand`
        );
      }
      console.log(`webhook: ${event.type} on ${chargeId} cancelled ${cancelled} pending earning(s)`);
    }

    // A reversal begun in the Stripe dashboard rather than by us. Transfers are
    // platform objects, so this arrives on the account endpoint, not the
    // Connect one.
    if (event.type === 'transfer.reversed') {
      await markReversedByTransfer(
        getServiceClient(),
        event.data.object as Stripe.Transfer,
        'Reversed in Stripe.'
      );
    }

    // A tutor finishing, or failing, Stripe's onboarding. Nothing else knows
    // when this happens: the tutor is on Stripe's pages, not ours.
    if (event.type === 'account.updated') {
      const account = event.data.object as Stripe.Account;
      const db = getServiceClient();
      const { error } = await db
        .from('profiles')
        .update({ stripe_payouts_enabled: !!account.payouts_enabled })
        .eq('stripe_account_id', account.id);
      if (error) console.error('webhook: could not update connect status:', error.message);
    }

    return res.status(200).json({ received: true });
  } catch (err: any) {
    console.error('Webhook handler error:', err);
    return res.status(500).json({ error: 'Webhook handler failed' });
  }
}
