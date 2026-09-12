import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getServiceClient } from '../_utils/supabase.js';
import {
  NOTHING_DELIVERED,
  NO_CONNECTED_ACCOUNT,
  PLATFORM_BALANCE_SHORT,
  recordSessionEarning,
  releaseDueEarnings,
} from '../_utils/earnings.js';
import { attachMeeting } from '../_utils/meeting.js';
import { reportServerError } from '../_utils/report.js';
import { notifyAll } from '../_utils/notify.js';

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

/**
 * Give a room to every booked session that still has none.
 *
 * The backstop for the call made at booking time: a Zoom outage, a browser
 * closed before it landed, and every advising hour booked before sessions were
 * given rooms of their own. Without one the hour falls back to the
 * counsellor's personal room, which neither attendance system can see, and an
 * hour with no attendance completes itself and pays a counsellor who may never
 * have turned up.
 *
 * Only sessions still ahead: backfilling a room onto an hour that has already
 * passed books a meeting nobody will use and tells Zoom about a date in the
 * past.
 */
export async function attachMissingMeetings(
  db: any,
  /** Swappable so the check can assert which sessions are picked without Zoom. */
  attach: typeof attachMeeting = attachMeeting
): Promise<{ attached: number }> {
  const { data: pending, error } = await db
    .from('sessions')
    .select('id, subject, date, start_time, duration_minutes')
    .eq('status', 'upcoming')
    .is('zoom_meeting_id', null)
    .gte('date', new Date().toISOString().slice(0, 10))
    .limit(200);

  if (error || !pending?.length) return { attached: 0 };

  let attached = 0;
  for (const session of pending) {
    if (await attach(db, session, session.subject || 'Yakal session')) attached += 1;
  }
  return { attached };
}

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
        `${session.subject} on ${session.session_date} has no attendance.`,
        `${session.subject} on ${session.session_date} was paid for and neither side joined ` +
          `the meeting, so it has been marked as a no-show. Nothing has been paid out to the ` +
          `tutor and the hold on the money is still running, which means this can be refunded ` +
          `without anything having to be reversed.`,
        [
          { label: 'Subject', value: String(session.subject) },
          { label: 'Date', value: String(session.session_date) },
        ]
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

    // An advising hour completes like anything else, because the counselling
    // delivery check reads status = 'completed' and a session that never
    // completes makes its counsellor look like they did nothing. It must not
    // earn here though: that work is paid through the subscription, and a
    // second earning against the same hour would pay them twice.
    if (session.kind === 'advising') continue;

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

/**
 * Close invoices nobody ever paid.
 *
 * checkout.session.expired handles the ones that reached Stripe. This is for
 * the ones that never did: an invoice is written before the parent is
 * redirected, so closing the tab on the page before checkout leaves a row that
 * no webhook will ever mention again. They accumulate on the billing page
 * looking like money owed.
 *
 * A week, because a family that starts a booking and comes back the next
 * evening should find it where they left it, and nobody comes back after seven
 * days to a checkout they abandoned.
 */
async function voidStaleInvoices(db: any): Promise<number> {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await db
    .from('invoices')
    .update({ status: 'void', updated_at: new Date().toISOString() })
    .eq('status', 'open')
    .lt('created_at', cutoff)
    .select('id');

  if (error) {
    console.error('run-jobs: could not close stale invoices:', error.message);
    return 0;
  }
  return (data ?? []).length;
}

/**
 * Something for an administrator to look at.
 *
 * Through the adminNotice template. The rows this used to write carried type
 * 'payout', which is not what a no-show is, and no template, so the inbox
 * could render them only as a line and a bare Open button, and no email went
 * out at all: an admin who was not in the app never learned about it.
 */
/** Cents as a person reads them. Matches the other handlers rather than importing from src. */
const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

async function tellAdmins(
  db: any,
  title: string,
  summary: string,
  detail?: string,
  facts?: { label: string; value: string }[]
): Promise<void> {
  const { data: admins } = await db.from('profiles').select('id').eq('role', 'admin');
  await notifyAll(
    db,
    (admins ?? []).map((a: any) => ({
      userId: a.id,
      key: 'adminNotice' as const,
      vars: {
        title,
        summary,
        detail: detail ?? summary,
        facts: facts ?? [],
        link: '/admin/billing',
        linkLabel: 'Open billing',
      },
    }))
  );
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
    // Before completion, so an hour booked minutes ago is not swept past.
    const rooms = await attachMissingMeetings(db);
    const sessions = await completeFinishedSessions(db);
    const released = await releaseDueEarnings(db);
    const voided = await voidStaleInvoices(db);

    // A counselling month that ended with nothing delivered. Money nobody is
    // getting is exactly the thing a person should look at, and the ledger has
    // already latched it so this is said once rather than every run.
    const undelivered = released.skipped.filter(
      (s) => s.reason === NOTHING_DELIVERED && s.firstTime
    );
    if (undelivered.length > 0) {
      await tellAdmins(
        db,
        'A counselling month is being held',
        `${undelivered.length} counselling ${undelivered.length === 1 ? 'month has' : 'months have'} ended with no advising session and no essay review. Nothing has been paid out.`
      );
    }

    // Money that is owed and cannot move. Both of these used to be silent, and
    // both mean somebody did not get paid: the first is the payee's to fix and
    // the second is ours. Latched on the earning, so an hourly job says each
    // once rather than two dozen times a day.
    const unbanked = released.skipped.filter((s) => s.reason === NO_CONNECTED_ACCOUNT && s.firstTime);
    if (unbanked.length > 0) {
      const owedByPayee = new Map<string, number>();
      for (const s of unbanked) {
        if (!s.payeeId) continue;
        owedByPayee.set(s.payeeId, (owedByPayee.get(s.payeeId) ?? 0) + (s.amountCents ?? 0));
      }
      // The payee first: they are the only one who can fix it, and until now
      // the money simply sat there with nobody saying why.
      await notifyAll(
        db,
        [...owedByPayee].map(([userId, cents]) => ({
          userId,
          key: 'payoutBlocked' as const,
          vars: { amount: money(cents) },
        }))
      ).catch(() => undefined);

      await tellAdmins(
        db,
        'Somebody cannot be paid',
        `${owedByPayee.size} ${owedByPayee.size === 1 ? 'payee has' : 'payees have'} money waiting and no connected bank. They have been told; an admin can also settle by hand.`
      );
    }

    const short = released.skipped.filter((s) => s.reason === PLATFORM_BALANCE_SHORT && s.firstTime);
    if (short.length > 0) {
      const cents = short.reduce((n, s) => n + (s.amountCents ?? 0), 0);
      await tellAdmins(
        db,
        'Payouts are waiting on the platform balance',
        `${money(cents)} could not be transferred because the Stripe balance has not settled. This usually clears on its own; if it does not, the balance is short.`
      );
    }

    const errors = [...sessions.errors, ...released.errors];
    // Reported, not just logged. Nobody is watching when this runs, and every
    // error it collects is either a lesson that did not complete or money that
    // did not reach somebody. A quiet failure here is a tutor wondering why
    // they have not been paid, weeks later.
    if (errors.length > 0) {
      reportServerError('run-jobs', new Error(`the scheduled job finished with ${errors.length} error(s): ${errors.join(' | ')}`));
    }

    return res.status(200).json({
      meetingsAttached: rooms.attached,
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
      staleInvoicesClosed: voided,
      errors,
    });
  } catch (err: any) {
    console.error('run-jobs error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}
