import { VercelRequest, VercelResponse } from '@vercel/node';

import { createMeeting, deleteMeeting, getZoomToken, getPastParticipants } from './utils/zoom';

// ============================================================
// Meetings, on demand.
//
// Fulfilment creates a meeting for every session it books, so this is the
// path for everything that happens afterwards: a rescheduled session, a
// cancelled one, and reading back who attended.
//
// The token and the create call live in utils/zoom so this and fulfilment
// cannot drift apart on settings like join_before_host.
// ============================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // CREATE MEETING
    if (req.method === 'POST') {
      const { topic, startTime, duration, date, time } = req.body ?? {};

      // Older callers send one ISO timestamp; sessions hold a date and a time
      // separately and must not be pushed through a UTC conversion on the way.
      let meetingDate = date;
      let meetingTime = time;
      if (!meetingDate && startTime) {
        const [d, t = '00:00'] = String(startTime).replace('Z', '').split('T');
        meetingDate = d;
        meetingTime = t.slice(0, 5);
      }
      if (!meetingDate || !meetingTime) {
        return res.status(400).json({ error: 'date and time (or startTime) required' });
      }

      const meeting = await createMeeting({
        topic: topic || 'Yakal Tutoring Session',
        date: meetingDate,
        startTime: meetingTime,
        durationMinutes: duration || 60,
      });

      return res.status(200).json({
        meetingNumber: meeting.meetingId,
        password: meeting.password,
        joinUrl: meeting.joinUrl,
      });
    }

    // UPDATE MEETING
    if (req.method === 'PATCH') {
      const { meetingId, topic, startTime, duration } = req.body ?? {};
      if (!meetingId) return res.status(400).json({ error: 'meetingId required' });

      const token = await getZoomToken();
      const response = await fetch(`https://api.zoom.us/v2/meetings/${meetingId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, start_time: startTime, duration }),
      });

      if (!response.ok && response.status !== 204) {
        throw new Error(`Failed to update meeting: ${await response.text()}`);
      }
      return res.status(200).json({ success: true });
    }

    // DELETE MEETING
    if (req.method === 'DELETE') {
      const { meetingId } = req.body ?? {};
      if (!meetingId) return res.status(400).json({ error: 'meetingId required' });

      await deleteMeeting(meetingId);
      return res.status(200).json({ success: true });
    }

    // WHO ATTENDED
    if (req.method === 'GET') {
      const meetingId = String(req.query.meetingId ?? '');
      if (!meetingId) return res.status(400).json({ error: 'meetingId required' });

      const participants = await getPastParticipants(meetingId);
      // Null means Zoom has no past record: the meeting was never started.
      return res.status(200).json({ held: participants !== null, participants: participants ?? [] });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Zoom API Error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
