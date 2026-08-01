import { VercelRequest, VercelResponse } from '@vercel/node';
import { getStripe, getServiceClient, requireUser } from './utils/billing';

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
    const account = await stripe.accounts.retrieve(profile.stripe_account_id);
    const payoutsEnabled = !!account.payouts_enabled;

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
      // What Stripe is still waiting for, so a stuck tutor can be told why
      // rather than left to guess.
      needs: account.requirements?.currently_due ?? [],
    });
  } catch (err: any) {
    console.error('connect-status error:', err);
    return res
      .status(err.message?.includes('session') ? 401 : 500)
      .json({ error: err.message || 'Server error' });
  }
}
