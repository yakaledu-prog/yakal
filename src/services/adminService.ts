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

export async function markPayoutPaid(id: string): Promise<Result> {
  const { error } = await supabase.from("invoices").update({ payout_status: "paid" }).eq("id", id);
  if (error) return { success: false, error: error.message };
  return { success: true };
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

export async function approveUser(id: string): Promise<Result> {
  const { error } = await supabase
    .from("profiles")
    .update({ status: "active", rejection_reason: null })
    .eq("id", id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function rejectUser(id: string, reason: string): Promise<Result> {
  const { error } = await supabase
    .from("profiles")
    .update({ status: "rejected", rejection_reason: reason || "Not approved" })
    .eq("id", id);
  if (error) return { success: false, error: error.message };
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
    .select("id, title, subject, description, price_cents, tutor_payout_cents, thumbnail_url, google_classroom_url, is_active")
    .order("created_at", { ascending: false });
  return courses || [];
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

    return { success: true, data: details };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
