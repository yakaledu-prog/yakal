import { supabase } from "@/lib/supabase";

export interface AdminUser {
  id: string;
  full_name: string;
  email: string | null;
  role: string;
  status: string;
  avatar_url: string | null;
  created_at: string;
  rejection_reason: string | null;
  bio?: string | null;
  cv_url?: string | null;
  subjects?: string[] | null;
}

export interface AdminInvoice {
  id: string;
  parent_id: string;
  parent_name: string;
  description: string;
  amount_cents: number;
  currency: string;
  kind: string;
  status: string;
  created_at: string;
  paid_at: string | null;
}

export interface AdminCourse {
  id: string;
  title: string;
  subject: string;
  description: string | null;
  price_cents: number | null;
  tutor_payout_cents: number | null;
  thumbnail_url: string | null;
  google_classroom_url: string | null;
  is_active: boolean;
  /** Null until an admin accepts one of the applicants. */
  tutor_id: string | null;
}

export interface ContactMessage {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  subject: string | null;
  message: string;
  status: string | null;
  created_at: string;
}

export interface TutorPayout {
  id: string;
  tutor_id: string;
  tutor_name: string;
  parent_name: string;
  description: string;
  payout_cents: number;
  currency: string;
  paid_at: string | null;
}

export interface AdminDashboard {
  usersByRole: Record<string, number>;
  totalUsers: number;
  pendingApprovals: number;
  totalSessions: number;
  revenueCents: number;
  outstandingCents: number;
  payoutsDueCents: number;
  newMessages: number;
}

export type UserDetails = {
  profile: AdminUser;
  invoices?: AdminInvoice[];
  children?: { id: string; full_name: string; avatar_url: string | null; grade_level: string | null }[];
  sessions?: any[];
  applications?: any[];
  courses?: any[];
  child_services?: any[];
  students?: any[];
};

type Result = { success: boolean; error?: string };

// ---- Dashboard ----
export async function getAdminDashboard(): Promise<AdminDashboard> {
  const [profilesRes, sessionsRes, invoicesRes, messagesRes] = await Promise.all([
    supabase.from("profiles").select("role, status"),
    supabase.from("sessions").select("id", { count: "exact", head: true }),
    supabase.from("invoices").select("amount_cents, status, payout_cents, payout_status"),
    supabase.from("contact_messages").select("id", { count: "exact", head: true }).eq("status", "new"),
  ]);

  const profiles = profilesRes.data || [];
  const usersByRole: Record<string, number> = {};
  let pendingApprovals = 0;
  profiles.forEach((p: any) => {
    usersByRole[p.role] = (usersByRole[p.role] || 0) + 1;
    if ((p.role === "tutor" || p.role === "counselor") && p.status === "pending") pendingApprovals++;
  });

  const invoices = invoicesRes.data || [];
  const revenueCents = invoices.filter((i: any) => i.status === "paid").reduce((s: number, i: any) => s + i.amount_cents, 0);
  const outstandingCents = invoices.filter((i: any) => i.status === "open").reduce((s: number, i: any) => s + i.amount_cents, 0);
  const payoutsDueCents = invoices
    .filter((i: any) => i.payout_status === "pending")
    .reduce((s: number, i: any) => s + (i.payout_cents || 0), 0);

  return {
    usersByRole,
    totalUsers: profiles.length,
    pendingApprovals,
    totalSessions: sessionsRes.count || 0,
    revenueCents,
    outstandingCents,
    payoutsDueCents,
    newMessages: messagesRes.count || 0,
  };
}

// ---- Tutor payouts (owed once a parent has paid) ----
export async function getTutorPayouts(): Promise<TutorPayout[]> {
  const { data: rows } = await supabase
    .from("invoices")
    .select("id, tutor_id, parent_id, description, payout_cents, currency, paid_at")
    .eq("payout_status", "pending")
    .order("paid_at", { ascending: false });
  const list = (rows || []).filter((r: any) => r.tutor_id && r.payout_cents);
  const ids = [...new Set([...list.map((r: any) => r.tutor_id), ...list.map((r: any) => r.parent_id)])];
  const { data: people } = ids.length
    ? await supabase.from("profiles").select("id, full_name").in("id", ids)
    : { data: [] as any[] };
  const nameById = new Map((people || []).map((p: any) => [p.id, p.full_name]));
  return list.map((r: any) => ({
    id: r.id,
    tutor_id: r.tutor_id,
    tutor_name: nameById.get(r.tutor_id) || "Tutor",
    parent_name: nameById.get(r.parent_id) || "Parent",
    description: r.description,
    payout_cents: r.payout_cents,
    currency: r.currency || "usd",
    paid_at: r.paid_at,
  }));
}

/**
 * Settle a payout without recording how.
 *
 * Kept only so nothing that still calls it breaks. It flips a column and
 * leaves the tutor no way to check the money moved, which is the problem
 * recordPayout and payViaConnect exist to fix. Use one of those.
 *
 * @deprecated
 */
export async function markPayoutPaid(id: string): Promise<Result> {
  const { error } = await supabase.from("invoices").update({ payout_status: "paid" }).eq("id", id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

/** Whether each of these tutors can receive a Stripe transfer yet. */
export async function getConnectReadiness(tutorIds: string[]): Promise<Map<string, boolean>> {
  const out = new Map<string, boolean>();
  if (tutorIds.length === 0) return out;
  const { data } = await supabase
    .from("profiles")
    .select("id, stripe_payouts_enabled")
    .in("id", tutorIds);
  for (const p of data ?? []) out.set(p.id, !!p.stripe_payouts_enabled);
  return out;
}

// ---- Users / approvals ----
export async function getUsers(role?: string): Promise<AdminUser[]> {
  let q = supabase
    .from("profiles")
    .select("id, full_name, email, role, status, avatar_url, created_at, rejection_reason, subjects")
    .order("created_at", { ascending: false });
  if (role && role !== "all") q = q.eq("role", role);
  const { data, error } = await q;
  if (error) throw error;
  return (data as AdminUser[]) || [];
}

export async function getPendingApprovals(): Promise<AdminUser[]> {
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, status, avatar_url, created_at, rejection_reason, subjects")
    .in("role", ["tutor", "counselor"])
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  return (data as AdminUser[]) || [];
}

export interface Applicant {
  id: string;
  full_name: string;
  email: string | null;
  role: string;
  status: string;
  avatar_url: string | null;
  created_at: string;
  rejection_reason: string | null;
  bio: string | null;
  phone: string | null;
  subjects: string[] | null;
  hourly_rate: number | null;
  rate_currency: string | null;
  resume_url: string | null;
}

/**
 * Tutors and counselors awaiting a decision, or already decided.
 *
 * Everything the reviewer needs is fetched in one go, including resume_url, so
 * the CV can be opened without a second round trip per row.
 */
export async function getApplicants(
  status: "pending" | "active" | "rejected" | "all" = "pending"
): Promise<Applicant[]> {
  let query = supabase
    .from("profiles")
    .select(
      "id, full_name, email, role, status, avatar_url, created_at, rejection_reason, bio, phone, subjects, hourly_rate, rate_currency, resume_url"
    )
    .in("role", ["tutor", "counselor"]);

  if (status !== "all") query = query.eq("status", status);

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;
  return (data as Applicant[]) ?? [];
}

/**
 * Tells an applicant what was decided.
 *
 * Best effort: a failure here must not make the caller think the decision
 * itself failed, because the profile row is already updated by then.
 */
async function notifyDecision(userId: string, approved: boolean, reason?: string) {
  const { error } = await supabase.from("notifications").insert({
    user_id: userId,
    type: "system",
    title: approved ? "Your application was approved" : "Your application was not approved",
    message: approved
      ? "Welcome aboard. Your account is active and you can start taking on students."
      : reason?.trim()
        ? `Reason given: ${reason.trim()}`
        : "Your application was not approved at this time.",
    link: approved ? "/" : "/pending-approval",
  });
  if (error) console.warn("Could not notify the applicant", error.message);
}

export async function approveUser(id: string): Promise<Result> {
  const { error } = await supabase
    .from("profiles")
    .update({ status: "active", rejection_reason: null })
    .eq("id", id);
  if (error) return { success: false, error: error.message };
  await notifyDecision(id, true);
  return { success: true };
}

export async function rejectUser(id: string, reason: string): Promise<Result> {
  const { error } = await supabase
    .from("profiles")
    .update({ status: "rejected", rejection_reason: reason || "Not approved" })
    .eq("id", id);
  if (error) return { success: false, error: error.message };
  await notifyDecision(id, false, reason);
  return { success: true };
}

// ---- Invoices / revenue ----
export async function getAllInvoices(): Promise<AdminInvoice[]> {
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, parent_id, description, amount_cents, currency, kind, status, created_at, paid_at")
    .order("created_at", { ascending: false });
  const rows = invoices || [];
  const parentIds = [...new Set(rows.map((r: any) => r.parent_id))];
  const { data: parents } = parentIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", parentIds)
    : { data: [] as any[] };
  const nameById = new Map((parents || []).map((p: any) => [p.id, p.full_name]));
  return rows.map((r: any) => ({ ...r, parent_name: nameById.get(r.parent_id) || "Unknown" }));
}

// ---- Courses (parent price = margin control) ----
export async function getCourses(): Promise<AdminCourse[]> {
  const { data: courses } = await supabase
    .from("courses")
    .select("id, title, subject, description, price_cents, tutor_payout_cents, thumbnail_url, google_classroom_url, is_active, tutor_id")
    .order("created_at", { ascending: false });
  return courses || [];
}

export async function getCourse(id: string): Promise<AdminCourse | null> {
  const { data: course } = await supabase
    .from("courses")
    .select("id, title, subject, description, price_cents, tutor_payout_cents, thumbnail_url, google_classroom_url, is_active, tutor_id")
    .eq("id", id)
    .single();
  return course || null;
}

export async function updateCourse(id: string, patch: Partial<AdminCourse>): Promise<Result> {
  const { error } = await supabase.from("courses").update(patch).eq("id", id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function createCourse(patch: Partial<AdminCourse>): Promise<Result> {
  const { error } = await supabase.from("courses").insert(patch);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

// ---- Contact inbox ----
export async function getContactMessages(): Promise<ContactMessage[]> {
  const { data, error } = await supabase
    .from("contact_messages")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as ContactMessage[]) || [];
}

export async function markContactHandled(id: string): Promise<Result> {
  const { error } = await supabase.from("contact_messages").update({ status: "handled" }).eq("id", id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function deleteUser(id: string): Promise<Result> {
  // Soft delete by setting status to 'deleted'
  const { error } = await supabase.from("profiles").update({ status: "deleted" }).eq("id", id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function getAdminUserDetails(id: string, role: string): Promise<Result & { data?: UserDetails }> {
  try {
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, email, role, status, avatar_url, created_at, rejection_reason")
      .eq("id", id)
      .single();

    if (profileError) throw profileError;

    const details: UserDetails = { profile: profileData as AdminUser };

    // Common query logic based on role
    if (role === "parent") {
      const [{ data: invoices }, { data: links }] = await Promise.all([
        supabase.from("invoices").select("*").eq("parent_id", id).order("created_at", { ascending: false }),
        supabase.from("parent_student_links").select("student_id").eq("parent_id", id).eq("status", "active")
      ]);
      details.invoices = invoices || [];
      const studentIds = (links || []).map((l: any) => l.student_id);
      if (studentIds.length > 0) {
        const { data: children } = await supabase.from("profiles").select("id, full_name, avatar_url, grade_level").in("id", studentIds);
        details.children = children || [];
      } else {
        details.children = [];
      }
    } else if (role === "student") {
      const [{ data: sessions }, { data: apps }, { data: services }] = await Promise.all([
        supabase.from("sessions").select("*").eq("student_id", id).order("start_time", { ascending: false }),
        supabase.from("college_applications").select("*").eq("student_id", id),
        supabase.from("child_services").select("*").eq("student_id", id)
      ]);
      details.sessions = sessions || [];
      details.applications = apps || [];
      details.child_services = services || [];
    } else if (role === "tutor") {
      const [{ data: sessions }, { data: courses }, { data: invoices }] = await Promise.all([
        supabase.from("sessions").select("*").eq("tutor_id", id).order("start_time", { ascending: false }),
        supabase.from("courses").select("*").contains("tutor_ids", [id]),
        supabase.from("invoices").select("*").eq("tutor_id", id).order("created_at", { ascending: false })
      ]);
      details.sessions = sessions || [];
      details.courses = courses || [];
      details.invoices = invoices || [];
      
      const studentIds = [...new Set((sessions || []).map((s: any) => s.student_id).filter(Boolean))];
      if (studentIds.length > 0) {
        const { data: students } = await supabase.from("profiles").select("id, full_name, avatar_url, grade_level").in("id", studentIds);
        details.students = students || [];
      } else {
        details.students = [];
      }
    } else if (role === "counselor") {
      const [{ data: apps }, { data: sessions }, { data: invoices }] = await Promise.all([
        supabase.from("college_applications").select("*").eq("counselor_id", id),
        supabase.from("sessions").select("*").eq("counselor_id", id).order("start_time", { ascending: false }),
        supabase.from("invoices").select("*").eq("counselor_id", id).order("created_at", { ascending: false })
      ]);
      details.applications = apps || [];
      details.sessions = sessions || [];
      details.invoices = invoices || [];
      
      const studentIds = [...new Set((apps || []).map((a: any) => a.student_id).filter(Boolean))];
      if (studentIds.length > 0) {
        const { data: students } = await supabase.from("profiles").select("id, full_name, avatar_url, grade_level").in("id", studentIds);
        details.students = students || [];
      } else {
        details.students = [];
      }
    }

    if (details.sessions && details.sessions.length > 0) {
      const userIds = new Set<string>();
      details.sessions.forEach((s: any) => {
        if (s.tutor_id) userIds.add(s.tutor_id);
        if (s.counselor_id) userIds.add(s.counselor_id);
        if (s.student_id) userIds.add(s.student_id);
      });
      userIds.delete(id);
      if (userIds.size > 0) {
        const { data: profiles } = await supabase.from("profiles").select("id, full_name, avatar_url, role").in("id", Array.from(userIds));
        if (profiles) {
          const profileMap = new Map(profiles.map(p => [p.id, p]));
          details.sessions = details.sessions.map((s: any) => {
            const otherId = s.tutor_id && s.tutor_id !== id ? s.tutor_id :
                            s.counselor_id && s.counselor_id !== id ? s.counselor_id :
                            s.student_id !== id ? s.student_id : null;
            return { ...s, other_profile: otherId ? profileMap.get(otherId) : null };
          });
        }
      }
    }

    return { success: true, data: details };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ------------------------------------------------------------
// One course, for the admin detail page.
//
// The old page had tabs for students and sessions that rendered a placeholder
// telling you what they would eventually show. These are the real rows.
// ------------------------------------------------------------

export interface CourseStudent {
  id: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  gradeLevel: string | null;
  enrolledAt: string;
  /** The parent who paid, when it was not the student. */
  purchasedByName: string | null;
}

export interface CourseSession {
  id: string;
  date: string;
  startTime: string;
  durationMinutes: number;
  status: string;
  studentName: string | null;
}

export interface AdminCourseDetailData {
  students: CourseStudent[];
  sessions: CourseSession[];
  revenueCents: number;
  payoutCents: number;
  unpaidPayoutCents: number;
}

export async function getCourseDetail(courseId: string): Promise<AdminCourseDetailData> {
  const [enrolRes, sessionRes, invoiceRes] = await Promise.all([
    supabase
      .from("enrolments")
      .select(`id, created_at, status,
               student:profiles!enrolments_student_id_fkey (id, full_name, email, avatar_url, grade_level),
               buyer:profiles!enrolments_purchased_by_fkey (full_name)`)
      .eq("course_id", courseId)
      .eq("status", "active")
      .order("created_at", { ascending: false }),
    supabase
      .from("sessions")
      .select(`id, date, start_time, duration_minutes, status,
               student:profiles!sessions_student_id_fkey (full_name)`)
      .eq("course_id", courseId)
      .order("date", { ascending: true }),
    supabase
      .from("invoices")
      .select("amount_cents, payout_cents, payout_status, status")
      .eq("course_id", courseId),
  ]);

  if (enrolRes.error) console.error("getCourseDetail enrolments:", enrolRes.error);
  if (sessionRes.error) console.error("getCourseDetail sessions:", sessionRes.error);
  if (invoiceRes.error) console.error("getCourseDetail invoices:", invoiceRes.error);

  const paid = (invoiceRes.data ?? []).filter((i: any) => i.status === "paid");

  return {
    students: (enrolRes.data ?? []).map((r: any) => ({
      id: r.student?.id ?? "",
      name: r.student?.full_name ?? "A student",
      email: r.student?.email ?? null,
      avatarUrl: r.student?.avatar_url ?? null,
      gradeLevel: r.student?.grade_level ?? null,
      enrolledAt: r.created_at,
      purchasedByName: r.buyer?.full_name ?? null,
    })),
    sessions: (sessionRes.data ?? []).map((r: any) => ({
      id: r.id,
      date: r.date,
      startTime: r.start_time,
      durationMinutes: r.duration_minutes,
      status: r.status,
      studentName: r.student?.full_name ?? null,
    })),
    revenueCents: paid.reduce((n: number, i: any) => n + (i.amount_cents ?? 0), 0),
    payoutCents: paid.reduce((n: number, i: any) => n + (i.payout_cents ?? 0), 0),
    // What the admin still owes the tutor. The payout is marked pending by the
    // payment webhook and settled by hand.
    unpaidPayoutCents: paid
      .filter((i: any) => i.payout_status === "pending")
      .reduce((n: number, i: any) => n + (i.payout_cents ?? 0), 0),
  };
}

/**
 * How many tutors are waiting on a decision, per course.
 *
 * Lets the course list mark the ones that need attention and float them up,
 * so an admin does not have to open each course to find out which are
 * waiting on them.
 */
export async function getPendingApplicantCounts(): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from("course_applications")
    .select("course_id")
    .eq("status", "pending");

  if (error) {
    console.error("getPendingApplicantCounts failed:", error);
    return {};
  }

  const counts: Record<string, number> = {};
  for (const row of data ?? []) counts[row.course_id] = (counts[row.course_id] ?? 0) + 1;
  return counts;
}
