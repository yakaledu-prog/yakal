import { supabase } from "@/lib/supabase";

/**
 * The per-cycle layer of the college catalog: what a college asks for this
 * year, and the essay questions it asks.
 *
 * collegeCatalogService holds the part that barely changes, ships as a static
 * file, and is the same for everyone. This holds the part that changes every
 * August, lives in Postgres so an admin can correct it without a deploy, and is
 * the reason data/colleges/README.md called the curated layer the moat.
 *
 * Two sources, and they are not equally strong, so the UI should not present
 * them as if they were:
 *
 *   Deadlines, fees and recommendation counts come from the Common App
 *   Requirements Grid, which is each college's own answer on Common App's own
 *   form. Treat these as correct.
 *
 *   Prompts are transcribed from the college's own admissions page. Every row
 *   carries source_url and verified_on so anyone can check one in a click, and
 *   the UI shows both. A prompt that has drifted is a same-day fix in the admin
 *   screen rather than a deploy.
 */

/** The admissions cycle we hold data for. An application filed in November 2026
 *  and one filed in January 2027 belong to the same cycle. */
export const CURRENT_CYCLE = "2026-27";

export type DeadlineRound = "ed" | "ed2" | "ea" | "ea2" | "rea" | "rd";

export interface CollegeRequirements {
  unitid: number;
  cycle: string;
  deadline_ed: string | null;
  deadline_ed2: string | null;
  deadline_ea: string | null;
  deadline_ea2: string | null;
  deadline_rea: string | null;
  deadline_rd: string | null;
  is_rolling: boolean;
  application_fee_cents: number | null;
  application_fee_intl_cents: number | null;
  fee_waiver: string | null;
  personal_essay_required: boolean | null;
  courses_grades_required: boolean | null;
  writing_supplement_required: boolean | null;
  portfolio: string | null;
  /** A, F, I, N or S in the grid's key: Always, Flexible, Ignored, Never, Sometimes. */
  test_policy: string | null;
  tests_used: string | null;
  english_proficiency: string | null;
  recs_teacher: number | null;
  recs_other: number | null;
  recs_midyear_required: boolean | null;
  recs_counselor_required: boolean | null;
  admissions_url: string | null;
  essay_page_url: string | null;
  source: string;
  source_url: string | null;
  verified_on: string | null;
}

export interface EssayPrompt {
  id: string;
  cycle: string;
  /** common_app, uc, coalition, activities, or a college's own application. */
  app_key: string | null;
  /** Null for a shared application's own question. */
  unitid: number | null;
  slug: string;
  title: string;
  prompt: string;
  word_limit: number | null;
  char_limit: number | null;
  requirement: "required" | "optional" | "choice";
  choice_group: string | null;
  choose_count: number | null;
  group_label: string | null;
  source_url: string | null;
  verified_on: string | null;
  sort_order: number;
  /** Hidden prompts stay in the table so an essay written against one can
   *  still say where its question came from. Only the admin list shows them. */
  is_active?: boolean;
}

export const ROUND_LABEL: Record<DeadlineRound, string> = {
  ed: "Early Decision",
  ed2: "Early Decision II",
  ea: "Early Action",
  ea2: "Early Action II",
  rea: "Restrictive Early Action",
  rd: "Regular Decision",
};

/** Rounds in the order a student meets them, which is also date order. */
const ROUND_ORDER: DeadlineRound[] = ["ea", "ed", "rea", "ea2", "ed2", "rd"];

export function deadlinesOf(
  r: CollegeRequirements
): { round: DeadlineRound; date: string }[] {
  return ROUND_ORDER
    .map((round) => ({ round, date: r[`deadline_${round}` as const] }))
    .filter((d): d is { round: DeadlineRound; date: string } => !!d.date)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** The one a student is most likely to be working to: the earliest that has
 *  not passed, or regular decision if they all have. */
export function nextDeadline(
  r: CollegeRequirements
): { round: DeadlineRound; date: string } | null {
  const all = deadlinesOf(r);
  if (!all.length) return null;
  const today = new Date().toISOString().slice(0, 10);
  return all.find((d) => d.date >= today) ?? all[all.length - 1];
}

/**
 * How many letters a college wants, as a sentence.
 *
 * Written out rather than shown as three counts because a student asking "how
 * many recommenders do I need" wants one answer, and the answer is almost
 * always "two teachers and your counselor".
 */
export function recommendationSummary(r: CollegeRequirements): string | null {
  const parts: string[] = [];
  if (r.recs_teacher) {
    parts.push(`${r.recs_teacher} teacher ${r.recs_teacher === 1 ? "letter" : "letters"}`);
  }
  if (r.recs_counselor_required) parts.push("a counselor recommendation");
  if (r.recs_other) {
    parts.push(`${r.recs_other} other ${r.recs_other === 1 ? "evaluation" : "evaluations"}`);
  }
  if (!parts.length) return null;
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

// --- reads -----------------------------------------------------------------

const REQUIREMENT_COLUMNS = "*";

export async function getRequirements(
  unitid: number,
  cycle = CURRENT_CYCLE
): Promise<CollegeRequirements | null> {
  const { data } = await supabase
    .from("college_requirements")
    .select(REQUIREMENT_COLUMNS)
    .eq("unitid", unitid)
    .eq("cycle", cycle)
    .maybeSingle();
  return (data as CollegeRequirements) ?? null;
}

/** For a whole college list in one request, keyed by unitid. */
export async function getRequirementsFor(
  unitids: number[],
  cycle = CURRENT_CYCLE
): Promise<Map<number, CollegeRequirements>> {
  const wanted = [...new Set(unitids.filter(Boolean))];
  if (!wanted.length) return new Map();
  const { data } = await supabase
    .from("college_requirements")
    .select(REQUIREMENT_COLUMNS)
    .eq("cycle", cycle)
    .in("unitid", wanted);
  return new Map(((data as CollegeRequirements[]) ?? []).map((r) => [r.unitid, r]));
}

/** Questions asked by a shared application rather than by one college. */
export async function getUniversalPrompts(cycle = CURRENT_CYCLE): Promise<EssayPrompt[]> {
  const { data } = await supabase
    .from("essay_prompts")
    .select("*")
    .eq("cycle", cycle)
    .is("unitid", null)
    .order("app_key")
    .order("sort_order");
  return (data as EssayPrompt[]) ?? [];
}

export async function getSchoolPrompts(
  unitid: number,
  cycle = CURRENT_CYCLE
): Promise<EssayPrompt[]> {
  const { data } = await supabase
    .from("essay_prompts")
    .select("*")
    .eq("cycle", cycle)
    .eq("unitid", unitid)
    .order("sort_order");
  return (data as EssayPrompt[]) ?? [];
}

/**
 * How many prompts we hold per college, for the picker's list.
 *
 * One request for every school at once rather than one per row. The picker
 * lists 1,944 colleges and a count beside each is the difference between
 * "search and hope" and knowing before you click whether there is anything
 * there.
 */
export async function getPromptCounts(cycle = CURRENT_CYCLE): Promise<Map<number, number>> {
  const { data } = await supabase
    .from("essay_prompts")
    .select("unitid")
    .eq("cycle", cycle)
    .eq("is_active", true)
    .not("unitid", "is", null);

  const counts = new Map<number, number>();
  for (const row of (data as { unitid: number }[]) ?? []) {
    counts.set(row.unitid, (counts.get(row.unitid) ?? 0) + 1);
  }
  return counts;
}

/** Every cycle we hold prompts for, newest first, for the cycle switcher. */
export async function getCycles(): Promise<string[]> {
  const { data } = await supabase.from("essay_prompts").select("cycle");
  const seen = new Set<string>();
  for (const row of (data as { cycle: string }[]) ?? []) seen.add(row.cycle);
  if (!seen.size) seen.add(CURRENT_CYCLE);
  return [...seen].sort().reverse();
}

// --- writes ----------------------------------------------------------------
//
// Admin only, enforced by RLS rather than by these functions. A counselor who
// finds a prompt that has drifted tells an admin, and the fix is an edit here
// rather than a data file and a deploy, because a wrong prompt in October
// cannot wait for a release.

export type PromptInput = Omit<
  EssayPrompt,
  "id" | "sort_order"
> & { sort_order?: number };

type Result<T> = { success: boolean; data?: T; error?: string };

async function write<T>(promise: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<Result<T>> {
  const { data, error } = await promise;
  if (error) {
    console.error("collegeCycleService write failed:", error);
    return { success: false, error: error.message };
  }
  return { success: true, data: data as T };
}

export const createPrompt = (input: PromptInput) =>
  write<EssayPrompt>(
    supabase.from("essay_prompts").insert([input]).select().single()
  );

export const updatePrompt = (id: string, patch: Partial<PromptInput>) =>
  write<EssayPrompt>(
    supabase.from("essay_prompts").update(patch).eq("id", id).select().single()
  );

/** Hidden rather than deleted. An essay written against a prompt keeps its own
 *  copy of the text, but the row is still what says where that text came from. */
export const setPromptActive = (id: string, isActive: boolean) =>
  write(supabase.from("essay_prompts").update({ is_active: isActive }).eq("id", id));

/** Everything for one cycle, active or not, for the admin list. */
export async function getAllPrompts(cycle = CURRENT_CYCLE): Promise<EssayPrompt[]> {
  const { data } = await supabase
    .from("essay_prompts")
    .select("*")
    .eq("cycle", cycle)
    .order("unitid", { nullsFirst: true })
    .order("app_key")
    .order("sort_order");
  return (data as EssayPrompt[]) ?? [];
}

/** How many students are writing against a prompt. Shown before hiding one. */
export async function getPromptUsage(cycle = CURRENT_CYCLE): Promise<Map<string, number>> {
  const { data } = await supabase
    .from("essays")
    .select("essay_prompt_id")
    .not("essay_prompt_id", "is", null);
  const counts = new Map<string, number>();
  for (const row of (data as { essay_prompt_id: string }[]) ?? []) {
    counts.set(row.essay_prompt_id, (counts.get(row.essay_prompt_id) ?? 0) + 1);
  }
  void cycle;
  return counts;
}
