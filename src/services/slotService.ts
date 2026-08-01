import { supabase } from "@/lib/supabase";

// ============================================================
// Hours that are already spoken for.
//
// The booking grid drew the tutor's published availability and nothing else,
// so a slot already sold looked exactly like a free one. Two things can clash
// with a pick:
//
//   the child   already has a lesson then, in any subject, with any tutor
//   the tutor   already has a lesson then, with any student
//
// Both are drawn as taken. The child's clash names the subject, because "you
// already have Chemistry then" is the sentence a parent needs. The tutor's
// clash says only that the hour is gone: whose lesson it is belongs to another
// family.
// ============================================================

export interface BusySlot {
  /** "YYYY-MM-DD" */
  date: string;
  /** "HH:MM", 24 hour. */
  startTime: string;
  /** What the child is already doing then. Null for a tutor's other bookings. */
  subject: string | null;
}

/** "HH:MM" from whatever Postgres hands back for a time column. */
function hhmm(value: string): string {
  return String(value).slice(0, 5);
}

export function slotKey(date: string, startTime: string): string {
  return `${date}|${hhmm(startTime)}`;
}

/**
 * Everything this child already has booked in the window, whoever teaches it
 * and whatever it is about. Readable because a parent can see their own
 * children's sessions.
 */
export async function getStudentBusySlots(
  studentId: string,
  from: string,
  to: string
): Promise<BusySlot[]> {
  const { data, error } = await supabase
    .from("sessions")
    .select("date, start_time, subject")
    .eq("student_id", studentId)
    .neq("status", "cancelled")
    .gte("date", from)
    .lte("date", to);

  if (error) {
    console.error("getStudentBusySlots failed:", error);
    return [];
  }

  return (data ?? []).map((s) => ({
    date: s.date,
    startTime: hhmm(s.start_time),
    subject: s.subject ?? null,
  }));
}

/**
 * Hours this tutor is already teaching, for anyone.
 *
 * Row level security stops a parent reading another family's sessions, so this
 * goes through a definer function that returns times and nothing else.
 */
export async function getTutorBusySlots(
  tutorId: string,
  from: string,
  to: string
): Promise<BusySlot[]> {
  const { data, error } = await supabase.rpc("tutor_busy_slots", {
    p_tutor_id: tutorId,
    p_from: from,
    p_to: to,
  });

  if (error) {
    console.error("getTutorBusySlots failed:", error);
    return [];
  }

  return (data ?? []).map((s: { busy_date: string; busy_time: string }) => ({
    date: s.busy_date,
    startTime: hhmm(s.busy_time),
    subject: null,
  }));
}

export interface SlotConflicts {
  /** Slot key to the reason it cannot be picked. */
  byKey: Map<string, string>;
}

/**
 * Both sets, merged, keyed for a grid to look up per cell.
 *
 * The child's reason wins where they overlap: if the child is already booked
 * with this very tutor, saying "already booked" is less use than saying which
 * subject it is.
 */
export async function getSlotConflicts(input: {
  studentId: string | null;
  tutorId: string | null;
  from: string;
  to: string;
}): Promise<SlotConflicts> {
  const [student, tutor] = await Promise.all([
    input.studentId ? getStudentBusySlots(input.studentId, input.from, input.to) : [],
    input.tutorId ? getTutorBusySlots(input.tutorId, input.from, input.to) : [],
  ]);

  const byKey = new Map<string, string>();
  for (const s of tutor) byKey.set(slotKey(s.date, s.startTime), "This hour is already taken");
  for (const s of student) {
    byKey.set(
      slotKey(s.date, s.startTime),
      s.subject ? `Already booked for ${s.subject}` : "Already booked"
    );
  }
  return { byKey };
}
