import { VercelRequest, VercelResponse } from '@vercel/node';
import type Stripe from 'stripe';
import { getStripe, getServiceClient } from './utils/billing';

// Vercel: receive the raw body so we can verify the Stripe signature.
export const config = { api: { bodyParser: false } };

async function readRawBody(req: any): Promise<Buffer> {
  if (Buffer.isBuffer(req.body)) return req.body;                 // express.raw (local dev)
  if (typeof req.body === 'string') return Buffer.from(req.body);
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks);
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
        const { error } = await db
          .from('invoices')
          .update({
            status: 'paid',
            paid_at: new Date().toISOString(),
            stripe_payment_intent_id:
              typeof session.payment_intent === 'string' ? session.payment_intent : null,
          })
          .in('id', invoiceIds);
        if (error) console.error('Failed to mark invoices paid:', error.message);

        // The tutor's cut becomes a pending payout once paid.
        await db
          .from('invoices')
          .update({ payout_status: 'pending' })
          .in('id', invoiceIds)
          .not('tutor_id', 'is', null)
          .eq('payout_status', 'none');
      }
    }
    return res.status(200).json({ received: true });
  } catch (err: any) {
    console.error('Webhook handler error:', err);
    return res.status(500).json({ error: 'Webhook handler failed' });
  }
}
