import { supabase } from "@/lib/supabase";
import { bookAndPay } from "./billingService";

// ============================================================
// Admissions counselling, sold as a tier.
//
// A tier is a row, not a constant: its name, price, bullet list and quotas are
// all editable, because the offering is not settled. Nothing in here assumes
// there are three of them or what they are called.
//
// Quotas are counted and shown. They are not enforced anywhere, on purpose: a
// ceiling that blocks has to answer who may spend it and what happens when
// somebody mis-clicks, and it turns the counter into something worth gaming.
// A number both sides can see does the same job, and the conversation about
// asking for one more round happens between people.
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
  };
}

const TIER_FIELDS =
  "id, key, name, blurb, price_cents, ps_rounds_limit, supp_essays_limit, mock_interviews_limit, sessions_per_month, instalment_months, features, fits, is_recommended, sort_order";

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
      .in("status", ["scheduled", "completed"])
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
