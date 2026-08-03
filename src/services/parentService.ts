import { supabase } from "@/lib/supabase";

export interface LinkedChild {
  id: string;
  full_name: string;
  avatar_url: string | null;
  grade_level: string | null;
}

// Active children linked to this parent.
export async function getLinkedChildren(parentId: string): Promise<LinkedChild[]> {
  const { data: links } = await supabase
    .from("parent_student_links")
    .select("student_id")
    .eq("parent_id", parentId)
    .eq("status", "active");
  const ids = (links || []).map((l) => l.student_id);
  if (ids.length === 0) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, grade_level")
    .in("id", ids)
    .order("full_name");
  return (profiles as LinkedChild[]) || [];
}

// --- Per-child service enrollment (Tutoring / Admissions) ---
export type ServiceName = "tutoring" | "admissions";

export interface ChildService {
  id: string;
  student_id: string;
  service: ServiceName;
  is_active: boolean;
}

/**
 * The services active for the signed-in student.
 *
 * A student can read their own rows (child_services_student_select), so this
 * works without going through the parent. A service with no row at all counts
 * as inactive: nothing is unlocked until a parent turns it on.
 */
export async function getMyActiveServices(studentId: string): Promise<ServiceName[]> {
  const { data, error } = await supabase
    .from("child_services")
    .select("service, is_active")
    .eq("student_id", studentId)
    .eq("is_active", true);
  if (error) {
    console.warn("Could not read services", error.message);
    return [];
  }
  return (data ?? []).map((r) => r.service as ServiceName);
}

export async function getChildServices(childIds: string[]): Promise<ChildService[]> {
  if (childIds.length === 0) return [];
  const { data } = await supabase
    .from("child_services")
    .select("id, student_id, service, is_active")
    .in("student_id", childIds);
  return (data as ChildService[]) || [];
}

// Toggle a service on/off for a child (upsert on the unique (student_id, service)).
export async function setChildService(
  studentId: string,
  service: ServiceName,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("child_services")
    .upsert({ student_id: studentId, service, is_active: isActive }, { onConflict: "student_id,service" });
  if (error) {
    console.error("setChildService failed:", error);
    return { success: false, error: error.message };
  }
  return { success: true };
}

/** Upcoming session count per child, for the children list. */
export async function getUpcomingSessionCounts(
  childIds: string[]
): Promise<Record<string, number>> {
  if (childIds.length === 0) return {};
  const { data, error } = await supabase
    .from("sessions")
    .select("student_id")
    .in("student_id", childIds)
    .eq("status", "upcoming");
  if (error) {
    console.warn("Could not count sessions", error.message);
    return {};
  }
  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    counts[row.student_id] = (counts[row.student_id] ?? 0) + 1;
  }
  return counts;
}

// ------------------------------------------------------------
// Linking a child
//
// A parent creates the request and the student accepts it. RLS enforces that
// split: a parent may insert a row for themselves, only the student may update
// its status. So a parent cannot silently attach themselves to an account.
// ------------------------------------------------------------

export interface PendingChildLink {
  id: string;
  student_id: string;
  full_name: string;
  email: string | null;
  avatar_url: string | null;
  status: "pending" | "rejected";
}

export async function getPendingChildLinks(parentId: string): Promise<PendingChildLink[]> {
  const { data: links, error } = await supabase
    .from("parent_student_links")
    .select("id, student_id, status")
    .eq("parent_id", parentId)
    .in("status", ["pending", "rejected"]);
  if (error) throw error;
  if (!links?.length) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email, avatar_url")
    .in("id", links.map((l) => l.student_id));

  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
  return links.map((l) => {
    const p = byId.get(l.student_id);
    return {
      id: l.id,
      student_id: l.student_id,
      full_name: p?.full_name ?? "Unknown",
      email: p?.email ?? null,
      avatar_url: p?.avatar_url ?? null,
      status: l.status as "pending" | "rejected",
    };
  });
}

/** Asks a student to link their account to this parent. */
export async function requestChildLink(
  parentId: string,
  parentName: string,
  email: string
): Promise<{ success: boolean; error?: string }> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return { success: false, error: "Enter your child's email address." };

  const { data: student } = await supabase
    .from("profiles")
    .select("id, role, full_name")
    .eq("email", trimmed)
    .maybeSingle();

  if (!student) {
    return { success: false, error: "No account uses that email address yet." };
  }
  if (student.role !== "student") {
    return { success: false, error: `That account is a ${student.role}, not a student.` };
  }
  if (student.id === parentId) {
    return { success: false, error: "That is your own account." };
  }

  const { error } = await supabase
    .from("parent_student_links")
    .insert({ parent_id: parentId, student_id: student.id, status: "pending" });

  if (error) {
    if (error.code === "23505") return { success: false, error: "You have already asked to link this account." };
    return { success: false, error: error.message };
  }

  // Best effort: the request exists either way, and the student also sees it
  // on their own screen.
  const { error: notifErr } = await supabase.from("notifications").insert({
    user_id: student.id,
    type: "parent_link",
    title: "Parent link request",
    message: `${parentName} has asked to link to your account as your parent.`,
    link: `/student/notifications`,
  });
  if (notifErr) console.warn("Could not notify the student", notifErr.message);

  return { success: true };
}

/** The student's side: accept or decline a pending parent link. */
export async function respondToChildLink(
  linkId: string,
  accept: boolean
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("parent_student_links")
    .update({ status: accept ? "active" : "rejected" })
    .eq("id", linkId);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

/** Pending link requests addressed to this student. */
export async function getIncomingLinkRequests(studentId: string) {
  const { data: links, error } = await supabase
    .from("parent_student_links")
    .select("id, parent_id")
    .eq("student_id", studentId)
    .eq("status", "pending");
  if (error) throw error;
  if (!links?.length) return [];

  const { data: parents } = await supabase
    .from("profiles")
    .select("id, full_name, email, avatar_url")
    .in("id", links.map((l) => l.parent_id));

  const byId = new Map((parents ?? []).map((p) => [p.id, p]));
  return links.map((l) => ({
    id: l.id,
    parentId: l.parent_id,
    parentName: byId.get(l.parent_id)?.full_name ?? "A parent",
    parentEmail: byId.get(l.parent_id)?.email ?? null,
    avatarUrl: byId.get(l.parent_id)?.avatar_url ?? null,
  }));
}

// ------------------------------------------------------------
// Confirming a child's email while typing it.
//
// Backed by a SECURITY DEFINER function rather than a table query on purpose.
// An open search over profiles would let any account enumerate every student
// on the platform, most of whom are minors. The function requires a parent, a
// five character prefix, and returns the address masked. See
// supabase/migrations/20260731000900_search_students_by_email.sql.
// ------------------------------------------------------------

export interface StudentSuggestion {
  id: string;
  full_name: string;
  /** e.g. "am*******@gmail.com". Never the full address. */
  masked_email: string;
  avatar_url: string | null;
  grade_level: string | null;
}

export async function searchStudentsByEmail(prefix: string): Promise<StudentSuggestion[]> {
  if (prefix.trim().length < 5) return [];
  const { data, error } = await supabase.rpc("search_students_by_email", {
    p_prefix: prefix.trim(),
  });
  if (error) {
    // A failed suggestion is not worth interrupting anyone for: the field
    // still works by typing the whole address.
    console.warn("search_students_by_email failed:", error.message);
    return [];
  }
  return (data as StudentSuggestion[]) ?? [];
}

export interface ChildInvite {
  id: string;
  email: string;
  createdAt: string;
}

/**
 * Invite a child who has no account yet.
 *
 * The address is remembered rather than rejected. When somebody signs up as a
 * student with it, a trigger creates the link request for them, so the parent
 * does not have to come back and try again once the child has joined.
 *
 * The link it creates is pending, not active: an invitation is the parent
 * asking, and the child still answers.
 */
export async function inviteChild(
  parentId: string,
  email: string
): Promise<{ success: boolean; error?: string }> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return { success: false, error: "Enter your child's email address." };

  const { error } = await supabase
    .from("parent_child_invites")
    .insert({ parent_id: parentId, email: trimmed });

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: "You have already invited that address." };
    }
    return { success: false, error: error.message };
  }
  return { success: true };
}

/** Invitations still waiting on somebody to sign up. */
export async function getPendingInvites(parentId: string): Promise<ChildInvite[]> {
  const { data, error } = await supabase
    .from("parent_child_invites")
    .select("id, email, created_at")
    .eq("parent_id", parentId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getPendingInvites:", error.message);
    return [];
  }
  return (data ?? []).map((r) => ({ id: r.id, email: r.email, createdAt: r.created_at }));
}

/** Withdraw an invitation that has not been taken up. */
export async function cancelInvite(inviteId: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("parent_child_invites")
    .update({ status: "cancelled" })
    .eq("id", inviteId);
  return error ? { success: false, error: error.message } : { success: true };
}
