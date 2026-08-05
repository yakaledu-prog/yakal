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
