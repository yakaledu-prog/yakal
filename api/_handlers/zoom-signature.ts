import jwt from 'jsonwebtoken';
import type { VercelRequest, VercelResponse } from '@vercel/node';

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

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { meetingNumber, role } = req.body;

  if (!meetingNumber || role === undefined) {
    return res.status(400).json({ error: 'meetingNumber and role are required' });
  }

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
    return res.status(500).json({
      error:
        'Zoom is not configured on this deployment, so a meeting cannot be joined. ' +
        'An administrator needs to set the Meeting SDK credentials.',
    });
  }

  const iat = Math.round(new Date().getTime() / 1000) - 30;
  const exp = iat + 60 * 60 * 2; // 2 hours

  const header = { alg: 'HS256', typ: 'JWT' };

  const payload = {
    // Zoom deprecated the sdkKey field after Meeting SDK v5; appKey is the
    // required field and carries the same Client ID.
    appKey: sdkKey,
    mn: meetingNumber,
    role: role, // 0 for participant, 1 for host
    iat: iat,
    exp: exp,
    tokenExp: exp,
  };

  try {
    const signature = jwt.sign(payload, sdkSecret, { header });
    return res.status(200).json({ signature });
  } catch (error) {
    console.error('Error generating signature:', error);
    return res.status(500).json({ error: 'Failed to generate signature' });
  }
}
