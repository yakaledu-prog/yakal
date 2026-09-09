import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getServiceClient, requireUser } from '../_utils/supabase.js';
import { refundInvoice } from '../_utils/refunds.js';
import { notifyAll } from '../_utils/notify.js';
import type { TemplateKey } from '../../src/lib/notifications/index.js';

// ============================================================
// A family saying a lesson did not happen, and somebody deciding.
//
// The 72 hour hold exists so a complaint can arrive while the money is still
// ours. This is the thing that arrives in it.
//
// Raising one holds the earning rather than cancelling it. "The tutor never
// showed" and "it ran and we did not like it" look identical from here, and
// only one of them is a refund, so the money stops and a person decides.
//
// Two operations, both admin-gated on the deciding half:
//   raise    the family, about their own lesson
//   resolve  an admin, upheld or rejected, with the money moving alongside
// ============================================================

/** Fixed here rather than in the tier editor: it is a policy, not a price. */
const REASONS = ['no_show', 'left_early', 'quality', 'other'] as const;

async function tellThem(
  db: any,
  userIds: string[],
  key: TemplateKey,
  vars: Record<string, unknown>
): Promise<void> {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return;
  // Through the template rather than as a title and a line. Rows written
  // without template and vars fall back in detailFor() to the one sentence
  // they were stored with, so opening one showed less than the email said
  // about the same event.
  await notifyAll(db, ids.map((userId) => ({ userId, key, vars }))).catch((err) =>
    // Never fatal. Telling somebody is not allowed to fail a verdict that has
    // already moved money.
    console.error('session-dispute: could not notify:', err?.message ?? err)
  );
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const user = await requireUser(req);
    const db = getServiceClient();
    const op: string = req.body?.op ?? 'raise';

    if (op === 'raise') return await raise(req, res, db, user.id);
    if (op === 'resolve') return await resolve(req, res, db, user.id);
    return res.status(400).json({ error: `Unknown operation: ${op}` });
  } catch (err: any) {
    console.error('session-dispute error:', err);
    return res
      .status(/session|authorization|token/i.test(err?.message ?? '') ? 401 : 500)
      .json({ error: err?.message ?? 'Server error' });
  }
}

/**
 * The family raising one.
 *
 * Deliberately allowed after the hold has expired too. The money has gone by
 * then and an admin has a harder job, but refusing to record the complaint
 * because we were slow to hear it is the wrong way round. The dialog says so.
 */
async function raise(req: VercelRequest, res: VercelResponse, db: any, userId: string) {
  const sessionId: string = req.body?.sessionId;
  const reason: string = req.body?.reason;
  const detail: string = (req.body?.detail ?? '').toString().trim();

  if (!sessionId) return res.status(400).json({ error: 'Which session?' });
  if (!REASONS.includes(reason as any)) return res.status(400).json({ error: 'Pick a reason.' });
  if (!detail) return res.status(400).json({ error: 'Tell us what happened.' });

  // Their own lesson. Checked here as well as in RLS because this runs as the
  // service role, which RLS does not apply to.
  const { data: session } = await db
    .from('sessions')
    .select('id, student_id, tutor_id, subject, date, status')
    .eq('id', sessionId)
    .maybeSingle();

  if (!session) return res.status(404).json({ error: 'That session no longer exists.' });

  const isStudent = session.student_id === userId;
  const { data: link } = await db
    .from('parent_student_links')
    .select('parent_id')
    .eq('student_id', session.student_id)
    .eq('parent_id', userId)
    .eq('status', 'active')
    .maybeSingle();

  if (!isStudent && !link) {
    return res.status(403).json({ error: 'That is not your session.' });
  }

  const { data: dispute, error } = await db
    .from('session_disputes')
    .insert({ session_id: sessionId, raised_by: userId, reason, detail })
    .select('id')
    .single();

  // 23505 is the one-open-per-session index. Somebody has already raised it.
  if (error?.code === '23505') {
    return res.status(409).json({ error: 'This session is already being looked at.' });
  }
  if (error) throw new Error(error.message);

  // Stop the money. Only if it has not already moved: a settled earning needs a
  // transfer reversal, which is an admin's decision and not a side effect of
  // somebody filling in a form.
  const { data: held } = await db
    .from('earnings')
    .update({ status: 'held', updated_at: new Date().toISOString() })
    .eq('session_id', sessionId)
    .eq('status', 'pending')
    .is('voided_at', null)
    .select('id, amount_cents');

  const stopped = (held ?? []).length > 0;

  const { data: admins } = await db.from('profiles').select('id').eq('role', 'admin');
  await tellThem(db, [...(admins ?? []).map((a: any) => a.id), session.tutor_id], 'sessionDisputed', {
    subject: session.subject,
    date: session.date,
    paymentHeld: stopped,
  });

  return res.status(200).json({ id: dispute.id, paymentHeld: stopped });
}

/**
 * An admin deciding.
 *
 * Upheld refunds the family and cancels the earning. Rejected releases it and
 * the next job run pays it as normal. Both record who decided and why, because
 * a verdict nobody signed is not a verdict.
 */
async function resolve(req: VercelRequest, res: VercelResponse, db: any, userId: string) {
  const { data: me } = await db.from('profiles').select('role').eq('id', userId).single();
  if (me?.role !== 'admin') return res.status(403).json({ error: 'Admins only' });

  const disputeId: string = req.body?.disputeId;
  const verdict: string = req.body?.verdict;
  const note: string = (req.body?.note ?? '').toString().trim();

  if (!disputeId) return res.status(400).json({ error: 'Which one?' });
  if (verdict !== 'upheld' && verdict !== 'rejected') {
    return res.status(400).json({ error: 'Uphold it or reject it.' });
  }
  // Required both ways. "Why" is the only part of this anybody reads later.
  if (!note) return res.status(400).json({ error: 'Say why.' });

  const { data: dispute } = await db
    .from('session_disputes')
    .select('id, session_id, status, raised_by')
    .eq('id', disputeId)
    .maybeSingle();

  if (!dispute) return res.status(404).json({ error: 'No such report.' });
  if (dispute.status !== 'open') {
    return res.status(409).json({ error: 'That has already been decided.' });
  }

  const { data: session } = await db
    .from('sessions')
    .select('id, subject, date, invoice_id, tutor_id, student_id')
    .eq('id', dispute.session_id)
    .single();

  const now = new Date().toISOString();
  let refunded = 0;

  if (verdict === 'upheld') {
    // The earning first. If the refund fails afterwards the money is at least
    // not on its way to somebody for a lesson we have just agreed did not
    // happen, and a refund can be retried.
    await db
      .from('earnings')
      .update({ status: 'cancelled', note: `Upheld report: ${note}`, updated_at: now })
      .eq('session_id', dispute.session_id)
      .in('status', ['held', 'pending'])
      .is('voided_at', null);

    if (session?.invoice_id) {
      const { data: invoice } = await db
        .from('invoices')
        .select('id, amount_cents, currency')
        .eq('id', session.invoice_id)
        .maybeSingle();

      // The lesson's own share of the purchase, not the whole basket: one
      // invoice often covers several lessons and only one is being disputed.
      const { count } = await db
        .from('sessions')
        .select('id', { count: 'exact', head: true })
        .eq('invoice_id', session.invoice_id);

      const share = Math.round((invoice?.amount_cents ?? 0) / Math.max(count ?? 1, 1));
      const result = await refundInvoice(db, {
        invoiceId: session.invoice_id,
        sessionId: dispute.session_id,
        amountCents: share,
        currency: invoice?.currency ?? 'usd',
        reason: 'admin',
        note: `Upheld report: ${note}`,
        requestedBy: userId,
      });
      refunded = result.refunded ? (result.amountCents ?? 0) : 0;
    }

    await db
      .from('sessions')
      .update({ status: 'no-show', updated_at: now })
      .eq('id', dispute.session_id)
      .neq('status', 'cancelled');
  } else {
    // Back to pending. The hold it was already serving stands, so this does not
    // reset the clock or pay anybody early.
    await db
      .from('earnings')
      .update({ status: 'pending', note: `Report rejected: ${note}`, updated_at: now })
      .eq('session_id', dispute.session_id)
      .eq('status', 'held')
      .is('voided_at', null);
  }

  const { error: closeErr } = await db
    .from('session_disputes')
    .update({
      status: verdict,
      resolved_by: userId,
      resolution_note: note,
      resolved_at: now,
      updated_at: now,
    })
    .eq('id', disputeId)
    .eq('status', 'open');

  if (closeErr) throw new Error(closeErr.message);

  await tellThem(db, [dispute.raised_by, session?.tutor_id].filter(Boolean) as string[], 'disputeResolved', {
    subject: session?.subject ?? 'That session',
    date: session?.date ?? '',
    upheld: verdict === 'upheld',
    refunded: refunded > 0 ? `$${(refunded / 100).toFixed(2)}` : null,
    note,
  });

  return res.status(200).json({ verdict, refundedCents: refunded });
}
