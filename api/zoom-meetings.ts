import { VercelRequest, VercelResponse } from '@vercel/node';

const ZOOM_OAUTH_ENDPOINT = 'https://zoom.us/oauth/token';
const ZOOM_API_BASE_URL = 'https://api.zoom.us/v2';

async function getAccessToken() {
  const accountId = process.env.ZOOM_S2S_ACCOUNT_ID;
  const clientId = process.env.ZOOM_S2S_CLIENT_ID;
  const clientSecret = process.env.ZOOM_S2S_CLIENT_SECRET;

  if (!accountId || !clientId || !clientSecret) {
    throw new Error('Zoom S2S credentials are not configured');
  }

  const response = await fetch(
    `${ZOOM_OAUTH_ENDPOINT}?grant_type=account_credentials&account_id=${accountId}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to get Zoom access token: ${err}`);
  }

  const data = await response.json();
  return data.access_token;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const token = await getAccessToken();

    // CREATE MEETING
    if (req.method === 'POST') {
      const { topic, startTime, duration } = req.body;

      const response = await fetch(`${ZOOM_API_BASE_URL}/users/me/meetings`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic: topic || 'Yakal Tutoring Session',
          type: 2, // Scheduled meeting
          start_time: startTime,
          duration: duration || 60,
          timezone: 'UTC',
          settings: {
            host_video: true,
            participant_video: true,
            join_before_host: false,
            waiting_room: true,
            approval_type: 0, // Automatically approve
          },
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Failed to create meeting: ${err}`);
      }

      const meetingData = await response.json();
      return res.status(200).json({
        meetingNumber: meetingData.id.toString(),
        password: meetingData.password,
      });
    }

    // UPDATE MEETING
    if (req.method === 'PATCH') {
      const { meetingId, topic, startTime, duration } = req.body;

      if (!meetingId) return res.status(400).json({ error: 'meetingId required' });

      const response = await fetch(`${ZOOM_API_BASE_URL}/meetings/${meetingId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic,
          start_time: startTime,
          duration,
        }),
      });

      if (!response.ok && response.status !== 204) {
        const err = await response.text();
        throw new Error(`Failed to update meeting: ${err}`);
      }

      return res.status(200).json({ success: true });
    }

    // DELETE MEETING
    if (req.method === 'DELETE') {
      const { meetingId } = req.body;

      if (!meetingId) return res.status(400).json({ error: 'meetingId required' });

      const response = await fetch(`${ZOOM_API_BASE_URL}/meetings/${meetingId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok && response.status !== 204) {
        const err = await response.text();
        throw new Error(`Failed to delete meeting: ${err}`);
      }

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Zoom API Error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
