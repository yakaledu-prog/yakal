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

async function authedPost(path: string, body: unknown): Promise<{ url?: string; error?: string }> {
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

// Open the Stripe Customer Portal (manage cards / receipts).
export async function openCustomerPortal(): Promise<{ error?: string }> {
  const { url, error } = await authedPost("/api/stripe-portal", {});
  if (error) return { error };
  if (url) window.location.assign(url);
  return {};
}

export const money = (cents: number, currency = "usd") =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
