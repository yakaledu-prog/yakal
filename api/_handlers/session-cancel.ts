import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getServiceClient, requireUser } from '../_utils/supabase.js';
import { decideCancellation, freeUntil, type CancelledBy } from '../_utils/cancellation.js';
import { refundInvoice } from '../_utils/refunds.js';
import { cancelSessionEarning, recordSessionEarning } from '../_utils/earnings.js';

// ============================================================
// Calling off a lesson, and settling up.
//
// This replaces cancelSession, which set a status from the browser and did
// nothing else: no notice window, nobody refunded, and a tutor's held hour
// worth nothing either way, while the published policy promised all three.
//
// Two modes, and the difference matters. `preview` says what would happen and
// changes nothing, so the confirmation screen can name a figure. `cancel` does
// it. Nothing takes money back from a card without having shown the amount
// first.
// ============================================================

/** Who is cancelling, from who they are to the lesson. */
async function roleFor(
  db: any,
  session: { student_id: string; tutor_id: string },
  userId: string
): Promise<CancelledBy | null> {
  if (session.tutor_id === userId) return 'tutor';
  if (session.student_id === userId) return 'family';

  const { count } = await db
    .from('parent_student_links')
    .select('id', { count: 'exact', head: true })
    .eq('parent_id', userId)
    .eq('student_id', session.student_id)
    .eq('status', 'active');
  if ((count ?? 0) > 0) return 'family';

  const { data: me } = await db.from('profiles').select('role').eq('id', userId).single();
  if (me?.role === 'admin' || me?.role === 'counselor') return 'admin';

  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const user = await requireUser(req);
    const db = getServiceClient();

    const sessionId: string = req.body?.sessionId;
    const preview: boolean = !!req.body?.preview;
    const reason: string | null = (req.body?.reason ?? '').toString().trim().slice(0, 500) || null;
    if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

    const { data: session } = await db
      .from('sessions')
      .select('id, student_id, tutor_id, subject, date, start_time, status, tutor_earning_cents, invoice_id')
      .eq('id', sessionId)
      .maybeSingle();

    if (!session) return res.status(404).json({ error: 'That session no longer exists.' });
    if (session.status !== 'upcoming') {
      return res.status(400).json({ error: 'Only an upcoming lesson can be cancelled.' });
    }

    const by = await roleFor(db, session, user.id);
    if (!by) return res.status(403).json({ error: 'That is not your lesson to cancel.' });

    // The same conversion the database uses, so the deadline shown on screen
    // and the one enforced are the same moment rather than four hours apart.
    const { data: startsAtRaw } = await db.rpc('session_starts_at', {
      p_date: session.date,
      p_start_time: session.start_time,
    });
    const startsAt = new Date(startsAtRaw);
    const now = new Date();

    // What the family paid for this one lesson. Read from the invoice and split
    // the way fulfilment split it, rather than trusting a figure from anywhere.
    const { data: invoice } = session.invoice_id
      ? await db
          .from('invoices')
          .select('id, amount_cents, currency, status, stripe_charge_id')
          .eq('id', session.invoice_id)
          .maybeSingle()
      : { data: null };

    const slotPriceCents = invoice ? await slotShare(db, invoice, session.id) : 0;

    const outcome = decideCancellation({
      slotPriceCents,
      tutorEarningCents: session.tutor_earning_cents ?? 0,
      startsAt,
      now,
      by,
    });

    if (preview) {
      return res.status(200).json({
        ...outcome,
        by,
        freeUntil: freeUntil(startsAt).toISOString(),
        startsAt: startsAt.toISOString(),
        slotPriceCents,
      });
    }

    // ---- do it ----

    const { error: markErr } = await db
      .from('sessions')
      .update({
        status: 'cancelled',
        cancelled_at: now.toISOString(),
        cancelled_by: user.id,
        cancel_reason: reason,
        updated_at: now.toISOString(),
      })
      .eq('id', sessionId)
      // Only from upcoming, so two people pressing cancel at once produces one
      // cancellation and one refund rather than two of each.
      .eq('status', 'upcoming');

    if (markErr) return res.status(500).json({ error: markErr.message });

    // The tutor's side first, because it cannot fail in a way that costs
    // anybody money. A late cancellation still pays them their share of the
    // fee; anything else pays them nothing.
    await cancelSessionEarning(db, sessionId, 'The lesson was cancelled.');

    if (outcome.tutorEarningCents > 0) {
      await recordSessionEarning(db, {
        sessionId,
        payeeId: session.tutor_id,
        amountCents: outcome.tutorEarningCents,
        currency: invoice?.currency ?? 'usd',
        invoiceId: session.invoice_id ?? null,
        sourceChargeId: invoice?.stripe_charge_id ?? null,
      });
    }

    let refund = { refunded: false, amountCents: 0 } as Awaited<ReturnType<typeof refundInvoice>>;
    if (invoice && outcome.refundCents > 0) {
      refund = await refundInvoice(db, {
        invoiceId: invoice.id,
        sessionId,
        amountCents: outcome.refundCents,
        currency: invoice.currency,
        reason: outcome.reason,
        note: reason,
        requestedBy: user.id,
      });
    }

    await tellThem(db, session, by, outcome.refundCents, reason);

    return res.status(200).json({
      cancelled: true,
      refundedCents: refund.refunded ? refund.amountCents : 0,
      // Named rather than swallowed. A cancellation that went through with a
      // refund that did not is exactly the state somebody has to be told about.
      refundError: refund.error ?? null,
      reason: outcome.reason,
    });
  } catch (err: any) {
    console.error('session-cancel error:', err);
    const unauthorised = /token|session expired|Invalid or expired/i.test(err.message ?? '');
    return res.status(unauthorised ? 401 : 500).json({ error: err.message || 'Server error' });
  }
}

/**
 * This lesson's share of what was paid.
 *
 * A purchase buys several lessons at once, so cancelling one gives back a
 * fraction. Split across the lessons the invoice actually created rather than
 * the slots it was sold, because a slot that clashed and never became a lesson
 * would otherwise shrink everybody else's refund.
 *
 * The remainder goes to the first, matching how fulfilment split the tutor's
 * side, so the parts add back up to the whole.
 */
async function slotShare(db: any, invoice: any, sessionId: string): Promise<number> {
  const { data: siblings } = await db
    .from('sessions')
    .select('id')
    .eq('invoice_id', invoice.id)
    .order('date', { ascending: true })
    .order('start_time', { ascending: true });

  const ids = (siblings ?? []).map((s: any) => s.id);
  if (ids.length === 0) return invoice.amount_cents ?? 0;

  const per = Math.floor((invoice.amount_cents ?? 0) / ids.length);
  const remainder = (invoice.amount_cents ?? 0) - per * ids.length;
  return ids[0] === sessionId ? per + remainder : per;
}

async function tellThem(
  db: any,
  session: any,
  by: CancelledBy,
  refundCents: number,
  reason: string | null
): Promise<void> {
  const when = new Date(`${session.date}T00:00:00`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  const money = `${(refundCents / 100).toFixed(2)}`;
  const rows: any[] = [];

  // Whoever did not press the button is the one who needs telling.
  if (by === 'tutor' || by === 'admin') {
    rows.push({
      user_id: session.student_id,
      type: 'session_cancelled',
      title: 'A lesson was cancelled',
      message: `${session.subject} on ${when} is off${reason ? `: ${reason}` : ''}. ${refundCents > 0 ? `${money} has been refunded.` : ''}`.trim(),
      link: '/student/sessions',
    });
  } else {
    rows.push({
      user_id: session.tutor_id,
      type: 'session_cancelled',
      title: 'A lesson was cancelled',
      message: `${session.subject} on ${when} has been cancelled by the family.`,
      link: '/tutor/sessions',
    });
  }

  const { error } = await db.from('notifications').insert(rows);
  if (error) console.error('session-cancel: could not tell anybody:', error.message);
}
