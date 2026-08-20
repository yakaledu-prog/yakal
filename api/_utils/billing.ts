import Stripe from 'stripe';

/**
 * Stripe for the billing serverless functions.
 *
 * Only Stripe. The Supabase helpers that used to sit here now live in
 * supabase.ts, because importing one of those pulled the 16 MB Stripe SDK into
 * every function that touched them - including the Google one, which bills
 * nothing and was pushed past Vercel's 250 MB unzipped limit as a result.
 * Importing from here should mean you charge somebody.
 */

let _stripe: Stripe | null = null;
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured');
  // Let the SDK use its pinned apiVersion (2026-06-24.dahlia).
  if (!_stripe) _stripe = new Stripe(key);
  return _stripe;
}

/**
 * The charge behind a payment intent.
 *
 * A transfer's source_transaction has to name a charge, and a checkout session
 * only carries the intent, which is the attempt rather than the money. Resolved
 * once when a payment lands and stored on the invoice, because the alternative
 * is a Stripe call per earning at release time, months later, on a path that
 * must not fail for want of network.
 *
 * Null on failure rather than throwing. Marking the invoice paid matters more
 * than the transfer hint, and an earning with no source charge still transfers,
 * just out of the general balance.
 */
export async function chargeIdFor(paymentIntent: unknown): Promise<string | null> {
  const id =
    typeof paymentIntent === 'string'
      ? paymentIntent
      : ((paymentIntent as { id?: string } | null)?.id ?? null);
  if (!id) return null;

  try {
    const intent = await getStripe().paymentIntents.retrieve(id);
    const latest = (intent as { latest_charge?: string | { id?: string } }).latest_charge;
    return typeof latest === 'string' ? latest : (latest?.id ?? null);
  } catch (err) {
    console.error('could not resolve the charge for', id, (err as Error)?.message);
    return null;
  }
}
