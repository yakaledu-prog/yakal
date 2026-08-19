// ============================================================
// Counselling subscriptions.
//
// A tier is a monthly price a family subscribes to, for as long as they want
// it. Stripe Billing owns the hard parts: proration on an upgrade, the switch
// at period end on a downgrade, the retries when a card fails. What lives here
// is the translation between a Stripe subscription and the plan row that mirrors
// it, and the one rule Stripe cannot know: which tier a Price belongs to.
//
// The plan row is a mirror, never the source of truth. Anything that decides
// what a family is entitled to reads it, but every write to it comes from a
// Stripe object, so a change made in the Stripe dashboard is not a state the
// two can disagree about for long.
// ============================================================

import type Stripe from 'stripe';
import { getStripe } from './billing.js';

export interface TierRow {
  id: string;
  name: string;
  price_cents: number;
  stripe_price_id: string | null;
}

/**
 * The Stripe Price for a tier, made if it is not there yet.
 *
 * Stripe will not let a Price's amount be edited, so a repriced tier gets a new
 * Price rather than a changed one. Families already subscribed stay on the old
 * Price until they change tier, which is the correct behaviour: a subscription
 * is an agreement about a number, and changing that number under somebody
 * without telling them is not a repricing, it is a surprise.
 *
 * The stored id is checked against Stripe rather than trusted, because the two
 * can drift: a Price deleted or archived in the dashboard leaves an id here
 * that no longer bills anything, and the failure would otherwise surface at
 * checkout in front of a customer.
 */
export async function priceForTier(db: any, tier: TierRow): Promise<string> {
  const stripe = getStripe();

  if (tier.stripe_price_id) {
    try {
      const existing = await stripe.prices.retrieve(tier.stripe_price_id);
      const matches =
        existing.active &&
        existing.unit_amount === tier.price_cents &&
        existing.recurring?.interval === 'month';
      if (matches) return existing.id;
    } catch {
      // Gone from Stripe. Fall through and make a new one rather than failing a
      // purchase over a stale id.
    }
  }

  const price = await stripe.prices.create({
    currency: 'usd',
    unit_amount: tier.price_cents,
    recurring: { interval: 'month' },
    // product_data rather than a product we manage: there is exactly one price
    // per tier at a time, so a separate product to keep in step buys nothing.
    product_data: { name: `${tier.name} admissions counselling` },
    metadata: { tier_id: tier.id },
  });

  const { error } = await db
    .from('admissions_tiers')
    .update({ stripe_price_id: price.id, updated_at: new Date().toISOString() })
    .eq('id', tier.id);

  // Loud, not fatal. The Price exists and the checkout can use it; the next
  // purchase simply makes another one until this is fixed.
  if (error) console.error(`could not store the Stripe price for tier ${tier.id}:`, error.message);

  return price.id;
}

/**
 * When the month a family has already paid for runs out.
 *
 * Stripe moved this from the subscription to its items, and which one carries
 * it depends on the API version the SDK is pinned to. Reading both means this
 * does not silently start returning null the day that pin moves, which would
 * show every parent "next charge: unknown" and nothing would error.
 */
export function periodEndOf(sub: Stripe.Subscription): string | null {
  const raw =
    (sub as any).current_period_end ?? (sub.items?.data?.[0] as any)?.current_period_end ?? null;
  return typeof raw === 'number' ? new Date(raw * 1000).toISOString() : null;
}

/** The tier a live subscription is billing for, by its Price. */
export function priceIdOf(sub: Stripe.Subscription): string | null {
  const price = sub.items?.data?.[0]?.price;
  return typeof price === 'string' ? price : (price?.id ?? null);
}

/**
 * Stripe's status, in ours.
 *
 * Deliberately coarse. Stripe distinguishes incomplete, unpaid, paused and
 * several more; the platform only ever asks whether counselling is on, whether
 * somebody needs chasing, and whether it is over.
 */
export function planStatusFor(stripeStatus: Stripe.Subscription.Status): string {
  if (stripeStatus === 'canceled' || stripeStatus === 'incomplete_expired') return 'canceled';
  if (stripeStatus === 'past_due' || stripeStatus === 'unpaid') return 'past_due';
  return 'active';
}

/**
 * Bring the plan row into line with a Stripe subscription.
 *
 * Called from every subscription webhook and from the handler that changes a
 * tier, so a change made in the Stripe dashboard lands here exactly as one made
 * through the app does. Returns false when no plan matches, which is normal:
 * the Stripe account may carry subscriptions this platform did not create.
 */
export async function syncPlanFromSubscription(
  db: any,
  sub: Stripe.Subscription
): Promise<boolean> {
  const { data: plan } = await db
    .from('admissions_plans')
    .select('id, tier_id, status')
    .eq('stripe_subscription_id', sub.id)
    .maybeSingle();

  if (!plan) return false;

  const status = planStatusFor(sub.status);
  const priceId = priceIdOf(sub);

  // Which tier they are on now. On a downgrade this only changes once Stripe's
  // schedule actually switches the price, which is the whole point of doing it
  // that way: nothing here has to decide when the month ends.
  let tierId = plan.tier_id;
  if (priceId) {
    const { data: tier } = await db
      .from('admissions_tiers')
      .select('id')
      .eq('stripe_price_id', priceId)
      .maybeSingle();
    if (tier) tierId = tier.id;
  }

  const update: Record<string, unknown> = {
    status,
    tier_id: tierId,
    current_period_end: periodEndOf(sub),
    cancel_at_period_end: !!sub.cancel_at_period_end,
    updated_at: new Date().toISOString(),
  };

  // A scheduled downgrade that has arrived is no longer pending.
  if (tierId !== plan.tier_id) {
    update.pending_tier_id = null;
    update.stripe_schedule_id = null;
  }
  if (status === 'canceled') {
    update.ended_at = new Date().toISOString();
    update.pending_tier_id = null;
    update.stripe_schedule_id = null;
  }

  const { error } = await db.from('admissions_plans').update(update).eq('id', plan.id);
  if (error) {
    console.error(`could not sync plan ${plan.id} from subscription ${sub.id}:`, error.message);
    return false;
  }
  return true;
}
