import type { VercelRequest, VercelResponse } from '@vercel/node';

import { createMeeting, deleteMeeting, updateMeeting, getPastParticipants } from '../_utils/zoom';

/**
 * Sessions hold a date and a time separately; older callers send one ISO
 * timestamp. Both end up as local parts, because converting through UTC on the
 * way in is how a 4 PM lesson becomes an 8 PM one.
 */
function splitStart(date?: string, time?: string, startTime?: string) {
  if (date && time) return { date, time: time.slice(0, 5) };
  if (!startTime) return null;
  const [d, t = '00:00'] = String(startTime).replace('Z', '').split('T');
  return { date: d, time: t.slice(0, 5) };
}

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

      const parts = splitStart(date, time, startTime);
      if (!parts) return res.status(400).json({ error: 'date and time (or startTime) required' });

      const meeting = await createMeeting({
        topic: topic || 'Yakal Tutoring Session',
        date: parts.date,
        startTime: parts.time,
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
      const { meetingId, topic, startTime, duration, date, time } = req.body ?? {};
      if (!meetingId) return res.status(400).json({ error: 'meetingId required' });

      const parts = splitStart(date, time, startTime);
      if (!parts) return res.status(400).json({ error: 'date and time (or startTime) required' });

      await updateMeeting({
        meetingId,
        topic,
        date: parts.date,
        startTime: parts.time,
        durationMinutes: duration || 60,
      });
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
