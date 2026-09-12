/**
 * Where each machine-read prompt came from.
 *
 * The prompts in supplements-2026-27.machine.json are quotations from pages
 * data/essay-prompts/build/discover_pages.py went and found. Nobody has read
 * them, so the address a prompt came from is the only evidence it is real, and
 * a plausible-looking page from the wrong place produces prompts that are
 * wrong in a way no schema catches.
 *
 * Every assertion here is a page the discovery actually returned:
 *
 *   UNC's was /application-prompts-for-2025-2026/. The cycle is a label the
 *   extractor applies, not something it read, so last year's questions would
 *   have been published as this year's and a student would have written 650
 *   careful words answering a question no longer asked.
 *
 *   Babson's was a summer programme for high schoolers, Bucknell's a podcast
 *   episode called "how I crafted a killer application essay", Bryn Mawr's a
 *   student blog post. All three talk about essays and word counts, which is
 *   all the structural scorer was looking for. Two arrived by redirect from an
 *   innocent-looking guess, so only the requested URL was ever filtered.
 *
 *   Dartmouth's was /glossary-term/writing-supplement, a dictionary entry.
 *
 * Reads files only. Needs no database and no network.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const CYCLE = "2026-27";
let failures = 0;
const pass = (what: string, ok: boolean, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${detail ? `  -> ${detail}` : ""}`);
};

type School = {
  unitid: number;
  name: string;
  source_url: string;
  extraction: string;
  prompts: { slug: string; title: string; prompt: string; word_limit?: number }[];
};

const machine = JSON.parse(
  readFileSync(resolve(root, "data/essay-prompts/out/supplements-2026-27.machine.json"), "utf8")
) as { cycle: string; schools: School[] };

pass("the machine file is for the cycle we are building", machine.cycle === CYCLE);
pass("there are machine-read colleges", machine.schools.length > 0,
  `${machine.schools.length} colleges`);

// Nothing here has been read by a person. The picker says so on the row, and
// it can only say so if the flag survives.
pass("every machine-read college is flagged as machine",
  machine.schools.every((s) => s.extraction === "machine"));

pass("every college says which page it was read from",
  machine.schools.every((s) => /^https?:\/\//.test(s.source_url ?? "")));

// The UNC case. A year pair in the address is the college filing the page
// under a cycle, and if it is not ours the page is not ours.
const CYCLE_PAIR = /\b(20\d\d)\s*[-/_]\s*(20)?(\d\d)\b/g;
const wrongCycle = machine.schools.filter((s) =>
  [...s.source_url.matchAll(CYCLE_PAIR)].some((m) => m[1] !== CYCLE.split("-")[0])
);
pass("no prompt was read off a page for another cycle", wrongCycle.length === 0,
  wrongCycle.map((s) => `${s.name} ${s.source_url}`).join(" "));

// Babson, Bucknell, Bryn Mawr, Dartmouth.
const NOT_THE_PAGE =
  /episode[-_]?\d|\/podcast|summer[-_](at|program|session|institute)|high[-_]school[-_]learner|pre[-_]college|\/webinar|\/story\/|\/stories\/|how[-_]i[-_]|killer[-_]application|glossary/i;
const STRONG =
  /essay[-_]?prompt|prompt[-_]?guide|supplemental[-_]?essay|writing[-_]?supplement|writing[-_]?section|essay[-_]?question|short[-_]?answer|supplemental[-_]?question/i;
const offTarget = machine.schools.filter(
  (s) => NOT_THE_PAGE.test(s.source_url) && !STRONG.test(s.source_url)
);
pass("no prompt was read off a podcast, a summer programme or a glossary",
  offTarget.length === 0,
  offTarget.map((s) => `${s.name} ${s.source_url}`).join(" "));

// Northwestern's page carries the first-year and transfer questions under
// separate headings, and a line-by-line reader has no headings, so "Please
// share with us why you would like to transfer to Northwestern" was published
// as a first-year prompt. Every student we have is applying as a first-year.
const WRONG_APPLICANT =
  /\b(transfer|transferring)\b|\byour (current|previous|former) (college|university|institution)\b|\b(graduate|doctoral|master's|MBA|PhD) (program|study|degree|school)\b/i;
const wrongApplicant = machine.schools.flatMap((s) =>
  s.prompts.filter((p) => WRONG_APPLICANT.test(p.prompt)).map((p) => `${s.name}: ${p.prompt.slice(0, 60)}`)
);
pass("no prompt is asking a transfer or graduate applicant",
  wrongApplicant.length === 0, wrongApplicant.join(" | "));

// A prompt with no text is a row in the picker a student cannot answer.
const empty = machine.schools.flatMap((s) =>
  s.prompts.filter((p) => !p.prompt?.trim() || !p.title?.trim()).map(() => s.name)
);
pass("every prompt has text and a title", empty.length === 0, empty.join(" "));

const slugs = machine.schools.flatMap((s) => s.prompts.map((p) => p.slug));
pass("no two prompts share a slug", new Set(slugs).size === slugs.length);

// The hand-read file is the other half of the catalogue. A college in both
// would show its prompts twice.
const curated = JSON.parse(
  readFileSync(resolve(root, "data/essay-prompts/curated/supplements-2026-27.json"), "utf8")
) as { schools: School[] };
const overlap = machine.schools
  .filter((s) => curated.schools.some((c) => c.unitid === s.unitid))
  .map((s) => s.name);
pass("no college is both hand-read and machine-read", overlap.length === 0, overlap.join(" "));

console.log(failures === 0 ? "\nall good" : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
