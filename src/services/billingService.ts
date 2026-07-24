import { supabase } from "@/lib/supabase";

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
}

export async function getPaymentMethods(): Promise<SavedCard[]> {
  const res = await authedPost("/api/stripe-payment-methods", {});
  return (res as any).methods || [];
}

async function authedPost(path: string, body: unknown): Promise<{ url?: string; error?: string; methods?: unknown }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return { error: "You must be signed in." };

  const res = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  });

  let payload: any = {};
  try {
    payload = await res.json();
  } catch {
    /* non-JSON error */
  }
  if (!res.ok) return { error: payload.error || `Request failed (${res.status})` };
  return payload;
}

// Redirect the browser to a hosted Stripe Checkout page for these invoices.
export async function startCheckout(invoiceIds: string[]): Promise<{ error?: string }> {
  const { url, error } = await authedPost("/api/stripe-checkout", { invoiceIds });
  if (error) return { error };
  if (url) window.location.assign(url);
  return {};
}

// Confirm a returned Checkout Session (marks invoices paid without needing the
// webhook - used on the success redirect so local testing works out of the box).
export async function confirmCheckout(sessionId: string): Promise<{ status?: string; error?: string }> {
  const { error, ...rest } = await authedPost("/api/stripe-confirm", { sessionId });
  if (error) return { error };
  return rest as { status?: string };
}

// Returns the Stripe Customer Portal URL (the caller opens it - in a new tab).
export async function getCustomerPortalUrl(): Promise<{ url?: string; error?: string }> {
  const { url, error } = await authedPost("/api/stripe-portal", {});
  if (error) return { error };
  return { url };
}

export const money = (cents: number, currency = "usd") =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
