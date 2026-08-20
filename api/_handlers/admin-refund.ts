import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getServiceClient, requireUser } from '../_utils/supabase.js';
import { costToUs, refundInvoice } from '../_utils/refunds.js';
import { cancelEarningsForCharge } from '../_utils/earnings.js';

// ============================================================
// An admin giving money back, outside the cancellation rules.
//
// Goodwill, a complaint, a mistake. The rules-driven path is session-cancel;
// this is the one where a person has decided.
//
// The point of it is the number it shows first. A refund is cheap while the
// money is still in the platform balance and expensive once it has been paid
// out to a tutor or counsellor for work they actually did, because refunding
// the family does not take that back and clawing it out of somebody's bank is
// not an API call. Which of those two a refund is depends on when it happens,
// and nothing else on the screen would say so.
//
// So `preview` answers with what it costs, and the admin decides knowing it.
// ============================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const user = await requireUser(req);
    const db = getServiceClient();

    const { data: me } = await db.from('profiles').select('role').eq('id', user.id).single();
    if (me?.role !== 'admin') return res.status(403).json({ error: 'Admins only' });

    const invoiceId: string = req.body?.invoiceId;
    const preview: boolean = !!req.body?.preview;
    const note: string | null = (req.body?.note ?? '').toString().trim().slice(0, 500) || null;
    if (!invoiceId) return res.status(400).json({ error: 'invoiceId required' });

    const { data: invoice } = await db
      .from('invoices')
      .select('id, amount_cents, currency, status, stripe_charge_id, description')
      .eq('id', invoiceId)
      .maybeSingle();

    if (!invoice) return res.status(404).json({ error: 'That invoice no longer exists.' });
    if (invoice.status !== 'paid') {
      return res.status(400).json({ error: 'Nothing was taken for that, so there is nothing to give back.' });
    }

    // What has already gone back, so a second refund cannot exceed the charge.
    // Stripe would refuse it anyway, but refusing here says why.
    const { data: already } = await db
      .from('refunds')
      .select('amount_cents')
      .eq('invoice_id', invoice.id)
      .eq('status', 'succeeded');

    const refundedSoFar = (already ?? []).reduce((n, r: any) => n + r.amount_cents, 0);
    const refundable = (invoice.amount_cents ?? 0) - refundedSoFar;

    const requested = Number(req.body?.amountCents);
    const amountCents = Number.isFinite(requested) && requested > 0 ? Math.floor(requested) : refundable;

    if (amountCents > refundable) {
      return res.status(400).json({
        error: `Only ${(refundable / 100).toFixed(2)} of that payment is left to refund.`,
      });
    }

    const cost = await costToUs(db, invoice.stripe_charge_id);

    if (preview) {
      return res.status(200).json({
        amountCents,
        refundable,
        refundedSoFar,
        // The part that is not obvious. Money already paid out for delivered
        // work does not come back with the refund.
        alreadyPaidOutCents: cost.alreadyPaidCents,
        alreadyPaidOutCount: cost.count,
        currency: invoice.currency ?? 'usd',
      });
    }

    if (amountCents <= 0) return res.status(400).json({ error: 'There is nothing left to refund.' });

    const result = await refundInvoice(db, {
      invoiceId: invoice.id,
      amountCents,
      currency: invoice.currency,
      reason: 'admin',
      note,
      requestedBy: user.id,
    });

    if (!result.refunded) {
      return res.status(400).json({ error: result.error ?? 'The refund did not go through.' });
    }

    // Anything still owed on that charge stops being owed. Only pending rows:
    // a settled one is money that has already left, which is what the preview
    // warned about and what cancelEarningsForCharge deliberately will not touch.
    const { cancelled, alreadySettled } = await cancelEarningsForCharge(
      db,
      invoice.stripe_charge_id,
      note ? `Refunded: ${note}` : 'Refunded by an admin.'
    );

    if (alreadySettled > 0) {
      console.error(
        `admin refund on invoice ${invoice.id}: ${alreadySettled} earning(s) had already been paid out and are not recoverable`
      );
    }

    return res.status(200).json({
      refunded: true,
      amountCents: result.amountCents,
      earningsCancelled: cancelled,
      earningsAlreadyPaid: alreadySettled,
    });
  } catch (err: any) {
    console.error('admin-refund error:', err);
    const unauthorised = /token|session expired|Invalid or expired/i.test(err.message ?? '');
    return res.status(unauthorised ? 401 : 500).json({ error: err.message || 'Server error' });
  }
}
