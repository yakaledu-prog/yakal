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
