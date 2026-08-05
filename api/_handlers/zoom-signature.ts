import jwt from 'jsonwebtoken';
import type { VercelRequest, VercelResponse } from '@vercel/node';

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

  if (!sdkKey || !sdkSecret) {
    console.error('Zoom Meeting SDK credentials are not configured.');
    return res.status(500).json({ error: 'Server configuration error' });
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
