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

/**
 * Write a tutor's availability.
 *
 * onConflict has to name tutor_id. The table has a unique constraint on it but
 * the primary key is a generated id, so an upsert without this conflicts on
 * the key it just generated, inserts, and then trips the unique constraint. It
 * worked once, on the first save, and every edit after that failed.
 *
 * The failure was also swallowed by a console.error, so the caller believed it
 * had saved. It returns a result now and the caller says so.
 */
export const saveTutorAvailability = async (
  tutorId: string,
  timeGrid: number[][],
  disabledDays: number[]
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('tutor_availability')
      .upsert(
        {
          tutor_id: tutorId,
          time_grid: timeGrid,
          disabled_days: disabledDays,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'tutor_id' }
      );

    if (error) {
      console.error('Failed to save tutor availability', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (e: any) {
    console.error('Failed to save tutor availability', e);
    return { success: false, error: e?.message ?? 'Could not save your availability.' };
  }
};
