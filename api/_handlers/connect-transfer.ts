import { VercelRequest, VercelResponse } from '@vercel/node';
import { getStripe } from '../_utils/billing';
import { getServiceClient, requireUser } from '../_utils/supabase';

// ============================================================
// Paying a tutor out of the platform balance.
//
// Separate charges and transfers: the parent's payment is untouched, and this
// moves money from the platform to the tutor's connected account whenever an
// admin says so. The alternative, splitting at charge time, would have meant
// rewriting checkout for no benefit at this size.
//
// Everything is checked here rather than trusted from the request. The
// browser says which invoices to settle; the amount, the tutor and whether
// they can be paid at all are read from the database.
// ============================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const user = await requireUser(req);
    const db = getServiceClient();
    const stripe = getStripe();

    const { data: me } = await db.from('profiles').select('role').eq('id', user.id).single();
    if (me?.role !== 'admin') return res.status(403).json({ error: 'Admins only' });

    const invoiceIds: string[] = Array.isArray(req.body?.invoiceIds) ? req.body.invoiceIds : [];
    if (invoiceIds.length === 0) return res.status(400).json({ error: 'Nothing selected' });

    // Only invoices a parent has actually paid, and only ones still owed. A
    // client asking twice must not pay twice.
    const { data: invoices, error: invErr } = await db
      .from('invoices')
      .select('id, tutor_id, payout_cents, currency, description')
      .in('id', invoiceIds)
      .eq('status', 'paid')
      .eq('payout_status', 'pending')
      .not('tutor_id', 'is', null);

    if (invErr) throw new Error(invErr.message);
    if (!invoices || invoices.length === 0) {
      return res.status(400).json({ error: 'Nothing here is still owed' });
    }

    // One transfer goes to one account, so a batch covering two tutors is a
    // request that cannot be honoured as asked.
    const tutorIds = [...new Set(invoices.map((i: any) => i.tutor_id))];
    if (tutorIds.length > 1) {
      return res.status(400).json({ error: 'Pay one tutor at a time' });
    }

    const tutorId = tutorIds[0];
    const { data: tutor } = await db
      .from('profiles')
      .select('id, full_name, stripe_account_id, stripe_payouts_enabled')
      .eq('id', tutorId)
      .single();

    if (!tutor?.stripe_account_id || !tutor.stripe_payouts_enabled) {
      return res.status(400).json({
        error: `${tutor?.full_name ?? 'This tutor'} has not finished connecting their bank. Pay them another way and record it.`,
      });
    }

    const amountCents = invoices.reduce((n: number, i: any) => n + (i.payout_cents ?? 0), 0);
    if (amountCents <= 0) return res.status(400).json({ error: 'Nothing to pay' });

    const currency = (invoices[0] as any).currency || 'usd';

    // A monthly batch is one transfer covering several sessions, not one
    // transfer each: fewer fees, and one reference the tutor can match to one
    // line on their statement.
    const transfer = await stripe.transfers.create(
      {
        amount: amountCents,
        currency,
        destination: tutor.stripe_account_id,
        description: `${invoices.length} session${invoices.length === 1 ? '' : 's'}`,
        metadata: {
          tutor_id: tutorId,
          invoice_ids: invoices.map((i: any) => i.id).join(','),
          recorded_by: user.id,
        },
      },
      // Asking twice for the same invoices produces the same transfer rather
      // than a second one. The most expensive bug in this file is paying
      // somebody twice, so it is the one guarded hardest.
      { idempotencyKey: `payout:${[...invoiceIds].sort().join(',')}` }
    );

    // The record comes first. If this fails the invoices stay owed, which is
    // recoverable; the opposite order would settle them with no receipt.
    const { error: payoutErr } = await db.from('tutor_payouts').insert({
      tutor_id: tutorId,
      invoice_id: invoices.length === 1 ? invoices[0].id : null,
      amount_cents: amountCents,
      currency,
      method: 'stripe_connect',
      reference: transfer.id,
      paid_on: new Date().toISOString().slice(0, 10),
      note: invoices.length > 1 ? `Covers ${invoices.length} invoices` : null,
      recorded_by: user.id,
    });
    if (payoutErr) {
      console.error('connect-transfer: transfer sent but not recorded:', payoutErr.message);
      return res.status(500).json({
        error: 'The transfer went through but could not be recorded. Do not retry, tell a developer.',
        transferId: transfer.id,
      });
    }

    await db
      .from('invoices')
      .update({ payout_status: 'paid' })
      .in('id', invoices.map((i: any) => i.id));

    await db.from('notifications').insert({
      user_id: tutorId,
      type: 'payout',
      title: 'You have been paid',
      message: `${(amountCents / 100).toFixed(2)} ${currency.toUpperCase()} is on its way to your bank. Reference ${transfer.id}.`,
      link: '/tutor/earnings',
    });

    return res.status(200).json({ transferId: transfer.id, amountCents });
  } catch (err: any) {
    console.error('connect-transfer error:', err);
    return res
      .status(err.message?.includes('session') ? 401 : 500)
      .json({ error: err.message || 'Server error' });
  }
}
