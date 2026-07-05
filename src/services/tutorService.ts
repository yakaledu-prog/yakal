import { supabase } from "@/lib/supabase";

export interface SessionRow {
  id: string;
  student_id: string;
  tutor_id: string;
  course_id: string | null;
  subject: string;
  date: string;
  start_time: string;
  duration_minutes: number;
  mode: string;
  zoom_link: string | null;
  status: string;
  notes: string | null;
  student_name?: string;
  student_avatar?: string | null;
}

export interface TutorStats {
  activeStudents: number;
  upcoming: number;
  completed: number;
  pendingReviews: number;
}

export interface TutorDashboard {
  today: SessionRow[];
  next: SessionRow | null;
  stats: TutorStats;
  weekly: { name: string; sessions: number }[];
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** All of a tutor's sessions, newest first, with the student's name/avatar joined. */
export async function getTutorSessionsFull(tutorId: string): Promise<SessionRow[]> {
  const { data: sessions, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("tutor_id", tutorId)
    .order("date", { ascending: false })
    .order("start_time", { ascending: false });

  if (error || !sessions) return [];
  if (sessions.length === 0) return sessions as SessionRow[];

  const studentIds = [...new Set(sessions.map((s) => s.student_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url")
    .in("id", studentIds);

  return sessions.map((s) => {
    const p = profiles?.find((x) => x.id === s.student_id);
    return { ...s, student_name: p?.full_name || "Student", student_avatar: p?.avatar_url };
  }) as SessionRow[];
}

export async function getTutorDashboard(tutorId: string): Promise<TutorDashboard> {
  const sessions = await getTutorSessionsFull(tutorId);
  const todayStr = new Date().toISOString().slice(0, 10);

  const today = sessions.filter((s) => s.date === todayStr && s.status === "upcoming");

  const upcomingSorted = sessions
    .filter((s) => s.status === "upcoming" && s.date >= todayStr)
    .sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time));
  const next = upcomingSorted[0] ?? null;

  const activeStudents = new Set(sessions.map((s) => s.student_id)).size;
  const upcoming = sessions.filter((s) => s.status === "upcoming").length;
  const completed = sessions.filter((s) => s.status === "completed").length;

  // Pending submission reviews across all of this tutor's assignments.
  const { count: pendingReviews } = await supabase
    .from("submissions")
    .select("id, assignments!inner(tutor_id)", { count: "exact", head: true })
    .eq("assignments.tutor_id", tutorId)
    .eq("status", "submitted");

  // Sessions per day for the last 7 days (oldest -> today).
  const weekly: { name: string; sessions: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    weekly.push({
      name: WEEKDAYS[d.getDay()],
      sessions: sessions.filter((s) => s.date === key).length,
    });
  }

  return {
    today,
    next,
    stats: { activeStudents, upcoming, completed, pendingReviews: pendingReviews ?? 0 },
    weekly,
  };
}

export interface TutorStudent {
  id: string;
  full_name: string;
  avatar_url: string | null;
  email: string | null;
  sessionCount: number;
  completedCount: number;
  lastDate: string | null;
  subjects: string[];
}

/** Distinct students who have booked this tutor, with per-student aggregates. */
export async function getTutorStudents(tutorId: string): Promise<TutorStudent[]> {
  const sessions = await getTutorSessionsFull(tutorId);
  if (sessions.length === 0) return [];

  const ids = [...new Set(sessions.map((s) => s.student_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, email")
    .in("id", ids);

  return ids.map((id) => {
    const mine = sessions.filter((s) => s.student_id === id);
    const p = profiles?.find((x) => x.id === id);
    const dates = mine.map((s) => s.date).sort();
    return {
      id,
      full_name: p?.full_name || "Student",
      avatar_url: p?.avatar_url ?? null,
      email: p?.email ?? null,
      sessionCount: mine.length,
      completedCount: mine.filter((s) => s.status === "completed").length,
      lastDate: dates[dates.length - 1] ?? null,
      subjects: [...new Set(mine.map((s) => s.subject))],
    };
  });
}

/** Courses assigned to this tutor. */
export async function getTutorCourses(tutorId: string) {
  const { data } = await supabase
    .from("courses")
    .select("*")
    .eq("tutor_id", tutorId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

// ── Sessions: tutor actions ─────────────────────────────────
export async function completeSession(id: string, notes?: string) {
  const patch: Record<string, unknown> = { status: "completed" };
  if (notes !== undefined) patch.notes = notes;
  const { error } = await supabase.from("sessions").update(patch).eq("id", id);
  return !error;
}

export async function saveSessionNotes(id: string, notes: string) {
  const { error } = await supabase.from("sessions").update({ notes }).eq("id", id);
  return !error;
}

export async function cancelSession(id: string) {
  const { error } = await supabase.from("sessions").update({ status: "cancelled" }).eq("id", id);
  return !error;
}

// ── Assignments & submissions ───────────────────────────────
export interface AssignmentRow {
  id: string;
  tutor_id: string;
  course_id: string | null;
  title: string;
  description: string | null;
  due_date: string | null;
  template_url: string | null;
  created_at: string;
  course_title?: string;
  submissionCount?: number;
  reviewedCount?: number;
}

export async function getTutorAssignments(tutorId: string): Promise<AssignmentRow[]> {
  const { data: assignments } = await supabase
    .from("assignments")
    .select("*, courses(title)")
    .eq("tutor_id", tutorId)
    .order("created_at", { ascending: false });
  if (!assignments) return [];

  const ids = assignments.map((a) => a.id);
  const { data: subs } = ids.length
    ? await supabase.from("submissions").select("assignment_id, status").in("assignment_id", ids)
    : { data: [] as any[] };

  return assignments.map((a: any) => {
    const mine = (subs ?? []).filter((s) => s.assignment_id === a.id);
    return {
      ...a,
      course_title: a.courses?.title ?? null,
      submissionCount: mine.length,
      reviewedCount: mine.filter((s) => s.status === "reviewed").length,
    };
  });
}

export async function getAssignment(id: string): Promise<AssignmentRow | null> {
  const { data } = await supabase
    .from("assignments")
    .select("*, courses(title)")
    .eq("id", id)
    .single();
  if (!data) return null;
  return { ...(data as any), course_title: (data as any).courses?.title ?? null };
}

export async function createAssignment(input: {
  tutor_id: string;
  course_id: string | null;
  title: string;
  description?: string;
  due_date?: string | null;
  template_url?: string | null;
}) {
  const { data, error } = await supabase.from("assignments").insert(input).select().single();
  return { data, error };
}

export async function deleteAssignment(id: string) {
  const { error } = await supabase.from("assignments").delete().eq("id", id);
  return !error;
}

export interface SubmissionRow {
  id: string;
  assignment_id: string;
  student_id: string;
  drive_url: string | null;
  status: string;
  tutor_feedback: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  student_name?: string;
  student_avatar?: string | null;
}

export async function getSubmissions(assignmentId: string): Promise<SubmissionRow[]> {
  const { data: subs } = await supabase
    .from("submissions")
    .select("*")
    .eq("assignment_id", assignmentId)
    .order("submitted_at", { ascending: false });
  if (!subs || subs.length === 0) return [];

  const ids = [...new Set(subs.map((s) => s.student_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url")
    .in("id", ids);

  return subs.map((s) => {
    const p = profiles?.find((x) => x.id === s.student_id);
    return { ...s, student_name: p?.full_name || "Student", student_avatar: p?.avatar_url };
  }) as SubmissionRow[];
}

export async function reviewSubmission(id: string, status: "reviewed" | "revision_needed", feedback: string) {
  const { error } = await supabase
    .from("submissions")
    .update({ status, tutor_feedback: feedback, reviewed_at: new Date().toISOString() })
    .eq("id", id);
  return !error;
}
