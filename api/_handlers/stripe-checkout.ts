import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getStripe } from '../_utils/billing.js';
import { getServiceClient, requireUser, appBaseUrl } from '../_utils/supabase.js';

// ------------------------------------------------------------
// What the Stripe page says.
//
// The layout of Checkout is Stripe's and cannot be changed from here: the
// logo, colours and fonts come from the branding settings in the Stripe
// dashboard, and rearranging the page itself would mean dropping the hosted
// page for embedded Elements.
//
// What is ours is the line item. It used to be one string, "Course with Tutor
// (5 sessions)", so the last thing a parent saw before paying never mentioned
// which child it was for or when the lessons are. Both are now on the page.
// ------------------------------------------------------------

/** "Mon 3 Aug, 12:00" from a booked slot. */
function slotLabel(slot: { date: string; startTime: string }): string {
  const d = new Date(`${slot.date}T00:00:00`);
  const day = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  return `${day}, ${String(slot.startTime).slice(0, 5)}`;
}

/**
 * Who it is for and when.
 *
 * Capped at four times. Stripe gives this a couple of lines before it
 * truncates, and a wall of dates is not read anyway.
 */
function lineDescription(inv: any): string {
  const parts: string[] = [];
  if (inv.student?.full_name) parts.push(`For ${inv.student.full_name}`);

  // On instalments the headline is the monthly figure, so the total has to be
  // somewhere the payer can see it before they commit.
  if (inv.tier && inv.tier.instalment_months > 1) {
    const total = (inv.tier.price_cents / 100).toFixed(2);
    parts.push(`${inv.tier.instalment_months} monthly payments, ${total} in total`);
    return parts.join('. ');
  }

  const slots = Array.isArray(inv.booking) ? inv.booking : [];
  if (slots.length > 0) {
    const shown = slots.slice(0, 4).map(slotLabel);
    const rest = slots.length - shown.length;
    parts.push(shown.join(' - ') + (rest > 0 ? ` and ${rest} more` : ''));
  }

  // Never empty: Stripe rejects a blank description.
  return parts.join('. ') || inv.description;
}

/**
 * One instalment.
 *
 * Rounded down, so N instalments come to at most N-1 cents under the total.
 * Charging a family slightly less than the list price is the safer direction
 * to be wrong in than slightly more.
 */
export function monthlyCents(tier: { price_cents: number; instalment_months: number }): number {
  const months = Math.max(1, tier.instalment_months);
  return Math.floor(tier.price_cents / months);
}

/** Stripe fetches images from its own servers, so localhost is never reachable. */
function publicImage(url: string | null | undefined): boolean {
  return !!url && /^https:\/\//.test(url) && !/localhost|127\.0\.0\.1/.test(url);
}

// Creates a Stripe Checkout Session (mode=payment) for one or more of the
// authenticated parent's OPEN invoices, and returns the hosted-page URL.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const user = await requireUser(req);
    const stripe = getStripe();
    const db = getServiceClient();

    const invoiceIds: string[] = Array.isArray(req.body?.invoiceIds) ? req.body.invoiceIds : [];
    if (invoiceIds.length === 0) return res.status(400).json({ error: 'No invoices selected' });

    // Load the invoices - scoped to THIS parent and still open (server-derived, not client-trusted).
    // The child and the chosen times come along so the Checkout page can say
    // what is being bought rather than only how much it costs.
    const { data: invoices, error: invErr } = await db
      .from('invoices')
      .select(`id, description, amount_cents, currency, status, parent_id, booking,
               student:profiles!invoices_student_id_fkey (full_name),
               course:courses (title, thumbnail_url),
               tier:admissions_tiers (id, name, price_cents, instalment_months)`)
      .in('id', invoiceIds)
      .eq('parent_id', user.id)
      .eq('status', 'open');

    if (invErr) throw new Error(invErr.message);
    if (!invoices || invoices.length === 0) {
      return res.status(400).json({ error: 'No payable invoices found' });
    }

    // Get-or-create the parent's Stripe Customer.
    let customerId: string;
    const { data: existing } = await db
      .from('billing_customers')
      .select('stripe_customer_id')
      .eq('profile_id', user.id)
      .maybeSingle();

    if (existing?.stripe_customer_id) {
      customerId = existing.stripe_customer_id;
    } else {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { profile_id: user.id },
      });
      customerId = customer.id;
      await db.from('billing_customers').upsert({ profile_id: user.id, stripe_customer_id: customerId });
    }

    // Note: `managed_payments` (on by default on newer accounts) requires a tax
    // code per line item. We disable it for these ad-hoc invoices. Cast to any
    // because the field isn't in the SDK's typed params yet.
    // Counselling is a fixed-length engagement collected monthly, so it is a
    // subscription with an end rather than an open one. Only ever one tier per
    // checkout: mixing a recurring line with one-off invoices is not a thing
    // Stripe allows, and is not a basket anyone would build on purpose.
    const tierInvoice = invoices.find((i: any) => i.tier);
    const tier = (tierInvoice as any)?.tier;
    const months: number = tier?.instalment_months ?? 1;
    const isInstalments = !!tier && months > 1;

    if (tier && invoices.length > 1) {
      return res.status(400).json({ error: 'Pay for a counselling plan on its own' });
    }

    const params: any = {
      mode: isInstalments ? 'subscription' : 'payment',
      // Card only. Checkout otherwise leads with Apple Pay, Link and Amazon
      // Pay and files Card into an accordion, so paying by card takes an extra
      // click to find. None of the wallets are set up for this account anyway.
      payment_method_types: ['card'],
      customer: customerId,
      line_items: invoices.map((inv: any) => ({
        quantity: 1,
        price_data: {
          currency: inv.currency || 'usd',
          // An instalment charges the monthly figure, not the total. It is
          // worked out here rather than stored, so a total and a number of
          // months can never disagree with a third number.
          unit_amount: isInstalments ? monthlyCents(tier) : inv.amount_cents,
          ...(isInstalments ? { recurring: { interval: 'month' } } : {}),
          product_data: {
            name: inv.course?.title || inv.description,
            description: lineDescription(inv),
            ...(publicImage(inv.course?.thumbnail_url) ? { images: [inv.course.thumbnail_url] } : {}),
          },
        },
      })),
      // The only wording on the page we control. Says what happens after the
      // money moves, which is the question somebody has with a card in hand.
      custom_text: {
        submit: {
          message: isInstalments
            ? `${months} monthly payments. Counselling starts as soon as the first one goes through.`
            : 'The times you chose are confirmed as soon as this goes through.',
        },
      },
      managed_payments: { enabled: false },
      metadata: {
        invoice_ids: invoices.map((i: any) => i.id).join(','),
        parent_id: user.id,
      },
      success_url: `${appBaseUrl()}/parent/billing?paid=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appBaseUrl()}/parent/billing?canceled=1`,
    };

    if (isInstalments) {
      // The engagement is a fixed length, so the subscription has to stop on
      // its own: relying on a family to cancel means charging the ones who
      // forget for a service that finished months ago.
      //
      // cancel_at cannot be set here. It is a field on a subscription, and at
      // this point the subscription does not exist yet, so Checkout rejects
      // it. It is set on the way back, in stripe-confirm, once there is a
      // subscription to set it on. The months travel in metadata so that step
      // does not have to look them up again.
      params.subscription_data = {
        metadata: {
          invoice_ids: invoices.map((i: any) => i.id).join(','),
          parent_id: user.id,
          tier_id: tier.id,
          months: String(months),
        },
      };
    } else {
      // Keep the card for next time. Subscriptions already save it, and
      // setting this alongside one is rejected.
      params.payment_intent_data = { setup_future_usage: 'off_session' };
    }
    const session = await stripe.checkout.sessions.create(params);

    // Record the session id so we can reconcile if needed.
    await db
      .from('invoices')
      .update({ stripe_checkout_session_id: session.id })
      .in('id', invoices.map((i) => i.id));

    return res.status(200).json({ url: session.url });
  } catch (err: any) {
    console.error('stripe-checkout error:', err);
    return res.status(err.message?.includes('session') ? 401 : 500).json({ error: err.message || 'Server error' });
  }
}
