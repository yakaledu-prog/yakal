import { VercelRequest, VercelResponse } from '@vercel/node';
import { getStripe, getServiceClient, getUserClient, requireUser } from './utils/billing';

// ============================================================
// A tutor asks to be paid for one session, and is paid.
//
// Requesting used to be the end of it: the row said "awaiting payment" and
// waited for an admin to notice. That is the right behaviour for a tutor who
// has not connected a bank, and pointless friction for one who has, so the two
// cases are now separated here rather than collapsed into the slower one.
//
// Whether the session happened is decided by request_session_payment, called
// as the tutor so its checks answer for them. This file only decides whether
// the money can move, and every figure it uses is read from the database
// rather than taken from the request.
// ============================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const user = await requireUser(req);
    const db = getServiceClient();

    const sessionId: string = req.body?.sessionId;
    if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

    const { data: session } = await db
      .from('sessions')
      .select('id, tutor_id, subject, date, invoice_id, payout_cents, payout_status')
      .eq('id', sessionId)
      .single();

    if (!session) return res.status(404).json({ error: 'That session no longer exists.' });
    if (session.tutor_id !== user.id) {
      return res.status(403).json({ error: 'Only the tutor who taught a session can ask to be paid for it.' });
    }
    if (session.payout_status === 'paid') {
      return res.status(200).json({ paid: true, alreadyPaid: true });
    }

    // Not yet asked for, so the checks run now. A session already requested but
    // unpaid skips this and goes straight to the transfer, which is what makes
    // calling this twice safe.
    if (session.payout_status === 'none') {
      const { error } = await getUserClient(req).rpc('request_session_payment', {
        p_session_id: sessionId,
      });
      if (error) return res.status(400).json({ error: error.message });
    }

    const { data: tutor } = await db
      .from('profiles')
      .select('id, full_name, stripe_account_id, stripe_payouts_enabled')
      .eq('id', user.id)
      .single();

    // A session nobody paid for cannot pay anybody. This is the seeded and
    // hand-made data rather than anything a parent bought, and saying so beats
    // a transfer of nothing.
    const amountCents = session.payout_cents ?? 0;
    if (amountCents <= 0) {
      return res.status(200).json({
        paid: false,
        reason: 'no_amount',
        message: 'This session has no payment attached to it, so there is nothing to transfer. An admin can settle it by hand.',
      });
    }

    // No connected account, so it waits for an admin. Requested, recorded, and
    // visible to both sides in the meantime.
    if (!tutor?.stripe_account_id || !tutor.stripe_payouts_enabled) {
      return res.status(200).json({
        paid: false,
        reason: 'not_connected',
        message: 'Connect your bank to be paid automatically. Until then an admin will pay this by hand.',
      });
    }

    const stripe = getStripe();
    const transfer = await stripe.transfers.create(
      {
        amount: amountCents,
        currency: 'usd',
        destination: tutor.stripe_account_id,
        description: `${session.subject} on ${session.date}`,
        metadata: { session_id: sessionId, tutor_id: user.id },
      },
      // Asking twice for the same session produces the same transfer rather
      // than a second one. Paying somebody twice is the expensive mistake here,
      // so it is the one guarded hardest.
      { idempotencyKey: `session-payout:${sessionId}` }
    );

    // The record comes first. If this fails the session stays owed, which is
    // recoverable; the opposite order would settle it with no receipt.
    const { error: payoutErr } = await db.from('tutor_payouts').insert({
      tutor_id: user.id,
      session_id: sessionId,
      invoice_id: session.invoice_id,
      amount_cents: amountCents,
      currency: 'usd',
      method: 'stripe_connect',
      reference: transfer.id,
      paid_on: new Date().toISOString().slice(0, 10),
      recorded_by: user.id,
    });
    if (payoutErr) {
      console.error('session-payout: transfer sent but not recorded:', payoutErr.message);
      return res.status(500).json({
        error: 'The transfer went through but could not be recorded. Do not retry, tell a developer.',
        transferId: transfer.id,
      });
    }

    await db.from('sessions').update({ payout_status: 'paid' }).eq('id', sessionId);

    return res.status(200).json({
      paid: true,
      amountCents,
      reference: transfer.id,
    });
  } catch (err: any) {
    console.error('session-payout error:', err);
    // A missing or expired token is the caller's problem to fix by signing in
    // again, not a server fault, and saying 500 sends them nowhere useful.
    const unauthorised = /token|session expired|Invalid or expired/i.test(err.message ?? '');
    return res.status(unauthorised ? 401 : 500).json({ error: err.message || 'Server error' });
  }
}
