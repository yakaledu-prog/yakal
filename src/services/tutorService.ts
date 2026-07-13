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

export interface WeekDayItem {
  id: string;
  time: string;     // HH:mm
  subject: string;
  student: string;
  status: string;
}
export interface WeekDay {
  label: string;   // Mon, Tue, ...
  date: string;    // YYYY-MM-DD
  dayNum: number;  // 1..31
  count: number;
  isToday: boolean;
  items: WeekDayItem[];
}

export interface TutorDashboard {
  today: SessionRow[];
  next: SessionRow | null;
  upcomingList: SessionRow[];
  stats: TutorStats;
  weekly: WeekDay[];
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
  const weekly: WeekDay[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const dayItems = sessions
      .filter((s) => s.date === key)
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
      .map((s) => ({
        id: s.id,
        time: (s.start_time || "").slice(0, 5),
        subject: s.subject,
        student: s.student_name || "Student",
        status: s.status,
      }));
    weekly.push({
      label: WEEKDAYS[d.getDay()],
      date: key,
      dayNum: d.getDate(),
      count: dayItems.length,
      isToday: key === todayStr,
      items: dayItems,
    });
  }

  return {
    today,
    next,
    upcomingList: upcomingSorted,
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

export interface StudentDetail {
  profile: {
    id: string; full_name: string; avatar_url: string | null; email: string | null;
    grade_level: string | null; subjects: string[] | null;
  } | null;
  sessions: SessionRow[];
  submissions: {
    id: string; assignment_id: string; assignment_title: string; status: string;
    drive_url: string | null; submitted_at: string; reviewed_at: string | null;
  }[];
}

/** Full detail for one student, scoped to this tutor (sessions + submissions). */
export async function getStudentDetail(tutorId: string, studentId: string): Promise<StudentDetail> {
  const [profRes, allSessions, subsRes] = await Promise.all([
    supabase.from("profiles").select("id, full_name, avatar_url, email, grade_level, subjects").eq("id", studentId).single(),
    getTutorSessionsFull(tutorId),
    supabase
      .from("submissions")
      .select("id, assignment_id, status, drive_url, submitted_at, reviewed_at, assignments!inner(title, tutor_id)")
      .eq("student_id", studentId)
      .eq("assignments.tutor_id", tutorId)
      .order("submitted_at", { ascending: false }),
  ]);

  const sessions = allSessions.filter((s) => s.student_id === studentId);
  const submissions = (subsRes.data ?? []).map((s: any) => ({
    id: s.id,
    assignment_id: s.assignment_id,
    assignment_title: s.assignments?.title ?? "Assignment",
    status: s.status,
    drive_url: s.drive_url,
    submitted_at: s.submitted_at,
    reviewed_at: s.reviewed_at,
  }));

  return { profile: (profRes.data as any) ?? null, sessions, submissions };
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

export interface CourseWorkspace {
  course: any | null;
  sessions: SessionRow[];
  students: TutorStudent[];
  assignments: AssignmentRow[];
}

/** Everything for one course's tabbed detail view. */
export async function getCourseWorkspace(courseId: string, tutorId: string): Promise<CourseWorkspace> {
  const [{ data: course }, allSessions, allAssignments] = await Promise.all([
    supabase.from("courses").select("*").eq("id", courseId).single(),
    getTutorSessionsFull(tutorId),
    getTutorAssignments(tutorId),
  ]);

  const sessions = allSessions.filter((s) => s.course_id === courseId);
  const assignments = allAssignments.filter((a) => a.course_id === courseId);

  const ids = [...new Set(sessions.map((s) => s.student_id))];
  const students: TutorStudent[] = ids.map((id) => {
    const mine = sessions.filter((s) => s.student_id === id);
    const dates = mine.map((s) => s.date).sort();
    return {
      id,
      full_name: mine[0]?.student_name || "Student",
      avatar_url: mine[0]?.student_avatar ?? null,
      email: null,
      sessionCount: mine.length,
      completedCount: mine.filter((s) => s.status === "completed").length,
      lastDate: dates[dates.length - 1] ?? null,
      subjects: [...new Set(mine.map((s) => s.subject))],
    };
  });

  return { course: course ?? null, sessions, students, assignments };
}

// ── Earnings (rate is the tutor's current profile rate) ─────
export interface EarningsActivity {
  id: string;
  date: string;
  subject: string;
  student: string;
  amount: number;
}
export interface EarningsSummary {
  total: number;
  thisMonth: number;
  lastMonth: number;
  momChangePct: number | null; // this month vs last month
  completedCount: number;
  rate: number;
  months: { key: string; label: string; shortLabel: string; count: number; amount: number }[]; // newest first
  bySubject: { subject: string; count: number; amount: number }[];
  activity: EarningsActivity[]; // newest first
}

/** Earnings = completed sessions × current rate, with month/subject/activity views. */
export function computeEarnings(sessions: SessionRow[], rate: number): EarningsSummary {
  const completed = sessions
    .filter((s) => s.status === "completed")
    .sort((a, b) => (b.date + b.start_time).localeCompare(a.date + a.start_time));

  const byMonth = new Map<string, number>();
  const bySubjectMap = new Map<string, number>();
  for (const s of completed) {
    const mk = s.date.slice(0, 7);
    byMonth.set(mk, (byMonth.get(mk) ?? 0) + 1);
    bySubjectMap.set(s.subject, (bySubjectMap.get(s.subject) ?? 0) + 1);
  }

  const now = new Date();
  // Generate the last 8 months in reverse chronological order (newest first)
  const months = Array.from({ length: 8 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const key = `${year}-${month}`;
    const count = byMonth.get(key) ?? 0;
    return {
      key,
      label: d.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
      shortLabel: d.toLocaleDateString(undefined, { month: "short" }),
      count,
      amount: count * rate,
    };
  });

  const bySubject = [...bySubjectMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([subject, count]) => ({ subject, count, amount: count * rate }));

  const thisYear = now.getFullYear();
  const thisMonthStr = String(now.getMonth() + 1).padStart(2, "0");
  const thisKey = `${thisYear}-${thisMonthStr}`;
  
  const lastD = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastYear = lastD.getFullYear();
  const lastMonthStr = String(lastD.getMonth() + 1).padStart(2, "0");
  const lastKey = `${lastYear}-${lastMonthStr}`;
  
  const thisMonth = (byMonth.get(thisKey) ?? 0) * rate;
  const lastMonth = (byMonth.get(lastKey) ?? 0) * rate;
  const momChangePct = lastMonth > 0 ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : null;

  const activity: EarningsActivity[] = completed.map((s) => ({
    id: s.id,
    date: s.date,
    subject: s.subject,
    student: s.student_name || "Student",
    amount: rate,
  }));

  return {
    total: completed.length * rate,
    thisMonth,
    lastMonth,
    momChangePct,
    completedCount: completed.length,
    rate,
    months,
    bySubject,
    activity,
  };
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
