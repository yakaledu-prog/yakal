/**
 * Application requirements, derived rather than asked for.
 *
 * The old tracker showed eight checkboxes per college, so a list of nine
 * colleges meant seventy-two manual toggles that nobody would ever keep
 * accurate. Five of the eight are already knowable from data the portal holds:
 * whether a test score is on file, whether a transcript has been uploaded,
 * whether the essays for that college are finished, and how far the
 * recommenders have got.
 *
 * A derived value is a claim the system is making, so each one carries the
 * reason it reached that conclusion and can be overridden by hand. An override
 * always wins: the student is looking at the college's own portal and we are
 * not.
 */

import {
  ApplicationRequirement,
  CollegeListItem,
  Essay,
  Recommendation,
  StudentAcademics,
} from "./collegeService";

export type ReqKey =
  | "application"
  | "essays"
  | "recs_requested"
  | "recs_received"
  | "transcript"
  | "test_scores"
  | "fafsa"
  | "css_profile";

export const REQUIREMENTS: { key: ReqKey; label: string; short: string }[] = [
  { key: "application", label: "Application submitted", short: "App" },
  { key: "essays", label: "Supplemental essays", short: "Essays" },
  { key: "recs_requested", label: "Recommendations requested", short: "Recs asked" },
  { key: "recs_received", label: "Recommendations submitted", short: "Recs in" },
  { key: "transcript", label: "Transcript sent", short: "Transcript" },
  { key: "test_scores", label: "Test scores", short: "Scores" },
  { key: "fafsa", label: "FAFSA", short: "FAFSA" },
  { key: "css_profile", label: "CSS Profile", short: "CSS" },
];

/** Requirement rows stored in application_requirements use these labels. */
const OVERRIDE_LABEL: Record<ReqKey, string> = {
  application: "Application",
  essays: "Essays",
  recs_requested: "Recs requested",
  recs_received: "Recs received",
  transcript: "Transcript",
  test_scores: "Test scores",
  fafsa: "FAFSA",
  css_profile: "CSS Profile",
};

export type ReqStatus = "done" | "partial" | "todo" | "not_required";

export interface ReqCell {
  key: ReqKey;
  status: ReqStatus;
  /** True when the system worked it out rather than someone ticking a box. */
  derived: boolean;
  /** Why the system concluded this. Shown on hover so it can be trusted. */
  reason: string;
  /** Populated for requirements that are a fraction, such as 1 of 3 essays. */
  progress?: { done: number; total: number };
}

export interface StudentContext {
  academics: StudentAcademics | null;
  essays: Essay[];
  recommendations: Recommendation[];
  /** Whether a transcript document exists for this student. */
  hasTranscript: boolean;
  fafsaSubmitted: boolean;
  cssSubmitted: boolean;
}

function override(
  reqs: ApplicationRequirement[] | undefined,
  key: ReqKey
): ApplicationRequirement | undefined {
  return reqs?.find((r) => r.label === OVERRIDE_LABEL[key]);
}

function essaysFor(ctx: StudentContext, school: CollegeListItem): Essay[] {
  return ctx.essays.filter((e) => e.college_list_item_id === school.id);
}

function derive(
  key: ReqKey,
  school: CollegeListItem,
  ctx: StudentContext
): ReqCell {
  const base = { key, derived: true };

  switch (key) {
    case "test_scores": {
      // A school that does not consider scores should not show an outstanding
      // requirement for them.
      const sat = ctx.academics?.sat_score;
      const act = ctx.academics?.act_score;
      if (sat || act) {
        return {
          ...base,
          status: "done",
          reason: `Ticked because your ${sat ? `SAT ${sat}` : `ACT ${act}`} is on file`,
        };
      }
      return { ...base, status: "todo", reason: "No SAT or ACT score on your profile yet" };
    }

    case "transcript":
      return ctx.hasTranscript
        ? { ...base, status: "done", reason: "Ticked because a transcript is in your documents" }
        : { ...base, status: "todo", reason: "No transcript uploaded yet" };

    case "essays": {
      const list = essaysFor(ctx, school);

      // Only an explicit zero means "this college wants none". A null count is
      // simply unknown, and rendering unknown as not-required told every
      // student their whole list was essay-free.
      if (school.supp_essay_count === 0) {
        return {
          ...base,
          status: "not_required",
          reason: "This college asks for no supplemental essays",
        };
      }

      if (school.supp_essay_count == null && list.length === 0) {
        return {
          ...base,
          status: "todo",
          reason:
            "We do not know how many supplements this college wants. Check its application and set the count on your list.",
        };
      }

      const expected = school.supp_essay_count ?? list.length;
      const done = list.filter((e) => e.status === "done").length;
      if (list.length === 0) {
        return {
          ...base,
          status: "todo",
          reason: `${expected} supplement${expected === 1 ? "" : "s"} to write, none started`,
          progress: { done: 0, total: expected },
        };
      }
      return {
        ...base,
        status: done >= expected ? "done" : done > 0 ? "partial" : "todo",
        reason: `${done} of ${expected} supplemental essays finished`,
        progress: { done, total: expected },
      };
    }

    case "recs_requested": {
      const asked = ctx.recommendations.filter((r) =>
        ["requested", "received", "submitted"].includes(r.status)
      ).length;
      // Two teacher letters is the common ask. The curated per-cycle data will
      // replace this default once a college's real requirement is known.
      const needed = 2;
      if (asked === 0) {
        return { ...base, status: "todo", reason: "You have not asked anyone yet" };
      }
      return {
        ...base,
        status: asked >= needed ? "done" : "partial",
        reason: `${asked} recommender${asked === 1 ? "" : "s"} asked`,
        progress: { done: asked, total: Math.max(needed, asked) },
      };
    }

    case "recs_received": {
      const sent = ctx.recommendations.filter((r) =>
        ["received", "submitted"].includes(r.status)
      ).length;
      const asked = ctx.recommendations.filter((r) =>
        ["requested", "received", "submitted"].includes(r.status)
      ).length;
      if (asked === 0) {
        return { ...base, status: "todo", reason: "Nothing to wait on yet" };
      }
      return {
        ...base,
        status: sent >= asked && sent > 0 ? "done" : sent > 0 ? "partial" : "todo",
        reason: `${sent} of ${asked} letters submitted`,
        progress: { done: sent, total: asked },
      };
    }

    case "fafsa":
      return ctx.fafsaSubmitted
        ? { ...base, status: "done", reason: "You marked the FAFSA as submitted" }
        : { ...base, status: "todo", reason: "FAFSA not submitted. It applies to every college." };

    case "css_profile":
      return ctx.cssSubmitted
        ? { ...base, status: "done", reason: "You marked the CSS Profile as submitted" }
        : {
            ...base,
            status: "todo",
            reason: "CSS Profile not submitted. Only some private colleges need it.",
          };

    case "application":
    default:
      // The one thing only the student can know: whether they pressed submit.
      return {
        ...base,
        derived: false,
        status: ["submitted", "accepted", "waitlisted", "denied", "enrolled"].includes(
          school.status
        )
          ? "done"
          : "todo",
        reason:
          school.status === "considering"
            ? "Set the college's status to Submitted once you apply"
            : "From the status on your college list",
      };
  }
}

/** All eight cells for one college, overrides applied. */
export function requirementsFor(
  school: CollegeListItem,
  ctx: StudentContext
): ReqCell[] {
  return REQUIREMENTS.map(({ key }) => {
    const manual = override(school.requirements, key);
    if (manual) {
      return {
        key,
        status: manual.is_complete ? "done" : "todo",
        derived: false,
        reason: manual.is_complete
          ? "You ticked this yourself"
          : "You cleared this yourself",
      };
    }
    return derive(key, school, ctx);
  });
}

/** Completion for the row header, ignoring requirements the college waives. */
export function completion(cells: ReqCell[]): { done: number; total: number } {
  const relevant = cells.filter((c) => c.status !== "not_required");
  return {
    done: relevant.filter((c) => c.status === "done").length,
    total: relevant.length,
  };
}

export { OVERRIDE_LABEL };
