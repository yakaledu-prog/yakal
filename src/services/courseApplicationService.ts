import { supabase } from "@/lib/supabase";
import { sendFromTemplate } from "./notificationService";

// ============================================================
// Tutors applying to teach a course.
//
// A course is created by an admin with no tutors. Tutors see the ones they are
// not already on, apply, and an admin accepts them onto the roster in
// course_tutors. Before this the assignment was a column set by hand and there
// was nowhere to record that somebody wanted the work.
//
// Accepting used to be exclusive: it wrote courses.tutor_id and rejected every
// other applicant, so a course was closed forever by its first hire. That was
// never the intent. A course is a subject an admin priced, so several tutors
// can teach it and a family picks between them.
//
// A tutor can read only their own applications, enforced in row level
// security. How many others applied would change how they price themselves,
// and it is not theirs to know.
// ============================================================

export type ApplicationStatus = "pending" | "accepted" | "rejected" | "withdrawn";

export interface CourseSummary {
  id: string;
  title: string;
  subject: string;
  description: string | null;
  thumbnailUrl: string | null;
  priceCents: number | null;
  tutorPayoutCents: number | null;
  createdAt: Date;
  /** This tutor's own application, if they have one. Null means not applied. */
  myApplication?: { id: string; status: ApplicationStatus } | null;
}

export interface CourseApplication {
  id: string;
  courseId: string;
  tutorId: string;
  message: string | null;
  status: ApplicationStatus;
  decisionNote: string | null;
  decidedAt: Date | null;
  createdAt: Date;
  course: CourseSummary | null;
}

const COURSE_FIELDS =
  "id, title, subject, description, thumbnail_url, price_cents, tutor_payout_cents, created_at";

/**
 * The roster, embedded.
 *
 * created_at is selected because the gallery orders on it. It is not shown.
 */
const ROSTER_FIELDS =
  `roster:course_tutors (created_at,
     tutor:profiles!course_tutors_tutor_id_fkey
       (id, full_name, avatar_url, bio, subjects, hourly_rate, education, work_experience, certifications, languages))`;

function toCourse(row: any): CourseSummary | null {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    subject: row.subject,
    description: row.description ?? null,
    thumbnailUrl: row.thumbnail_url ?? null,
    priceCents: row.price_cents ?? null,
    tutorPayoutCents: row.tutor_payout_cents ?? null,
    createdAt: new Date(row.created_at),
  };
}

/** Courses a tutor is already on. */
export async function getTeachingCourses(tutorId: string): Promise<CourseSummary[]> {
  const { data, error } = await supabase
    .from("course_tutors")
    .select(`course:courses (${COURSE_FIELDS}, is_active)`)
    .eq("tutor_id", tutorId);
  if (error) {
    console.error("getTeachingCourses failed:", error);
    return [];
  }
  return (data ?? [])
    .map((row: any) => row.course)
    .filter((c: any) => c?.is_active)
    .map(toCourse)
    .filter(Boolean)
    .sort((a, b) => b!.createdAt.getTime() - a!.createdAt.getTime()) as CourseSummary[];
}

/**
 * Courses this tutor could apply to, each carrying their application if any.
 *
 * Open means "they are not on it", not "nobody is on it". The filter used to
 * be `tutor_id IS NULL`, so the first accepted application removed the course
 * from every other tutor's catalog permanently and there was no way back in.
 * Several tutors can teach one course, so the only thing that should hide it
 * is already teaching it.
 *
 * Applied courses used to be filtered out too. Applying then emptied the
 * catalog, which read as the click having failed: the card vanished, and the
 * only trace was a count on another view. They stay put now and show their
 * state, so the page still says what happened.
 */
export async function getOpenCourses(tutorId: string): Promise<CourseSummary[]> {
  const [coursesRes, rosterRes, mine] = await Promise.all([
    supabase
      .from("courses")
      .select(COURSE_FIELDS)
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
    supabase.from("course_tutors").select("course_id").eq("tutor_id", tutorId),
    getMyApplications(tutorId),
  ]);

  if (coursesRes.error) {
    console.error("getOpenCourses failed:", coursesRes.error);
    return [];
  }

  const alreadyTeaching = new Set((rosterRes.data ?? []).map((r: any) => r.course_id));

  // Newest decision per course, so a rejected application followed by a fresh
  // one shows the fresh one.
  const byCourse = new Map<string, { id: string; status: ApplicationStatus }>();
  for (const a of mine) {
    if (!byCourse.has(a.courseId)) byCourse.set(a.courseId, { id: a.id, status: a.status });
  }

  return (coursesRes.data ?? [])
    .map(toCourse)
    .filter((c): c is CourseSummary => !!c && !alreadyTeaching.has(c.id))
    .map((c) => ({ ...c, myApplication: byCourse.get(c.id) ?? null }));
}

export async function getMyApplications(tutorId: string): Promise<CourseApplication[]> {
  const { data, error } = await supabase
    .from("course_applications")
    .select(`id, course_id, tutor_id, message, status, decision_note, decided_at, created_at,
             course:courses (${COURSE_FIELDS})`)
    .eq("tutor_id", tutorId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getMyApplications failed:", error);
    return [];
  }
  return (data ?? []).map((row: any) => ({
    id: row.id,
    courseId: row.course_id,
    tutorId: row.tutor_id,
    message: row.message,
    status: row.status,
    decisionNote: row.decision_note,
    decidedAt: row.decided_at ? new Date(row.decided_at) : null,
    createdAt: new Date(row.created_at),
    course: toCourse(row.course),
  }));
}

export async function applyForCourse(input: {
  courseId: string;
  tutorId: string;
  tutorName: string;
  courseTitle: string;
  message?: string;
}): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from("course_applications").insert({
    course_id: input.courseId,
    tutor_id: input.tutorId,
    message: input.message?.trim() || null,
  });

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: "You have already applied for this course." };
    }
    console.error("applyForCourse failed:", error);
    return { success: false, error: error.message };
  }

  // Tell the admins there is something to decide. Best effort: the application
  // is filed either way, and an admin will see it in the queue regardless.
  const { data: admins } = await supabase.from("profiles").select("id").eq("role", "admin");
  await Promise.all(
    (admins ?? []).map((a: { id: string }) =>
      sendFromTemplate(a.id, "courseApplication", {
        tutorName: input.tutorName,
        courseTitle: input.courseTitle,
        courseId: input.courseId,
      }).catch(() => undefined)
    )
  );

  return { success: true };
}

export async function withdrawApplication(
  applicationId: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("course_applications")
    .update({ status: "withdrawn", updated_at: new Date().toISOString() })
    .eq("id", applicationId);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

// ---------- admin ----------

export interface Applicant {
  id: string;
  message: string | null;
  status: ApplicationStatus;
  createdAt: Date;
  tutor: {
    id: string;
    name: string;
    email: string | null;
    avatarUrl: string | null;
    bio: string | null;
    subjects: string[] | null;
    hourlyRate: number | null;
    resumeUrl: string | null;
  };
}

export async function getApplicants(courseId: string): Promise<Applicant[]> {
  const { data, error } = await supabase
    .from("course_applications")
    .select(`id, message, status, created_at,
             tutor:profiles!course_applications_tutor_id_fkey
               (id, full_name, email, avatar_url, bio, subjects, hourly_rate, resume_url)`)
    .eq("course_id", courseId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getApplicants failed:", error);
    return [];
  }
  return (data ?? []).map((row: any) => ({
    id: row.id,
    message: row.message,
    status: row.status,
    createdAt: new Date(row.created_at),
    tutor: {
      id: row.tutor?.id ?? "",
      name: row.tutor?.full_name ?? "Someone",
      email: row.tutor?.email ?? null,
      avatarUrl: row.tutor?.avatar_url ?? null,
      bio: row.tutor?.bio ?? null,
      subjects: row.tutor?.subjects ?? null,
      hourlyRate: row.tutor?.hourly_rate ?? null,
      resumeUrl: row.tutor?.resume_url ?? null,
    },
  }));
}

/**
 * Accept an applicant onto a course.
 *
 * Adds them to the roster and leaves everybody else alone. This used to be
 * exclusive: it set courses.tutor_id, rejected every pending application, and
 * told those tutors the course had been "filled". None of that was a decision
 * anybody made, it followed from the column holding one id. A course can carry
 * several tutors, so hiring one says nothing about the next.
 *
 * An admin who wants to turn the others down does it per applicant, which is
 * the same button and now means what it says.
 */
export async function acceptApplicant(input: {
  applicationId: string;
  courseId: string;
  tutorId: string;
  adminId: string;
  courseTitle: string;
  /** For the email, which greets them by name. */
  tutorName?: string;
  note?: string;
}): Promise<{ success: boolean; error?: string }> {
  const now = new Date().toISOString();

  // Idempotent: an admin who accepts an already-accepted tutor should get a
  // no-op, not a duplicate key error thrown at them from a modal.
  const { error: assignErr } = await supabase
    .from("course_tutors")
    .upsert(
      { course_id: input.courseId, tutor_id: input.tutorId },
      { onConflict: "course_id,tutor_id", ignoreDuplicates: true }
    );
  if (assignErr) return { success: false, error: assignErr.message };

  const { error: acceptErr } = await supabase
    .from("course_applications")
    .update({
      status: "accepted",
      decided_by: input.adminId,
      decided_at: now,
      decision_note: input.note?.trim() || null,
      updated_at: now,
    })
    .eq("id", input.applicationId);
  if (acceptErr) return { success: false, error: acceptErr.message };

  await sendFromTemplate(input.tutorId, "courseApplicationDecided", {
    tutorName: input.tutorName ?? "",
    courseTitle: input.courseTitle,
    accepted: true,
  }).catch(() => undefined);

  return { success: true };
}

/**
 * Take a tutor off a course.
 *
 * Their past sessions and invoices are untouched: those name the tutor
 * directly and are a record of work that happened. This only says they are not
 * taking new bookings on it.
 */
export async function removeTutorFromCourse(
  courseId: string,
  tutorId: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("course_tutors")
    .delete()
    .eq("course_id", courseId)
    .eq("tutor_id", tutorId);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function rejectApplicant(input: {
  applicationId: string;
  tutorId: string;
  adminId: string;
  courseTitle: string;
  /** For the email, which greets them by name. */
  tutorName?: string;
  note?: string;
}): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("course_applications")
    .update({
      status: "rejected",
      decided_by: input.adminId,
      decided_at: new Date().toISOString(),
      decision_note: input.note?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.applicationId);
  if (error) return { success: false, error: error.message };

  await sendFromTemplate(input.tutorId, "courseApplicationDecided", {
    tutorName: input.tutorName ?? "",
    courseTitle: input.courseTitle,
    accepted: false,
  }).catch(() => undefined);

  return { success: true };
}

// ------------------------------------------------------------
// Booking a course
// ------------------------------------------------------------

/** One tutor, as the gallery and the booking page need them. */
export interface TutorCard {
  id: string;
  name: string;
  avatarUrl: string | null;
  bio: string | null;
  subjects: string[] | null;
  hourlyRate: number | null;
  /** Kept in the database's own shape, which is what TutorResume reads. */
  education: unknown[];
  work_experience: unknown[];
  certifications: unknown[];
  languages: unknown[];
}

export interface CourseWithTutors extends CourseSummary {
  /** Everyone who may teach it, in roster order. Never null, sometimes empty. */
  tutors: TutorCard[];
}

function toTutorCard(t: any): TutorCard | null {
  if (!t) return null;
  return {
    id: t.id,
    name: t.full_name,
    avatarUrl: t.avatar_url ?? null,
    bio: t.bio ?? null,
    subjects: t.subjects ?? null,
    hourlyRate: t.hourly_rate ?? null,
    education: t.education ?? [],
    work_experience: t.work_experience ?? [],
    certifications: t.certifications ?? [],
    languages: t.languages ?? [],
  };
}

/**
 * The roster, oldest first.
 *
 * Ties break on id because a seed writes a whole roster in one transaction, so
 * every row in it carries the same now(). Left to the timestamp alone the
 * order is the planner's to choose and the gallery reshuffles between visits.
 */
function toRoster(rows: any[] | null | undefined): TutorCard[] {
  return (rows ?? [])
    .slice()
    .sort((a, b) => {
      const byTime = String(a.created_at).localeCompare(String(b.created_at));
      return byTime !== 0 ? byTime : String(a.tutor?.id).localeCompare(String(b.tutor?.id));
    })
    .map((r) => toTutorCard(r.tutor))
    .filter((t): t is TutorCard => !!t);
}

/**
 * A course and everyone who teaches it, for the booking page.
 *
 * The roster comes from accepted applications, so the people a parent chooses
 * between are people an admin approved. The page used to show four invented
 * tutors with invented prices, which meant the id it handed to checkout was
 * not a real profile.
 */
export async function getCourseForBooking(courseId: string): Promise<CourseWithTutors | null> {
  const { data, error } = await supabase
    .from("courses")
    .select(`${COURSE_FIELDS}, ${ROSTER_FIELDS}`)
    .eq("id", courseId)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("getCourseForBooking failed:", error);
    return null;
  }

  return { ...toCourse(data)!, tutors: toRoster((data as any).roster) };
}

/**
 * The catalog a parent browses: active courses that somebody teaches.
 *
 * A course with an empty roster cannot be booked, because there is no calendar
 * to pick a time from, so listing it only produces a dead end. Tutors see
 * those on their own Find Courses page, where the point is to apply for them.
 *
 * The empty ones are dropped here rather than in the query. PostgREST can
 * filter on an embedded table, but only by dropping rows from the embed, and
 * an inner join against course_tutors returns one course row per tutor on it.
 *
 * ParentCourses used to hold six hardcoded entries with invented ratings and
 * student counts, and ids like "CAT-01" that matched nothing, so clicking one
 * led to a booking page for a course that did not exist.
 */
export async function getCatalogCourses(): Promise<CourseWithTutors[]> {
  const { data, error } = await supabase
    .from("courses")
    .select(`${COURSE_FIELDS}, ${ROSTER_FIELDS}`)
    .eq("is_active", true)
    .order("title");

  if (error) {
    console.error("getCatalogCourses failed:", error);
    return [];
  }

  return (data ?? [])
    .map((row: any) => ({ ...toCourse(row)!, tutors: toRoster(row.roster) }))
    .filter((c) => c.tutors.length > 0);
}
