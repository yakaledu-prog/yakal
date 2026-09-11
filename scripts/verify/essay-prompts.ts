/**
 * The essay prompt catalogue, and the cycle data behind it.
 *
 * Each of these pins something that was wrong at some point while this was
 * built, or that would be silently wrong if the data drifted:
 *
 *   The Common App grid parser recovers columns by x position, so a column
 *   boundary being off by a few points moves every value one column left and
 *   nothing throws. Yale's restrictive early action date is the canary.
 *
 *   The grid lists Siena University three times with three different regular
 *   decision dates. Merging those would put a date on the screen that is right
 *   for some applicants and wrong for others, so duplicates are dropped, and
 *   this asserts they stay dropped.
 *
 *   Every prompt has to carry a source and a date. A prompt with neither
 *   cannot be checked, and an unverifiable prompt is worse than no prompt.
 *
 *   The Common App's seven prompts are a choice of one. A student who writes
 *   all seven has been badly misled by us, so the choice group is asserted.
 *
 * Needs the local database with migrations applied and the admissions data
 * loaded (npm run db:load:admissions).
 */
import { createClient } from "@supabase/supabase-js";

const URL = process.env.VITE_SUPABASE_LOCAL_URL ?? "http://127.0.0.1:54321";
const KEY =
  process.env.SUPABASE_LOCAL_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const db = createClient(URL, KEY, { auth: { persistSession: false } });
const CYCLE = "2026-27";

let failures = 0;
const pass = (what: string, ok: boolean, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${detail ? `  -> ${detail}` : ""}`);
};

// --- the requirements grid -------------------------------------------------

const { data: reqs } = await db
  .from("college_requirements")
  .select("*")
  .eq("cycle", CYCLE);

const rows = reqs ?? [];
pass("the grid loaded for a useful number of colleges", rows.length > 800, `${rows.length}`);

const byUnitid = new Map(rows.map((r) => [r.unitid, r]));

// Read off the published grid on 2026-09-11. If a column boundary in
// parse_reqgrid.py slips, these move together and all four fail at once.
const KNOWN: [number, string, string, string | null][] = [
  [130794, "Yale", "deadline_rea", "2026-11-01"],
  [130794, "Yale", "deadline_rd", "2027-01-02"],
  [166027, "Harvard", "deadline_rea", "2026-11-01"],
  [162928, "Johns Hopkins", "deadline_ed", "2026-11-01"],
  [164465, "Amherst", "deadline_ed", "2026-11-09"],
  [121345, "Pomona", "deadline_ed", "2026-11-08"],
];
for (const [unitid, name, column, expected] of KNOWN) {
  const row = byUnitid.get(unitid);
  pass(
    `${name} ${column.replace("deadline_", "").toUpperCase()} is ${expected}`,
    row?.[column] === expected,
    row ? String(row[column]) : "no row"
  );
}

pass(
  "fees came through in cents, not dollars",
  byUnitid.get(130794)?.application_fee_cents === 8500,
  String(byUnitid.get(130794)?.application_fee_cents)
);

pass(
  "recommendation counts came through",
  byUnitid.get(130794)?.recs_teacher === 2 &&
    byUnitid.get(130794)?.recs_counselor_required === true,
  `teacher=${byUnitid.get(130794)?.recs_teacher}`
);

// A college the grid lists more than once must not be here at all. Siena
// appears three times with three different RD dates.
pass(
  "a college listed several times in the grid was dropped, not guessed at",
  !byUnitid.has(195474),
  byUnitid.has(195474) ? "Siena University has a row" : ""
);

pass(
  "every college has a deadline or is rolling",
  rows.every(
    (r) =>
      r.is_rolling ||
      r.deadline_ed || r.deadline_ed2 || r.deadline_ea ||
      r.deadline_ea2 || r.deadline_rea || r.deadline_rd
  ),
  `${rows.filter((r) => !r.is_rolling && !r.deadline_rd && !r.deadline_ed && !r.deadline_ea && !r.deadline_rea && !r.deadline_ed2 && !r.deadline_ea2).length} with neither`
);

// --- the prompts -----------------------------------------------------------

const { data: prompts } = await db.from("essay_prompts").select("*").eq("cycle", CYCLE);
const all = prompts ?? [];
pass("prompts loaded", all.length > 0, `${all.length}`);

pass(
  "every prompt says where it came from and when it was checked",
  all.every((p) => p.source_url && p.verified_on),
  all
    .filter((p) => !p.source_url || !p.verified_on)
    .map((p) => p.slug)
    .slice(0, 3)
    .join(", ")
);

pass(
  "no prompt is stored paraphrased down to a title",
  all.every((p) => p.prompt.length > 30),
  all.filter((p) => p.prompt.length <= 30).map((p) => p.slug).join(", ")
);

const commonApp = all.filter((p) => p.app_key === "common_app" && !p.unitid);
pass("the Common App has its seven prompts", commonApp.length === 7, `${commonApp.length}`);
pass(
  "and they are a choice of one, not seven essays to write",
  commonApp.every((p) => p.requirement === "choice" && p.choose_count === 1),
  commonApp.map((p) => `${p.requirement}/${p.choose_count}`).join(" ")
);

const uc = all.filter((p) => p.app_key === "uc" && !p.unitid);
pass("the UC has eight personal insight questions", uc.length === 8, `${uc.length}`);
pass("of which four are answered", uc.every((p) => p.choose_count === 4));
pass("each capped at 350 words", uc.every((p) => p.word_limit === 350));

// A supplement belongs to a college that exists in the catalog, or the picker
// will list prompts under a school nobody can find.
const orphans = all.filter((p) => p.unitid && !byUnitid.has(p.unitid) && p.app_key !== "mit");
pass(
  "every supplement belongs to a college we hold requirements for",
  orphans.length === 0,
  orphans.map((p) => p.slug).join(", ")
);

pass(
  "a word limit and a character limit are never both set",
  all.every((p) => !(p.word_limit && p.char_limit)),
  all.filter((p) => p.word_limit && p.char_limit).map((p) => p.slug).join(", ")
);

console.log(failures === 0 ? "\nall good" : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
