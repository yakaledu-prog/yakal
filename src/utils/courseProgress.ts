// ============================================================
// Rolling one student's submissions up into a course's progress.
//
// Pure and free of the Supabase client on purpose, so it can be checked without
// a database and without the Vite loader. submissionService.getCourseProgress
// fetches the rows and hands them here.
// ============================================================

export interface CourseProgress {
  total: number;
  /** Turned in, whether or not it has been marked. */
  submitted: number;
  graded: number;
  /** Mean of the grades that exist, or null before anything is marked. */
  averageGrade: number | null;
}

export interface ProgressSubmission {
  assignment_id: string;
  status: string;
  grade: number | null;
}

export function summarizeProgress(
  assignmentIds: string[],
  submissions: ProgressSubmission[]
): CourseProgress {
  const byAssignment = new Map(submissions.map((s) => [s.assignment_id, s]));
  let submitted = 0;
  let graded = 0;
  let gradeSum = 0;
  let gradeCount = 0;
  for (const id of assignmentIds) {
    const s = byAssignment.get(id);
    if (!s) continue;
    submitted++;
    if (s.grade != null) {
      graded++;
      gradeSum += s.grade;
      gradeCount++;
    }
  }
  return {
    total: assignmentIds.length,
    submitted,
    graded,
    averageGrade: gradeCount > 0 ? gradeSum / gradeCount : null,
  };
}
