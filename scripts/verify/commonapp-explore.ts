/**
 * The Common App member data, and the admissions links built from it.
 *
 * data/common-app/build/harvest_explore.py reads one static JSON per member
 * college off commonapp.org and resolve_admissions_host.py folds the stated
 * admissions links into admissions-urls.csv, which db:load:admissions puts on
 * college_requirements.admissions_url. That link is the one a student clicks
 * to go and apply, so a wrong one sends them somewhere useless.
 *
 * Each assertion here pins something that has already gone wrong or would go
 * wrong silently:
 *
 *   A stated link is not automatically a good one. Alverno's points at /visit
 *   and several are recorded as http on sites that answer https, so the
 *   harvest is filtered through looks_like_admissions and upgraded to https
 *   rather than trusted. If that filter is ever dropped, the CSV fills with
 *   links to visit pages and nothing throws.
 *
 *   The guard exists because of Harvard, whose /admissions redirects to
 *   /task-force-on-antisemitism/admissions-and-early-student-experiences.
 *   The word appears, but in the second path segment. First segment only.
 *
 *   Every unitid in the CSV has to be a college we carry. Common App has
 *   members we do not: foreign universities, and some with no IPEDS id.
 *   A row for a college the catalogue has never heard of joins to nothing.
 *
 * Reads files only. Needs no database and no network.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
let failures = 0;
const pass = (what: string, ok: boolean, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${detail ? `  -> ${detail}` : ""}`);
};

type Row = {
  slug: string;
  unitid: number | null;
  name: string | null;
  admissions_url: string | null;
  logo_url: string | null;
  alternate_names: string | null;
  source_url: string;
};

const explore: Row[] = readFileSync(
  resolve(root, "data/common-app/out/commonapp-explore.ndjson"),
  "utf8"
)
  .split("\n")
  .filter(Boolean)
  .map((l) => JSON.parse(l) as Row);

// --- the harvest -----------------------------------------------------------

pass("the harvest covers Common App's membership", explore.length > 1_000,
  `${explore.length} colleges`);

pass("every row says where it came from",
  explore.every((r) => r.source_url?.startsWith("https://www.commonapp.org/explore/")));

pass("every row is named", explore.every((r) => Boolean(r.name)));

// The whole point of this file over the requirements grid: the join key is
// stated, so nothing has to be matched by name.
const withId = explore.filter((r) => r.unitid !== null);
pass("most colleges state an IPEDS id", withId.length > 1_000,
  `${withId.length} of ${explore.length}`);

// Georgetown University in Qatar is recorded as 5555540, a placeholder for a
// campus that has no unitid at all. A made-up id that looks like a number is
// worse than a blank, because it joins, so the harvest nulls it.
pass("a stated IPEDS id is a real six-digit one",
  withId.every((r) => Number.isInteger(r.unitid) && r.unitid! >= 100_000 && r.unitid! <= 999_999),
  withId.filter((r) => r.unitid! < 100_000 || r.unitid! > 999_999).map((r) => r.slug).join(" "));

const slugs = new Set(explore.map((r) => r.slug));
pass("no college is harvested twice", slugs.size === explore.length);

// These are the fields the app wants and the reason the harvest is worth
// keeping. A drop here means commonapp.org changed its shape.
pass("logos survived the harvest",
  explore.filter((r) => r.logo_url).length > 900);
pass("search aliases survived the harvest",
  explore.filter((r) => r.alternate_names).length > 700);

// --- the admissions links -------------------------------------------------

const catalogue = new Set(
  readFileSync(resolve(root, "data/colleges/out/colleges.ndjson"), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => Number(JSON.parse(l).unitid))
);

const csv = readFileSync(resolve(root, "data/common-app/out/admissions-urls.csv"), "utf8")
  .split("\n")
  .filter(Boolean)
  .slice(1)
  .map((line) => {
    const [unitid, ...rest] = line.split(",");
    // The name may contain a comma; the URL never does.
    const url = rest[rest.length - 1];
    return { unitid: Number(unitid), url };
  });

pass("there are admissions links to load", csv.length > 900, `${csv.length} rows`);

pass("every admissions link belongs to a college we carry",
  csv.every((r) => catalogue.has(r.unitid)),
  csv.filter((r) => !catalogue.has(r.unitid)).slice(0, 3).map((r) => r.unitid).join(" "));

const dupes = csv.length - new Set(csv.map((r) => r.unitid)).size;
pass("no college has two admissions links", dupes === 0, `${dupes} duplicated`);

pass("every admissions link is https",
  csv.every((r) => r.url.startsWith("https://")),
  csv.find((r) => !r.url.startsWith("https://"))?.url ?? "");

// is_admissions_link in resolve_admissions_host.py, in TypeScript. A
// dedicated admissions subdomain is the answer whatever path it lands on;
// otherwise the word has to lead the FIRST path segment, which is the Harvard
// case: its /admissions redirects to a task force page that contains the word
// further along and is emphatically not where to send a seventeen-year-old.
const ADMISSIONS_WORD =
  /^(admission|apply|applying|applicant|undergrad|future-student|prospective)/i;
const SUBDOMAINS = ["admission", "admissions", "apply", "undergrad", "college"];
const offTarget = csv.filter((r) => {
  const u = new URL(r.url);
  if (SUBDOMAINS.includes(u.hostname.replace(/^www\./, "").split(".")[0])) return false;
  const first = u.pathname.replace(/^\/|\/$/g, "").split("/")[0];
  return first.length > 0 && !ADMISSIONS_WORD.test(first);
});
pass("no admissions link sends a student somewhere that is not admissions",
  offTarget.length === 0,
  offTarget.slice(0, 3).map((r) => r.url).join(" "));

console.log(failures === 0 ? "\nall good" : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
