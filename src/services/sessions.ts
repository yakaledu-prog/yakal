import { supabase } from '@/lib/supabase';

export interface CreateSessionParams {
  tutor_id: string;
  student_id: string;
  subject: string;
  date: string; // YYYY-MM-DD
  start_time: string; // HH:mm:ss
  duration_minutes: number;
  mode: number; // 1: Online, 2: In-Person, 3: Both (though usually booked as 1 or 2)
}

export const createSession = async (params: CreateSessionParams) => {
  try {
    const { data, error } = await supabase
      .from('sessions')
      .insert([params])
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
