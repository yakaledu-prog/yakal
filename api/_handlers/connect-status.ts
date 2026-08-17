import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getStripe } from '../_utils/billing.js';
import { getServiceClient, requireUser } from '../_utils/supabase.js';

// ============================================================
// Ask Stripe directly whether an account can be paid yet.
//
// account.updated normally answers this, but a webhook is a thing that can be
// missed: locally it needs the Stripe CLI forwarding, and in production a
// delivery can fail. Somebody who has just finished onboarding and is looking
// at a page that still says "connect your bank" will not wait for a retry.
//
// So this is the pull to the webhook's push. Same destination, and whichever
// arrives first wins.
// ============================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const user = await requireUser(req);
    const db = getServiceClient();

    // An admin can refresh anybody, so a stuck tutor can be unstuck without
    // asking them to log in. Everybody else refreshes only themselves.
    const { data: me } = await db.from('profiles').select('role').eq('id', user.id).single();
    const targetId: string =
      me?.role === 'admin' && req.body?.profileId ? req.body.profileId : user.id;

    const { data: profile } = await db
      .from('profiles')
      .select('id, stripe_account_id, stripe_payouts_enabled')
      .eq('id', targetId)
      .single();

    if (!profile?.stripe_account_id) {
      return res.status(200).json({ accountId: null, payoutsEnabled: false, started: false });
    }

    const stripe = getStripe();

    // v1 first, then v2. An account created either way is stored in the same
    // column and its id does not say which, so the only way to find out is to
    // ask and see.
    let payoutsEnabled = false;
    let needs: string[] = [];
    try {
      const account = await stripe.accounts.retrieve(profile.stripe_account_id);
      payoutsEnabled = !!account.payouts_enabled;
      // What Stripe is still waiting for, so a stuck tutor can be told why
      // rather than left to guess.
      needs = account.requirements?.currently_due ?? [];
    } catch (v1Err: any) {
      console.warn('connect-status: v1 retrieve failed, trying v2:', v1Err?.message);
      const v2: any = await stripe.v2.core.accounts.retrieve(profile.stripe_account_id, {
        include: ['configuration.recipient'],
      });
      // v2 has no payouts_enabled. The equivalent is whether the capability
      // that lets them receive transfers has actually come through.
      const transfers =
        v2?.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers;
      payoutsEnabled = transfers?.status === 'active';
      // status_details is empty while active, which is exactly when there is
      // nothing outstanding to report.
      needs = (transfers?.status_details ?? []).map((d: any) => d?.code ?? 'unknown');
    }

    if (payoutsEnabled !== profile.stripe_payouts_enabled) {
      await db
        .from('profiles')
        .update({ stripe_payouts_enabled: payoutsEnabled })
        .eq('id', profile.id);
    }

    return res.status(200).json({
      accountId: profile.stripe_account_id,
      payoutsEnabled,
      started: true,
      needs,
    });
  } catch (err: any) {
    console.error('connect-status error:', err);

    const raw: string = err?.message ?? '';
    if (/session|authorization|token/i.test(raw)) {
      return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
    }
    // The same reason as connect-onboard: Stripe's messages are written for
    // whoever wrote the integration, not for the tutor reading the page.
    return res.status(502).json({ error: 'Could not check your payout status. Please try again shortly.' });
  }
}
