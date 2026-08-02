import { supabase } from "@/lib/supabase";
import { MOCK_DASHBOARD_SUMMARY, delay } from "@/mock";

export const studentService = {
  /**
   * Student and parent home screen figures.
   *
   * Still mock data. Replacing it means querying sessions for the next booking,
   * assignments and submissions for what is due, and counting completed
   * sessions for the progress block. See src/mock/index.ts.
   */
  async getDashboardSummary() {
    await delay(600);
    return MOCK_DASHBOARD_SUMMARY;
  },
};

// ------------------------------------------------------------
// Enrolled courses
// ------------------------------------------------------------

export interface StudentCourse {
  id: string;
  title: string;
  subject: string;
  thumbnailUrl: string | null;
  tutorName: string | null;
  /** Assignments marked reviewed, over the total set for the course. */
  completed: number;
  total: number;
  progress: number;
  status: "In progress" | "Done" | "Pending";
  /** Soonest assignment still outstanding. */
  nextDue: Date | null;
  sessionCount: number;
}

/**
 * The courses a student is taking, with real progress.
 *
 * There is no enrolments table, so membership is inferred from the sessions
 * booked for them. That is the only link the schema actually has between a
 * student and a course.
 */
export async function getStudentCourses(studentId: string): Promise<StudentCourse[]> {
  // Enrolment is what puts a course on this list. It used to be derived from
  // booked sessions, so a course a parent had paid for did not exist here
  // until somebody scheduled something, which is exactly backwards.
  //
  // Sessions still count too: courses arranged before enrolments existed have
  // no row, and dropping them would make work disappear from a student's page.
  const [enrolRes, sessionRes] = await Promise.all([
    supabase
      .from("enrolments")
      .select("course_id")
      .eq("student_id", studentId)
      .eq("status", "active"),
    supabase
      .from("sessions")
      .select("course_id")
      .eq("student_id", studentId)
      .not("course_id", "is", null),
  ]);
  if (enrolRes.error) throw enrolRes.error;
  if (sessionRes.error) throw sessionRes.error;

  const courseIds = [
    ...new Set([
      ...(enrolRes.data ?? []).map((e: any) => e.course_id),
      ...(sessionRes.data ?? []).map((s: any) => s.course_id),
    ]),
  ];
  if (courseIds.length === 0) return [];

  const [coursesRes, assignmentsRes, submissionsRes] = await Promise.all([
    supabase
      .from("courses")
      .select("id, title, subject, thumbnail_url, tutor:profiles!courses_tutor_id_fkey(full_name)")
      .in("id", courseIds),
    supabase.from("assignments").select("id, course_id, due_date").in("course_id", courseIds),
    supabase.from("submissions").select("assignment_id, status").eq("student_id", studentId),
  ]);
  if (coursesRes.error) throw coursesRes.error;
  if (assignmentsRes.error) throw assignmentsRes.error;
  if (submissionsRes.error) throw submissionsRes.error;

  const submissionByAssignment = new Map(
    (submissionsRes.data ?? []).map((s: any) => [s.assignment_id, s.status])
  );

  return (coursesRes.data ?? []).map((c: any) => {
    const assignments = (assignmentsRes.data ?? []).filter((a: any) => a.course_id === c.id);
    const total = assignments.length;
    // "Done" means the tutor has reviewed it, not merely that it was handed in.
    const completed = assignments.filter(
      (a: any) => submissionByAssignment.get(a.id) === "reviewed"
    ).length;

    const outstanding = assignments
      .filter((a: any) => submissionByAssignment.get(a.id) !== "reviewed" && a.due_date)
      .map((a: any) => new Date(a.due_date))
      .sort((a: Date, b: Date) => a.getTime() - b.getTime());

    const progress = total === 0 ? 0 : Math.round((completed / total) * 100);

    return {
      id: c.id,
      title: c.title,
      subject: c.subject,
      thumbnailUrl: c.thumbnail_url ?? null,
      tutorName: c.tutor?.full_name ?? null,
      completed,
      total,
      progress,
      status: total > 0 && completed === total ? "Done" : completed > 0 ? "In progress" : "Pending",
      nextDue: outstanding[0] ?? null,
      sessionCount: (sessionRes.data ?? []).filter((s: any) => s.course_id === c.id).length,
    };
  });
}

export interface CourseSessionRow {
  id: string;
  date: string;
  start_time: string;
  duration_minutes: number;
  status: string;
  subject: string;
  zoom_link: string | null;
  /** Needed to draw their free hours when a session is being moved. */
  tutor_id: string | null;
  tutor_name: string | null;
  tutor_avatar: string | null;
  notes: string | null;
}

/** A student's sessions on one course, soonest first. */
export async function getCourseSessions(
  studentId: string,
  courseId: string
): Promise<CourseSessionRow[]> {
  const { data, error } = await supabase
    .from("sessions")
    .select(`id, date, start_time, duration_minutes, status, subject, zoom_link, notes, tutor_id,
             tutor:profiles!sessions_tutor_id_fkey (full_name, avatar_url)`)
    .eq("student_id", studentId)
    .eq("course_id", courseId)
    .order("date", { ascending: true });

  if (error) {
    console.error("getCourseSessions failed:", error);
    return [];
  }

  return (data ?? []).map((r: any) => ({
    id: r.id,
    date: r.date,
    start_time: r.start_time,
    duration_minutes: r.duration_minutes,
    status: r.status,
    subject: r.subject,
    zoom_link: r.zoom_link,
    notes: r.notes,
    tutor_id: r.tutor_id ?? null,
    tutor_name: r.tutor?.full_name ?? null,
    tutor_avatar: r.tutor?.avatar_url ?? null,
  }));
}

// ============================================================
// Coursework, as this platform holds it.
//
// Assignments are written on the admin side and read everywhere else, which is
// why there is nothing here that creates or marks one. A course linked to a
// Google Classroom carries the link on each row, so the same card can offer a
// way out to where the work is actually turned in.
// ============================================================

export interface CourseAssignmentRow {
  id: string;
  title: string;
  description: string | null;
  materials: { title: string; link: string | null }[];
  dueDate: string | null;
  maxPoints: number | null;
  /** This student's own result. Null means turned in and not yet marked. */
  grade: number | null;
  isSubmitted: boolean;
  link: string | null;
}

export async function getCourseAssignments(
  studentId: string,
  courseId: string
): Promise<CourseAssignmentRow[]> {
  const [{ data: rows, error }, { data: course }] = await Promise.all([
    supabase
      .from("assignments")
      .select("id, title, description, materials, due_date, max_points, template_url")
      .eq("course_id", courseId)
      .order("due_date", { ascending: true }),
    supabase.from("courses").select("google_classroom_url").eq("id", courseId).maybeSingle(),
  ]);

  if (error) {
    console.error("getCourseAssignments failed:", error);
    return [];
  }

  const ids = (rows ?? []).map((r) => r.id);
  const { data: mine } = ids.length
    ? await supabase
        .from("submissions")
        .select("assignment_id, status, grade")
        .eq("student_id", studentId)
        .in("assignment_id", ids)
    : { data: [] as any[] };

  const byAssignment = new Map((mine ?? []).map((s: any) => [s.assignment_id, s]));

  return (rows ?? []).map((r: any) => {
    const submission = byAssignment.get(r.id);
    return {
      id: r.id,
      title: r.title,
      description: r.description,
      materials: Array.isArray(r.materials) ? r.materials : [],
      dueDate: r.due_date ? String(r.due_date).slice(0, 10) : null,
      maxPoints: r.max_points ?? null,
      grade: submission?.grade != null ? Number(submission.grade) : null,
      isSubmitted: !!submission,
      // The assignment's own template first, then the class it belongs to.
      link: r.template_url || course?.google_classroom_url || null,
    };
  });
}

/**
 * Every assignment across every course a student is taking.
 *
 * The per-course version answers "what is set for this class". A parent, or a
 * student's own overview, is asking a different question: what is outstanding
 * at all, and when. So this gathers the courses first and orders the whole lot
 * by deadline, because the next thing due is the point of the list.
 */
export async function getAllAssignments(studentId: string): Promise<CourseAssignmentRow[]> {
  const courses = await getStudentCourses(studentId);
  if (courses.length === 0) return [];

  const perCourse = await Promise.all(
    courses.map((c) => getCourseAssignments(studentId, c.id))
  );

  return perCourse.flat().sort((a, b) => {
    // No deadline sinks to the bottom rather than sorting as the epoch.
    if (!a.dueDate) return b.dueDate ? 1 : 0;
    if (!b.dueDate) return -1;
    return a.dueDate.localeCompare(b.dueDate);
  });
}
