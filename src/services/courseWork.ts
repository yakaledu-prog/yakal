import { authedPost } from "@/lib/authedFetch";
import type { ClassroomAssignment } from "./classroomService";

// ============================================================
// Reading a class without anybody signing into Google.
//
// classroomService talks to Google with a token the browser holds, which meant
// every reader getting one: a student needed a Google account, consent to
// Classroom scopes, and membership of the class before they could see that
// homework existed. Most gave up somewhere in there, so work was set and
// nobody saw it.
//
// This asks our own server instead. It holds one credential, the operations
// account that owns every class, and checks against the database who is
// entitled to the course before it calls Google. A family books a course and
// the work appears.
//
// Its own file rather than another export on classroomService, because it is
// a different thing: that module speaks to Google, this one speaks to us.
// ============================================================

export interface CourseWorkResult {
  assignments: ClassroomAssignment[];
  /** False when the course has no Google Classroom attached. */
  linked: boolean;
  /** True when it has one, but the stored URL is not a class link. */
  invalidLink?: boolean;
}

/** The work set on a Yakal course, for anyone entitled to read it. */
export async function getCourseWorkFor(courseId: string): Promise<CourseWorkResult> {
  const res = await authedPost("/api/google?action=classroom", { courseId });
  if ((res as any).error) throw new Error((res as any).error);
  return {
    assignments: ((res as any).assignments ?? []) as ClassroomAssignment[],
    linked: !!(res as any).linked,
    invalidLink: !!(res as any).invalidLink,
  };
}
