import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getStripe } from '../_utils/billing.js';
import { getServiceClient, requireUser } from '../_utils/supabase.js';

// ============================================================
// A payee's own Stripe dashboard.
//
// Express accounts come with a hosted dashboard, and it already does the things
// this platform would otherwise have to build: the balance, the payout history,
// changing a bank account, downloading a 1099, and taking an instant payout
// when they do not want to wait for the weekly run. None of it is worth
// rebuilding, and a bank form we host is a bank form we are liable for.
//
// The link is single use and short lived, so it is minted per request rather
// than stored, exactly like the onboarding link next door.
// ============================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const user = await requireUser(req);
    const db = getServiceClient();

    // Their own account, always. There is deliberately no admin override here:
    // a login link is a way into somebody's money, and an admin who needs to
    // see a connected account can do it from the platform's Stripe dashboard
    // under their own name, where it is logged as them.
    const { data: profile } = await db
      .from('profiles')
      .select('id, role, stripe_account_id')
      .eq('id', user.id)
      .single();

    if (!profile || !['tutor', 'counselor'].includes(profile.role)) {
      return res.status(403).json({ error: 'Only tutors and counselors have a payouts dashboard' });
    }

    if (!profile.stripe_account_id) {
      return res.status(400).json({ error: 'Connect a bank first.' });
    }

    const stripe = getStripe();

    // v1 first, then v2, for the reason spelled out in connect-onboard.ts: the
    // stored id does not say which API made the account, and this platform has
    // accounts from both.
    let url: string;
    try {
      const link = await stripe.accounts.createLoginLink(profile.stripe_account_id);
      url = link.url;
    } catch (v1Err: any) {
      console.warn('connect-dashboard: v1 login link failed, trying v2:', v1Err?.message);
      const link: any = await (stripe as any).v2.core.accountLinks.create({
        account: profile.stripe_account_id,
        use_case: {
          type: 'account_update',
          account_update: { configurations: ['recipient'] },
        },
      });
      url = link.url as string;
    }

    return res.status(200).json({ url });
  } catch (err: any) {
    console.error('connect-dashboard error:', err);

    const raw: string = err?.message ?? '';
    if (/session|authorization|token/i.test(raw)) {
      return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
    }

    // Stripe refuses a login link for an account that has not finished
    // onboarding, and that is worth saying plainly rather than as an API error.
    if (/not.*(completed|onboard)|capabilit/i.test(raw)) {
      return res.status(400).json({ error: 'Finish connecting your bank first.' });
    }

    return res.status(502).json({ error: 'Could not open your payouts dashboard. Please try again.' });
  }
}
