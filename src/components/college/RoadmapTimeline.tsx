import { useMemo, useState } from "react";
import { cn } from "@/utils/cn";

/**
 * The admissions timeline, positioned against where the student actually is.
 *
 * It used to be a hardcoded block headed "Grade 11", which is why the heading
 * made no sense: it said nothing about the reader. Grade and term are worked
 * out from the graduation year on file, so the page opens on the term the
 * student is standing in and everything else is context around it.
 */

export type Term = "Fall" | "Winter" | "Spring" | "Summer";

const TERMS: Term[] = ["Fall", "Winter", "Spring", "Summer"];

interface Task {
  title: string;
  detail: string;
  /** Marks the testing thread, which runs across grades and is easy to lose. */
  testing?: boolean;
}

const PLAN: Record<number, { headline: string; terms: Partial<Record<Term, Task[]>> }> = {
  9: {
    headline: "Build the record everything later rests on",
    terms: {
      Fall: [
        { title: "Take the hardest classes you can carry", detail: "Course rigour counts for as much as the grades themselves." },
        { title: "Try more activities than you will keep", detail: "Depth beats breadth by senior year, but you cannot go deep on something you never tried." },
      ],
      Spring: [
        { title: "Pick next year's courses deliberately", detail: "Honours and AP tracks branch here, and moving up later is harder than starting high." },
      ],
      Summer: [
        { title: "Do one thing properly", detail: "A job, a project, a course. Admissions officers read summers as a signal of what you choose when nobody assigns it." },
      ],
    },
  },
  10: {
    headline: "Narrow what you care about",
    terms: {
      Fall: [
        { title: "Take the PSAT 10 for practice", detail: "It does not count for anything. That is the point: a free read on where you stand.", testing: true },
        { title: "Keep the GPA climbing", detail: "An upward trend across grades reads better than a flat strong one." },
      ],
      Winter: [
        { title: "Drop what you are not enjoying", detail: "Two or three activities you lead beat eight you attend." },
      ],
      Spring: [
        { title: "Sit a diagnostic SAT and ACT", detail: "Most students are meaningfully better at one. Finding out now saves a year of prepping the wrong test.", testing: true },
      ],
      Summer: [
        { title: "Visit a campus, any campus", detail: "Large, small, urban, rural. You learn what you want by reacting to somewhere real." },
      ],
    },
  },
  11: {
    headline: "The year that decides most of the outcome",
    terms: {
      Fall: [
        { title: "PSAT/NMSQT in October", detail: "The only year it counts for National Merit. Register through your school, not online.", testing: true },
        { title: "Protect the GPA", detail: "Junior grades and junior rigour carry the most weight of any year." },
        { title: "Commit to SAT or ACT", detail: "Use the diagnostic and pick one. Preparing for both halves your practice on each.", testing: true },
      ],
      Winter: [
        { title: "Start focused prep", detail: "Begin eight to twelve weeks out, using official Bluebook or ACT materials rather than third-party imitations.", testing: true },
        { title: "Register for a spring sitting", detail: "SAT runs March, May and June. ACT runs February, April and June.", testing: true },
        { title: "Draft a balanced list", detail: "Reach, target and safety. A list with no true safety is the one failure that ends a cycle badly." },
      ],
      Spring: [
        { title: "Sit the test", detail: "Spring of junior year is the ideal first attempt: enough content covered, and time left to retake.", testing: true },
        { title: "Ask two teachers for letters", detail: "In person, before summer. Good writers fill their slots early and they write dozens of these." },
        { title: "Take AP exams", detail: "Strong scores earn credit and evidence the rigour on your transcript." },
      ],
      Summer: [
        { title: "Write the personal statement", detail: "Draft it before senior year starts. Term time will not give you the quiet." },
        { title: "Retake if a retake would help", detail: "An August or early-autumn sitting still lands before Early deadlines.", testing: true },
        { title: "Research supplements", detail: "Every college's own question. Knowing the count now tells you how much writing is ahead." },
      ],
    },
  },
  12: {
    headline: "Execution, and not much room for slippage",
    terms: {
      Fall: [
        { title: "Finish the Common App", detail: "Opens August 1. The account and essay carry over from last summer's draft." },
        { title: "File the FAFSA from October 1", detail: "Some aid is first come, first served. Filing late costs money nothing else will recover." },
        { title: "Submit Early applications by November 1", detail: "Early Decision is binding. Early Action is not, and there is rarely a reason to skip it." },
        { title: "Retake if needed", detail: "October is the last sitting most Early deadlines will accept.", testing: true },
      ],
      Winter: [
        { title: "Submit Regular Decision", detail: "Most deadlines land between January 1 and 15. Submit days early: portals fail under load." },
        { title: "Send the mid-year report", detail: "Your counselor sends first-semester grades. Most colleges will not finish reading you without it." },
      ],
      Spring: [
        { title: "Compare offers on net price", detail: "Sticker price is close to meaningless. Compare what each college actually costs you after aid." },
        { title: "Decide by May 1", detail: "Decision Day. Deposit at one college and decline the rest so waitlists can move." },
      ],
      Summer: [
        { title: "Send the final transcript", detail: "Proof you graduated, to the college you are enrolling at. Offers are conditional until it lands." },
      ],
    },
  },
};

/**
 * School years run August to May, so the calendar year alone does not say which
 * grade someone is in. Anchored on graduation year because that is stable,
 * where a stored grade goes stale every August.
 */
export function currentGrade(gradYear: number | null | undefined): number | null {
  if (!gradYear) return null;
  const now = new Date();
  const schoolYearEnd = now.getMonth() >= 7 ? now.getFullYear() + 1 : now.getFullYear();
  const grade = 12 - (gradYear - schoolYearEnd);
  return grade >= 9 && grade <= 12 ? grade : null;
}

export function currentTerm(): Term {
  const m = new Date().getMonth();
  if (m >= 7 && m <= 10) return "Fall";
  if (m === 11 || m <= 1) return "Winter";
  if (m >= 2 && m <= 4) return "Spring";
  return "Summer";
}

export function RoadmapTimeline({
  gradYear,
  gradeLevel,
  subjectName,
}: {
  gradYear?: number | null;
  /** Fallback when no graduation year is on file, e.g. "11" or "Grade 11". */
  gradeLevel?: string | null;
  /**
   * Whose timeline this is, when it is not the reader's own. A parent reading
   * their child's roadmap is not the one in Grade 12, and "you are here" told
   * them so.
   */
  subjectName?: string;
}) {
  const derived =
    currentGrade(gradYear) ??
    (() => {
      const n = Number(String(gradeLevel ?? "").replace(/\D/g, ""));
      return n >= 9 && n <= 12 ? n : null;
    })();

  const [grade, setGrade] = useState<number>(derived ?? 11);
  const term = currentTerm();
  const isNow = derived !== null && grade === derived;

  const plan = PLAN[grade];
  const terms = useMemo(
    () => TERMS.filter((t) => (plan.terms[t]?.length ?? 0) > 0),
    [plan]
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {[9, 10, 11, 12].map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setGrade(g)}
            className={cn(
              "rounded-full px-3 py-1.5 text-[13px] transition-colors",
              g === grade
                ? "bg-[#1099A1] font-medium text-white"
                : "bg-[#f3f3f5] text-[#54656f] hover:bg-[#ececf0] dark:bg-[#1c2a32] dark:text-[#aebac1]"
            )}
          >
            Grade {g}
            {g === derived && (
              <span className={cn("ml-1.5", g === grade ? "text-white/70" : "text-[#1099A1]")}>
                {subjectName ?? "you"}
              </span>
            )}
          </button>
        ))}
      </div>

      <p className="text-[14px] text-[#54656f] dark:text-[#aebac1]">
        {plan.headline}
        {derived === null && (
          <span className="text-[#717182]">
            {" "}
            Set your graduation year above to have this follow you.
          </span>
        )}
      </p>

      <ol className="relative space-y-6 pl-6">
        {/* One rail down the whole grade, so the terms read as a sequence
            rather than four unrelated boxes. */}
        <span
          aria-hidden
          className="absolute bottom-2 left-[7px] top-2 w-px bg-[#e9edef] dark:bg-[#2a3942]"
        />

        {terms.map((t) => {
          const here = isNow && t === term;
          return (
            <li key={t} className="relative">
              <span
                aria-hidden
                className={cn(
                  "absolute -left-6 top-1 h-[15px] w-[15px] rounded-full border-2",
                  here
                    ? "border-[#1099A1] bg-[#1099A1]"
                    : "border-[#e9edef] bg-white dark:border-[#2a3942] dark:bg-[#111b21]"
                )}
              />

              <div className="mb-2 flex items-center gap-2">
                <h4
                  className={cn(
                    "text-[14px]",
                    here
                      ? "font-semibold text-[#111] dark:text-white"
                      : "text-[#54656f] dark:text-[#aebac1]"
                  )}
                >
                  {t}
                </h4>
                {here && (
                  <span className="rounded-full bg-[#1099A1]/10 px-2 py-0.5 text-[11px] font-medium text-[#0d757b] dark:text-[#5fc9cf]">
                    {subjectName ? `${subjectName} is here` : "you are here"}
                  </span>
                )}
              </div>

              <div className="space-y-2">
                {plan.terms[t]!.map((task) => (
                  <div
                    key={task.title}
                    className={cn(
                      "rounded-xl border p-3",
                      here
                        ? "border-[#1099A1]/25 bg-white dark:bg-[#182229]"
                        : "border-[#e9edef] bg-white dark:border-[#2a3942] dark:bg-[#182229]"
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[14px] text-[#111] dark:text-white">
                        {task.title}
                      </span>
                      {task.testing && (
                        <span className="rounded-full bg-[#CAA25F]/15 px-2 py-0.5 text-[11px] text-[#8a6a2f] dark:text-[#e0c48a]">
                          testing
                        </span>
                      )}
                    </div>
                    <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-[#717182]">
                      {task.detail}
                    </p>
                  </div>
                ))}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
