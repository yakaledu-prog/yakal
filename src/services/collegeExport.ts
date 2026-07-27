import { College } from "./collegeCatalogService";
import { CollegeListItem } from "./collegeService";

/**
 * CSV export of a college list.
 *
 * Exists because families keep their real shortlist in a spreadsheet no matter
 * what the app does, and a parent comparing costs wants it next to the rest of
 * their planning. Fighting that loses; feeding it does not.
 */

const TIER_LABEL: Record<string, string> = {
  dream: "Reach",
  target: "Target",
  safety: "Safety",
};

const ROUND_LABEL: Record<string, string> = {
  ed1: "Early Decision", ed2: "Early Decision II", ea: "Early Action",
  rea: "Restrictive Early Action", rd: "Regular Decision", rolling: "Rolling",
};

/**
 * Quote anything a spreadsheet could misread. A college name with a comma in
 * it silently shifts every later column, which is the classic way a CSV looks
 * fine and is wrong.
 */
function cell(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const COLUMNS: {
  header: string;
  value: (item: CollegeListItem, college: College | null) => unknown;
}[] = [
  { header: "College", value: (i) => i.school_name },
  { header: "City", value: (_i, c) => c?.city },
  { header: "State", value: (_i, c) => c?.state },
  { header: "Category", value: (i) => TIER_LABEL[i.tier] ?? i.tier },
  { header: "Status", value: (i) => i.status },
  { header: "Round", value: (i) => (i.deadline_round ? ROUND_LABEL[i.deadline_round] : "") },
  { header: "Deadline", value: (i) => i.deadline },
  { header: "Admit rate %", value: (_i, c) => c?.admitRate },
  { header: "SAT 25th", value: (_i, c) => c?.satLow },
  { header: "SAT 75th", value: (_i, c) => c?.satHigh },
  { header: "Net price / yr", value: (_i, c) => c?.netPrice },
  { header: "Sticker / yr", value: (_i, c) => c?.cost },
  { header: "Graduation rate %", value: (_i, c) => c?.gradRate },
  { header: "Student-faculty ratio", value: (_i, c) => c?.ratio },
  { header: "Undergrads", value: (_i, c) => c?.undergrads },
  { header: "Supplemental essays", value: (i) => i.supp_essay_count },
  { header: "Admissions page", value: (i) => i.application_url },
  { header: "Why this college", value: (i) => i.why_school },
];

export function toCsv(
  items: CollegeListItem[],
  match: (item: CollegeListItem) => College | null
): string {
  const lines = [COLUMNS.map((c) => cell(c.header)).join(",")];
  for (const item of items) {
    const college = match(item);
    lines.push(COLUMNS.map((c) => cell(c.value(item, college))).join(","));
  }
  // A leading BOM so Excel opens UTF-8 college names correctly rather than
  // rendering them as mojibake.
  return "\uFEFF" + lines.join("\r\n");
}

export function downloadCsv(filename: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
