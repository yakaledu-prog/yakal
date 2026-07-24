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
  price_cents: number | null;
  is_active: boolean;
  tutor_id: string | null;
  tutor_name: string | null;
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
    .select("id, full_name, email, role, status, avatar_url, created_at, rejection_reason")
    .order("created_at", { ascending: false });
  if (role && role !== "all") q = q.eq("role", role);
  const { data, error } = await q;
  if (error) throw error;
  return (data as AdminUser[]) || [];
}

export async function getPendingApprovals(): Promise<AdminUser[]> {
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, status, avatar_url, created_at, rejection_reason")
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
    .select("id, title, subject, price_cents, is_active, tutor_id")
    .order("created_at", { ascending: false });
  const rows = courses || [];
  const tutorIds = [...new Set(rows.map((r: any) => r.tutor_id).filter(Boolean))];
  const { data: tutors } = tutorIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", tutorIds)
    : { data: [] as any[] };
  const nameById = new Map((tutors || []).map((t: any) => [t.id, t.full_name]));
  return rows.map((r: any) => ({ ...r, tutor_name: r.tutor_id ? nameById.get(r.tutor_id) || null : null }));
}

export async function updateCourse(id: string, patch: { price_cents?: number | null; is_active?: boolean }): Promise<Result> {
  const { error } = await supabase.from("courses").update(patch).eq("id", id);
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
