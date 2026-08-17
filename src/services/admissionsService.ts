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
  /** Percent of the price paid to the counsellor. Null means nobody has
   *  decided, which is not the same as zero. */
  counselorSharePercent: number | null;
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
  /** Who is actually advising them. Null until one is assigned. */
  counselorName: string | null;
  counselorAvatarUrl: string | null;
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
    counselorSharePercent:
      row.counselor_share_percent == null ? null : Number(row.counselor_share_percent),
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
  "id, key, name, blurb, price_cents, ps_rounds_limit, supp_essays_limit, mock_interviews_limit, sessions_per_month, instalment_months, counselor_share_percent, features, fits, is_recommended, sort_order";

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

/**
 * A distinct shade per tier, so the plans read as three different things at a
 * glance without inventing a colour. It cycles Yakal's three brand colours in
 * list order - green, teal, gold - which lands Essential green, Premier teal
 * (also the recommended one) and Elite gold. Position, not key, so a rename or
 * a fourth tier still gets a stable colour.
 *
 * Used only for identity accents (a card's border, a marker by the name), never
 * for the action buttons, which stay teal so their contrast never drops.
 */
export const TIER_SHADES = ["#97CE9D", "#1099A1", "#CAA25F"] as const;

export function tierShade(index: number): string {
  const n = TIER_SHADES.length;
  return TIER_SHADES[((index % n) + n) % n];
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
  counselorSharePercent: number | null;
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
    counselor_share_percent: input.counselorSharePercent,
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

/**
 * A stable handle derived from the name.
 *
 * `key` is NOT NULL on the table, so a row needs one, but nothing in the app
 * reads it: plans and invoices point at `id`. Asking an admin to invent a slug
 * for a field with no consumer is friction with no payoff, so it is generated
 * and the suffix only appears if the obvious one is taken.
 */
function slugify(name: string): string {
  const base = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return base || "tier";
}

export async function createTier(input: TierInput): Promise<TierResult> {
  const { data: taken } = await supabase.from("admissions_tiers").select("key");
  const used = new Set((taken ?? []).map((r: { key: string }) => r.key));

  let key = slugify(input.name);
  for (let n = 2; used.has(key); n++) key = `${slugify(input.name)}-${n}`;

  const { error } = await supabase.from("admissions_tiers").insert({ key, ...toRow(input) });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

/**
 * Write a new order from the tiers in the order they should appear.
 *
 * Renumbered in tens from scratch rather than swapping the pair that moved.
 * Swapping leaves gaps, and after enough moves two tiers share a number, at
 * which point the list orders itself by something else and the arrows appear
 * to do nothing.
 */
export async function reorderTiers(orderedIds: string[]): Promise<TierResult> {
  const results = await Promise.all(
    orderedIds.map((id, i) =>
      supabase.from("admissions_tiers").update({ sort_order: (i + 1) * 10 }).eq("id", id)
    )
  );
  const failed = results.find((r) => r.error);
  return failed?.error ? { success: false, error: failed.error.message } : { success: true };
}

export interface TierSubscriber {
  planId: string;
  studentId: string;
  studentName: string;
  studentAvatar: string | null;
  parentName: string | null;
  parentAvatar: string | null;
  /** Who is actually doing the work. Null when nobody has been assigned. */
  counselorId: string | null;
  counselorName: string | null;
  counselorAvatar: string | null;
  status: string;
  startedAt: string | null;
  /** Instalments settled and owed, so a past_due plan explains itself. */
  paymentsMade: number;
  paymentsDue: number;
}

/**
 * Who is on each tier, for the counts on the cards.
 *
 * One query for every tier rather than one per card: the list draws three or
 * four of these and a request each would be a waterfall for a number.
 * Admin RLS on admissions_plans is what allows reading somebody else's plan.
 */
export async function getTierSubscribers(): Promise<Map<string, TierSubscriber[]>> {
  const { data, error } = await supabase
    .from("admissions_plans")
    .select(
      `id, tier_id, status, started_at, payments_made, payments_due,
       student:profiles!admissions_plans_student_id_fkey(id, full_name, avatar_url),
       parent:profiles!admissions_plans_purchased_by_fkey(id, full_name, avatar_url),
       counselor:profiles!admissions_plans_counselor_id_fkey(id, full_name, avatar_url)`
    )
    .neq("status", "cancelled");

  if (error) {
    // A card without a count is a card; a card that fails to draw is not.
    console.error("getTierSubscribers failed:", error.message);
    return new Map();
  }

  const byTier = new Map<string, TierSubscriber[]>();
  for (const row of (data ?? []) as any[]) {
    if (!row.tier_id) continue;
    const list = byTier.get(row.tier_id) ?? [];
    list.push({
      planId: row.id,
      studentId: row.student?.id ?? "",
      studentName: row.student?.full_name ?? "Unknown",
      studentAvatar: row.student?.avatar_url ?? null,
      parentName: row.parent?.full_name ?? null,
      parentAvatar: row.parent?.avatar_url ?? null,
      counselorId: row.counselor?.id ?? null,
      counselorName: row.counselor?.full_name ?? null,
      counselorAvatar: row.counselor?.avatar_url ?? null,
      status: row.status,
      startedAt: row.started_at,
      paymentsMade: row.payments_made ?? 0,
      paymentsDue: row.payments_due ?? 1,
    });
    byTier.set(row.tier_id, list);
  }
  return byTier;
}

export interface PlanInstalment {
  id: string;
  instalmentNumber: number;
  /** When the payment arrived. */
  paidAt: string;
  /** What the parent paid for this month. Null on rows written before the
   *  column existed, which is different from zero. */
  paidCents: number | null;
  /** The counsellor's share of it, and where that payout stands. */
  counselorCents: number;
  sharePercent: number | null;
  payoutStatus: string;
  note: string | null;
}

/**
 * Every payment made on one plan, newest first.
 *
 * One row per month, not per tier. A plan is a single subscription to a single
 * tier: if a family switched, that is a different plan with its own payments,
 * and mixing the two into one list made a switch look like something that
 * happened inside a subscription rather than the end of one.
 *
 * counselor_payouts is the only per-month record of an engagement there is.
 * Plans carry payments_made as a counter and the amounts live in Stripe, so
 * both halves of each payment, what came in and what the counsellor is owed,
 * are read from here.
 *
 * Fetched on expand rather than joined into the list: a tier with forty
 * families would otherwise pull every payment any of them has ever made to
 * draw one screen.
 */
export async function getPlanInstalments(planId: string): Promise<PlanInstalment[]> {
  const { data, error } = await supabase
    .from("counselor_payouts")
    .select("id, instalment_number, created_at, paid_cents, amount_cents, share_percent, status, note")
    .eq("plan_id", planId)
    .order("instalment_number", { ascending: false });

  if (error) {
    console.error("getPlanInstalments failed:", error.message);
    return [];
  }

  return ((data ?? []) as any[]).map((row) => ({
    id: row.id,
    instalmentNumber: row.instalment_number ?? 1,
    paidAt: row.created_at,
    paidCents: row.paid_cents == null ? null : Number(row.paid_cents),
    counselorCents: Number(row.amount_cents ?? 0),
    sharePercent: row.share_percent == null ? null : Number(row.share_percent),
    payoutStatus: row.status ?? "pending",
    note: row.note ?? null,
  }));
}

/**
 * Total collected per plan, for the column on the table.
 *
 * Summed from the payments themselves rather than price times payments_made,
 * so a repriced tier does not restate what a family has already paid.
 */
export async function getPlanTotals(): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from("counselor_payouts")
    .select("plan_id, paid_cents");

  if (error) {
    console.error("getPlanTotals failed:", error.message);
    return new Map();
  }

  const totals = new Map<string, number>();
  for (const row of (data ?? []) as any[]) {
    if (!row.plan_id) continue;
    totals.set(row.plan_id, (totals.get(row.plan_id) ?? 0) + Number(row.paid_cents ?? 0));
  }
  return totals;
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
             counselor:profiles!admissions_plans_counselor_id_fkey (full_name, avatar_url),
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
    counselorName: (data as any).counselor?.full_name ?? null,
    counselorAvatarUrl: (data as any).counselor?.avatar_url ?? null,
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
      counselorName: row.counselor?.full_name ?? null,
      counselorAvatarUrl: row.counselor?.avatar_url ?? null,
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

export interface CounselorCard {
  id: string;
  name: string;
  avatarUrl: string | null;
  bio: string | null;
  subjects: string[] | null;
  resumeUrl: string | null;
  averageStars: number | null;
  ratingCount: number;
  /** Families currently on their books, so a parent can see who has room. */
  activePlans: number;
}

/**
 * The counsellors a family can choose between.
 *
 * Active ones only: a pending application is somebody an admin has not
 * approved, and a suspended account is somebody who should not be taking on a
 * new family.
 *
 * Ratings come from the same view a tutor's profile reads. Advising sessions
 * store the counsellor in sessions.tutor_id, so v_tutor_ratings already covers
 * them and there is nothing separate to build.
 */
export async function getCounselors(): Promise<CounselorCard[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, bio, subjects, resume_url")
    .eq("role", "counselor")
    .eq("status", "active")
    .order("full_name");

  if (error) {
    console.error("getCounselors failed:", error.message);
    return [];
  }

  const rows = data ?? [];
  const ids = rows.map((r: any) => r.id);
  if (ids.length === 0) return [];

  // Ratings and current load, both in one round trip each rather than per card.
  const [{ data: ratings }, { data: plans }] = await Promise.all([
    supabase.from("v_tutor_ratings").select("tutor_id, average_stars, rating_count").in("tutor_id", ids),
    supabase.from("admissions_plans").select("counselor_id").eq("status", "active").in("counselor_id", ids),
  ]);

  const ratingBy = new Map((ratings ?? []).map((r: any) => [r.tutor_id, r]));
  const loadBy = new Map<string, number>();
  for (const row of (plans ?? []) as any[]) {
    loadBy.set(row.counselor_id, (loadBy.get(row.counselor_id) ?? 0) + 1);
  }

  return rows.map((r: any) => {
    const rating = ratingBy.get(r.id);
    return {
      id: r.id,
      name: r.full_name ?? "Counsellor",
      avatarUrl: r.avatar_url ?? null,
      bio: r.bio ?? null,
      subjects: r.subjects ?? null,
      resumeUrl: r.resume_url ?? null,
      // Null rather than zero when nobody has rated them. Zero would draw an
      // empty five stars, which reads as a bad review rather than no reviews.
      averageStars: rating?.average_stars == null ? null : Number(rating.average_stars),
      ratingCount: rating?.rating_count ?? 0,
      activePlans: loadBy.get(r.id) ?? 0,
    };
  });
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
  /** Who the parent picked. Omitted, the server assigns the least loaded. */
  counselorId?: string | null;
  /** First advising sessions, chosen from the counsellor's calendar. Created
   *  on fulfilment, because a session cannot exist before the plan does. */
  booking?: { date: string; startTime: string; durationMinutes?: number }[];
}): Promise<{ error?: string }> {
  // No amount and no description. Sending a placeholder for the server to
  // overwrite means a stale or half-deployed server rejects it with "Invalid
  // amount", which says nothing about what is actually wrong.
  return bookAndPay({
    kind: "admissions",
    studentId: input.studentId,
    admissionsTierId: input.tierId,
    counselorId: input.counselorId ?? null,
    booking: input.booking && input.booking.length > 0 ? input.booking : undefined,
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
