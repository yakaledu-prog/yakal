import { supabase } from "@/lib/supabase";
import { sendNotification } from "./notificationService";

// ============================================================
// Tutors applying to teach a course.
//
// A course is created by an admin with no tutor. Tutors see the open ones,
// apply, and an admin accepts one, which sets courses.tutor_id. Before this
// the column was set by hand and there was nowhere to record that somebody
// wanted the work.
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
  tutorId: string | null;
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
  "id, title, subject, description, thumbnail_url, price_cents, tutor_payout_cents, tutor_id, created_at";

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
    tutorId: row.tutor_id ?? null,
    createdAt: new Date(row.created_at),
  };
}

/** Courses a tutor is already teaching. */
export async function getTeachingCourses(tutorId: string): Promise<CourseSummary[]> {
  const { data, error } = await supabase
    .from("courses")
    .select(COURSE_FIELDS)
    .eq("tutor_id", tutorId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getTeachingCourses failed:", error);
    return [];
  }
  return (data ?? []).map(toCourse).filter(Boolean) as CourseSummary[];
}

/**
 * Courses with no tutor yet, each carrying this tutor's application if any.
 *
 * Applied courses used to be filtered out. Applying then emptied the catalog,
 * which read as the click having failed: the card vanished, and the only trace
 * was a count on another view. They stay put now and show their state, so the
 * page still says what happened.
 */
export async function getOpenCourses(tutorId: string): Promise<CourseSummary[]> {
  const [coursesRes, mine] = await Promise.all([
    supabase
      .from("courses")
      .select(COURSE_FIELDS)
      .is("tutor_id", null)
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
    getMyApplications(tutorId),
  ]);

  if (coursesRes.error) {
    console.error("getOpenCourses failed:", coursesRes.error);
    return [];
  }

  // Newest decision per course, so a rejected application followed by a fresh
  // one shows the fresh one.
  const byCourse = new Map<string, { id: string; status: ApplicationStatus }>();
  for (const a of mine) {
    if (!byCourse.has(a.courseId)) byCourse.set(a.courseId, { id: a.id, status: a.status });
  }

  return (coursesRes.data ?? [])
    .map(toCourse)
    .filter((c): c is CourseSummary => !!c)
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
      sendNotification({
        userId: a.id,
        title: "New course application",
        message: `${input.tutorName} applied to teach ${input.courseTitle}.`,
        type: "course_application",
        link: `/admin/courses/${input.courseId}`,
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
 * Accept an applicant.
 *
 * Assigning the tutor and rejecting the rest are one decision, so they happen
 * together: a course with two accepted applications is a state nobody should
 * have to reason about. The remaining applicants are told, because being left
 * waiting indefinitely is the thing people complain about.
 */
export async function acceptApplicant(input: {
  applicationId: string;
  courseId: string;
  tutorId: string;
  adminId: string;
  courseTitle: string;
  note?: string;
}): Promise<{ success: boolean; error?: string }> {
  const now = new Date().toISOString();

  const { error: assignErr } = await supabase
    .from("courses")
    .update({ tutor_id: input.tutorId, updated_at: now })
    .eq("id", input.courseId);
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

  // Everyone else who was still waiting on this course.
  const { data: others } = await supabase
    .from("course_applications")
    .select("id, tutor_id")
    .eq("course_id", input.courseId)
    .eq("status", "pending");

  if (others?.length) {
    await supabase
      .from("course_applications")
      .update({ status: "rejected", decided_by: input.adminId, decided_at: now, updated_at: now })
      .in(
        "id",
        others.map((o: { id: string }) => o.id)
      );
  }

  await Promise.all([
    sendNotification({
      userId: input.tutorId,
      title: "You got the course",
      message: `You are now teaching ${input.courseTitle}.`,
      type: "course_application_decided",
      link: "/tutor/courses",
    }).catch(() => undefined),
    ...(others ?? []).map((o: { tutor_id: string }) =>
      sendNotification({
        userId: o.tutor_id,
        title: "Course filled",
        message: `${input.courseTitle} has been assigned to another tutor.`,
        type: "course_application_decided",
        link: "/tutor/courses",
      }).catch(() => undefined)
    ),
  ]);

  return { success: true };
}

export async function rejectApplicant(input: {
  applicationId: string;
  tutorId: string;
  adminId: string;
  courseTitle: string;
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

  await sendNotification({
    userId: input.tutorId,
    title: "Application not accepted",
    message: `Your application to teach ${input.courseTitle} was not accepted this time.`,
    type: "course_application_decided",
    link: "/tutor/courses",
  }).catch(() => undefined);

  return { success: true };
}

// ------------------------------------------------------------
// Booking a course
// ------------------------------------------------------------

export interface CourseWithTutor extends CourseSummary {
  tutor: {
    id: string;
    name: string;
    avatarUrl: string | null;
    bio: string | null;
    subjects: string[] | null;
    hourlyRate: number | null;
  } | null;
}

/**
 * A course and the tutor teaching it, for the booking page.
 *
 * The tutor comes from the accepted application, so the person a parent books
 * with is the person an admin approved. The page used to show four invented
 * tutors with invented prices, which meant the id it handed to checkout was
 * not a real profile.
 */
export async function getCourseForBooking(courseId: string): Promise<CourseWithTutor | null> {
  const { data, error } = await supabase
    .from("courses")
    .select(`${COURSE_FIELDS},
             tutor:profiles!courses_tutor_id_fkey (id, full_name, avatar_url, bio, subjects, hourly_rate)`)
    .eq("id", courseId)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("getCourseForBooking failed:", error);
    return null;
  }

  const base = toCourse(data)!;
  const t = (data as any).tutor;
  return {
    ...base,
    tutor: t
      ? {
          id: t.id,
          name: t.full_name,
          avatarUrl: t.avatar_url ?? null,
          bio: t.bio ?? null,
          subjects: t.subjects ?? null,
          hourlyRate: t.hourly_rate ?? null,
        }
      : null,
  };
}

/**
 * The catalog a parent browses: active courses that have a tutor.
 *
 * A course without one cannot be booked, because there is no calendar to pick
 * a time from, so listing it only produces a dead end. Tutors see those on
 * their own Find Courses page, where the point is to apply for them.
 *
 * ParentCourses used to hold six hardcoded entries with invented ratings and
 * student counts, and ids like "CAT-01" that matched nothing, so clicking one
 * led to a booking page for a course that did not exist.
 */
export async function getCatalogCourses(): Promise<CourseWithTutor[]> {
  const { data, error } = await supabase
    .from("courses")
    .select(`${COURSE_FIELDS},
             tutor:profiles!courses_tutor_id_fkey (id, full_name, avatar_url, bio, subjects, hourly_rate)`)
    .eq("is_active", true)
    .not("tutor_id", "is", null)
    .order("title");

  if (error) {
    console.error("getCatalogCourses failed:", error);
    return [];
  }

  return (data ?? []).map((row: any) => {
    const t = row.tutor;
    return {
      ...toCourse(row)!,
      tutor: t
        ? {
            id: t.id,
            name: t.full_name,
            avatarUrl: t.avatar_url ?? null,
            bio: t.bio ?? null,
            subjects: t.subjects ?? null,
            hourlyRate: t.hourly_rate ?? null,
          }
        : null,
    };
  });
}
