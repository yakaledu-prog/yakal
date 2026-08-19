import type { VercelRequest, VercelResponse } from '@vercel/node';
import type Stripe from 'stripe';
import { chargeIdFor, getStripe } from './_utils/billing.js';
import { getServiceClient } from './_utils/supabase.js';
import { fulfilInvoices } from './_utils/fulfil.js';
import { recordCounselorShare } from './_utils/counselor-pay.js';
import { cancelEarningsForCharge, markReversedByTransfer } from './_utils/earnings.js';

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
 * A monthly instalment on a counselling plan.
 *
 * Nobody is at a keyboard when these arrive: Stripe charges the saved card and
 * sends this. So it is the only record that the second through tenth payments
 * happened at all.
 *
 * A failed one marks the plan past_due and tells an admin. It does not revoke
 * anything, and that is deliberate. A card expiring in November must not lock
 * a student out of their college list a fortnight before a deadline. Chasing
 * money is a job for a person who can ring the parent.
 */
export async function recordInstalment(event: Stripe.Event): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice;
  const subscriptionId =
    typeof (invoice as any).subscription === 'string'
      ? (invoice as any).subscription
      : (invoice as any).subscription?.id;
  if (!subscriptionId) return;

  const db = getServiceClient();
  const { data: plan } = await db
    .from('admissions_plans')
    .select(`id, student_id, purchased_by, payments_made, payments_due, status, counselor_id,
             student:profiles!admissions_plans_student_id_fkey (full_name),
             tier:admissions_tiers (name, price_cents, instalment_months, counselor_share_percent)`)
    .eq('stripe_subscription_id', subscriptionId)
    .maybeSingle();

  // Not one of ours, or the first payment, which the checkout branch already
  // counted as payment one.
  if (!plan) return;
  if (event.type === 'invoice.paid' && (invoice as any).billing_reason === 'subscription_create') {
    return;
  }

  if (event.type === 'invoice.paid') {
    const made = Math.min((plan.payments_made ?? 0) + 1, plan.payments_due ?? 1);
    const settled = made >= (plan.payments_due ?? 1);

    await db
      .from('admissions_plans')
      .update({
        payments_made: made,
        // Paying catches a plan back up. The engagement itself carries on
        // either way, so this only ever changes an admin's queue.
        status: plan.status === 'past_due' ? 'active' : plan.status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', plan.id);

    // This month's share for the counsellor. Written per payment received, so
    // the ledger tracks the money in rather than the promise made, and the
    // unique index makes a redelivered webhook a no-op rather than a second
    // month's pay.
    if (plan.counselor_id) {
      const tier = (plan as any).tier;
      await recordCounselorShare(db, {
        planId: plan.id,
        counselorId: plan.counselor_id,
        tierPriceCents: tier?.price_cents ?? 0,
        sharePercent: tier?.counselor_share_percent,
        instalmentMonths: tier?.instalment_months ?? plan.payments_due ?? 1,
        instalmentNumber: made,
      });
    }

    if (settled) {
      console.log(`instalments complete for plan ${plan.id}: ${made} of ${plan.payments_due}`);
    }
    return;
  }

  // A failed payment.
  await db
    .from('admissions_plans')
    .update({ status: 'past_due', updated_at: new Date().toISOString() })
    .eq('id', plan.id);

  const studentName = (plan as any).student?.full_name ?? 'a student';
  const tierName = (plan as any).tier?.name ?? 'counselling';

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
    if (error) console.error('webhook: could not report a failed instalment:', error.message);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error('STRIPE_WEBHOOK_SECRET not configured');
    return res.status(500).json({ error: 'Webhook not configured' });
  }

  const sig = req.headers['stripe-signature'] as string;
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    const raw = await readRawBody(req);
    event = stripe.webhooks.constructEvent(raw, sig, secret);
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

    // Instalments two onwards. The first arrives with the checkout above; the
    // rest are Stripe billing the saved card each month with nobody watching,
    // so this is the only place they are ever seen.
    if (event.type === 'invoice.paid' || event.type === 'invoice.payment_failed') {
      await recordInstalment(event);
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
