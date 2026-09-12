import { ExternalLink } from "lucide-react";
import { cn } from "@/utils/cn";
import { College } from "@/services/collegeCatalogService";

/**
 * What a college costs families like yours, not families on average.
 *
 * The single net price figure is the most misleading number in the catalog.
 * MIT's is $20,111, which is true of nobody: a family under $30,000 is paid
 * $2,533 to attend and one over $110,000 pays $48,479. A student who rules a
 * college out on the average has been told the wrong thing by us, and that is
 * the mistake this exists to stop. The College Scorecard reports all five
 * bands and we were keeping one.
 *
 * The bar is not decoration. Five dollar amounts in a column take reading;
 * the shape of the curve is the fact, and at most colleges it is much steeper
 * than anyone expects.
 */
export function NetPriceByIncome({
  college,
  className,
}: {
  college: College;
  className?: string;
}) {
  const bands = college.netByIncome.filter((b) => b.amount !== null);
  // One band alone is a number without a comparison, which is what the average
  // already was.
  if (bands.length < 2) return null;

  // Negative net price is real: the aid exceeds the cost of attendance and the
  // college pays the difference. Scaled from zero so those read as the win they
  // are rather than an empty row.
  const top = Math.max(...bands.map((b) => b.amount as number), 0);

  return (
    <div className={cn("rounded-xl border border-border/60 p-3", className)}>
      <div className="mb-2 flex items-baseline gap-2">
        <h4 className="text-[13px] font-medium text-foreground">
          What families actually pay
        </h4>
        {college.npc && (
          <a
            href={college.npc}
            target="_blank"
            rel="noreferrer"
            className="ml-auto inline-flex shrink-0 items-center gap-1 text-[12px] font-medium text-primary hover:underline"
          >
            Your own estimate
            <ExternalLink size={11} />
          </a>
        )}
      </div>

      <dl className="space-y-1">
        {college.netByIncome.map((b) => {
          const amount = b.amount;
          const free = amount !== null && amount <= 0;
          const width = amount === null || top <= 0 ? 0 : Math.max(0, (amount / top) * 100);

          return (
            <div key={b.label} className="flex items-center gap-2.5">
              <dt className="w-[92px] shrink-0 text-[11.5px] text-muted-foreground">
                {b.label}
              </dt>
              <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                {amount !== null && (
                  // The bar is cost, so free is a short bar and not a long
                  // one. Drawn full it was the same length as the most
                  // expensive band and read as the opposite of what it means.
                  // A stub rather than nothing, so the row still has a mark.
                  <div
                    className={cn("h-full rounded-full", free ? "bg-tertiary" : "bg-primary")}
                    style={{ width: `${free ? 4 : Math.max(width, 1)}%` }}
                  />
                )}
              </div>
              <dd
                className={cn(
                  "w-[68px] shrink-0 text-right text-[12px] tabular-nums",
                  amount === null
                    ? "text-muted-foreground"
                    : free
                      ? "font-medium text-tertiary-foreground dark:text-tertiary"
                      : "text-foreground"
                )}
              >
                {amount === null
                  ? "-"
                  : free
                    ? "Free"
                    : `$${Math.round(amount).toLocaleString()}`}
              </dd>
            </div>
          );
        })}
      </dl>

      <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
        Yearly cost after grants, by family income, for students who received
        federal aid. Averages within each band, not a quote
        {college.npc ? ": the calculator gives you yours." : "."}
      </p>
    </div>
  );
}
