import { supabase } from '@/lib/supabase';
import { authedPost } from '@/lib/authedFetch';
import { sendFromTemplate } from '@/services/notificationService';

export interface CreateSessionParams {
  tutor_id: string;
  student_id: string;
  subject: string;
  date: string; // YYYY-MM-DD
  start_time: string; // HH:mm:ss
  duration_minutes: number;
  mode: 'online' | 'in-person' | 'both';
  meeting_room_id: string;
  zoom_meeting_id?: string;
  zoom_password?: string;
  status?: string; // 'upcoming' | 'completed' | 'canceled'
}

export const createSession = async (params: CreateSessionParams) => {
  try {
    const { data, error } = await supabase
      .from('sessions')
      .insert([{ ...params, status: params.status || 'upcoming' }])
      .select()
      .single();

    if (error) {
      console.error('Failed to create session', error);
      return { success: false, error: error.message };
    }
    return { success: true, data };
  } catch (e: any) {
    console.error('Failed to create session', e);
    return { success: false, error: e.message };
  }
};

export const getSessionById = async (sessionId: string) => {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (error || !data) return null;

  // Fetch both tutor and student names
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', [data.tutor_id, data.student_id]);

  return {
    ...data,
    tutor_name: profiles?.find((p: any) => p.id === data.tutor_id)?.full_name || 'Tutor',
    student_name: profiles?.find((p: any) => p.id === data.student_id)?.full_name || 'Student',
  };
};

export const updateSessionStatus = async (sessionId: string, status: string) => {
  const { error } = await supabase
    .from('sessions')
    .update({ status })
    .eq('id', sessionId);

  if (error) {
    console.error('Failed to update session status', error);
  }
  return !error;
};

export const getStudentSessions = async (studentId: string) => {
  const { data: sessions, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('student_id', studentId)
    .order('date', { ascending: false });

  if (sessions && sessions.length > 0) {
    const tutorIds = [...new Set(sessions.map(s => s.tutor_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', tutorIds);
    return {
      data: sessions.map(s => ({
        ...s,
        tutor_name: profiles?.find(p => p.id === s.tutor_id)?.full_name || 'Unknown Tutor',
        tutor_avatar: profiles?.find(p => p.id === s.tutor_id)?.avatar_url ?? null,
      })),
      error
    };
  }
  return { data: sessions, error };
};

export const getTutorSessions = async (tutorId: string) => {
  const { data: sessions, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('tutor_id', tutorId)
    .order('date', { ascending: false });

  if (sessions && sessions.length > 0) {
    const studentIds = [...new Set(sessions.map(s => s.student_id))];
    const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', studentIds);
    return {
      data: sessions.map(s => ({
        ...s,
        student_name: profiles?.find(p => p.id === s.student_id)?.full_name || 'Unknown Student'
      })),
      error
    };
  }
  return { data: sessions, error };
};

/**
 * Tell the server the caller is still in the meeting.
 *
 * Called on a timer while a meeting is open. The server accumulates the time
 * and decides what counts, so this deliberately sends nothing but the session
 * id: a client that could report its own minutes could report itself a payout.
 *
 * Returns the running total in seconds, or 0 when the call was refused, which
 * is not worth telling anyone about mid-meeting.
 */
export const recordAttendance = async (sessionId: string): Promise<number> => {
  const { data, error } = await supabase.rpc('record_attendance', { p_session_id: sessionId });
  if (error) {
    console.error('Failed to record attendance', error);
    return 0;
  }
  return data ?? 0;
};

/**
 * A precise edge reported by the Zoom SDK.
 *
 * The heartbeat is coarse by design: it can only place a start or an end
 * within one interval. The SDK knows the moment, so the moment is recorded
 * when it is offered and the beat carries on regardless, because the SDK
 * never gets to speak when a browser is killed.
 */
export const recordAttendanceEvent = async (
  sessionId: string,
  event: 'join' | 'leave'
): Promise<number> => {
  const { data, error } = await supabase.rpc('record_attendance_event', {
    p_session_id: sessionId,
    p_event: event,
  });
  if (error) {
    console.error(`Failed to record attendance ${event}`, error);
    return 0;
  }
  return data ?? 0;
};

/** Whether both sides turned up, and for how long they overlapped. */
export const getAttendanceSummary = async (sessionId: string) => {
  const { data, error } = await supabase
    .from('v_session_attendance_summary')
    .select('*')
    .eq('session_id', sessionId)
    .maybeSingle();
  if (error) {
    console.error('Failed to read attendance summary', error);
    return null;
  }
  return data;
};

/** Who was in a session, and for how long. */
export const getSessionAttendance = async (sessionId: string) => {
  const { data, error } = await supabase
    .from('session_attendance')
    .select('user_id, role, first_joined_at, last_seen_at, seconds')
    .eq('session_id', sessionId);

  if (error) {
    console.error('Failed to read attendance', error);
    return [];
  }
  return data ?? [];
};

/**
 * Move an upcoming session to a new slot.
 *
 * Students and parents cannot update a session row, so the move goes through
 * reschedule_session, which re-checks the tutor's published hours and both
 * sides' clashes. Every refusal comes back as a sentence worth showing.
 *
 * The Zoom meeting is moved afterwards rather than first: a failed booking
 * would otherwise leave the meeting on a date no session points at. If Zoom
 * refuses, the session has still moved and the meeting keeps its old time,
 * which is visible and fixable, unlike the reverse.
 */

/**
 * Tell whoever did not move it.
 *
 * The mover never hears about their own change, so who receives it depends on
 * who acted: a tutor moving an hour tells the student, anyone else tells the
 * tutor. A parent or admin acting on a student's behalf counts as "anyone
 * else", and the tutor is the one who needs to know their day changed.
 */
async function notifyMoved(
  moved: { id: string; date: string; start_time: string; subject?: string | null;
           student_id: string; tutor_id: string } | null,
  was: { date: string; start_time: string; subject?: string | null } | null,
  reason?: string
): Promise<void> {
  if (!moved) return;

  const { data: auth } = await supabase.auth.getUser();
  const actor = auth.user?.id;
  if (!actor) return;

  const movedByTutor = actor === moved.tutor_id;
  const recipient = movedByTutor ? moved.student_id : moved.tutor_id;
  if (recipient === actor) return;

  const { data: mover } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', actor)
    .maybeSingle();

  await sendFromTemplate(recipient, 'sessionMoved', {
    subject: moved.subject ?? was?.subject ?? 'Your session',
    movedBy: mover?.full_name ?? 'Someone',
    from: was ? readableSlot(was.date, was.start_time) : 'its previous time',
    to: readableSlot(moved.date, moved.start_time),
    // Only a tutor is asked for one, so only a tutor's move carries it.
    reason: movedByTutor ? reason?.trim() || null : null,
  });
}

/** "Thursday 14 August, 4pm", the wording the booking emails already use. */
function readableSlot(date: string, startTime: string): string {
  const [h, m] = startTime.split(':').map(Number);
  const d = new Date(`${date}T00:00:00`);
  d.setHours(h, m ?? 0, 0, 0);
  return d.toLocaleString(undefined, {
    weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit',
  });
}

export const rescheduleSession = async (
  sessionId: string,
  date: string,
  startTime: string,
  /** Required of a tutor, ignored for everyone else. Enforced in the RPC. */
  reason?: string
): Promise<{ success: boolean; error?: string }> => {
  // Read before the move: the row that comes back has the new time on it, and
  // "moved from X to Y" needs the old one.
  const { data: before } = await supabase
    .from('sessions')
    .select('date, start_time, subject, student_id, tutor_id')
    .eq('id', sessionId)
    .maybeSingle();
  const was = before;

  const { data, error } = await supabase.rpc('reschedule_session', {
    p_session_id: sessionId,
    p_date: date,
    p_start_time: startTime.length === 5 ? `${startTime}:00` : startTime,
    p_reason: reason ?? null,
  });

  if (error) {
    return { success: false, error: error.message || 'Could not move that session.' };
  }

  const moved = Array.isArray(data) ? data[0] : data;
  if (moved?.zoom_meeting_id) {
    try {
      await updateZoomMeeting(moved.zoom_meeting_id, date, startTime, moved.duration_minutes ?? 60);
    } catch (e) {
      console.error('Session moved but its Zoom meeting did not', e);
    }
  }

  // Tell the other side. Nothing did before, while the booking email was
  // telling people that moving an hour in the app is what informs the tutor.
  //
  // After the move, not before, and failures are swallowed: the session has
  // already moved, and throwing here would report a failure for something
  // that succeeded.
  try {
    await notifyMoved(moved, was, reason);
  } catch (e) {
    console.error('Session moved but nobody was told', e);
  }

  return { success: true };
};

/** PATCH the meeting to the session's new date and time. */
async function updateZoomMeeting(
  meetingId: string,
  date: string,
  startTime: string,
  durationMinutes: number
) {
  const res = await fetch('/api/zoom?action=meetings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ meetingId, date, time: startTime, duration: durationMinutes }),
  });
  if (!res.ok) throw new Error(await res.text());
}

// ============================================================
// What a finished session is worth knowing after the fact.
//
// Both of these are read for a whole list at once rather than per row: a page
// showing thirty sessions should ask two questions, not sixty.
// ============================================================

export interface SessionExtras {
  /** Session id to the stars it was given. */
  ratings: Record<string, number>;
  /** Session id to the minutes the people in it actually spent there. */
  minutes: Record<string, number>;
}

export const getSessionExtras = async (sessionIds: string[]): Promise<SessionExtras> => {
  if (sessionIds.length === 0) return { ratings: {}, minutes: {} };

  const [rated, attended] = await Promise.all([
    supabase.from('session_ratings').select('session_id, stars').in('session_id', sessionIds),
    supabase.from('session_attendance').select('session_id, seconds').in('session_id', sessionIds),
  ]);

  const ratings: Record<string, number> = {};
  for (const r of rated.data ?? []) ratings[r.session_id] = r.stars;

  // The shorter of the two is what the session was worth: an hour of tutor
  // sitting alone in the room is not an hour of tutoring.
  const shortest: Record<string, number> = {};
  for (const a of attended.data ?? []) {
    const mins = Math.round((a.seconds ?? 0) / 60);
    shortest[a.session_id] = Math.min(shortest[a.session_id] ?? Infinity, mins);
  }

  return { ratings, minutes: shortest };
};

/** The student's verdict on a session. One per person; changing it replaces it. */
export const rateSession = async (
  sessionId: string,
  tutorId: string,
  stars: number,
  comment?: string
): Promise<{ success: boolean; error?: string }> => {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { success: false, error: 'You need to be signed in to rate a session.' };

  const { error } = await supabase
    .from('session_ratings')
    .upsert(
      {
        session_id: sessionId,
        rated_by: user.user.id,
        ratee_id: tutorId,
        stars,
        comment: comment?.trim() || null,
      },
      { onConflict: 'session_id,rated_by' }
    );

  if (error) {
    // The policy refuses a session that has not happened. Saying so beats
    // quoting a row-level security message at somebody holding five stars.
    const refused = /row-level security/i.test(error.message);
    return {
      success: false,
      error: refused
        ? "This session cannot be rated yet. Ratings open once the lesson has taken place."
        : error.message,
    };
  }
  return { success: true };
};

/** Has this student already had their say about this session? */
export const getMyRating = async (
  sessionId: string
): Promise<{ stars: number; comment: string } | null> => {
  const { data } = await supabase
    .from('session_ratings')
    .select('stars, comment')
    .eq('session_id', sessionId)
    .maybeSingle();
  return data ? { stars: data.stars, comment: data.comment ?? '' } : null;
};

export interface TutorReview {
  id: string;
  stars: number;
  comment: string;
  createdAt: Date;
  reviewerName: string;
  reviewerAvatarUrl: string | null;
}

/**
 * What students wrote about a tutor, for somebody deciding whether to book
 * them.
 *
 * Only ratings that carry a note. A bare score belongs in the average; a
 * review is the sentence that explains it.
 */
export const getTutorReviews = async (tutorId: string): Promise<TutorReview[]> => {
  const { data, error } = await supabase
    .from('v_tutor_reviews')
    .select('*')
    .eq('tutor_id', tutorId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to load tutor reviews', error);
    return [];
  }
  return (data ?? []).map((r: any) => ({
    id: r.id,
    stars: r.stars,
    comment: r.comment,
    createdAt: new Date(r.created_at),
    reviewerName: r.reviewer_name || 'A student',
    reviewerAvatarUrl: r.reviewer_avatar_url ?? null,
  }));
};

// ------------------------------------------------------------
// Calling a lesson off
//
// Through the server, because it decides the refund. The published policy is a
// 24 hour window, half kept inside it, and nothing kept when the tutor is the
// one cancelling; none of that is a decision a browser can be trusted with.
// ------------------------------------------------------------

export interface CancellationPreview {
  refundCents: number;
  /** What the tutor keeps. Only ever non-zero on a late cancellation. */
  tutorEarningCents: number;
  reason: "in_notice" | "late" | "tutor_cancelled" | "admin";
  /** Said to whoever is about to press the button. */
  explanation: string;
  by: "family" | "tutor" | "admin";
  /** The moment after which cancelling costs money. */
  freeUntil: string;
  startsAt: string;
  slotPriceCents: number;
  error?: string;
}

/** What cancelling would do. Changes nothing. */
export async function previewCancellation(sessionId: string): Promise<CancellationPreview> {
  return authedPost("/api/stripe?action=session-cancel", { sessionId, preview: true });
}

/** Do it. The refund, if any, follows the policy the preview described. */
export async function cancelSession(
  sessionId: string,
  reason?: string
): Promise<{
  cancelled?: boolean;
  refundedCents?: number;
  /** The cancellation went through and the refund did not. Somebody has to know. */
  refundError?: string | null;
  error?: string;
}> {
  return authedPost("/api/stripe?action=session-cancel", { sessionId, reason });
}
