import { supabase } from '@/lib/supabase';

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
export const rescheduleSession = async (
  sessionId: string,
  date: string,
  startTime: string
): Promise<{ success: boolean; error?: string }> => {
  const { data, error } = await supabase.rpc('reschedule_session', {
    p_session_id: sessionId,
    p_date: date,
    p_start_time: startTime.length === 5 ? `${startTime}:00` : startTime,
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

  return { success: true };
};

/** PATCH the meeting to the session's new date and time. */
async function updateZoomMeeting(
  meetingId: string,
  date: string,
  startTime: string,
  durationMinutes: number
) {
  const res = await fetch('/api/zoom-meetings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ meetingId, date, time: startTime, duration: durationMinutes }),
  });
  if (!res.ok) throw new Error(await res.text());
}
