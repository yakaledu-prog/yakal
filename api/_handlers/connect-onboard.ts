import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getStripe } from '../_utils/billing';
import { getServiceClient, requireUser, appBaseUrl } from '../_utils/supabase';

// ============================================================
// A tutor connecting their bank to the platform.
//
// Express accounts, so Stripe collects the bank details, the tax ID and the
// identity documents on its own hosted pages. The platform never sees any of
// it, which is the point: holding a contractor's SSN is a liability nobody
// here wants.
//
// Called twice in practice. Once to start, and again every time they come
// back to finish, because an onboarding link is single use and expires. So
// this creates the account only if there is not one already, and always
// returns a fresh link.
// ============================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const user = await requireUser(req);
    const stripe = getStripe();
    const db = getServiceClient();

    const { data: profile } = await db
      .from('profiles')
      .select('id, role, email, full_name, stripe_account_id')
      .eq('id', user.id)
      .single();

    // Only people who get paid. A parent has no reason to have one of these.
    if (!profile || !['tutor', 'counselor'].includes(profile.role)) {
      return res.status(403).json({ error: 'Only tutors and counselors can be paid this way' });
    }

    let accountId = profile.stripe_account_id;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        email: profile.email ?? undefined,
        country: 'US',
        capabilities: { transfers: { requested: true } },
        business_type: 'individual',
        // So a payout in the Stripe dashboard can be traced back to a person
        // here without a lookup table.
        metadata: { profile_id: profile.id, name: profile.full_name ?? '' },
      });
      accountId = account.id;
      await db.from('profiles').update({ stripe_account_id: accountId }).eq('id', profile.id);
    }

    // Single use and short lived, so it is minted per visit rather than
    // stored. Returning to a spent link is the most common way onboarding
    // fails, and refresh_url sends them back here for a new one.
    const link = await stripe.accountLinks.create({
      account: accountId,
      type: 'account_onboarding',
      refresh_url: `${appBaseUrl()}/${profile.role}/earnings?connect=refresh`,
      return_url: `${appBaseUrl()}/${profile.role}/earnings?connect=done`,
    });

    return res.status(200).json({ url: link.url, accountId });
  } catch (err: any) {
    console.error('connect-onboard error:', err);
    return res
      .status(err.message?.includes('session') ? 401 : 500)
      .json({ error: err.message || 'Server error' });
  }
}
