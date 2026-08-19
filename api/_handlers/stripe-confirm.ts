import type { VercelRequest, VercelResponse } from '@vercel/node';
import { chargeIdFor, getStripe } from '../_utils/billing.js';
import { getServiceClient, requireUser } from '../_utils/supabase.js';
import { fulfilInvoices } from '../_utils/fulfil.js';
import { syncPlanFromSubscription } from '../_utils/subscriptions.js';

/**
 * Remember which subscription belongs to this plan.
 *
 * There is no longer a term to close: a counselling subscription is open ended
 * and stops when the family says so, so the cancel_at this used to compute is
 * gone along with the instalment model.
 *
 * What is still needed is the link. Every later invoice.paid arrives attached
 * to a subscription and nothing else, so a plan that does not carry its id is a
 * plan the second month cannot find.
 *
 * Idempotent: a plan that already has one is left alone.
 */
async function linkSubscription(session: any, db: any): Promise<void> {
  const subscriptionId =
    typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
  if (!subscriptionId) return;

  const firstInvoiceId = (session.metadata?.invoice_ids || '').split(',')[0]?.trim();
  if (!firstInvoiceId) return;

  try {
    const { error } = await db
      .from('admissions_plans')
      .update({ stripe_subscription_id: subscriptionId })
      .eq('invoice_id', firstInvoiceId)
      .is('stripe_subscription_id', null);
    if (error) throw new Error(error.message);

    // Bring the plan's period end and status into line straight away, so the
    // billing page can say when the next charge is without waiting for a
    // webhook that may be minutes behind, or absent locally.
    const sub = await getStripe().subscriptions.retrieve(subscriptionId);
    await syncPlanFromSubscription(db, sub);
  } catch (err: any) {
    // The money has moved and the plan is granted. Failing to record the link
    // is worth shouting about, not worth failing the confirmation over.
    console.error('stripe-confirm: could not link the subscription:', err?.message ?? err);
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
          stripe_charge_id: await chargeIdFor(session.payment_intent),
        })
        .in('id', invoiceIds)
        .eq('status', 'open');

      // Nothing is owed to the tutor yet. An earning is written when a lesson
      // is delivered, not when it is bought. See api/_utils/earnings.ts.

      // The same fulfilment as the webhook. Both can fire for one payment, so
      // every step of it is idempotent.
      await fulfilInvoices(db, invoiceIds);

      // The subscription behind a counselling plan, so every later month can
      // find the plan it belongs to.
      await linkSubscription(session, db);
    }

    return res.status(200).json({ status: 'paid' });
  } catch (err: any) {
    console.error('stripe-confirm error:', err);
    return res.status(err.message?.includes('session') ? 401 : 500).json({ error: err.message || 'Server error' });
  }
}
