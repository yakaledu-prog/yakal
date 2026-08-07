import { supabase } from "@/lib/supabase";
import { bookAndPay } from "./billingService";

// ============================================================
// Admissions counselling, sold as a tier.
//
// A tier is a row, not a constant: its name, price, bullet list and quotas are
// all editable, because the offering is not settled. Nothing in here assumes
// there are three of them or what they are called.
//
// Most quotas are counted and shown, not enforced, on purpose: a ceiling that
// blocks has to answer who may spend it and what happens when somebody
// mis-clicks, and it turns the counter into something worth gaming. A number
// both sides can see does the same job, and the conversation about asking for
// one more round happens between people.
//
// Advising sessions are the exception, because spending one takes an hour out
// of a counsellor's calendar that nobody else can have. That ceiling is
// enforced in book_advising_session, in the database, where a browser cannot
// talk its way past it.
// ============================================================

export interface AdmissionsTier {
  id: string;
  key: string;
  name: string;
  blurb: string | null;
  priceCents: number;
  /** Null means no ceiling. Never a large number standing in for one. */
  psRoundsLimit: number | null;
  suppEssaysLimit: number | null;
  /** Null is unlimited. Zero means the tier includes no interview prep. */
  mockInterviewsLimit: number | null;
  sessionsPerMonth: number | null;
  /** Monthly instalments the total is collected over. 1 is a single payment. */
  instalmentMonths: number;
  features: string[];
  fits: string | null;
  isRecommended: boolean;
  sortOrder: number;
  /** Only meaningful to an admin; getTiers only ever returns active tiers. */
  isActive: boolean;
}

export interface AdmissionsPlan {
  id: string;
  studentId: string;
  studentName: string | null;
  tier: AdmissionsTier;
  startedAt: string;
  status: string;
}

function toTier(row: any): AdmissionsTier {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    blurb: row.blurb,
    priceCents: row.price_cents,
    psRoundsLimit: row.ps_rounds_limit,
    suppEssaysLimit: row.supp_essays_limit,
    mockInterviewsLimit: row.mock_interviews_limit,
    sessionsPerMonth: row.sessions_per_month,
    instalmentMonths: row.instalment_months ?? 1,
    features: Array.isArray(row.features) ? row.features : [],
    fits: row.fits,
    isRecommended: row.is_recommended,
    sortOrder: row.sort_order,
    // is_active is not always selected (the public read omits it); default the
    // shape to active so a partial row never reads as hidden.
    isActive: row.is_active ?? true,
  };
}

const TIER_FIELDS =
  "id, key, name, blurb, price_cents, ps_rounds_limit, supp_essays_limit, mock_interviews_limit, sessions_per_month, instalment_months, features, fits, is_recommended, sort_order";

// The admin editor needs is_active as well, because hiding a tier is one of the
// things it is for. Kept separate so the public getTiers query stays lean.
const ADMIN_TIER_FIELDS = `${TIER_FIELDS}, is_active`;

/**
 * One instalment. Derived, never stored: a total and a number of months are
 * the two facts, and a third number that has to agree with them is a bug
 * waiting to happen. Matches monthlyCents in api/stripe-checkout.
 */
export function monthlyCents(tier: AdmissionsTier): number {
  return Math.floor(tier.priceCents / Math.max(1, tier.instalmentMonths));
}

/** What is on offer, in the order it should be shown. */
export async function getTiers(): Promise<AdmissionsTier[]> {
  const { data, error } = await supabase
    .from("admissions_tiers")
    .select(TIER_FIELDS)
    .eq("is_active", true)
    .order("sort_order");

  if (error) {
    console.error("getTiers failed:", error);
    return [];
  }
  return (data ?? []).map(toTier);
}

// ============================================================
// Admin editing.
//
// A tier is a row and the RLS already lets an admin write it (see
// admissions_tiers_admin). These are the browser side of that: the same rows
// the marketing page and the parent checkout read, edited in one place so a
// price is never right on the card and wrong at the till.
// ============================================================

/** Every tier including hidden ones, for the admin list. Admin RLS only. */
export async function getAllTiers(): Promise<AdmissionsTier[]> {
  const { data, error } = await supabase
    .from("admissions_tiers")
    .select(ADMIN_TIER_FIELDS)
    .order("sort_order");

  if (error) {
    console.error("getAllTiers failed:", error);
    return [];
  }
  return (data ?? []).map(toTier);
}

/**
 * The editable half of a tier. `key` is set once at creation and never sent in
 * an update: renaming the display name is fine, but the stable handle that
 * plans and invoices point at must not move.
 */
export interface TierInput {
  name: string;
  blurb: string | null;
  priceCents: number;
  instalmentMonths: number;
  psRoundsLimit: number | null;
  suppEssaysLimit: number | null;
  mockInterviewsLimit: number | null;
  sessionsPerMonth: number | null;
  features: string[];
  fits: string | null;
  isRecommended: boolean;
  isActive: boolean;
  sortOrder: number;
}

type TierResult = { success: boolean; error?: string };

/** camelCase editor state to the snake_case columns the table actually has. */
function toRow(input: TierInput) {
  return {
    name: input.name,
    blurb: input.blurb,
    price_cents: input.priceCents,
    instalment_months: input.instalmentMonths,
    ps_rounds_limit: input.psRoundsLimit,
    supp_essays_limit: input.suppEssaysLimit,
    mock_interviews_limit: input.mockInterviewsLimit,
    sessions_per_month: input.sessionsPerMonth,
    features: input.features,
    fits: input.fits,
    is_recommended: input.isRecommended,
    is_active: input.isActive,
    sort_order: input.sortOrder,
  };
}

export async function updateTier(id: string, input: TierInput): Promise<TierResult> {
  const { error } = await supabase
    .from("admissions_tiers")
    .update({ ...toRow(input), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function createTier(input: TierInput & { key: string }): Promise<TierResult> {
  const { error } = await supabase
    .from("admissions_tiers")
    .insert({ key: input.key, ...toRow(input) });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

/**
 * Flip a single flag without opening the editor, for the toggles on the list.
 * Narrow on purpose: only the two booleans a list row shows can be set here.
 */
export async function setTierFlag(
  id: string,
  patch: { isActive?: boolean; isRecommended?: boolean }
): Promise<TierResult> {
  const row: Record<string, boolean> = {};
  if (patch.isActive !== undefined) row.is_active = patch.isActive;
  if (patch.isRecommended !== undefined) row.is_recommended = patch.isRecommended;
  const { error } = await supabase.from("admissions_tiers").update(row).eq("id", id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

/** The tier a student is on, or null if admissions has not been bought. */
export async function getAdmissionsPlan(studentId: string): Promise<AdmissionsPlan | null> {
  const { data, error } = await supabase
    .from("admissions_plans")
    .select(`id, student_id, started_at, status,
             student:profiles!admissions_plans_student_id_fkey (full_name),
             tier:admissions_tiers (${TIER_FIELDS})`)
    .eq("student_id", studentId)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    console.error("getAdmissionsPlan failed:", error);
    return null;
  }
  if (!data?.tier) return null;

  return {
    id: data.id,
    studentId: data.student_id,
    studentName: (data as any).student?.full_name ?? null,
    tier: toTier((data as any).tier),
    startedAt: data.started_at,
    status: data.status,
  };
}

/** Plans for several students at once, for a counselor's or parent's list. */
export async function getAdmissionsPlans(
  studentIds: string[]
): Promise<Map<string, AdmissionsPlan>> {
  const out = new Map<string, AdmissionsPlan>();
  if (studentIds.length === 0) return out;

  const { data, error } = await supabase
    .from("admissions_plans")
    .select(`id, student_id, started_at, status,
             student:profiles!admissions_plans_student_id_fkey (full_name),
             tier:admissions_tiers (${TIER_FIELDS})`)
    .in("student_id", studentIds)
    .eq("status", "active");

  if (error) {
    console.error("getAdmissionsPlans failed:", error);
    return out;
  }

  for (const row of (data ?? []) as any[]) {
    if (!row.tier) continue;
    out.set(row.student_id, {
      id: row.id,
      studentId: row.student_id,
      studentName: row.student?.full_name ?? null,
      tier: toTier(row.tier),
      startedAt: row.started_at,
      status: row.status,
    });
  }
  return out;
}

export interface QuotaLine {
  label: string;
  used: number;
  /** Null is unlimited. */
  limit: number | null;
}

export interface AdmissionsUsage {
  plan: AdmissionsPlan | null;
  lines: QuotaLine[];
}

/**
 * How much of the tier has been used.
 *
 * The three lines are deliberately not equally trustworthy, and they are
 * ordered accordingly.
 *
 * Supplemental essays are counted as distinct essays reviewed at least once,
 * not as review events, because the tier says "review of up to 12 supplemental
 * essays". That also makes it the strongest meter: the ceiling is how many
 * essays the student actually created against colleges on their own list, so a
 * counselor cannot inflate it without essays that do not exist.
 *
 * Mock interviews are completed appointments. There is a second person in the
 * room, which is a better check than anything the schema can do.
 *
 * Personal statement rounds are the weak one: a round is a click, so it counts
 * what a counselor did rather than what happened. It is still worth showing,
 * because a family and a counselor looking at the same number is most of what
 * the meter is for.
 */
/** First moment of the current calendar month, as an ISO date. */
function monthStart(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

export async function getAdmissionsUsage(studentId: string): Promise<AdmissionsUsage> {
  const [plan, essaysRes, interviewsRes, advisingRes] = await Promise.all([
    getAdmissionsPlan(studentId),
    supabase.from("essays").select("id, kind, rounds_used").eq("student_id", studentId),
    supabase
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("student_id", studentId)
      .eq("kind", "mock_interview")
      .eq("status", "completed"),
    // Advising is the one quota that refills. Booked counts against it as much
    // as attended: a slot held is a slot nobody else can have, and letting a
    // cancellation the morning of return it would make the allowance meaningless.
    supabase
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("student_id", studentId)
      .eq("kind", "advising")
      // upcoming, not scheduled. The check constraint allows upcoming,
      // completed, cancelled and no-show, so the wrong word here counted
      // nothing and the meter sat at zero however many hours were booked.
      .in("status", ["upcoming", "completed"])
      .gte("date", monthStart()),
  ]);

  if (essaysRes.error) {
    console.error("getAdmissionsUsage failed:", essaysRes.error);
    return { plan, lines: [] };
  }

  const rows = essaysRes.data ?? [];
  const psRounds = rows
    .filter((e) => e.kind === "personal_statement")
    .reduce((n, e) => n + (e.rounds_used ?? 0), 0);
  const suppReviewed = rows.filter(
    (e) => e.kind === "supplement" && (e.rounds_used ?? 0) > 0
  ).length;

  const lines: QuotaLine[] = [
    {
      label: "Advising sessions this month",
      used: advisingRes.count ?? 0,
      limit: plan?.tier.sessionsPerMonth ?? null,
    },
    {
      label: "Supplemental essays reviewed",
      used: suppReviewed,
      limit: plan?.tier.suppEssaysLimit ?? null,
    },
    {
      label: "Personal statement rounds",
      used: psRounds,
      limit: plan?.tier.psRoundsLimit ?? null,
    },
  ];

  // A tier with no interview prep should say nothing about interviews rather
  // than show a permanent 0 of 0.
  const interviewLimit = plan?.tier.mockInterviewsLimit ?? null;
  if (interviewLimit !== 0) {
    lines.push({
      label: "Mock interviews",
      used: interviewsRes.count ?? 0,
      limit: interviewLimit,
    });
  }

  return { plan, lines };
}

/** "3 of 6" or "3" when the tier has no ceiling. */
export function quotaLabel(line: QuotaLine): string {
  return line.limit == null ? `${line.used}` : `${line.used} of ${line.limit}`;
}

/** True once a family has had everything the tier promised. Never blocks. */
export function quotaSpent(line: QuotaLine): boolean {
  return line.limit != null && line.used >= line.limit;
}

/**
 * Buy a tier for a child.
 *
 * The price is not sent. The server reads it from the tier row, because an
 * amount chosen by the browser is an amount a parent can choose.
 */
export async function buyTier(input: {
  tierId: string;
  studentId: string;
}): Promise<{ error?: string }> {
  // No amount and no description. Sending a placeholder for the server to
  // overwrite means a stale or half-deployed server rejects it with "Invalid
  // amount", which says nothing about what is actually wrong.
  return bookAndPay({
    kind: "admissions",
    studentId: input.studentId,
    admissionsTierId: input.tierId,
  });
}

/**
 * Book advising hours against the student's counsellor.
 *
 * Goes through book_advising_session rather than inserting: a parent has no
 * insert on sessions at all, and the monthly allowance, the counsellor's other
 * bookings and who is allowed to book for whom are all checked there. A cap
 * the browser applies is not a cap.
 *
 * Slots are booked one at a time and the outcome is reported per slot, because
 * the interesting failure is partial: an hour taken while the dialog was open
 * should not lose the other three.
 */
export async function bookAdvisingSlots(
  studentId: string,
  slots: { date: string; startTime: string; durationMinutes?: number }[]
): Promise<{ booked: number; errors: string[] }> {
  let booked = 0;
  const errors: string[] = [];

  for (const slot of slots) {
    const { error } = await supabase.rpc("book_advising_session", {
      p_student: studentId,
      p_date: slot.date,
      p_start: slot.startTime,
      p_duration: slot.durationMinutes ?? 60,
    });
    if (error) {
      errors.push(`${slot.date} ${slot.startTime}: ${error.message}`);
    } else {
      booked += 1;
    }
  }

  return { booked, errors };
}

export interface PlanPerson {
  id: string;
  fullName: string;
  avatarUrl: string | null;
}

/**
 * The two people a plan is between.
 *
 * The counsellor's id draws their calendar; both faces go on the plan card,
 * because "who is actually working with my child" is the question a parent
 * opens this page asking, and a name in grey text was not answering it.
 */
export async function getPlanPeople(
  studentId: string
): Promise<{ student: PlanPerson | null; counselor: PlanPerson | null }> {
  const { data: plan, error } = await supabase
    .from("admissions_plans")
    .select("counselor_id")
    .eq("student_id", studentId)
    .in("status", ["active", "past_due"])
    .maybeSingle();

  if (error) {
    console.error("getPlanPeople:", error.message);
    return { student: null, counselor: null };
  }

  const ids = [studentId, plan?.counselor_id].filter(Boolean) as string[];
  const { data: people } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url")
    .in("id", ids);

  const find = (id: string | null | undefined): PlanPerson | null => {
    if (!id) return null;
    const row = people?.find((p) => p.id === id);
    return row
      ? { id: row.id, fullName: row.full_name, avatarUrl: row.avatar_url }
      : null;
  };

  return { student: find(studentId), counselor: find(plan?.counselor_id) };
}

export interface AdvisingSession {
  id: string;
  date: string;
  startTime: string;
  status: string;
}

/** Advising hours booked for the month containing `on`, soonest first. */
export async function getAdvisingSessions(
  studentId: string,
  on: Date = new Date()
): Promise<AdvisingSession[]> {
  const from = new Date(on.getFullYear(), on.getMonth(), 1);
  const to = new Date(on.getFullYear(), on.getMonth() + 1, 1);
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const { data, error } = await supabase
    .from("sessions")
    .select("id, date, start_time, status")
    .eq("student_id", studentId)
    .eq("kind", "advising")
    .in("status", ["upcoming", "completed"])
    .gte("date", iso(from))
    .lt("date", iso(to))
    .order("date")
    .order("start_time");

  if (error) {
    console.error("getAdvisingSessions:", error.message);
    return [];
  }
  return (data ?? []).map((r) => ({
    id: r.id,
    date: r.date,
    startTime: String(r.start_time).slice(0, 5),
    status: r.status,
  }));
}

/**
 * Give an advising hour back.
 *
 * Frees the counsellor's calendar and the month's count, which is what makes
 * changing a slot possible once the allowance is spent.
 */
export async function cancelAdvisingSession(sessionId: string): Promise<{ error?: string }> {
  const { error } = await supabase.rpc("cancel_advising_session", { p_session: sessionId });
  return error ? { error: error.message } : {};
}
