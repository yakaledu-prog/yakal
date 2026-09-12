import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getServiceClient, requireUser } from '../_utils/supabase.js';
import { attachMeeting } from '../_utils/meeting.js';

// ============================================================
// Give a booked session a room of its own.
//
// book_advising_session is a database function, so it cannot call Zoom, and an
// advising hour was landing with no meeting at all. It fell back to the
// counsellor's personal room: one URL shared by every student they see, and
// invisible to both attendance systems, because the webhook matches on
// zoom_meeting_id and the in-app heartbeat only runs on a page that is routed
// to when one exists. No attendance meant the no-show branch of the scheduled
// job could never fire, so every advising hour completed itself, and a
// completed advising hour is the whole of what counselling_period_delivered
// asks before releasing a counsellor's month.
//
// Called right after booking so the room is there before anybody looks for it.
// run-jobs sweeps for whatever this missed.
// ============================================================

/** Whose session it is. Same shape session-cancel uses to decide the same thing. */
async function mayAttach(
  db: any,
  session: { student_id: string; tutor_id: string },
  userId: string
): Promise<boolean> {
  if (session.tutor_id === userId) return true;
  if (session.student_id === userId) return true;

  const { count } = await db
    .from('parent_student_links')
    .select('id', { count: 'exact', head: true })
    .eq('parent_id', userId)
    .eq('student_id', session.student_id)
    .eq('status', 'active');
  if ((count ?? 0) > 0) return true;

  const { data: me } = await db.from('profiles').select('role').eq('id', userId).single();
  return me?.role === 'admin' || me?.role === 'counselor';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const user = await requireUser(req);
    const db = getServiceClient();

    const sessionId: string = req.body?.sessionId;
    if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

    const { data: session } = await db
      .from('sessions')
      .select('id, student_id, tutor_id, subject, date, start_time, duration_minutes, status, zoom_meeting_id')
      .eq('id', sessionId)
      .maybeSingle();

    if (!session) return res.status(404).json({ error: 'That session no longer exists.' });
    if (!(await mayAttach(db, session, user.id))) {
      return res.status(403).json({ error: 'That is not your session.' });
    }

    // Already has one. Not an error, and not worth a second meeting: the claim
    // inside attachMeeting would refuse it anyway, but this saves the call.
    if (session.zoom_meeting_id) {
      return res.status(200).json({ attached: false, reason: 'already has a meeting' });
    }
    if (session.status !== 'upcoming') {
      return res.status(400).json({ error: 'Only an upcoming session can be given a room.' });
    }

    // Status alone is not enough: a session that nobody completed keeps saying
    // upcoming long after its hour has passed, and booking a room for it puts
    // a meeting on Zoom's calendar in the past that nobody will ever open.
    if (session.date < new Date().toISOString().slice(0, 10)) {
      return res.status(400).json({ error: 'That session has already passed.' });
    }

    const attached = await attachMeeting(db, session, session.subject || 'Yakal session');

    // False is not a failure. Zoom may not be configured, or the sweep may have
    // got there first, and neither is worth telling somebody who has just
    // booked an hour that something went wrong.
    return res.status(200).json({ attached });
  } catch (err: any) {
    const message = err?.message ?? 'Something went wrong';
    const status = /auth|token|signed in/i.test(message) ? 401 : 500;
    return res.status(status).json({ error: message });
  }
}
