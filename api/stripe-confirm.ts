import { VercelRequest, VercelResponse } from '@vercel/node';
import { getStripe, getServiceClient, requireUser } from './utils/billing';
import { fulfilInvoices } from './utils/fulfil';

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
    }

    return res.status(200).json({ status: 'paid' });
  } catch (err: any) {
    console.error('stripe-confirm error:', err);
    return res.status(err.message?.includes('session') ? 401 : 500).json({ error: err.message || 'Server error' });
  }
}
