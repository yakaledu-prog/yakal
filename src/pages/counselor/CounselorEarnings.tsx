import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { cn } from "@/utils/cn";
import { Info, TrendingUp, TrendingDown, Database } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { money } from "@/services/billingService";
import { getEarnings, summariseEarnings, type EarningRow } from "@/services/payoutService";
import { PayoutHistory } from "@/components/shared/PayoutHistory";

// ============================================================
// What a counsellor has earned.
//
// From the earnings ledger, which is the only thing that knows. This page used
// to multiply completed sessions by the hourly_rate on the counsellor's own
// profile and label the result ETB, which was wrong three times over: a
// counsellor is paid a percentage of the tier, not an hour; the rate is the
// admin's to set and was being read from a field the counsellor could edit; and
// every other figure on the platform is in USD.
//
// It also invented amounts for empty historical months so the chart would look
// fuller. In a financial view that is not decoration, it is a wrong number in
// front of the person whose income it is.
// ============================================================



// Custom tooltip, recharts' default uses inline styles that ignore CSS vars and
// break in dark mode; a component with our classes renders correctly in both.
function ChartTooltip({ active, payload, label, money }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[#e9edef] dark:border-[#2a3942] bg-white dark:bg-[#202c33] shadow-md px-3 py-2 text-[13px]">
      <p className="font-semibold text-[#111] dark:text-white mb-0.5">{label}</p>
      <p className="text-muted-foreground">
        Earned: <span className="font-semibold text-[#111] dark:text-white">{money(Number(payload[0].value))}</span>
      </p>
    </div>
  );
}

export function CounselorEarnings() {
  const { user } = useAuth();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["counselor-earnings", user?.id],
    queryFn: () => getEarnings(user!.id),
    enabled: !!user?.id,
  });

  const summary = useMemo(() => summariseEarnings(rows), [rows]);

  if (isLoading) {
    return <PageWrapper><div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div></PageWrapper>;
  }

  const now = new Date();
  const thisKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const up = (summary.momChangePct ?? 0) >= 0;

  // Only months that happened. Filling the empty ones so the chart looks
  // fuller would be inventing somebody's income.
  const barData = summary.months.slice(-8).map((m) => ({ ...m, amount: m.amountCents / 100 }));

  return (
    <PageWrapper>
      <div className="flex-1 min-h-screen bg-background dark:bg-[#111b21] pb-12">
        {/* Massive Integrated Header */}
        <div className="bg-primary text-white pt-6 md:pt-10 px-6 md:px-10 pb-0 md:pb-0 relative overflow-hidden shrink-0">
          {/* Subtle Background Texture/Graph */}
          <svg className="absolute right-0 top-0 h-full w-[60%] md:w-[40%] text-white/5 pointer-events-none" viewBox="0 0 400 200" preserveAspectRatio="none" fill="none">
            <path d="M 0 200 Q 100 50, 200 120 T 400 0 L 400 200 Z" fill="currentColor" />
            <path d="M 0 200 L 100 80 L 200 150 L 300 40 L 400 100 L 400 200 Z" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.3" />
            <circle cx="100" cy="80" r="4" fill="currentColor" opacity="0.5" />
            <circle cx="200" cy="150" r="4" fill="currentColor" opacity="0.5" />
            <circle cx="300" cy="40" r="4" fill="currentColor" opacity="0.5" />
          </svg>

          <div className="relative z-10 max-w-[1440px] mx-auto flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/20 pb-8">
            <div className="space-y-1">
              <h1 className="text-white/80 text-[14px] font-medium uppercase tracking-wider mb-2">Total Earnings</h1>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-4xl md:text-5xl font-bold tracking-tight">{money(summary.totalCents)}</span>
                {summary.momChangePct !== null && (
                  <span className={cn("inline-flex items-center gap-1 text-[13px] font-semibold px-2.5 py-1 rounded-full",
                    up ? "bg-white/20 text-white" : "bg-red-500/20 text-white")}>
                    {up ? <TrendingUp size={14} /> : <TrendingDown size={14} />} {Math.abs(summary.momChangePct)}%
                  </span>
                )}
              </div>
              <p className="text-white/70 text-[14px] pt-1">
                {money(summary.settledCents)} paid, {money(summary.owedCents)} still owed
              </p>
            </div>

            <div className="flex items-center gap-8 md:gap-12 pb-2">
              <div className="text-left md:text-right">
                <p className="text-white/70 text-[12px] font-medium uppercase tracking-wider mb-0.5">This Month</p>
                <p className="text-2xl font-bold">{money(summary.thisMonthCents)}</p>
              </div>
              <div className="text-left md:text-right">
                <p className="text-white/70 text-[12px] font-medium uppercase tracking-wider mb-0.5">Last Month</p>
                <p className="text-2xl font-bold opacity-80">{money(summary.lastMonthCents)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Content Below Banner */}
        <div className="max-w-[1440px] mx-auto p-6 md:p-10 space-y-12">
          
          {/* Bar Chart */}
          <div className="space-y-4">
            <h3 className="text-[18px] font-semibold text-foreground border-b border-border/50 pb-3">Monthly Trends</h3>
            <div className="h-[280px] w-full pt-4">
              {barData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-[14px] text-muted-foreground">No earnings to chart yet.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} vertical={false} />
                    <XAxis dataKey="shortLabel" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)} />
                    <Tooltip cursor={{ fill: "hsl(var(--muted))", fillOpacity: 0.4 }} content={<ChartTooltip money={money} />} />
                    <Bar dataKey="amount" radius={[4, 4, 0, 0]} maxBarSize={32}>
                      {barData.map((m) => <Cell key={m.key} fill={m.key === thisKey ? "#CAA25F" : "#1099A1"} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Recent earnings list */}
          <div className="pt-8 space-y-4">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <h3 className="text-[18px] font-semibold text-foreground">Recent Activity</h3>
              <span className="text-[13px] text-muted-foreground">{rows.length} entries</span>
            </div>
            
            {rows.length === 0 ? (
              <p className="text-center text-[14px] text-muted-foreground py-12">Nothing yet. A month appears here once it has been paid for.</p>
            ) : (
              <div className="space-y-0">
                {rows.slice(0, 20).map((a: EarningRow) => (
                  <div key={a.id} className="flex items-center justify-between py-4 border-b border-border/40 last:border-0 hover:bg-muted/10 transition-colors px-2 -mx-2 rounded-lg cursor-default">
                    <div className="flex items-center gap-6 min-w-0">
                      <div className="hidden sm:flex shrink-0 w-10 h-10 rounded-full bg-primary/10 items-center justify-center text-primary">
                        <Database size={18} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-[15px] text-foreground truncate">{a.subject}</p>
                        <p className="text-[13px] text-muted-foreground mt-0.5">
                          {a.date ? new Date(a.date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : ""}
                          {a.studentName ? ` · ${a.studentName}` : ""}
                          {a.status === "settled" ? " · paid" : a.status === "pending" ? " · owed" : ` · ${a.status}`}
                        </p>
                      </div>
                    </div>
                    <span className="text-[15px] font-bold text-primary whitespace-nowrap tabular-nums">{money(a.amountCents, a.currency)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Connecting a bank, and every payment with the reference to check
              it against. The same component the tutor's page uses, because it
              is the same question. */}
          {user && (
            <div className="pt-8">
              <PayoutHistory tutorId={user.id} />
            </div>
          )}

          <div className="mt-8 flex items-start gap-2.5 bg-muted/30 px-4 py-3 rounded-lg text-[13px] text-muted-foreground">
            <Info size={16} className="mt-0.5 shrink-0 text-primary" />
            <span>
              You earn a share of each month a family pays for, set by Yakal on the plan they are
              on. A month is held briefly before it is paid out, so recently earned money shows as
              owed rather than paid.
            </span>
          </div>

        </div>
      </div>
    </PageWrapper>
  );
}
