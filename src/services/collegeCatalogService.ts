import { supabase } from "@/lib/supabase";
/**
 * College catalog: 1,944 US bachelor's-granting institutions.
 *
 * Source data is built by data/colleges/build/ from the US Department of
 * Education College Scorecard and Wikidata, and shipped as a single 97 KB
 * gzipped payload at /data/colleges.json. It is fetched once, cached for the
 * session, and filtered in the browser. There is no server round trip on
 * search, which is what makes typing feel instant.
 *
 * What is NOT in here: application deadlines, supplemental essay prompts and
 * recommendation requirements. No public API supplies them. See
 * data/colleges/README.md and collegeCycleService for how those are handled.
 */

export type Control = "public" | "private_nonprofit" | "private_for_profit";
export type Locale = "city" | "suburb" | "town" | "rural";
export type TestPolicy = "required" | "considered_not_required" | "not_considered";

/** Reach / target / safety, computed from the student's own numbers. */
export type Fit = "reach" | "target" | "safety" | "unknown";

export interface College {
  unitid: number;
  name: string;
  city: string | null;
  state: string | null;
  control: Control | null;
  locale: Locale | null;
  undergrads: number | null;
  admitRate: number | null;
  testPolicy: TestPolicy | null;
  satLow: number | null;
  satHigh: number | null;
  actLow: number | null;
  actHigh: number | null;
  netPrice: number | null;
  cost: number | null;
  ratio: number | null;
  gradRate: number | null;
  /** Wikimedia Commons filename, or null. Use collegeImageUrl() to render. */
  image: string | null;
  /** Photographer. CC BY licences require this to be displayed. */
  credit: string | null;
}

const CONTROL: Control[] = ["public", "private_nonprofit", "private_for_profit"];
const LOCALE: Locale[] = ["city", "suburb", "town", "rural"];
const TEST_POLICY: TestPolicy[] = [
  "required",
  "considered_not_required",
  "not_considered",
];

export const CONTROL_LABEL: Record<Control, string> = {
  public: "Public",
  private_nonprofit: "Private",
  private_for_profit: "For-profit",
};

export const FIT_LABEL: Record<Fit, string> = {
  reach: "Reach",
  target: "Target",
  safety: "Safety",
  unknown: "No data",
};

// --- loading ---------------------------------------------------------------

let cache: College[] | null = null;
let inflight: Promise<College[]> | null = null;

function decode(payload: {
  columns: string[];
  rows: (string | number | null)[][];
}): College[] {
  const i = (k: string) => payload.columns.indexOf(k);
  const c = {
    unitid: i("unitid"), name: i("name"), city: i("city"), state: i("state"),
    control: i("control"), locale: i("locale"), undergrads: i("undergrads"),
    admitRate: i("admitRate"), testPolicy: i("testPolicy"),
    satLow: i("satLow"), satHigh: i("satHigh"),
    actLow: i("actLow"), actHigh: i("actHigh"),
    netPrice: i("netPrice"), cost: i("cost"), ratio: i("ratio"),
    gradRate: i("gradRate"), image: i("image"), credit: i("credit"),
  };

  return payload.rows.map((r) => ({
    unitid: r[c.unitid] as number,
    name: r[c.name] as string,
    city: r[c.city] as string | null,
    state: r[c.state] as string | null,
    control: r[c.control] === null ? null : CONTROL[r[c.control] as number],
    locale: r[c.locale] === null ? null : LOCALE[r[c.locale] as number],
    undergrads: r[c.undergrads] as number | null,
    admitRate: r[c.admitRate] as number | null,
    testPolicy:
      r[c.testPolicy] === null ? null : TEST_POLICY[r[c.testPolicy] as number],
    satLow: r[c.satLow] as number | null,
    satHigh: r[c.satHigh] as number | null,
    actLow: r[c.actLow] as number | null,
    actHigh: r[c.actHigh] as number | null,
    netPrice: r[c.netPrice] as number | null,
    cost: r[c.cost] as number | null,
    ratio: r[c.ratio] as number | null,
    gradRate: r[c.gradRate] as number | null,
    image: r[c.image] as string | null,
    credit: r[c.credit] as string | null,
  }));
}

export function loadCatalog(): Promise<College[]> {
  if (cache) return Promise.resolve(cache);
  if (inflight) return inflight;

  inflight = fetch(`${import.meta.env.BASE_URL}data/colleges.json`)
    .then((r) => {
      if (!r.ok) throw new Error(`catalog ${r.status}`);
      return r.json();
    })
    .then((payload) => {
      cache = decode(payload);
      return cache;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

/**
 * Commons serves a scaled thumbnail from Special:FilePath, so we do not pull a
 * multi-megabyte original into a card.
 *
 * TODO before launch: mirror these to our own CDN. Commons asks that you not
 * hotlink at volume, and 1,208 images across every page view is volume.
 */
export function collegeImageUrl(file: string | null, width = 640): string | null {
  if (!file) return null;
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(
    file
  )}?width=${width}`;
}

// --- fit -------------------------------------------------------------------

export interface StudentProfile {
  sat?: number | null;
  act?: number | null;
  gpa?: number | null;
}

/**
 * Where a student sits against a school's admitted middle 50 percent.
 *
 * Deliberately conservative. Being inside the middle 50 at a school that admits
 * 8 percent of applicants is not a "target", so admit rate overrides the score
 * comparison at the top end. This mirrors how a counselor actually talks about
 * a list, and it is the number the balance warnings are built on.
 *
 * Returns "unknown" rather than guessing when a school reports no scores. Only
 * about 71 percent of the top 300 do, so this is a common case, not an edge one.
 */
export function computeFit(college: College, student: StudentProfile): Fit {
  const { admitRate } = college;

  // Highly selective schools are a reach for everyone. A 1570 does not make
  // Hopkins a target; it makes you a plausible applicant.
  if (admitRate !== null && admitRate < 15) return "reach";

  let position: number | null = null; // -1 below range, 0 inside, 1 above

  if (student.sat && college.satLow && college.satHigh) {
    position =
      student.sat < college.satLow ? -1 : student.sat > college.satHigh ? 1 : 0;
  } else if (student.act && college.actLow && college.actHigh) {
    position =
      student.act < college.actLow ? -1 : student.act > college.actHigh ? 1 : 0;
  }

  if (position === null) {
    // No score comparison possible. Fall back to selectivity alone rather than
    // showing nothing, but only where the admit rate is decisive.
    if (admitRate === null) return "unknown";
    if (admitRate < 30) return "reach";
    if (admitRate > 80) return "safety";
    return "unknown";
  }

  if (position === 1) {
    // Above the range, but a 25 percent admit rate is still not a safety.
    if (admitRate !== null && admitRate < 40) return "target";
    return "safety";
  }
  if (position === -1) return "reach";

  // Inside the middle 50.
  if (admitRate !== null && admitRate < 40) return "reach";
  return "target";
}

/** Position of a student's SAT inside a school's range, 0-1, for the fit bar. */
export function satMarkerPosition(
  college: College,
  sat: number | null | undefined
): number | null {
  if (!sat || !college.satLow || !college.satHigh) return null;
  // Pad the rendered track 60 points either side so a marker at the edge of the
  // band is still visible rather than clipped to the end.
  const lo = college.satLow - 60;
  const hi = college.satHigh + 60;
  return Math.max(0, Math.min(1, (sat - lo) / (hi - lo)));
}

// --- filtering -------------------------------------------------------------

export interface CatalogFilters {
  query: string;
  states: string[];
  controls: Control[];
  locales: Locale[];
  /** Inclusive upper bound on average net price. null means no limit. */
  maxNetPrice: number | null;
  /** Inclusive bounds on admit rate, percent. */
  minAdmitRate: number | null;
  maxAdmitRate: number | null;
  testPolicies: TestPolicy[];
  /** Undergraduate enrollment bands. */
  sizes: ("small" | "medium" | "large")[];
  fits: Fit[];
  /** Only schools we hold a licensed photograph for. */
  withImageOnly: boolean;
}

export const EMPTY_FILTERS: CatalogFilters = {
  query: "",
  states: [],
  controls: [],
  locales: [],
  maxNetPrice: null,
  minAdmitRate: null,
  maxAdmitRate: null,
  testPolicies: [],
  sizes: [],
  fits: [],
  withImageOnly: false,
};

export function sizeBand(undergrads: number | null): "small" | "medium" | "large" | null {
  if (undergrads === null) return null;
  if (undergrads < 5000) return "small";
  if (undergrads <= 15000) return "medium";
  return "large";
}

/**
 * Match a search term against a school name.
 *
 * Handles the way people actually type: "john hopkins" (missing the s),
 * "umd", "u of michigan". Full fuzzy matching is overkill for 1,944 records,
 * but plain substring matching fails too often to ship.
 */
function matchesQuery(name: string, query: string): boolean {
  const n = name.toLowerCase();
  const q = query.toLowerCase().trim();
  if (!q) return true;
  if (n.includes(q)) return true;

  // Every word in the query must appear somewhere in the name, in order,
  // so "michigan ann" finds "University of Michigan-Ann Arbor".
  const words = q.split(/\s+/).filter((w) => w.length > 1);
  if (words.length > 1) {
    let cursor = 0;
    const all = words.every((w) => {
      const at = n.indexOf(w, cursor);
      if (at === -1) return false;
      cursor = at + w.length;
      return true;
    });
    if (all) return true;
  }

  // Initials: "mit", "ucla", "umbc".
  const initials = name
    .split(/[\s-]+/)
    .filter((w) => /^[A-Za-z]/.test(w) && !["of", "the", "at", "and"].includes(w.toLowerCase()))
    .map((w) => w[0].toLowerCase())
    .join("");
  return initials.startsWith(q.replace(/\s+/g, ""));
}

export function filterCatalog(
  colleges: College[],
  filters: CatalogFilters,
  student: StudentProfile
): College[] {
  const {
    query, states, controls, locales, maxNetPrice,
    minAdmitRate, maxAdmitRate, testPolicies, sizes, fits, withImageOnly,
  } = filters;

  return colleges.filter((c) => {
    if (query && !matchesQuery(c.name, query)) return false;
    if (states.length && (!c.state || !states.includes(c.state))) return false;
    if (controls.length && (!c.control || !controls.includes(c.control))) return false;
    if (locales.length && (!c.locale || !locales.includes(c.locale))) return false;
    if (withImageOnly && !c.image) return false;

    // A school with no price on file is excluded when a price cap is set:
    // showing an unknown cost under a "$35k or less" filter is misleading.
    if (maxNetPrice !== null && (c.netPrice === null || c.netPrice > maxNetPrice)) {
      return false;
    }

    if (minAdmitRate !== null && (c.admitRate === null || c.admitRate < minAdmitRate)) {
      return false;
    }
    if (maxAdmitRate !== null && (c.admitRate === null || c.admitRate > maxAdmitRate)) {
      return false;
    }

    if (testPolicies.length && (!c.testPolicy || !testPolicies.includes(c.testPolicy))) {
      return false;
    }

    if (sizes.length) {
      const band = sizeBand(c.undergrads);
      if (!band || !sizes.includes(band)) return false;
    }

    if (fits.length && !fits.includes(computeFit(c, student))) return false;

    return true;
  });
}

export type SortKey = "fit" | "name" | "netPrice" | "admitRate" | "size" | "gradRate";

export function sortCatalog(
  colleges: College[],
  key: SortKey,
  student: StudentProfile
): College[] {
  const out = [...colleges];
  const nullsLast = (v: number | null) => (v === null ? Number.POSITIVE_INFINITY : v);

  switch (key) {
    case "name":
      return out.sort((a, b) => a.name.localeCompare(b.name));
    case "netPrice":
      return out.sort((a, b) => nullsLast(a.netPrice) - nullsLast(b.netPrice));
    case "admitRate":
      return out.sort((a, b) => nullsLast(a.admitRate) - nullsLast(b.admitRate));
    case "size":
      return out.sort((a, b) => (b.undergrads ?? 0) - (a.undergrads ?? 0));
    case "gradRate":
      return out.sort((a, b) => (b.gradRate ?? 0) - (a.gradRate ?? 0));
    case "fit":
    default: {
      // Targets first: they are the most actionable, and a list of nothing but
      // reaches is the failure mode this whole feature exists to prevent.
      const rank: Record<Fit, number> = { target: 0, safety: 1, reach: 2, unknown: 3 };
      return out.sort((a, b) => {
        const d = rank[computeFit(a, student)] - rank[computeFit(b, student)];
        return d !== 0 ? d : (b.undergrads ?? 0) - (a.undergrads ?? 0);
      });
    }
  }
}

/** States present in the catalog, for the location filter. */
export function statesIn(colleges: College[]): string[] {
  return [...new Set(colleges.map((c) => c.state).filter(Boolean) as string[])].sort();
}

// ------------------------------------------------------------
// Saved universities.
//
// A shortlist, not the college list. Adding to the list is a decision with a
// tier attached and a dialog to fill in; saving is "come back to this one",
// which is what somebody browsing nineteen hundred schools does first.
//
// Keyed by unitid because the catalogue is a static JSON file rather than a
// table, so there is no row to reference and a name is not a key.
// ------------------------------------------------------------

export async function getBookmarks(studentId: string): Promise<Set<number>> {
  const { data, error } = await supabase
    .from("college_bookmarks")
    .select("unitid")
    .eq("student_id", studentId);

  if (error) {
    // A failed read is a card without a filled bookmark, not a page that
    // fails to draw.
    console.error("getBookmarks:", error.message);
    return new Set();
  }
  return new Set((data ?? []).map((r) => r.unitid as number));
}

/** Returns whether it ended up saved, so a caller can update without refetching. */
export async function toggleBookmark(
  studentId: string,
  unitid: number,
  saved: boolean
): Promise<boolean> {
  if (saved) {
    const { error } = await supabase
      .from("college_bookmarks")
      .delete()
      .eq("student_id", studentId)
      .eq("unitid", unitid);
    if (error) throw new Error(error.message);
    return false;
  }

  const { error } = await supabase
    .from("college_bookmarks")
    .insert({ student_id: studentId, unitid });
  // Already there is not a failure: two taps in quick succession should end
  // up saved, not throw.
  if (error && error.code !== "23505") throw new Error(error.message);
  return true;
}
