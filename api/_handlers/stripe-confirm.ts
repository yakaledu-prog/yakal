import { VercelRequest, VercelResponse } from '@vercel/node';
import { getStripe } from '../_utils/billing';
import { getServiceClient, requireUser } from '../_utils/supabase';
import { fulfilInvoices } from '../_utils/fulfil';

/**
 * Give an instalment plan an end date, and remember its subscription.
 *
 * A counselling tier is collected over a fixed number of months, so the
 * subscription must stop by itself. Checkout will not accept cancel_at,
 * because there is no subscription at the point the session is created, so it
 * is set here on the first return from Stripe.
 *
 * Idempotent: setting the same cancel_at twice is the same as setting it once,
 * and a plan that already carries a subscription id is skipped.
 */
async function closeInstalmentPlan(session: any, db: any): Promise<void> {
  const subscriptionId =
    typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
  if (!subscriptionId) return;

  const months = Number(session.metadata?.months ?? 0);

  try {
    const stripe = getStripe();
    const sub = await stripe.subscriptions.retrieve(subscriptionId);

    if (months > 1 && !sub.cancel_at) {
      // Counting from when the subscription actually started, not from now:
      // the parent may confirm minutes later, and an end date that drifts by
      // the length of the checkout is an end date nobody can predict.
      const startedAt = new Date((sub.start_date ?? Math.floor(Date.now() / 1000)) * 1000);
      const endsAt = new Date(startedAt);
      endsAt.setMonth(endsAt.getMonth() + months);
      await stripe.subscriptions.update(subscriptionId, {
        cancel_at: Math.floor(endsAt.getTime() / 1000),
      });
    }

    // So an admin can find the subscription behind a plan without guessing.
    await db
      .from('admissions_plans')
      .update({ stripe_subscription_id: subscriptionId })
      .eq('invoice_id', (session.metadata?.invoice_ids || '').split(',')[0]?.trim())
      .is('stripe_subscription_id', null);
  } catch (err: any) {
    // The money has moved and the plan is granted. Failing to set an end date
    // is worth shouting about, not worth failing the confirmation over.
    console.error('stripe-confirm: could not close the instalment plan:', err?.message ?? err);
  }
}

// Confirms a Checkout Session right after the parent returns from Stripe, and
// marks the linked invoices paid. This makes local testing work WITHOUT the
// webhook/CLI. In production the webhook is still the source of truth; both
// paths are idempotent (they only touch invoices that are still open).
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const user = await requireUser(req);
    const sessionId: string = req.body?.sessionId;
    if (!sessionId) return res.status(400).json({ error: 'Missing sessionId' });

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Only the parent who created the session may confirm it.
    if (session.metadata?.parent_id !== user.id) {
      return res.status(403).json({ error: 'Not your checkout session' });
    }

    if (session.payment_status !== 'paid') {
      return res.status(200).json({ status: session.payment_status });
    }

    const invoiceIds = (session.metadata?.invoice_ids || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (invoiceIds.length > 0) {
      const db = getServiceClient();
      await db
        .from('invoices')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          stripe_payment_intent_id:
            typeof session.payment_intent === 'string' ? session.payment_intent : null,
        })
        .in('id', invoiceIds)
        .eq('status', 'open');

      // Now that the parent has paid, the tutor's cut becomes a pending payout.
      await db
        .from('invoices')
        .update({ payout_status: 'pending' })
        .in('id', invoiceIds)
        .not('tutor_id', 'is', null)
        .eq('payout_status', 'none');

      // The same fulfilment as the webhook. Both can fire for one payment, so
      // every step of it is idempotent.
      await fulfilInvoices(db, invoiceIds);

      // A counselling plan is collected over a fixed number of months, so its
      // subscription needs an end. Checkout will not take cancel_at, because
      // at that point there is no subscription to set it on, so it is done
      // here on the way back.
      await closeInstalmentPlan(session, db);
    }

    return res.status(200).json({ status: 'paid' });
  } catch (err: any) {
    console.error('stripe-confirm error:', err);
    return res.status(err.message?.includes('session') ? 401 : 500).json({ error: err.message || 'Server error' });
  }
}
