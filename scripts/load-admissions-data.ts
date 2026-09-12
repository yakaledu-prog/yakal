/**
 * Loads the admissions reference data into Supabase.
 *
 *   npm run db:load:admissions                    the local Docker stack
 *   npm run db:load:admissions -- --target=remote --yes
 *
 * Two files, two tables, one idea: everything here is public reference data
 * that a college publishes and we transcribe. It is loaded rather than seeded,
 * so it is not demo data and --fresh does not touch it.
 *
 *   data/common-app/out/requirements-<cycle>.matched.ndjson
 *     -> college_requirements. Deadlines, fees, recommendation counts, read
 *        out of the Common App Requirements Grid and joined to the catalog on
 *        unitid.
 *
 *   data/common-app/out/admissions-urls.csv
 *     -> college_requirements.admissions_url. Where to apply, so the
 *        add-a-college form stops prefilling a university homepage.
 *
 *   data/essay-prompts/curated/sources-<cycle>.csv
 *     -> college_requirements.essay_page_url. The page each prompt was read
 *        from, so a counselor can check one.
 *
 *   data/essay-prompts/curated/universal-<cycle>.json
 *   data/essay-prompts/curated/supplements-<cycle>.json
 *   data/essay-prompts/out/supplements-<cycle>.machine.json
 *     -> essay_prompts. The questions themselves. The first two were read by a
 *        person; the third was extracted by a script and is marked as such, so
 *        the picker can say which is which rather than presenting both as
 *        equally settled.
 *
 * Upserts on the natural key, so running it twice changes nothing and running
 * it after a grid refresh updates in place. An admin's later correction to a
 * row will be overwritten by the next load, which is the right way round: the
 * college's own published answer wins, and the correction is a signal that the
 * source file needs fixing rather than a value to preserve.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
config({ path: resolve(root, ".env") });

const args = process.argv.slice(2);
const remote = args.includes("--target=remote") || args.includes("remote");
const confirmed = args.includes("--yes");
const cycle = (args.find((a) => a.startsWith("--cycle="))?.split("=")[1]) ?? "2026-27";

function env(...names: string[]): string | undefined {
  for (const n of names) if (process.env[n]) return process.env[n];
  return undefined;
}

const LOCAL_URL = env("VITE_SUPABASE_LOCAL_URL") ?? "http://127.0.0.1:54321";
const LOCAL_SERVICE_KEY =
  env("SUPABASE_LOCAL_SERVICE_ROLE_KEY") ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

function client(): SupabaseClient {
  if (!remote) return createClient(LOCAL_URL, LOCAL_SERVICE_KEY, { auth: { persistSession: false } });

  const url = env("VITE_SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are needed for --target=remote");
  if (!confirmed) throw new Error("writing to the hosted project needs --yes");
  return createClient(url, key, { auth: { persistSession: false } });
}

/** PostgREST rejects a very large single request, and a failure mid-way should
 *  say which chunk, so everything goes in at a size that fits comfortably. */
async function upsert(db: SupabaseClient, table: string, rows: unknown[], onConflict: string) {
  const size = 500;
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size);
    const { error } = await db.from(table).upsert(chunk as never, { onConflict });
    if (error) throw new Error(`${table} rows ${i}-${i + chunk.length}: ${error.message}`);
    process.stdout.write(`\r  ${table}: ${Math.min(i + size, rows.length)}/${rows.length}`);
  }
  process.stdout.write("\n");
}

/** A two-column lookup out of a csv, skipping blanks. Small enough not to want
 *  a csv library, and these files are written by our own scripts. */
function readCsvColumn(path: string, key: string, value: string): Map<number, string> {
  const out = new Map<number, string>();
  if (!existsSync(path)) return out;

  const lines = readFileSync(path, "utf8").split("\n").filter((l) => l.trim());
  if (!lines.length) return out;

  const header = lines[0].split(",").map((h) => h.trim());
  const ki = header.indexOf(key);
  const vi = header.indexOf(value);
  if (ki === -1 || vi === -1) return out;

  for (const line of lines.slice(1)) {
    // No quoted commas in these files: the columns are a unitid, a name we do
    // not read, and a URL.
    const cells = line.split(",");
    const unitid = Number(cells[ki]);
    const v = (cells[vi] ?? "").trim();
    if (Number.isFinite(unitid) && v) out.set(unitid, v);
  }
  return out;
}

function readNdjson(path: string): any[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l));
}

async function loadRequirements(db: SupabaseClient) {
  const path = resolve(root, `data/common-app/out/requirements-${cycle}.matched.ndjson`);
  const rows = readNdjson(path);
  if (!rows.length) {
    console.log(`  no requirements file at ${path}, skipping`);
    return;
  }

  const admissions = readCsvColumn(
    resolve(root, "data/common-app/out/admissions-urls.csv"),
    "unitid",
    "admissions_url"
  );
  const essayPages = readCsvColumn(
    resolve(root, `data/essay-prompts/curated/sources-${cycle}.csv`),
    "unitid",
    "url"
  );
  console.log(`  ${admissions.size} admissions links, ${essayPages.size} essay pages on file`);

  const mapped = rows.map((r) => ({
    unitid: r.unitid,
    cycle,
    deadline_ed: r.deadlines.ed,
    deadline_ed2: r.deadlines.ed2,
    deadline_ea: r.deadlines.ea,
    deadline_ea2: r.deadlines.ea2,
    deadline_rea: r.deadlines.rea,
    deadline_rd: r.deadlines.rd,
    is_rolling: r.rolling,
    application_fee_cents: r.fee_us_cents,
    application_fee_intl_cents: r.fee_intl_cents,
    fee_waiver: r.fee_waiver,
    personal_essay_required: r.personal_essay_required,
    courses_grades_required: r.courses_grades_required,
    // The 2026-27 grid ships this column empty for every school, so we hold no
    // opinion rather than claiming every college waived its supplement. The
    // prompts themselves answer the question better anyway.
    writing_supplement_required: null,
    portfolio: r.portfolio,
    test_policy: r.test_policy,
    tests_used: r.tests_used,
    english_proficiency: r.english_proficiency,
    recs_teacher: r.recs.teacher,
    recs_other: r.recs.other,
    recs_midyear_required: r.recs.midyear,
    recs_counselor_required: r.recs.counselor,
    admissions_url: admissions.get(r.unitid) ?? null,
    essay_page_url: essayPages.get(r.unitid) ?? null,
    source: "common_app_grid",
    source_url: "https://content.commonapp.org/Files/ReqGrid.pdf",
    verified_on: r.verified_on ?? new Date().toISOString().slice(0, 10),
  }));

  await upsert(db, "college_requirements", mapped, "unitid,cycle");
}

interface PromptFile {
  cycle: string;
  apps?: {
    app_key: string;
    source_url?: string;
    verified_on?: string;
    prompts: any[];
  }[];
  schools?: {
    unitid: number;
    app_key?: string | null;
    source_url?: string;
    verified_on?: string;
    /** manual when a person read the page, machine when a script did. */
    extraction?: "manual" | "machine";
    prompts: any[];
  }[];
}

function promptRows(file: PromptFile): any[] {
  let rows: any[] = [];

  const push = (p: any, extra: Record<string, unknown>, order: number) =>
    rows.push({
      cycle: file.cycle,
      slug: p.slug,
      title: p.title,
      prompt: p.prompt,
      word_limit: p.word_limit ?? null,
      char_limit: p.char_limit ?? null,
      requirement: p.requirement ?? "required",
      choice_group: p.choice_group ?? null,
      choose_count: p.choose_count ?? null,
      group_label: p.group_label ?? null,
      sort_order: order,
      is_active: true,
      // Default manual: everything hand-written predates the extractor and
      // was read by a person.
      extraction: p.extraction ?? "manual",
      ...extra,
    });

  for (const app of file.apps ?? []) {
    app.prompts.forEach((p, i) =>
      push(p, {
        app_key: app.app_key,
        unitid: null,
        source_url: p.source_url ?? app.source_url ?? null,
        verified_on: p.verified_on ?? app.verified_on ?? null,
      }, i)
    );
  }

  for (const school of file.schools ?? []) {
    school.prompts.forEach((p, i) =>
      push(p, {
        app_key: p.app_key ?? school.app_key ?? null,
        unitid: school.unitid,
        source_url: p.source_url ?? school.source_url ?? null,
        // A machine row has no verified date by definition: nobody has looked.
        verified_on: p.verified_on ?? school.verified_on ?? null,
        extraction: p.extraction ?? school.extraction ?? "manual",
      }, i)
    );
  }

  return rows;
}

async function loadPrompts(db: SupabaseClient) {
  const files = [
    `data/essay-prompts/curated/universal-${cycle}.json`,
    `data/essay-prompts/curated/supplements-${cycle}.json`,
    // Last, so a college done by hand wins on a slug clash.
    `data/essay-prompts/out/supplements-${cycle}.machine.json`,
  ];

  let rows: any[] = [];
  for (const rel of files) {
    const path = resolve(root, rel);
    if (!existsSync(path)) {
      console.log(`  no prompt file at ${rel}, skipping`);
      continue;
    }
    rows.push(...promptRows(JSON.parse(readFileSync(path, "utf8"))));
  }
  if (!rows.length) return;

  // A college done by hand and then picked up by the extractor would arrive
  // twice. The hand-written one is read first and keeps the slug.
  const byUnitid = new Set(
    rows.filter((r) => r.extraction === "manual" && r.unitid).map((r) => r.unitid)
  );
  const before = rows.length;
  rows = rows.filter((r) => r.extraction !== "machine" || !byUnitid.has(r.unitid));
  if (before !== rows.length) {
    console.log(`  ${before - rows.length} machine prompts dropped for colleges already done by hand`);
  }

  const seen = new Set<string>();
  for (const r of rows) {
    if (seen.has(r.slug)) throw new Error(`two prompts share the slug ${r.slug}`);
    seen.add(r.slug);
  }

  await upsert(db, "essay_prompts", rows, "cycle,slug");
}

async function main() {
  const db = client();
  console.log(`loading the ${cycle} cycle into ${remote ? "the hosted project" : "the local stack"}`);
  await loadRequirements(db);
  await loadPrompts(db);

  const counts = await Promise.all([
    db.from("college_requirements").select("*", { count: "exact", head: true }).eq("cycle", cycle),
    db.from("essay_prompts").select("*", { count: "exact", head: true }).eq("cycle", cycle),
  ]);
  console.log(`done: ${counts[0].count} colleges, ${counts[1].count} prompts`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
