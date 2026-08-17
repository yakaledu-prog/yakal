import { supabase } from "@/lib/supabase";
import { authedPost } from "@/lib/authedFetch";

export interface Invoice {
  id: string;
  parent_id: string;
  student_id: string | null;
  description: string;
  amount_cents: number;
  currency: string;
  kind: "tutoring" | "admissions" | "registration" | "other";
  status: "open" | "paid" | "void";
  due_date: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface BillingSummary {
  balanceDueCents: number;
  nextDueDate: string | null;
  openCount: number;
}

export async function getInvoices(parentId: string): Promise<Invoice[]> {
  const { data, error } = await supabase
    .from("invoices")
    .select("*")
    .eq("parent_id", parentId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as Invoice[]) || [];
}

export function summarize(invoices: Invoice[]): BillingSummary {
  const open = invoices.filter((i) => i.status === "open");
  const balanceDueCents = open.reduce((sum, i) => sum + i.amount_cents, 0);
  const withDates = open.filter((i) => i.due_date).sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1));
  return {
    balanceDueCents,
    nextDueDate: withDates[0]?.due_date ?? null,
    openCount: open.length,
  };
}

export interface SavedCard {
  id: string;
  brand: string;
  last4: string;
  exp_month: number | null;
  exp_year: number | null;
  isDefault: boolean;
  /** Stripe's created stamp, in seconds. Absent on cards saved before this. */
  addedAt?: number;
}

export async function getPaymentMethods(): Promise<SavedCard[]> {
  const res = await authedPost("/api/stripe?action=payment-methods", {});
  return (res as any).methods || [];
}


// Redirect the browser to a hosted Stripe Checkout page for these invoices.
export async function startCheckout(invoiceIds: string[]): Promise<{ error?: string }> {
  const { url, error } = await authedPost("/api/stripe?action=checkout", { invoiceIds });
  if (error) return { error };
  if (url) window.location.assign(url);
  return {};
}

// Create an invoice (e.g. from a course booking) and go straight to Checkout.
export async function bookAndPay(input: {
  /** Omitted when the server derives it, e.g. from an admissions tier. */
  description?: string;
  amountCents?: number;
  kind?: "tutoring" | "admissions" | "registration" | "other";
  studentId?: string | null;
  tutorId?: string | null;
  /** The course being bought. Payment creates the enrolment from this. */
  courseId?: string | null;
  /** Slots picked at checkout. Payment turns these into sessions. */
  booking?: { date: string; startTime: string; durationMinutes?: number }[];
  /**
   * The admissions tier being bought. When this is set the server ignores
   * amountCents and description and takes both from the tier row: a price the
   * browser supplies is a price the payer can choose.
   */
  admissionsTierId?: string | null;
  /**
   * The counsellor a parent chose for an admissions tier. Checked server side
   * against being an active counsellor; a stale id is ignored rather than
   * failing the purchase.
   */
  counselorId?: string | null;
}): Promise<{ error?: string }> {
  const res = await authedPost("/api/stripe?action=create-invoice", input);
  if (res.error) return { error: res.error };
  const invoiceId = (res as any).invoiceId as string | undefined;
  if (!invoiceId) return { error: "Could not create the invoice." };
  return startCheckout([invoiceId]);
}

// Confirm a returned Checkout Session (marks invoices paid without needing the
// webhook - used on the success redirect so local testing works out of the box).
export async function confirmCheckout(sessionId: string): Promise<{ status?: string; error?: string }> {
  const { error, ...rest } = await authedPost("/api/stripe?action=confirm", { sessionId });
  if (error) return { error };
  return rest as { status?: string };
}

// Returns the Stripe Customer Portal URL (the caller opens it - in a new tab).
export async function getCustomerPortalUrl(): Promise<{ url?: string; error?: string }> {
  const { url, error } = await authedPost("/api/stripe?action=portal", {});
  if (error) return { error };
  return { url };
}

export const money = (cents: number, currency = "usd") =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
