import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getServiceClient } from '../_utils/supabase.js';
import { recordSessionEarning, releaseDueEarnings } from '../_utils/earnings.js';

// ============================================================
// The one scheduled task.
//
// Two jobs, run together because they are the two halves of one sentence:
// decide which lessons happened, then move the money for the ones that did and
// whose hold has expired.
//
// Called by Supabase Cron over pg_net, not by a person. Authentication is a
// shared token rather than a user session, because there is no user.
//
// Everything here is idempotent. A cron that fires twice, a retry after a
// timeout, or somebody curling it out of curiosity all have to be harmless, so
// each step is written as "move rows that are still in the previous state"
// rather than "do the thing again".
//
// Nothing schedules payouts to banks. That is Stripe's own payout schedule on
// the connected account, which runs without us. Transfers are free and instant,
// so batching them here would only delay a tutor seeing their balance.
// ============================================================

/** A lesson with nobody in the room did not happen. Anything else is a judgement for a person. */
function nobodyAttended(attendance: unknown): boolean {
  return Array.isArray(attendance) && attendance.length === 0;
}

interface CompletionResult {
  completed: number;
  noShows: number;
  earningsWritten: number;
  errors: string[];
}

/**
 * Decide which finished lessons count as delivered.
 *
 * Auto-complete rather than asking anybody. A tutor marking their own session
 * complete is a tutor authorising their own payment, and a parent confirming
 * every lesson is a queue that stalls the moment somebody stops replying. The
 * control that makes this safe is not the marking, it is the 72 hour hold that
 * follows: a lesson that did not happen has three days to be disputed while the
 * money is still ours.
 *
 * Zoom attendance is evidence, not the gate. It can say two people were in a
 * room; it cannot say a lesson was taught, it reports no email for guests
 * joining through the Meeting SDK, and sessions.mode already allows in-person.
 * The single thing it says with confidence is that nobody joined at all, and
 * that alone holds a session back for review.
 */
async function completeFinishedSessions(db: any): Promise<CompletionResult> {
  const result: CompletionResult = { completed: 0, noShows: 0, earningsWritten: 0, errors: [] };

  const { data: due, error } = await db.rpc('sessions_due_for_completion', {
    p_timezone: process.env.ZOOM_TIMEZONE || 'America/New_York',
    p_limit: 200,
  });

  if (error) {
    result.errors.push(`could not list finished sessions: ${error.message}`);
    return result;
  }
  if (!due || due.length === 0) return result;

  // The charge behind each lesson, so the transfer can draw on it later. One
  // query for the batch: several lessons usually come from one purchase.
  const invoiceIds = [...new Set(due.map((s: any) => s.invoice_id).filter(Boolean))];
  const { data: invoices } = invoiceIds.length
    ? await db.from('invoices').select('id, stripe_charge_id, currency').in('id', invoiceIds)
    : { data: [] };
  const chargeByInvoice = new Map<string, any>((invoices ?? []).map((i: any) => [i.id, i]));

  const now = new Date().toISOString();

  for (const session of due as any[]) {
    // Zoom looked, and found an empty room.
    if (session.attendance_checked_at && nobodyAttended(session.attendance)) {
      const { error: markErr } = await db
        .from('sessions')
        .update({ status: 'no-show', updated_at: now })
        .eq('id', session.id)
        .eq('status', 'upcoming');

      if (markErr) {
        result.errors.push(`session ${session.id}: ${markErr.message}`);
        continue;
      }
      result.noShows += 1;
      await tellAdmins(
        db,
        'A lesson was billed but nobody joined',
        `${session.subject} on ${session.session_date} has no attendance. Nothing has been paid out.`
      );
      continue;
    }

    const { error: markErr } = await db
      .from('sessions')
      .update({ status: 'completed', completed_at: now, updated_at: now })
      .eq('id', session.id)
      // Only from upcoming, so a session a person already judged is left alone.
      .eq('status', 'upcoming');

    if (markErr) {
      result.errors.push(`session ${session.id}: ${markErr.message}`);
      continue;
    }
    result.completed += 1;

    const invoice = session.invoice_id ? chargeByInvoice.get(session.invoice_id) : null;
    const { created, error: earnErr } = await recordSessionEarning(db, {
      sessionId: session.id,
      payeeId: session.tutor_id,
      amountCents: session.tutor_earning_cents ?? 0,
      currency: invoice?.currency ?? 'usd',
      invoiceId: session.invoice_id ?? null,
      sourceChargeId: invoice?.stripe_charge_id ?? null,
    });

    if (earnErr) result.errors.push(`session ${session.id} earning: ${earnErr}`);
    if (created) result.earningsWritten += 1;
  }

  return result;
}

async function tellAdmins(db: any, title: string, message: string): Promise<void> {
  const { data: admins } = await db.from('profiles').select('id').eq('role', 'admin');
  const rows = (admins ?? []).map((a: any) => ({
    user_id: a.id,
    type: 'payout',
    title,
    message,
    link: '/admin/billing',
  }));
  if (rows.length === 0) return;

  const { error } = await db.from('notifications').insert(rows);
  if (error) console.error('run-jobs: could not notify admins:', error.message);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // A shared token, because the caller is a cron job with no user to be. With
  // no token configured this refuses everyone rather than allowing everyone:
  // an unauthenticated endpoint that moves money is not a thing to fail open.
  const expected = (process.env.JOBS_TOKEN ?? '').trim();
  const offered = (
    req.headers['x-jobs-token'] ??
    (typeof req.body?.token === 'string' ? req.body.token : '') ??
    ''
  ).toString();

  if (!expected || offered !== expected) {
    return res.status(401).json({ error: 'Not authorised' });
  }

  try {
    const db = getServiceClient();

    // Order matters: a lesson that finishes in this run should have its earning
    // written before the release step looks, even though its hold means it will
    // not move until three days from now.
    const sessions = await completeFinishedSessions(db);
    const released = await releaseDueEarnings(db);

    const errors = [...sessions.errors, ...released.errors];
    if (errors.length > 0) console.error('run-jobs finished with errors:', errors);

    return res.status(200).json({
      sessions: {
        completed: sessions.completed,
        noShows: sessions.noShows,
        earningsWritten: sessions.earningsWritten,
      },
      payouts: {
        transferred: released.transferred,
        amountCents: released.amountCents,
        skipped: released.skipped.length,
      },
      errors,
    });
  } catch (err: any) {
    console.error('run-jobs error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}
