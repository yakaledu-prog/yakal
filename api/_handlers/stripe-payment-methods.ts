import { VercelRequest, VercelResponse } from '@vercel/node';
import { getStripe, getServiceClient, requireUser } from '../_utils/billing';

// Returns the parent's saved cards (brand, last4, expiry, default flag) so the
// billing page can show the connected card instead of dev-speak.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await requireUser(req);
    const db = getServiceClient();

    const { data: mapping } = await db
      .from('billing_customers')
      .select('stripe_customer_id')
      .eq('profile_id', user.id)
      .maybeSingle();

    if (!mapping?.stripe_customer_id) return res.status(200).json({ methods: [] });

    const stripe = getStripe();
    const customerId = mapping.stripe_customer_id;

    const [customer, list] = await Promise.all([
      stripe.customers.retrieve(customerId),
      stripe.paymentMethods.list({ customer: customerId, type: 'card', limit: 10 }),
    ]);

    const defaultPm =
      customer && !('deleted' in customer)
        ? (customer.invoice_settings?.default_payment_method as string | null)
        : null;

    // Checkout creates a fresh PaymentMethod on every payment, so the same
    // physical card shows up multiple times. Collapse by card fingerprint
    // (identical for the same card) and keep the default if present.
    const byFingerprint = new Map<string, any>();
    for (const pm of list.data) {
      const key = pm.card?.fingerprint || pm.id;
      const isDefault = pm.id === defaultPm;
      const existing = byFingerprint.get(key);
      if (!existing || isDefault) {
        byFingerprint.set(key, {
          id: pm.id,
          brand: pm.card?.brand ?? 'card',
          last4: pm.card?.last4 ?? '****',
          exp_month: pm.card?.exp_month ?? null,
          exp_year: pm.card?.exp_year ?? null,
          isDefault,
        });
      }
    }

    const methods = Array.from(byFingerprint.values());
    // If Stripe hasn't flagged a default, treat the first as default.
    if (methods.length > 0 && !methods.some((m) => m.isDefault)) methods[0].isDefault = true;

    return res.status(200).json({ methods });
  } catch (err: any) {
    console.error('stripe-payment-methods error:', err);
    return res.status(err.message?.includes('session') ? 401 : 500).json({ error: err.message || 'Server error' });
  }
}
