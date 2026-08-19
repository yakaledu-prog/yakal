import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getStripe } from '../_utils/billing.js';
import { getServiceClient, requireUser, appBaseUrl } from '../_utils/supabase.js';

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
    // Which generation of Connect the account was made with, because the
    // onboarding link differs and there is no way to tell from the id.
    let madeWithV2 = false;

    const refreshUrl = `${appBaseUrl(req)}/${profile.role}/earnings?connect=refresh`;
    const returnUrl = `${appBaseUrl(req)}/${profile.role}/earnings?connect=done`;

    if (!accountId) {
      // v1 first, deliberately.
      //
      // It is the path this platform has always used and the one the local
      // Stripe account still has enabled, so the working case stays working.
      // Stripe now refuses v1 creation on accounts that were not already using
      // it, which is why this succeeds locally and fails on the deployed key.
      //
      // Only that refusal falls through to v2. Any other error is a real
      // failure and must not be retried against a different API.
      try {
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
      } catch (v1Err: any) {
        const raw: string = v1Err?.message ?? '';
        if (!/accounts v1|v2\/core\/accounts|feat_accounts_v1_support/i.test(raw)) throw v1Err;

        console.warn('connect-onboard: v1 accounts refused, creating through v2 instead');

        // The same account in v2 terms. A tutor is a recipient: they receive
        // transfers into a Stripe balance and pay out to their bank. They are
        // not a merchant, because the parent pays Yakal and the charge stays on
        // Yakal's account, which is what makes the platform the merchant of
        // record.
        const v2 = await stripe.v2.core.accounts.create({
          contact_email: profile.email ?? undefined,
          display_name: profile.full_name ?? undefined,
          // Express, matching v1: Stripe hosts the dashboard and collects the
          // identity, tax and bank details, so none of it touches this server.
          dashboard: 'express',
          identity: { country: 'US', entity_type: 'individual' },
          // Required by v2 for anything holding a Stripe balance, and the
          // reason the first attempt at this failed. v1 Express decided both
          // implicitly; v2 makes you say them, which is an improvement.
          //
          // application_express is the Express arrangement: Stripe bills the
          // platform rather than the tutor. losses_collector application means
          // Yakal carries a negative balance if one ever happens, which is
          // what Express already did and is not a change.
          //
          // requirements_collector belongs here by the SDK's types and is
          // rejected by the API as an unknown field, so it is deliberately
          // absent. Stripe collects them, which is what dashboard express
          // means.
          defaults: {
            responsibilities: {
              fees_collector: 'application_express',
              losses_collector: 'application',
            },
          },
          configuration: {
            recipient: {
              capabilities: { stripe_balance: { stripe_transfers: { requested: true } } },
            },
          },
          include: ['configuration.recipient', 'identity'],
          metadata: { profile_id: profile.id, name: profile.full_name ?? '' },
        });
        accountId = v2.id;
        madeWithV2 = true;
      }

      await db.from('profiles').update({ stripe_account_id: accountId }).eq('id', profile.id);
    }

    // Single use and short lived, so it is minted per visit rather than
    // stored. Returning to a spent link is the most common way onboarding
    // fails, and refresh_url sends them back here for a new one.
    //
    // An account made through v2 needs a v2 link. Tried in that order for an
    // account this request did not create, since the id alone does not say
    // which it is.
    const mintV1Link = () =>
      stripe.accountLinks.create({
        account: accountId!,
        type: 'account_onboarding',
        refresh_url: refreshUrl,
        return_url: returnUrl,
      }).then((l) => l.url);

    const mintV2Link = () =>
      stripe.v2.core.accountLinks.create({
        account: accountId!,
        use_case: {
          type: 'account_onboarding',
          account_onboarding: {
            configurations: ['recipient'],
            refresh_url: refreshUrl,
            return_url: returnUrl,
          },
        },
      }).then((l: any) => l.url as string);

    let url: string;
    if (madeWithV2) {
      url = await mintV2Link();
    } else {
      try {
        url = await mintV1Link();
      } catch (linkErr: any) {
        // A v2 account reached here because a previous visit created it. Its id
        // is stored and looks like any other, so this is the only way to find
        // out.
        console.warn('connect-onboard: v1 account link failed, trying v2:', linkErr?.message);
        url = await mintV2Link();
      }
    }

    return res.status(200).json({ url, accountId });
  } catch (err: any) {
    // The whole message, for whoever has to fix it.
    console.error('connect-onboard error:', err);

    const raw: string = err?.message ?? '';

    if (/session|authorization|token/i.test(raw)) {
      return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
    }

    // Stripe has stopped creating v1 Connect accounts on platforms that were
    // not already using them, which is why this works against one Stripe
    // account and fails against another: the two environments hold different
    // keys, and only the older account has v1 enabled.
    //
    // Both fixes are somebody's decision rather than a retry, so say which
    // rather than inviting a tutor to press the button again.
    if (/accounts v1|v2\/core\/accounts|feat_accounts_v1_support/i.test(raw)) {
      return res.status(503).json({
        error:
          'Bank payouts are not enabled on this Stripe account yet. This needs an ' +
          'administrator: either turn on Accounts v1 support in the Stripe dashboard, ' +
          'or move the platform to Accounts v2. Nothing is wrong with your account.',
      });
    }

    // Anything else is a Stripe message written for developers. A tutor who
    // wanted to add their bank details got a wall of API documentation, links
    // and a shell command, none of which is theirs to act on.
    return res.status(502).json({
      error: 'Could not start bank setup. Please try again, or contact Yakal support if it keeps failing.',
    });
  }
}
