import type { VercelRequest, VercelResponse } from '@vercel/node';
import type Stripe from 'stripe';
import { getStripe } from '../_utils/billing.js';
import { getServiceClient, requireUser } from '../_utils/supabase.js';
import { priceForTier, priceIdOf, syncPlanFromSubscription } from '../_utils/subscriptions.js';

// ============================================================
// Changing or ending a counselling subscription.
//
// Three operations, and the asymmetry between the first two is deliberate
// rather than an oversight.
//
//   upgrade    takes effect now, and charges the difference now. Stripe credits
//              the unused part of the month already paid for and bills the rest
//              immediately, so a family that wants more gets it today.
//
//   downgrade  takes effect at the end of the month they have already paid for.
//              No refund, no proration, and nothing to reconcile: they keep
//              what they bought until it runs out. This is what makes the
//              "what about the sessions they already used this month" question
//              disappear rather than need answering.
//
//   cancel     the same rule as a downgrade. Access to the end of the period,
//              then it stops.
//
// Every one of them is a Stripe call. Nothing here works out a prorated amount
// or a period end by hand, because the moment two systems both compute money
// they eventually disagree, and the one customers can see is Stripe's.
// ============================================================

interface LoadedPlan {
  id: string;
  student_id: string;
  purchased_by: string | null;
  tier_id: string;
  status: string;
  stripe_subscription_id: string;
  stripe_schedule_id: string | null;
  pending_tier_id: string | null;
}

/** The plan and its subscription, once the caller has been shown to own it. */
async function loadPlan(
  db: any,
  planId: string,
  userId: string
): Promise<{ error: string; plan?: never } | { plan: LoadedPlan; error?: never }> {
  const { data: plan } = await db
    .from('admissions_plans')
    .select('id, student_id, purchased_by, tier_id, status, stripe_subscription_id, stripe_schedule_id, pending_tier_id')
    .eq('id', planId)
    .maybeSingle();

  if (!plan) return { error: 'That plan no longer exists.' as const };

  // The person who bought it, or an admin. A student must not be able to
  // upgrade the plan their parent is paying for.
  if (plan.purchased_by !== userId) {
    const { data: me } = await db.from('profiles').select('role').eq('id', userId).single();
    if (me?.role !== 'admin') return { error: 'That is not your subscription.' as const };
  }

  if (!plan.stripe_subscription_id) {
    return { error: 'This plan has no subscription attached, so it cannot be changed here.' as const };
  }
  if (plan.status === 'canceled') {
    return { error: 'That subscription has already ended.' as const };
  }

  return { plan };
}

/**
 * Move to a more expensive tier, now.
 *
 * always_invoice rather than the default create_prorations: the default puts
 * the difference on the next monthly invoice, so a family would get the better
 * tier immediately and pay for it in four weeks. Billing it now keeps what they
 * have and what they have paid for the same thing.
 */
async function upgrade(
  stripe: Stripe,
  sub: Stripe.Subscription,
  newPriceId: string
): Promise<Stripe.Subscription> {
  return stripe.subscriptions.update(sub.id, {
    items: [{ id: sub.items.data[0].id, price: newPriceId }],
    proration_behavior: 'always_invoice',
    // The upgrade is the customer's decision, so a card that fails should say
    // so rather than quietly leaving them on the old tier.
    payment_behavior: 'error_if_incomplete',
  });
}

/**
 * Move to a cheaper tier, at the end of the period.
 *
 * A subscription schedule rather than a date we hold and act on later. Stripe
 * performs the switch itself, which means no cron of ours, no state to keep in
 * step, and no window where our idea of the period end and Stripe's disagree.
 */
async function downgrade(
  stripe: Stripe,
  sub: Stripe.Subscription,
  currentPriceId: string,
  newPriceId: string,
  existingScheduleId: string | null
): Promise<Stripe.SubscriptionSchedule> {
  // Changing their mind before the first change lands updates the schedule that
  // is already there. Creating a second one against the same subscription is
  // refused by Stripe, and would be the wrong answer anyway.
  const schedule = existingScheduleId
    ? await stripe.subscriptionSchedules.retrieve(existingScheduleId)
    : await stripe.subscriptionSchedules.create({ from_subscription: sub.id });

  const current = schedule.phases[0];

  return stripe.subscriptionSchedules.update(schedule.id, {
    // Hand the subscription back to itself once the second phase begins, so it
    // carries on renewing monthly instead of stopping.
    end_behavior: 'release',
    phases: [
      {
        items: [{ price: currentPriceId, quantity: 1 }],
        start_date: current.start_date,
        end_date: current.end_date,
      },
      { items: [{ price: newPriceId, quantity: 1 }] },
    ],
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const user = await requireUser(req);
    const db = getServiceClient();
    const stripe = getStripe();

    const planId: string = req.body?.planId;
    const op: string = req.body?.op;
    if (!planId) return res.status(400).json({ error: 'planId required' });

    const loaded = await loadPlan(db, planId, user.id);
    if (!loaded.plan) {
      return res.status(loaded.error.includes('not your') ? 403 : 400).json({ error: loaded.error });
    }
    const plan = loaded.plan;
    const sub = await stripe.subscriptions.retrieve(plan.stripe_subscription_id);

    // ---- cancel, and undo a cancel ----

    if (op === 'cancel' || op === 'resume') {
      const cancelling = op === 'cancel';

      // A pending downgrade and a pending cancellation are two answers to the
      // same question. Cancelling wins, so the schedule is dropped rather than
      // left to switch a tier on somebody who is leaving.
      if (cancelling && plan.stripe_schedule_id) {
        await stripe.subscriptionSchedules.release(plan.stripe_schedule_id).catch(() => undefined);
        await db
          .from('admissions_plans')
          .update({ stripe_schedule_id: null, pending_tier_id: null })
          .eq('id', plan.id);
      }

      const updated = await stripe.subscriptions.update(sub.id, {
        cancel_at_period_end: cancelling,
      });
      await syncPlanFromSubscription(db, updated);

      return res.status(200).json({
        cancelAtPeriodEnd: cancelling,
        // The date is the whole of what a parent wants to know here.
        periodEnd: updated.cancel_at
          ? new Date(updated.cancel_at * 1000).toISOString()
          : null,
      });
    }

    // ---- change tier ----

    if (op !== 'change') return res.status(400).json({ error: `Unknown operation: ${op}` });

    const tierId: string = req.body?.tierId;
    if (!tierId) return res.status(400).json({ error: 'tierId required' });

    if (tierId === plan.tier_id) {
      // Asking for the tier they are on already, while a downgrade is waiting
      // to happen, is somebody changing their mind and wanting to stay. Telling
      // them they are already on it would be true and useless: the change would
      // still land at the end of the month with no way left to stop it.
      if (plan.stripe_schedule_id) {
        await stripe.subscriptionSchedules.release(plan.stripe_schedule_id).catch(() => undefined);
        await db
          .from('admissions_plans')
          .update({
            pending_tier_id: null,
            stripe_schedule_id: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', plan.id);
        return res.status(200).json({ applied: 'kept', tierName: null });
      }
      return res.status(400).json({ error: 'They are already on that plan.' });
    }

    const { data: tier } = await db
      .from('admissions_tiers')
      .select('id, name, price_cents, stripe_price_id, is_active')
      .eq('id', tierId)
      .maybeSingle();

    if (!tier || !tier.is_active) {
      return res.status(400).json({ error: 'That plan is not available.' });
    }

    const { data: currentTier } = await db
      .from('admissions_tiers')
      .select('price_cents')
      .eq('id', plan.tier_id)
      .maybeSingle();

    const newPriceId = await priceForTier(db, tier);
    const currentPriceId = priceIdOf(sub);
    const isUpgrade = (tier.price_cents ?? 0) > (currentTier?.price_cents ?? 0);

    if (isUpgrade) {
      // A schedule owns the subscription while it exists, and Stripe refuses to
      // let the subscription be edited out from under one. Releasing it hands
      // control back; the pending downgrade is being replaced by this upgrade
      // either way.
      if (plan.stripe_schedule_id) {
        await stripe.subscriptionSchedules.release(plan.stripe_schedule_id).catch(() => undefined);
        await db
          .from('admissions_plans')
          .update({ pending_tier_id: null, stripe_schedule_id: null })
          .eq('id', plan.id);
      }

      const updated = await upgrade(stripe, sub, newPriceId);
      await syncPlanFromSubscription(db, updated);
      return res.status(200).json({ applied: 'now', tierName: tier.name });
    }

    if (!currentPriceId) {
      return res.status(400).json({
        error: 'This subscription has no price on it, so a downgrade cannot be scheduled.',
      });
    }

    const schedule = await downgrade(
      stripe,
      sub,
      currentPriceId,
      newPriceId,
      plan.stripe_schedule_id
    );

    // Held here so the billing page can say "changes to Essential on the 1st"
    // without asking Stripe on every render. Stripe still owns the switch.
    await db
      .from('admissions_plans')
      .update({
        pending_tier_id: tier.id,
        stripe_schedule_id: schedule.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', plan.id);

    const startsAt = schedule.phases[1]?.start_date ?? null;

    return res.status(200).json({
      applied: 'period_end',
      tierName: tier.name,
      startsAt: startsAt ? new Date(startsAt * 1000).toISOString() : null,
    });
  } catch (err: any) {
    console.error('subscription error:', err);

    const raw: string = err?.message ?? '';
    if (/token|session expired|Invalid or expired/i.test(raw)) {
      return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
    }
    // A declined card on an upgrade is the customer's to fix, and Stripe's
    // wording for it is the clearest thing anybody has written on the subject.
    if (err?.type === 'StripeCardError') {
      return res.status(402).json({ error: raw || 'That card was declined.' });
    }
    return res.status(500).json({ error: 'Could not change that subscription.' });
  }
}
