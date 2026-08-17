import { authedPost } from "@/lib/authedFetch";
import type { ClassroomAssignment, ClassroomTopic } from "./classroomService";

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
  /** The class's topics, in the order Google returned them. Empty for a class
   *  that groups nothing, in which case the reader shows a flat list. */
  topics: ClassroomTopic[];
  /** False when the course has no Google Classroom attached. */
  linked: boolean;
  /** True when it has one, but the stored URL is not a class link. */
  invalidLink?: boolean;
  /** Who has turned each assignment in, keyed by its id. Staff only, and only
   *  once the class has students; a learner is told about their own work and
   *  nothing about anybody else's. */
  submitters?: Record<string, { id: string; name: string; avatarUrl: string | null }[]>;
}

/**
 * A class read straight from its URL, so an admin can confirm they attached
 * the right one before saving. Admin only, and the only caller is the course
 * modal.
 *
 * This used to sign the admin into Google in a popup and read Classroom from
 * the browser, which needed a second OAuth client configuration, a token in
 * localStorage, and an "Authorised JavaScript origin" per environment. It
 * asked a person to authenticate for something the server was already doing
 * with its own credential.
 */
export async function previewCourseWork(classroomUrl: string): Promise<CourseWorkResult> {
  return read({ classroomUrl });
}

/** The work set on a Yakal course, for anyone entitled to read it. */
export async function getCourseWorkFor(courseId: string): Promise<CourseWorkResult> {
  return read({ courseId });
}

async function read(body: { courseId: string } | { classroomUrl: string }): Promise<CourseWorkResult> {
  const res = await authedPost("/api/google?action=classroom", body);
  if ((res as any).error) throw new Error((res as any).error);
  return {
    assignments: ((res as any).assignments ?? []) as ClassroomAssignment[],
    topics: ((res as any).topics ?? []) as ClassroomTopic[],
    linked: !!(res as any).linked,
    invalidLink: !!(res as any).invalidLink,
    submitters: (res as any).submitters ?? undefined,
  };
}
