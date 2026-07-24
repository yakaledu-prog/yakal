import { VercelRequest, VercelResponse } from '@vercel/node';
import { getStripe, getServiceClient, requireUser, appBaseUrl } from './utils/billing';

// Creates a Stripe Checkout Session (mode=payment) for one or more of the
// authenticated parent's OPEN invoices, and returns the hosted-page URL.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const user = await requireUser(req);
    const stripe = getStripe();
    const db = getServiceClient();

    const invoiceIds: string[] = Array.isArray(req.body?.invoiceIds) ? req.body.invoiceIds : [];
    if (invoiceIds.length === 0) return res.status(400).json({ error: 'No invoices selected' });

    // Load the invoices - scoped to THIS parent and still open (server-derived, not client-trusted).
    const { data: invoices, error: invErr } = await db
      .from('invoices')
      .select('id, description, amount_cents, currency, status, parent_id')
      .in('id', invoiceIds)
      .eq('parent_id', user.id)
      .eq('status', 'open');

    if (invErr) throw new Error(invErr.message);
    if (!invoices || invoices.length === 0) {
      return res.status(400).json({ error: 'No payable invoices found' });
    }

    // Get-or-create the parent's Stripe Customer.
    let customerId: string;
    const { data: existing } = await db
      .from('billing_customers')
      .select('stripe_customer_id')
      .eq('profile_id', user.id)
      .maybeSingle();

    if (existing?.stripe_customer_id) {
      customerId = existing.stripe_customer_id;
    } else {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { profile_id: user.id },
      });
      customerId = customer.id;
      await db.from('billing_customers').upsert({ profile_id: user.id, stripe_customer_id: customerId });
    }

    // Note: `managed_payments` (on by default on newer accounts) requires a tax
    // code per line item. We disable it for these ad-hoc invoices. Cast to any
    // because the field isn't in the SDK's typed params yet.
    const params: any = {
      mode: 'payment',
      customer: customerId,
      line_items: invoices.map((inv) => ({
        quantity: 1,
        price_data: {
          currency: inv.currency || 'usd',
          unit_amount: inv.amount_cents,
          product_data: { name: inv.description },
        },
      })),
      // Save the card on the customer so we can show it later ("connected card").
      payment_intent_data: { setup_future_usage: 'off_session' },
      managed_payments: { enabled: false },
      metadata: {
        invoice_ids: invoices.map((i) => i.id).join(','),
        parent_id: user.id,
      },
      success_url: `${appBaseUrl()}/parent/billing?paid=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appBaseUrl()}/parent/billing?canceled=1`,
    };
    const session = await stripe.checkout.sessions.create(params);

    // Record the session id so we can reconcile if needed.
    await db
      .from('invoices')
      .update({ stripe_checkout_session_id: session.id })
      .in('id', invoices.map((i) => i.id));

    return res.status(200).json({ url: session.url });
  } catch (err: any) {
    console.error('stripe-checkout error:', err);
    return res.status(err.message?.includes('session') ? 401 : 500).json({ error: err.message || 'Server error' });
  }
}
