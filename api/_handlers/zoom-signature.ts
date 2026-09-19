import jwt from 'jsonwebtoken';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getServiceClient } from '../_utils/supabase.js';
import { callerOrNull, sessionRole } from '../_utils/access.js';

/**
 * A credential that is actually a credential.
 *
 * .env.example carries readable placeholders so somebody filling it in knows
 * what goes where, and those placeholders are truthy. Anything that still looks
 * like one is treated as unset.
 */
function isConfigured(value: string | undefined): value is string {
  if (!value) return false;
  const v = value.trim();
  if (v.length === 0) return false;
  return !/^your-|^replace-|^changeme|^xxx/i.test(v);
}

/**
 * Sign a Meeting SDK join for one meeting and one role.
 *
 * Pure, and separate from the handler, so the credential rules can be checked
 * without a database. The handler is what decides the meeting and the role.
 */
export function signFor(
  meetingNumber: string,
  role: 0 | 1
): { status: number; body: { signature?: string; error?: string } } {
  const sdkKey = process.env.VITE_ZOOM_MEETING_CLIENT_ID;
  const sdkSecret = process.env.ZOOM_MEETING_CLIENT_SECRET;

  // Absent, or still the example.
  //
  // Checking only for absence was not enough. Production had
  // VITE_ZOOM_MEETING_CLIENT_ID set to "your-meeting-sdk-client-id", the value
  // from .env.example, which is a perfectly good non-empty string. So this
  // signed every request with a placeholder and answered 200 with a
  // valid-looking token that Zoom rejects on join, and the only symptom
  // anywhere was a meeting that would not open.
  //
  // A signature nobody can use is worse than no signature: the browser cannot
  // tell the difference, and the person waiting for the lesson certainly
  // cannot.
  if (!isConfigured(sdkKey) || !isConfigured(sdkSecret)) {
    console.error(
      'Zoom Meeting SDK credentials are missing or still the example values. ' +
        'Set VITE_ZOOM_MEETING_CLIENT_ID and ZOOM_MEETING_CLIENT_SECRET on the deployment.'
    );
    return {
      status: 500,
      body: {
        error:
          'Zoom is not configured on this deployment, so a meeting cannot be joined. ' +
          'An administrator needs to set the Meeting SDK credentials.',
      },
    };
  }

  const iat = Math.round(new Date().getTime() / 1000) - 30;
  const exp = iat + 60 * 60 * 2; // 2 hours

  const payload = {
    // Zoom deprecated the sdkKey field after Meeting SDK v5; appKey is the
    // required field and carries the same Client ID.
    appKey: sdkKey,
    mn: meetingNumber,
    role, // 0 for participant, 1 for host
    iat,
    exp,
    tokenExp: exp,
  };

  try {
    return { status: 200, body: { signature: jwt.sign(payload, sdkSecret, { header: { alg: 'HS256', typ: 'JWT' } }) } };
  } catch (error) {
    console.error('Error generating signature:', error);
    return { status: 500, body: { error: 'Failed to generate signature' } };
  }
}

/**
 * A join signature for a session the caller belongs to.
 *
 * This used to sign whatever meetingNumber and role the body asked for, with
 * no sign-in at all, and role 1 is host: a guessed or leaked meeting number
 * gave a stranger host control of a lesson between a tutor and a minor. Now
 * the caller comes from their token, the meeting from the session row, and the
 * role from who they are on that session. Only the session's tutor (the
 * counsellor, for an advising hour) is ever host.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const caller = await callerOrNull(req);
  if (!caller) return res.status(401).json({ error: 'Sign in to join this session.' });

  const { sessionId } = req.body ?? {};
  if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });

  const db = getServiceClient();
  const { data: session } = await db
    .from('sessions')
    .select('id, tutor_id, student_id, zoom_meeting_id')
    .eq('id', sessionId)
    .maybeSingle();
  if (!session) return res.status(404).json({ error: 'That session no longer exists.' });

  const who = await sessionRole(db, caller.id, session);
  if (!who) return res.status(403).json({ error: 'That is not your session.' });
  if (!session.zoom_meeting_id) {
    return res.status(409).json({ error: 'This session does not have a meeting yet.' });
  }

  const role: 0 | 1 = who === 'tutor' ? 1 : 0;
  const out = signFor(String(session.zoom_meeting_id), role);
  return res.status(out.status).json({ ...out.body, ...(out.body.signature ? { role, meetingNumber: String(session.zoom_meeting_id) } : {}) });
}
