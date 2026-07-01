import { supabase } from '@/lib/supabase';

export interface CreateSessionParams {
  tutor_id: string;
  student_id: string;
  subject: string;
  date: string; // YYYY-MM-DD
  start_time: string; // HH:mm:ss
  duration_minutes: number;
  mode: number; // 1: Online, 2: In-Person, 3: Both
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
    const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', tutorIds);
    return {
      data: sessions.map(s => ({
        ...s,
        tutor_name: profiles?.find(p => p.id === s.tutor_id)?.full_name || 'Unknown Tutor'
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
