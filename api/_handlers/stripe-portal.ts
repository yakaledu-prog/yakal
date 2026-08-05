import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getStripe } from '../_utils/billing.js';
import { getServiceClient, requireUser, appBaseUrl } from '../_utils/supabase.js';

// Opens the Stripe Customer Portal so a parent can manage saved payment
// methods and see receipts. Requires the Portal to be enabled in the
// Stripe dashboard (Settings → Billing → Customer portal).
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const user = await requireUser(req);
    const stripe = getStripe();
    const db = getServiceClient();

    const { data: mapping } = await db
      .from('billing_customers')
      .select('stripe_customer_id')
      .eq('profile_id', user.id)
      .maybeSingle();

    if (!mapping?.stripe_customer_id) {
      return res.status(400).json({ error: 'No billing account yet. Make a payment first.' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: mapping.stripe_customer_id,
      return_url: `${appBaseUrl()}/parent/billing`,
    });

    return res.status(200).json({ url: session.url });
  } catch (err: any) {
    console.error('stripe-portal error:', err);
    return res.status(err.message?.includes('session') ? 401 : 500).json({ error: err.message || 'Server error' });
  }
}
