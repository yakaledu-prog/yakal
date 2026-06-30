import { supabase } from '@/lib/supabase';

export interface TutorAvailability {
  tutor_id: string;
  time_grid: number[][]; // 13 rows (8 AM to 8 PM) x 7 cols (Sun to Sat)
  disabled_days: number[]; // Array of day indices (0-6)
  updated_at?: string;
}

export const getTutorAvailability = async (tutorId: string): Promise<TutorAvailability | null> => {
  try {
    const { data, error } = await supabase
      .from('tutor_availability')
      .select('*')
      .eq('tutor_id', tutorId)
      .single();

    if (error) {
      if (error.code !== 'PGRST116') { // PGRST116 is "No rows found"
        console.error('Failed to load tutor availability', error);
      }
      return null;
    }
    return data as TutorAvailability;
  } catch (e) {
    console.error('Failed to load tutor availability', e);
    return null;
  }
};

export const getFirstAvailableTutor = async (): Promise<TutorAvailability | null> => {
  try {
    const { data, error } = await supabase
      .from('tutor_availability')
      .select('*')
      .limit(1)
      .single();
    if (error) return null;
    return data as TutorAvailability;
  } catch (e) {
    return null;
  }
};

export const saveTutorAvailability = async (tutorId: string, timeGrid: number[][], disabledDays: number[]) => {
  try {
    const { error } = await supabase
      .from('tutor_availability')
      .upsert({
        tutor_id: tutorId,
        time_grid: timeGrid,
        disabled_days: disabledDays,
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error('Failed to save tutor availability', error);
    }
  } catch (e) {
    console.error('Failed to save tutor availability', e);
  }
};
