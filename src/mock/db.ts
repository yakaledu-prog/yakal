// Simple localStorage-based mock DB for tutor availability

export interface TutorAvailability {
  timeGrid: number[][]; // 13 rows (8 AM to 8 PM) x 7 cols (Sun to Sat)
  disabledDays: number[]; // Array of day indices (0-6)
}

const AVAILABILITY_KEY = 'yakal_tutor_availability';

export const getTutorAvailability = (): TutorAvailability | null => {
  try {
    const data = localStorage.getItem(AVAILABILITY_KEY);
    if (data) {
      return JSON.parse(data) as TutorAvailability;
    }
  } catch (e) {
    console.error('Failed to load tutor availability', e);
  }
  return null;
};

export const saveTutorAvailability = (timeGrid: number[][], disabledDays: number[]) => {
  try {
    const data: TutorAvailability = { timeGrid, disabledDays };
    localStorage.setItem(AVAILABILITY_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save tutor availability', e);
  }
};
