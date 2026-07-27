import { cn } from "@/utils/cn";

/**
 * SAT and ACT planning.
 *
 * Two rows of identical pills said only "these months exist". A year strip says
 * which months offer both, which offer neither, and where you are in it now,
 * which is the thing a student is actually trying to work out.
 */

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const SAT_MONTHS = ["Aug", "Oct", "Nov", "Dec", "Mar", "May", "Jun"];
const ACT_MONTHS = ["Sep", "Oct", "Dec", "Feb", "Apr", "Jun", "Jul"];

const MILESTONES: {
  when: string;
  title: string;
  detail: string;
  tests: ("SAT" | "ACT")[];
}[] = [
  {
    when: "October, junior year",
    title: "PSAT/NMSQT",
    detail:
      "The only year it counts for National Merit. Take the PSAT 10 as a sophomore for practice.",
    tests: ["SAT"],
  },
  {
    when: "Spring, junior year",
    title: "First real sitting",
    detail:
      "March to June. Pick SAT or ACT from a diagnostic rather than sitting both, then prep for eight to twelve weeks.",
    tests: ["SAT", "ACT"],
  },
  {
    when: "Fall, senior year",
    title: "Retake, if it helps",
    detail:
      "August to October, before Early deadlines. December is the last useful sitting for Regular Decision.",
    tests: ["SAT", "ACT"],
  },
];

export function TestingPlan() {
  const currentMonth = MONTHS[new Date().getMonth()];

  return (
    <div className="space-y-8">
      <section>
        <h3 className="mb-3 text-[13px] font-medium text-[#54656f] dark:text-[#aebac1]">
          When the tests run
        </h3>

        <div className="overflow-x-auto rounded-xl border border-[#e9edef] bg-white p-4 dark:border-[#2a3942] dark:bg-[#182229]">
          <div className="grid min-w-[560px] grid-cols-12 gap-1">
            {MONTHS.map((m) => {
              const sat = SAT_MONTHS.includes(m);
              const act = ACT_MONTHS.includes(m);
              const now = m === currentMonth;

              return (
                <div key={m} className="flex flex-col items-center gap-2">
                  <span
                    className={cn(
                      "text-[12px] tabular-nums",
                      now
                        ? "font-semibold text-[#111] dark:text-white"
                        : "text-[#717182]"
                    )}
                  >
                    {m}
                  </span>

                  {/* A column with nothing in it is as informative as one with
                      both, so empty months keep their slot. */}
                  <div className="flex w-full flex-col gap-1">
                    <span
                      className={cn(
                        "h-1.5 rounded-full",
                        sat ? "bg-[#1099A1]" : "bg-[#f3f3f5] dark:bg-[#1c2a32]"
                      )}
                    />
                    <span
                      className={cn(
                        "h-1.5 rounded-full",
                        act ? "bg-[#CAA25F]" : "bg-[#f3f3f5] dark:bg-[#1c2a32]"
                      )}
                    />
                  </div>

                  {now && (
                    <span className="text-[10px] text-[#1099A1]">now</span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[#e9edef] pt-3 dark:border-[#2a3942]">
            <span className="inline-flex items-center gap-1.5 text-[12px] text-[#54656f] dark:text-[#aebac1]">
              <span className="h-1.5 w-6 rounded-full bg-[#1099A1]" />
              SAT
            </span>
            <span className="inline-flex items-center gap-1.5 text-[12px] text-[#54656f] dark:text-[#aebac1]">
              <span className="h-1.5 w-6 rounded-full bg-[#CAA25F]" />
              ACT
            </span>
            <p className="text-[12px] text-[#717182]">
              The SAT is digital now, taken in College Board's Bluebook app.
              Confirm exact dates on the official sites.
            </p>
          </div>
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-[13px] font-medium text-[#54656f] dark:text-[#aebac1]">
          Your three sittings
        </h3>

        <ol className="space-y-2">
          {MILESTONES.map((m) => (
            <li
              key={m.title}
              className="rounded-xl border border-[#e9edef] bg-white p-4 dark:border-[#2a3942] dark:bg-[#182229]"
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h4 className="text-[15px] text-[#111] dark:text-white">{m.title}</h4>
                <span className="text-[12px] text-[#717182]">{m.when}</span>
                <div className="flex-1" />
                <div className="flex gap-1">
                  {m.tests.map((t) => (
                    <span
                      key={t}
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px]",
                        t === "SAT"
                          ? "bg-[#1099A1]/10 text-[#0d757b] dark:text-[#5fc9cf]"
                          : "bg-[#CAA25F]/15 text-[#8a6a2f] dark:text-[#e0c48a]"
                      )}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-[#717182]">
                {m.detail}
              </p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
