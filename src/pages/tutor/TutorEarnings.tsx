import { useEffect, useState } from "react";
import { Info, TrendingDown, TrendingUp } from "lucide-react";

import { PayoutHistory } from "@/components/shared/PayoutHistory";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { cn } from "@/utils/cn";
import { useAuth } from "@/contexts/AuthContext";
import { money as usd } from "@/services/billingService";
import { computeEarnings, getTutorSessionsFull, type EarningsSummary } from "@/services/tutorService";

// ============================================================
// What a tutor has earned, and what has actually been paid.
//
// The charts are gone. A bar chart of eight months is empty for most of a
// tutor's first year here, and the version before this one filled the gaps
// with invented figures to keep it looking full, which is worse than an empty
// chart: it showed people money they had never earned. A table of months is
// honest when there is one row and still readable when there are thirty.
//
// Earnings and payments are deliberately two sections. What the sessions came
// to and what has reached a bank account are different questions, and running
// them together is how a tutor ends up unsure whether they have been paid.
// ============================================================

function MonthRow({
  label,
  count,
  amount,
  isCurrent,
}: {
  label: string;
  count: number;
  amount: number;
  isCurrent: boolean;
}) {
  return (
    <tr className="border-b border-border last:border-0">
      <td className="py-3 pr-4">
        <span className={cn("text-[14px]", isCurrent ? "font-semibold text-[#1099A1]" : "text-foreground")}>
          {label}
        </span>
        {isCurrent && <span className="ml-2 text-[12px] text-muted-foreground">so far</span>}
      </td>
      <td className="py-3 pr-4 text-right text-[13.5px] tabular-nums text-muted-foreground">
        {count === 0 ? "-" : count}
      </td>
      <td className="py-3 text-right text-[14px] font-medium tabular-nums text-foreground">
        {usd(amount * 100)}
      </td>
    </tr>
  );
}

export function TutorEarnings() {
  const { user, profile } = useAuth();
  const [summary, setSummary] = useState<EarningsSummary | null>(null);
  const rate = profile?.hourly_rate ?? 0;

  useEffect(() => {
    if (!user) return;
    getTutorSessionsFull(user.id).then((s) => setSummary(computeEarnings(s, rate)));
  }, [user, rate]);

  if (!summary) {
    return (
      <PageWrapper>
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      </PageWrapper>
    );
  }

  const now = new Date();
  const thisKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const up = (summary.momChangePct ?? 0) >= 0;

  // Only months that actually happened. No padding, and nothing invented for
  // the ones that did not.
  const months = summary.months.filter((m) => m.count > 0 || m.key === thisKey);

  return (
    <PageWrapper>
      <div className="min-h-screen flex-1 bg-background pb-12 dark:bg-[#111b21]">
        <header className="relative overflow-hidden bg-[#1099A1] px-6 pt-6 text-white md:px-10 md:pt-10">
          <svg
            className="pointer-events-none absolute right-0 top-0 h-full w-[60%] text-white/5 md:w-[40%]"
            viewBox="0 0 400 200"
            preserveAspectRatio="none"
            fill="none"
            aria-hidden="true"
          >
            <path d="M 0 200 Q 100 50, 200 120 T 400 0 L 400 200 Z" fill="currentColor" />
          </svg>

          <div className="relative z-10 mx-auto flex max-w-[1440px] flex-col justify-between gap-6 border-b border-white/20 pb-8 md:flex-row md:items-end">
            <div className="space-y-1">
              <h1 className="mb-2 text-[14px] font-medium uppercase tracking-wider text-white/80">
                Total earned
              </h1>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-4xl font-bold tracking-tight md:text-5xl">
                  {usd(summary.total * 100)}
                </span>
                {summary.momChangePct !== null && (
                  <span className="inline-flex items-center gap-1 text-[13px] font-medium text-white/80">
                    {up ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                    {Math.abs(summary.momChangePct)}% on last month
                  </span>
                )}
              </div>
              <p className="pt-1 text-[14px] text-white/70">
                {summary.completedCount} completed{" "}
                {summary.completedCount === 1 ? "session" : "sessions"}
                {rate > 0 && ` at ${usd(rate * 100)} an hour`}
              </p>
            </div>

            <div className="flex items-center gap-8 pb-2 md:gap-12">
              <div className="text-left md:text-right">
                <p className="mb-0.5 text-[12px] font-medium uppercase tracking-wider text-white/70">
                  This month
                </p>
                <p className="text-2xl font-bold">{usd(summary.thisMonth * 100)}</p>
              </div>
              <div className="text-left md:text-right">
                <p className="mb-0.5 text-[12px] font-medium uppercase tracking-wider text-white/70">
                  Last month
                </p>
                <p className="text-2xl font-bold opacity-80">{usd(summary.lastMonth * 100)}</p>
              </div>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-[1440px] space-y-12 p-6 md:p-10">
          <section className="space-y-4">
            <h2 className="border-b border-border/50 pb-3 text-[18px] font-semibold text-foreground">
              By month
            </h2>
            {months.length === 0 ? (
              <p className="py-10 text-[14px] text-muted-foreground">
                Nothing yet. A month appears here once you have completed a session in it.
              </p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="pb-2 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Month
                    </th>
                    <th className="pb-2 text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Sessions
                    </th>
                    <th className="pb-2 text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Earned
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {months.map((m) => (
                    <MonthRow
                      key={m.key}
                      label={m.label}
                      count={m.count}
                      amount={m.amount}
                      isCurrent={m.key === thisKey}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {/* What the sessions came to is one question. What has reached a bank
              account is another, and it was previously unanswerable here. */}
          {user && <PayoutHistory tutorId={user.id} />}

          <div className="flex items-start gap-2.5 rounded-lg bg-muted/30 px-4 py-3 text-[13px] text-muted-foreground">
            <Info size={16} className="mt-0.5 shrink-0 text-[#1099A1]" />
            <span>
              Earnings are worked out from your completed sessions at your current rate. What has
              actually been paid, and how, is listed above.
            </span>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
