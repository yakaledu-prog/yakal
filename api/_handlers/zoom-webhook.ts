import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { getServiceClient } from '../_utils/supabase.js';
import { getPastParticipants } from '../_utils/zoom.js';

// ============================================================
// Zoom telling us a meeting finished.
//
// Attendance is evidence, not the gate. Zoom can say two people were in a room
// for 47 minutes; it cannot say a lesson was taught, it reports no email for
// guests joining through the Meeting SDK, and sessions.mode already allows
// in-person. So this stores what Zoom saw and lets the scheduled job decide,
// which it does on time rather than attendance.
//
// The one thing Zoom says with confidence is that nobody joined at all. That is
// the signal worth acting on, and the completion job is what acts on it.
//
// An action on api/zoom.ts rather than its own file: every top-level file in
// api/ is a deployed function and Vercel's plan allows twelve, which is how
// many there are. Zoom lets the endpoint URL be anything, so it is registered
// as .../api/zoom?action=webhook.
// ============================================================

/**
 * Zoom's signature, over the exact bytes it sent.
 *
 * Recomputing the body with JSON.stringify does not work: key order and
 * whitespace would have to match Zoom's byte for byte, and the day they differ
 * the check fails for a legitimate delivery. So a missing raw body is refused
 * rather than worked around. A signature check that cannot actually check is
 * worse than none, because it looks like one.
 */
function verifies(rawBody: string, signature: string, timestamp: string, secret: string): boolean {
  const expected =
    'v0=' + createHmac('sha256', secret).update(`v0:${timestamp}:${rawBody}`).digest('hex');

  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const secret = (process.env.ZOOM_WEBHOOK_SECRET_TOKEN ?? '').trim();
  if (!secret) {
    console.error('ZOOM_WEBHOOK_SECRET_TOKEN not configured');
    return res.status(500).json({ error: 'Webhook not configured' });
  }

  const raw = (req as any).rawBody;
  if (typeof raw !== 'string' && !Buffer.isBuffer(raw)) {
    console.error('zoom webhook: no raw body, so the signature cannot be checked');
    return res.status(500).json({ error: 'Webhook not configured' });
  }
  const rawBody = Buffer.isBuffer(raw) ? raw.toString('utf8') : raw;

  const body = typeof req.body === 'object' && req.body ? req.body : JSON.parse(rawBody);

  // Zoom proves it owns the endpoint by asking us to sign a token back. This
  // one arrives before any signature exists to check, which is the point of it.
  if (body?.event === 'endpoint.url_validation') {
    const plainToken = body?.payload?.plainToken ?? '';
    return res.status(200).json({
      plainToken,
      encryptedToken: createHmac('sha256', secret).update(plainToken).digest('hex'),
    });
  }

  const signature = String(req.headers['x-zm-signature'] ?? '');
  const timestamp = String(req.headers['x-zm-request-timestamp'] ?? '');
  if (!verifies(rawBody, signature, timestamp, secret)) {
    console.error('zoom webhook: signature did not verify');
    return res.status(401).json({ error: 'Bad signature' });
  }

  try {
    if (body?.event === 'meeting.ended') {
      await recordAttendance(String(body?.payload?.object?.id ?? ''));
    }
    // Everything else is acknowledged and ignored. Zoom retries anything it
    // does not get a 200 for, and retrying an event we will never act on is
    // noise for both sides.
    return res.status(200).json({ received: true });
  } catch (err: any) {
    console.error('zoom webhook handler error:', err?.message ?? err);
    return res.status(500).json({ error: 'Webhook handler failed' });
  }
}

/**
 * Who was actually in the room.
 *
 * Stored as it comes, on the session. attendance_checked_at is what separates
 * "Zoom said nobody joined" from "nobody has asked Zoom", and only the first of
 * those should ever hold a lesson back.
 */
async function recordAttendance(meetingId: string): Promise<void> {
  if (!meetingId) return;

  const db = getServiceClient();
  const { data: session, error: lookupErr } = await db
    .from('sessions')
    .select('id')
    .eq('zoom_meeting_id', meetingId)
    .maybeSingle();

  // Thrown, so the caller answers 500 and Zoom retries. Swallowing it would
  // return 200 to a delivery that recorded nothing, and Zoom does not send a
  // meeting.ended twice: a database blip would lose the only evidence that
  // meeting ever produced.
  if (lookupErr) throw new Error(`could not look up the session: ${lookupErr.message}`);

  // A meeting this platform did not create, or one whose session has since been
  // deleted. Neither is an error.
  if (!session) return;

  const participants = await getPastParticipants(meetingId);

  // Null means Zoom has no record of the meeting having run, which is not the
  // same as an empty room and must not be stored as one. Left unchecked, so the
  // job treats it as no evidence rather than as evidence of absence.
  if (participants === null) {
    console.log(`zoom webhook: no past record for meeting ${meetingId}, leaving it unchecked`);
    return;
  }

  const { error } = await db
    .from('sessions')
    .update({
      attendance: participants,
      attendance_checked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', session.id);

  // Same reasoning: a failed write is worth a retry, not a log line.
  if (error) throw new Error(`could not store attendance: ${error.message}`);
}
