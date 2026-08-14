import { supabase } from "@/lib/supabase";
import { authedPost } from "@/lib/authedFetch";
import {
  summarizeProgress,
  type CourseProgress,
  type ProgressSubmission,
} from "@/utils/courseProgress";

export { summarizeProgress };
export type { CourseProgress, ProgressSubmission };

// ============================================================
// The native workspace: turning work in, grading it, and rolling up progress.
//
// P3 of the Classroom integration (docs/architecture/google-classroom.md).
// Classroom owns the assignment definitions (read live, mirrored into native
// rows keyed by external_id in P2); the actual work happens here, so a student
// never signs into Google to hand something in and a tutor never leaves Yakal
// to mark it.
//
// Every write goes through RLS, not a service role: "Students manage their own
// submissions" scopes a turn-in to auth.uid(), and "Tutors view and review
// submissions for their assignments" scopes a grade to the tutor's courses. A
// crafted id changes nothing it should not.
// ============================================================

type Result = { success: boolean; error?: string };

/**
 * A student turns work in for one assignment. Upserts on the
 * (assignment_id, student_id) unique index, so turning in twice updates the one
 * row rather than failing. driveUrl is optional: some work is a link, some is
 * just "done".
 */
export async function turnInAssignment(
  studentId: string,
  assignmentId: string,
  driveUrl?: string | null
): Promise<Result> {
  const { error } = await supabase.from("submissions").upsert(
    {
      assignment_id: assignmentId,
      student_id: studentId,
      drive_url: driveUrl?.trim() || null,
      status: "submitted",
      submitted_at: new Date().toISOString(),
    },
    { onConflict: "assignment_id,student_id" }
  );
  if (error) return { success: false, error: error.message };
  return { success: true };
}

/**
 * Take a turn-in back, but only while it is unmarked. Once a tutor has put a
 * grade on it, it is a record and undoing it would erase their work, so the
 * `.is("grade", null)` guard leaves a graded row alone.
 */
export async function unsubmitAssignment(
  studentId: string,
  assignmentId: string
): Promise<Result> {
  const { error } = await supabase
    .from("submissions")
    .delete()
    .eq("student_id", studentId)
    .eq("assignment_id", assignmentId)
    .is("grade", null);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

/**
 * A tutor grades a submission. Sets the grade, optional feedback, marks it
 * reviewed and stamps the time. Returns the updated row's ids so a caller that
 * writes the grade back to Classroom (P4) has what it needs.
 */
export async function gradeSubmission(
  submissionId: string,
  grade: number,
  feedback?: string | null
): Promise<Result & { assignmentId?: string; studentId?: string }> {
  const { data, error } = await supabase
    .from("submissions")
    .update({
      grade,
      tutor_feedback: feedback?.trim() || null,
      status: "reviewed",
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", submissionId)
    .select("assignment_id, student_id")
    .maybeSingle();
  if (error) return { success: false, error: error.message };
  return { success: true, assignmentId: data?.assignment_id, studentId: data?.student_id };
}

/**
 * Push a grade a tutor just gave back to the linked Google Classroom (P4).
 *
 * Best-effort by design: gradeSubmission already saved the native grade, and
 * this is a courtesy for tutors who also keep a Classroom gradebook. It can only
 * reach a student who is a member of the Google class, so the server may answer
 * written:false with a reason (not linked, student not on the roster, missing
 * scope) - never something a caller should treat as the grade failing.
 */
export async function writeGradeToClassroom(
  submissionId: string
): Promise<{ written: boolean; reason?: string }> {
  try {
    const res = await authedPost("/api/google?action=grade", { submissionId });
    if ((res as any).error) return { written: false, reason: (res as any).error };
    return { written: !!(res as any).written, reason: (res as any).reason };
  } catch (err: any) {
    return { written: false, reason: err?.message ?? "Could not reach Classroom" };
  }
}

/** One student's progress across a course, for the dashboard rollup. */
export async function getCourseProgress(
  studentId: string,
  courseId: string
): Promise<CourseProgress> {
  const { data: assignments } = await supabase
    .from("assignments")
    .select("id")
    .eq("course_id", courseId);
  const assignmentIds = (assignments ?? []).map((a: { id: string }) => a.id);
  if (assignmentIds.length === 0) return summarizeProgress([], []);

  const { data: subs } = await supabase
    .from("submissions")
    .select("assignment_id, status, grade")
    .eq("student_id", studentId)
    .in("assignment_id", assignmentIds);

  const submissions: ProgressSubmission[] = (subs ?? []).map((s: any) => ({
    assignment_id: s.assignment_id,
    status: s.status,
    grade: s.grade != null ? Number(s.grade) : null,
  }));
  return summarizeProgress(assignmentIds, submissions);
}
