import { supabase } from "@/lib/supabase";
import { authedPost } from "@/lib/authedFetch";
import { sendNotification } from "./notificationService";

// ============================================================
// Paying a tutor, with a receipt.
//
// Marking an invoice paid used to be the whole of it, so a tutor had no way to
// tell whether the money had actually moved. Every rail a US platform uses
// produces an identifier the recipient can look up in their own bank, so that
// identifier is what turns "we paid you" into something checkable.
//
// Stripe Connect would remove the manual step for most payouts. It does not
// remove this: an off-platform payment always happens eventually, and the
// annual total per tutor is needed for a 1099 either way.
// ============================================================

export type PayoutMethod =
  | "stripe_connect"
  | "ach"
  | "zelle"
  | "paypal"
  | "venmo"
  | "check"
  | "wire"
  | "other";

/**
 * What the reference field holds, per rail. Shown as the input's hint.
 *
 * stripe_connect is not in here: it is never chosen by hand. A transfer
 * records itself, with the transfer id as its reference.
 */
export const METHODS: { id: PayoutMethod; label: string; referenceLabel: string }[] = [
  { id: "ach", label: "ACH direct deposit", referenceLabel: "Trace number" },
  { id: "zelle", label: "Zelle", referenceLabel: "Confirmation code" },
  { id: "paypal", label: "PayPal", referenceLabel: "Transaction ID" },
  { id: "venmo", label: "Venmo", referenceLabel: "Transaction ID" },
  { id: "check", label: "Check", referenceLabel: "Check number" },
  { id: "wire", label: "Wire transfer", referenceLabel: "Fed reference or IMAD" },
  { id: "other", label: "Something else", referenceLabel: "Reference" },
];

export const methodLabel = (m: string) =>
  m === "stripe_connect" ? "Stripe" : (METHODS.find((x) => x.id === m)?.label ?? m);
export const referenceLabel = (m: string) =>
  METHODS.find((x) => x.id === m)?.referenceLabel ?? "Reference";

export interface Payout {
  id: string;
  tutorId: string;
  tutorName: string | null;
  invoiceId: string | null;
  description: string | null;
  amountCents: number;
  currency: string;
  method: PayoutMethod;
  reference: string;
  paidOn: string;
  receiptUrl: string | null;
  note: string | null;
  recordedByName: string | null;
  voidedAt: string | null;
  voidReason: string | null;
}

const FIELDS = `id, tutor_id, invoice_id, amount_cents, currency, method, reference,
                paid_on, receipt_url, note, voided_at, void_reason,
                tutor:profiles!tutor_payouts_tutor_id_fkey (full_name),
                recorder:profiles!tutor_payouts_recorded_by_fkey (full_name),
                invoice:invoices (description)`;

function toPayout(r: any): Payout {
  return {
    id: r.id,
    tutorId: r.tutor_id,
    tutorName: r.tutor?.full_name ?? null,
    invoiceId: r.invoice_id,
    description: r.invoice?.description ?? null,
    amountCents: r.amount_cents,
    currency: r.currency ?? "usd",
    method: r.method,
    reference: r.reference,
    paidOn: r.paid_on,
    receiptUrl: r.receipt_url,
    note: r.note,
    recordedByName: r.recorder?.full_name ?? null,
    voidedAt: r.voided_at,
    voidReason: r.void_reason,
  };
}

/** Everything paid to one tutor, newest first. Their own receipt list. */
export async function getTutorPayoutHistory(tutorId: string): Promise<Payout[]> {
  const { data, error } = await supabase
    .from("tutor_payouts")
    .select(FIELDS)
    .eq("tutor_id", tutorId)
    .order("paid_on", { ascending: false });

  if (error) {
    console.error("getTutorPayoutHistory failed:", error);
    return [];
  }
  return (data ?? []).map(toPayout);
}

/**
 * What a tutor has been paid this calendar year.
 *
 * A US platform files a 1099-NEC once a contractor passes the annual
 * threshold, so this is a number somebody will need in January.
 */
export async function getPayoutYearTotal(
  tutorId: string,
  year = new Date().getFullYear()
): Promise<{ totalCents: number; count: number }> {
  const { data, error } = await supabase
    .from("tutor_payout_totals")
    .select("total_cents, payout_count")
    .eq("tutor_id", tutorId)
    .eq("tax_year", year)
    .maybeSingle();

  if (error || !data) return { totalCents: 0, count: 0 };
  return { totalCents: Number(data.total_cents), count: data.payout_count };
}

/**
 * Record a payment that has already been made.
 *
 * This does not move money. It is the platform writing down that somebody
 * moved it elsewhere, which is why the reference is not optional: without it
 * there is nothing to check the claim against.
 *
 * The invoice is marked paid out only once the record exists, so a failure
 * halfway leaves the payout still owed rather than silently settled.
 */
export async function recordPayout(input: {
  tutorId: string;
  invoiceId: string | null;
  amountCents: number;
  currency?: string;
  method: PayoutMethod;
  reference: string;
  paidOn: string;
  receiptUrl?: string | null;
  note?: string | null;
  adminId: string;
}): Promise<{ success: boolean; error?: string }> {
  const reference = input.reference.trim();
  if (!reference) return { success: false, error: "A reference is required." };

  const { error } = await supabase.from("tutor_payouts").insert({
    tutor_id: input.tutorId,
    invoice_id: input.invoiceId,
    amount_cents: input.amountCents,
    currency: input.currency ?? "usd",
    method: input.method,
    reference,
    paid_on: input.paidOn,
    receipt_url: input.receiptUrl ?? null,
    note: input.note?.trim() || null,
    recorded_by: input.adminId,
  });

  if (error) {
    // The partial unique index refuses a second live payout on one invoice,
    // which is the double payment this exists to prevent.
    if (error.code === "23505") {
      return { success: false, error: "That invoice has already been paid out." };
    }
    return { success: false, error: error.message };
  }

  if (input.invoiceId) {
    const { error: invErr } = await supabase
      .from("invoices")
      .update({ payout_status: "paid" })
      .eq("id", input.invoiceId);
    if (invErr) return { success: false, error: invErr.message };
  }

  await sendNotification({
    userId: input.tutorId,
    type: "payout",
    title: "You have been paid",
    message: `${(input.amountCents / 100).toLocaleString(undefined, { style: "currency", currency: (input.currency ?? "usd").toUpperCase() })} by ${methodLabel(input.method)}, reference ${reference}.`,
    link: "/tutor/earnings",
  }).catch(() => undefined);

  return { success: true };
}

/**
 * Undo a payout that was recorded in error.
 *
 * Voided, never deleted: a financial record that can vanish is not a record.
 * The invoice goes back to owing, so it reappears in the queue.
 */
export async function voidPayout(input: {
  payoutId: string;
  invoiceId: string | null;
  adminId: string;
  reason: string;
}): Promise<{ success: boolean; error?: string }> {
  const reason = input.reason.trim();
  if (!reason) return { success: false, error: "Say why it is being voided." };

  const { error } = await supabase
    .from("tutor_payouts")
    .update({
      voided_at: new Date().toISOString(),
      voided_by: input.adminId,
      void_reason: reason,
    })
    .eq("id", input.payoutId);
  if (error) return { success: false, error: error.message };

  if (input.invoiceId) {
    await supabase
      .from("invoices")
      .update({ payout_status: "pending" })
      .eq("id", input.invoiceId);
  }

  return { success: true };
}

// ------------------------------------------------------------
// Stripe Connect
//
// A tutor connects their own bank on Stripe's hosted pages, so the platform
// never holds a bank number or a tax ID. Nothing here can pay anybody until
// they have finished: connect-transfer refuses an account Stripe has not
// cleared, which is why the fallback above still exists.
// ------------------------------------------------------------

export interface ConnectStatus {
  accountId: string | null;
  payoutsEnabled: boolean;
}

export async function getConnectStatus(profileId: string): Promise<ConnectStatus> {
  const { data } = await supabase
    .from("profiles")
    .select("stripe_account_id, stripe_payouts_enabled")
    .eq("id", profileId)
    .maybeSingle();

  return {
    accountId: data?.stripe_account_id ?? null,
    payoutsEnabled: !!data?.stripe_payouts_enabled,
  };
}


/**
 * Start or resume connecting a bank.
 *
 * An onboarding link is single use and expires, so this is called every time
 * rather than stored. Coming back to a spent link is the most common way
 * onboarding fails.
 */
export async function startConnectOnboarding(): Promise<{ error?: string }> {
  const res = await authedPost("/api/connect?action=onboard", {});
  if (res.error) return { error: res.error };
  if (res.url) window.location.assign(res.url);
  return {};
}

/**
 * Ask Stripe whether onboarding is finished, and store the answer.
 *
 * The account.updated webhook does this too. This is the pull for when that
 * has not arrived: locally it needs the Stripe CLI running, and a tutor who
 * has just finished will not sit waiting for a retry.
 */
export async function refreshConnectStatus(
  profileId?: string
): Promise<{ payoutsEnabled?: boolean; needs?: string[]; error?: string }> {
  return authedPost("/api/connect?action=status", profileId ? { profileId } : {});
}

/** Pay one tutor for one or more settled invoices, out of the Stripe balance. */
export async function payViaConnect(
  invoiceIds: string[]
): Promise<{ transferId?: string; error?: string }> {
  return authedPost("/api/connect?action=transfer", { invoiceIds });
}

// ============================================================
// Earnings, a session at a time.
//
// Money is earned per session, so this is the ledger: one row per session with
// what it was worth, whether it has been asked for, and the reference for the
// payment that settled it. The by-invoice history it replaces could not answer
// "which lesson was that for".
// ============================================================

export interface EarningRow {
  sessionId: string;
  date: string;
  startTime: string;
  durationMinutes: number;
  subject: string;
  studentName: string | null;
  studentAvatarUrl: string | null;
  amountCents: number;
  /** none = not asked for yet, requested = waiting on an admin, paid = settled. */
  payoutStatus: "none" | "requested" | "paid";
  requestedAt: string | null;
  /** Only once paid. */
  method: string | null;
  reference: string | null;
  paidOn: string | null;
}

export async function getTutorEarnings(tutorId: string): Promise<EarningRow[]> {
  const { data: sessions, error } = await supabase
    .from("sessions")
    .select(
      "id, date, start_time, duration_minutes, subject, status, payout_cents, payout_status, payout_requested_at, student:profiles!sessions_student_id_fkey (full_name, avatar_url)"
    )
    .eq("tutor_id", tutorId)
    .order("date", { ascending: false })
    .order("start_time", { ascending: false });

  if (error) {
    console.error("getTutorEarnings failed:", error);
    return [];
  }

  const rows = (sessions ?? []) as any[];

  // The payment that settled each session, where there is one. Read in a single
  // query rather than per row.
  const ids = rows.map((r) => r.id);
  const { data: payouts } = ids.length
    ? await supabase
        .from("tutor_payouts")
        .select("session_id, method, reference, paid_on")
        .in("session_id", ids)
        .is("voided_at", null)
    : { data: [] as any[] };

  const settled = new Map<string, any>((payouts ?? []).map((p: any) => [p.session_id, p]));

  // Only sessions that have actually run. A lesson next Tuesday is not an
  // earning, and listing it as one is how a tutor comes to expect money that
  // is not owed yet.
  const now = Date.now();
  return rows
    .filter((r) => {
      const ended = new Date(`${r.date}T${String(r.start_time).slice(0, 5)}:00`).getTime()
        + (r.duration_minutes || 60) * 60_000;
      return r.status !== "cancelled" && ended < now;
    })
    .map((r) => {
      const paid = settled.get(r.id);
      return {
        sessionId: r.id,
        date: r.date,
        startTime: String(r.start_time).slice(0, 5),
        durationMinutes: r.duration_minutes ?? 60,
        subject: r.subject,
        studentName: r.student?.full_name ?? null,
        studentAvatarUrl: r.student?.avatar_url ?? null,
        amountCents: r.payout_cents ?? 0,
        payoutStatus: (paid ? "paid" : r.payout_status) as EarningRow["payoutStatus"],
        requestedAt: r.payout_requested_at,
        method: paid?.method ?? null,
        reference: paid?.reference ?? null,
        paidOn: paid?.paid_on ?? null,
      };
    });
}

/**
 * Ask to be paid for a session, and be paid.
 *
 * The server decides whether the session happened and whether the money can
 * move. A connected tutor is transferred straight away; one without a bank
 * connected is left waiting for an admin, and told so rather than left
 * wondering why nothing arrived.
 *
 * Every refusal is a sentence worth putting in front of the tutor rather than
 * flattening to "failed".
 */
export async function requestSessionPayment(sessionId: string): Promise<{
  success: boolean;
  paid?: boolean;
  message?: string;
  error?: string;
}> {
  const payload = await authedPost<{
    success?: boolean;
    paid?: boolean;
    message?: string;
  }>("/api/connect?action=session-payout", { sessionId });

  if (payload.error) return { success: false, error: payload.error };
  return { success: true, paid: !!payload.paid, message: payload.message };
}
