import { supabase } from "@/lib/supabase";
import { authedPost } from "@/lib/authedFetch";

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
 * The services a student can actually use, derived from what has been paid for.
 *
 * Read straight from v_student_entitlements, which is payment alone: an active
 * course enrolment means tutoring, an active admissions plan means admissions.
 * Both are written only by the Stripe webhook.
 *
 * There is no parent permission gate on top. The product model is that a
 * payment creates access for a child, and access is a server-side entitlement
 * rather than a manually editable switch, so nothing a parent toggles turns a
 * paid service off. (An earlier version AND-ed this with child_services as a
 * parent permission; that gate was removed to match the payment-only model.)
 */
export async function getMyActiveServices(studentId: string): Promise<ServiceName[]> {
  const { data, error } = await supabase
    .from("v_student_entitlements")
    .select("service")
    .eq("student_id", studentId);
  if (error) {
    console.warn("Could not read services", error.message);
    return [];
  }
  return (data ?? []).map((r) => r.service as ServiceName);
}

/**
 * A support/admin override for a child's service, kept separate from payment.
 *
 * Access is normally a fact about payment (see active_services). This is the
 * escape hatch the doc allows - "unless support overrides it" - used by the
 * dev console and by a parent answering a child's access request. It is not the
 * parent's day-to-day switch; the Manage children screen no longer offers one.
 * active_services honours an active row here on top of the paid entitlements.
 */
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

/**
 * The active services for each linked child, derived from payment (plus any
 * support override).
 *
 * One active_services call per child rather than a read of a table: access is
 * a fact about enrolments and admissions plans, and this is the parent's view
 * of the same answer the child's app computes. The parent is authorised for
 * their own linked children, so the guard inside active_services returns the
 * real set rather than an empty one.
 */
export async function getChildServices(childIds: string[]): Promise<ChildService[]> {
  if (childIds.length === 0) return [];
  const perChild = await Promise.all(
    childIds.map(async (id) => {
      const services = await getMyActiveServices(id);
      return services.map((service) => ({
        id: `${id}:${service}`,
        student_id: id,
        service,
        is_active: true,
      }));
    })
  );
  return perChild.flat();
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
  services: ServiceName[];
  token: string;
  createdAt: string;
}

/** The public URL a child follows to accept, built from a token. */
export function inviteLink(token: string): string {
  return `${window.location.origin}/invite/${token}`;
}

/**
 * A pragmatic email check: one @, no spaces, and a dot in the domain.
 *
 * Deliberately not the full RFC. The point is to stop a name being stored as an
 * address, which is what happened when a parent typed "sami abate" into an
 * email field whose native validation the button click had bypassed. The invite
 * then went nowhere and the child looked like they had no access. Anything that
 * could plausibly be delivered to passes; the mail server is the real judge.
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * Invite a child by email. The invitation is the family relationship only, not
 * a purchase: it lets the child sign in and be linked, and services are bought
 * per child separately. So no service scope is chosen here.
 *
 * Creates a token-carrying invite the child accepts by following a link sent to
 * that address. The same link works whether or not they already have an
 * account: a new child signs up and is linked as part of it, an existing child
 * is linked on the spot. The token and expiry come from the row's defaults.
 *
 * A second invite to the same address is not an error: the parent is usually
 * trying to resend, so the existing pending invite is returned to be mailed
 * again rather than rejected.
 */
export async function inviteChild(
  parentId: string,
  email: string
): Promise<{ success: boolean; error?: string; inviteId?: string; token?: string }> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return { success: false, error: "Enter your child's email address." };
  if (!isValidEmail(trimmed)) {
    return { success: false, error: "That does not look like an email address." };
  }

  const { data, error } = await supabase
    .from("parent_child_invites")
    .insert({ parent_id: parentId, email: trimmed })
    .select("id, token")
    .single();

  if (error) {
    if (error.code === "23505") {
      // Already a live invite for this address: hand back the existing one so
      // the caller can resend the link rather than being turned away.
      const { data: existing } = await supabase
        .from("parent_child_invites")
        .select("id, token")
        .eq("parent_id", parentId)
        .eq("email", trimmed)
        .eq("status", "pending")
        .maybeSingle();
      if (existing) {
        return { success: true, inviteId: existing.id, token: existing.token };
      }
      return { success: false, error: "You have already invited that address." };
    }
    return { success: false, error: error.message };
  }
  return { success: true, inviteId: data.id, token: data.token };
}

/** Mail the invitation link. The row already exists; this only sends it. */
export async function sendInviteEmail(
  inviteId: string
): Promise<{ sent: boolean; error?: string }> {
  const res = await authedPost<{ sent?: boolean }>("/api/invites?action=send", { inviteId });
  if (res.error) return { sent: false, error: res.error };
  return { sent: !!res.sent };
}

/** Invitations still waiting to be accepted. */
export async function getPendingInvites(parentId: string): Promise<ChildInvite[]> {
  const { data, error } = await supabase
    .from("parent_child_invites")
    .select("id, email, services, token, created_at")
    .eq("parent_id", parentId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getPendingInvites:", error.message);
    return [];
  }
  return (data ?? []).map((r) => ({
    id: r.id,
    email: r.email,
    services: (Array.isArray(r.services) ? r.services : []) as ServiceName[],
    token: r.token,
    createdAt: r.created_at,
  }));
}

// ------------------------------------------------------------
// The child's side of a link invite.
//
// Both go through SECURITY DEFINER functions, because the invite row is not
// readable by the child directly: the token is the only thing that opens it,
// and accepting is checked against the signed-in account in the database.
// ------------------------------------------------------------

export interface InviteDetails {
  valid: boolean;
  reason: "ok" | "used" | "expired" | "cancelled" | "invalid";
  email: string | null;
  services: ServiceName[];
  parentName: string;
}

/** What an invite link points at, for the landing page. Works signed out. */
export async function getInviteByToken(token: string): Promise<InviteDetails | null> {
  const { data, error } = await supabase.rpc("get_child_invite", { p_token: token });
  if (error) {
    console.error("getInviteByToken:", error.message);
    return null;
  }
  const d = (data ?? {}) as any;
  return {
    valid: !!d.valid,
    reason: (d.reason ?? "invalid") as InviteDetails["reason"],
    email: d.email ?? null,
    services: (Array.isArray(d.services) ? d.services : []) as ServiceName[],
    parentName: d.parent_name ?? "A parent",
  };
}

/**
 * Accept an invite as the signed-in student. Grants the parent link and the
 * services on the spot. Idempotent, so calling it after a fresh signup (where
 * the profile trigger has already granted everything) still reports success.
 */
export async function acceptInviteByToken(
  token: string
): Promise<{ ok: boolean; error?: string; services?: ServiceName[] }> {
  const { data, error } = await supabase.rpc("accept_child_invite", { p_token: token });
  if (error) return { ok: false, error: error.message };
  const d = (data ?? {}) as any;
  if (!d.ok) return { ok: false, error: d.error ?? "Could not accept the invitation." };
  return { ok: true, services: (Array.isArray(d.services) ? d.services : []) as ServiceName[] };
}

/** Withdraw an invitation that has not been taken up. */
export async function cancelInvite(inviteId: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("parent_child_invites")
    .update({ status: "cancelled" })
    .eq("id", inviteId);
  return error ? { success: false, error: error.message } : { success: true };
}
