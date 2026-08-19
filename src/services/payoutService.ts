import { supabase } from "@/lib/supabase";
import { authedPost } from "@/lib/authedFetch";

// ============================================================
// What a tutor or counsellor is owed, and what they have been paid.
//
// One table behind all of it. There used to be four: a payout figure on the
// invoice, another on the session, a table of payments already made, and a
// table of counsellor amounts nothing ever paid. Asking "what am I owed" meant
// reading all of them and hoping they agreed.
//
// Nothing here asks to be paid, because nothing needs to. An earning is written
// when the work is delivered, waits out a hold, and transfers itself. A tutor
// requesting payment for their own lesson was a tutor authorising their own
// payment, and it is gone.
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
 * stripe_connect is not in here: it is never chosen by hand. A transfer records
 * itself, with the transfer id as its reference.
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

/**
 * pending   owed, waiting out its hold or waiting for a bank to be connected
 * settled   paid, and `reference` says how
 * cancelled never became payable: refunded in time, disputed, or the lesson
 *           did not happen
 * reversed  moved and then pulled back
 */
export type EarningStatus = "pending" | "settled" | "cancelled" | "reversed";

export interface EarningRow {
  id: string;
  kind: "tutoring_session" | "counselling_month";
  sessionId: string | null;
  planId: string | null;
  /** The lesson's date, or the first day of the month a subscription paid for. */
  date: string;
  startTime: string | null;
  durationMinutes: number | null;
  /** The subject taught, or the tier's name. */
  subject: string;
  studentName: string | null;
  studentAvatarUrl: string | null;
  amountCents: number;
  currency: string;
  status: EarningStatus;
  /** When the hold expires. Nothing moves before this. */
  releasableAt: string | null;
  method: string | null;
  reference: string | null;
  settledAt: string | null;
  receiptUrl: string | null;
  note: string | null;
}

const FIELDS = `id, kind, session_id, plan_id, period_start, amount_cents, currency,
                status, releasable_at, method, reference, settled_at, receipt_url, note,
                session:sessions (
                  date, start_time, duration_minutes, subject,
                  student:profiles!sessions_student_id_fkey (full_name, avatar_url)
                ),
                plan:admissions_plans (
                  student:profiles!admissions_plans_student_id_fkey (full_name, avatar_url),
                  tier:admissions_tiers (name)
                )`;

function toRow(r: any): EarningRow {
  const session = r.session ?? null;
  const plan = r.plan ?? null;
  const student = session?.student ?? plan?.student ?? null;

  return {
    id: r.id,
    kind: r.kind,
    sessionId: r.session_id,
    planId: r.plan_id,
    date: session?.date ?? r.period_start ?? "",
    startTime: session ? String(session.start_time).slice(0, 5) : null,
    durationMinutes: session?.duration_minutes ?? null,
    subject: session?.subject ?? plan?.tier?.name ?? "Counselling",
    studentName: student?.full_name ?? null,
    studentAvatarUrl: student?.avatar_url ?? null,
    amountCents: r.amount_cents,
    currency: r.currency ?? "usd",
    status: r.status,
    releasableAt: r.releasable_at,
    method: r.method,
    reference: r.reference,
    settledAt: r.settled_at,
    receiptUrl: r.receipt_url,
    note: r.note,
  };
}

/**
 * Everything one person has earned, newest first.
 *
 * Voided rows are excluded: a correction is not a second earning, and showing
 * both is how a total stops matching the payments behind it.
 */
export async function getEarnings(payeeId: string): Promise<EarningRow[]> {
  const { data, error } = await supabase
    .from("earnings")
    .select(FIELDS)
    .eq("payee_id", payeeId)
    .is("voided_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getEarnings failed:", error);
    return [];
  }
  return (data ?? []).map(toRow);
}

/** Just the payments, for the receipt list. */
export async function getSettledPayouts(payeeId: string): Promise<EarningRow[]> {
  const rows = await getEarnings(payeeId);
  return rows.filter((r) => r.status === "settled");
}

/**
 * What somebody has been paid this calendar year.
 *
 * A US platform files a 1099-NEC once a contractor passes the annual threshold,
 * so this is a number somebody needs in January.
 */
export async function getEarningsYearTotal(
  payeeId: string,
  year = new Date().getFullYear()
): Promise<{ totalCents: number; count: number }> {
  const { data, error } = await supabase
    .from("earnings_year_totals")
    .select("total_cents, payout_count")
    .eq("payee_id", payeeId)
    .eq("tax_year", year)
    .maybeSingle();

  if (error || !data) return { totalCents: 0, count: 0 };
  return { totalCents: Number(data.total_cents), count: data.payout_count };
}

// ------------------------------------------------------------
// Stripe Connect
//
// A payee connects their own bank on Stripe's hosted pages, so the platform
// never holds a bank number or a tax ID. Until they finish, their earnings sit
// pending rather than failing: the money is still owed, it simply has nowhere
// to go, and it moves on its own the day they connect.
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
 * The account.updated webhook does this too. This is the pull for when that has
 * not arrived: locally it needs the Stripe CLI running, and a tutor who has
 * just finished will not sit waiting for a retry.
 */
export async function refreshConnectStatus(
  profileId?: string
): Promise<{ payoutsEnabled?: boolean; needs?: string[]; error?: string }> {
  return authedPost("/api/connect?action=status", profileId ? { profileId } : {});
}

// ------------------------------------------------------------
// Admin
// ------------------------------------------------------------

/** One person's unpaid earnings, as the admin queue shows them. */
export interface OwedRow extends EarningRow {
  payeeId: string;
  payeeName: string | null;
  payoutsEnabled: boolean;
}

/**
 * Everything still owed, across everybody.
 *
 * The ordinary path pays these on its own once the hold expires. This is the
 * queue for the exceptions: somebody with no bank connected, and somebody an
 * admin has decided to pay early.
 */
export async function getOwedEarnings(): Promise<OwedRow[]> {
  const { data, error } = await supabase
    .from("earnings")
    .select(
      `${FIELDS}, payee_id,
       payee:profiles!earnings_payee_id_fkey (full_name, stripe_payouts_enabled)`
    )
    .eq("status", "pending")
    .is("voided_at", null)
    .order("releasable_at", { ascending: true });

  if (error) {
    console.error("getOwedEarnings failed:", error);
    return [];
  }

  return (data ?? []).map((r: any) => ({
    ...toRow(r),
    payeeId: r.payee_id,
    payeeName: r.payee?.full_name ?? null,
    payoutsEnabled: !!r.payee?.stripe_payouts_enabled,
  }));
}

/**
 * Settle what somebody is owed, now.
 *
 * With no method, this transfers through Stripe, which is the same thing the
 * scheduled job would have done later. With one of the manual methods it
 * records a payment made elsewhere, and the reference is required: an admin who
 * cannot produce one has not paid anybody.
 */
export async function settleEarnings(
  earningIds: string[],
  options: { method?: PayoutMethod; reference?: string; note?: string; paidOn?: string } = {}
): Promise<{ transferId?: string; settled?: number; error?: string }> {
  return authedPost("/api/connect?action=transfer", {
    earningIds,
    method: options.method ?? null,
    reference: options.reference ?? "",
    note: options.note ?? "",
    paidOn: options.paidOn ?? null,
  });
}
