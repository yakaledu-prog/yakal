import type { VercelRequest, VercelResponse } from '@vercel/node';

import { updateMeeting } from '../_utils/zoom.js';
import { getServiceClient } from '../_utils/supabase.js';
import { callerOrNull, sessionRole } from '../_utils/access.js';

// ============================================================
// Moving a session's meeting when the session moves.
//
// This endpoint used to create, move, delete and read the participants of any
// meeting on Yakal's paid Zoom account, for anybody, with no sign-in. Nothing
// in the browser ever created or deleted one: fulfilment and the scheduled job
// do that on the server through api/_utils/zoom.ts. So only the one thing the
// browser does is left, and only for somebody on the session.
//
// The date and time come from the session row, not the request. The browser
// calls this right after reschedule_session has already moved the row, so the
// row is the truth, and taking times from the body would let a caller move a
// meeting somewhere the session never went.
// ============================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  // POST as well as PATCH, because the browser's authedPost only posts.
  if (req.method !== 'PATCH' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Meetings are created and removed on the server.' });
  }

  const caller = await callerOrNull(req);
  if (!caller) return res.status(401).json({ error: 'Sign in to move this session.' });

  const { meetingId, topic } = req.body ?? {};
  if (!meetingId) return res.status(400).json({ error: 'meetingId required' });

  const db = getServiceClient();
  const { data: session } = await db
    .from('sessions')
    .select('id, tutor_id, student_id, subject, date, start_time, duration_minutes')
    .eq('zoom_meeting_id', String(meetingId))
    .maybeSingle();
  if (!session) return res.status(404).json({ error: 'No session has that meeting.' });

  // The same people reschedule_session allows: the student, the tutor, an
  // active linked parent, or an admin.
  if (!(await sessionRole(db, caller.id, session))) {
    return res.status(403).json({ error: 'That is not your session.' });
  }

  try {
    await updateMeeting({
      meetingId: String(meetingId),
      topic: topic || session.subject,
      date: session.date,
      startTime: String(session.start_time).slice(0, 5),
      durationMinutes: session.duration_minutes || 60,
    });
    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Zoom API Error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
