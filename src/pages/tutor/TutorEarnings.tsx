import { useEffect, useState } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { cn } from "@/utils/cn";
import { Info, TrendingUp, TrendingDown, Database } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, PieChart, Pie,
} from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { getTutorSessionsFull, computeEarnings, EarningsSummary } from "@/services/tutorService";

// Brand-only palette (teal + gold + supporting warm/greens, no blue/purple).
const PALETTE = ["#1099A1", "#CAA25F", "#97CE9D", "#0d848b", "#d98f5a", "#7d8f69", "#b06f9a", "#c98a2b"];

export function TutorEarnings() {
  const { user, profile } = useAuth();
  const [summary, setSummary] = useState<EarningsSummary | null>(null);
  const currency = profile?.rate_currency || "ETB";
  const rate = profile?.hourly_rate ?? 0;
  const money = (n: number) => `${n.toLocaleString()} ${currency}`;

  useEffect(() => {
    if (!user) return;
    getTutorSessionsFull(user.id).then((s) => setSummary(computeEarnings(s, rate)));
  }, [user, rate]);

  if (!summary) {
    return <PageWrapper><div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div></PageWrapper>;
  }

  const barData = [...summary.months].reverse().slice(-8); // chronological, last 8 months
  const thisKey = new Date().toISOString().slice(0, 7);
  const up = (summary.momChangePct ?? 0) >= 0;

  return (
    <PageWrapper>
      <div className="earnings-page mx-auto w-full p-4 md:p-8 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Overview + monthly chart */}
          <div className="earnings-overview lg:col-span-2 rounded-2xl border bg-card dark:bg-[#182329] shadow-sm p-6">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
              <div>
                <h2 className="text-[15px] font-semibold text-muted-foreground mb-1">Total Earnings</h2>
                <div className="flex items-center gap-3">
                  <span className="text-4xl font-bold text-[#111] dark:text-white">{money(summary.total)}</span>
                  {summary.momChangePct !== null && (
                    <span className={cn("inline-flex items-center gap-1 text-[13px] font-semibold px-2 py-1 rounded-full",
                      up ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-600 dark:bg-red-900/20")}>
                      {up ? <TrendingUp size={13} /> : <TrendingDown size={13} />} {Math.abs(summary.momChangePct)}%
                    </span>
                  )}
                </div>
                <p className="text-[13px] text-muted-foreground mt-1">
                  {money(summary.thisMonth)} this month · {summary.completedCount} sessions at {money(rate)}
                </p>
              </div>
              <div className="flex gap-4 text-right">
                <div>
                  <p className="text-[12px] text-muted-foreground">This month</p>
                  <p className="text-lg font-bold">{money(summary.thisMonth)}</p>
                </div>
                <div>
                  <p className="text-[12px] text-muted-foreground">Last month</p>
                  <p className="text-lg font-bold">{money(summary.lastMonth)}</p>
                </div>
              </div>
            </div>

            <div className="earnings-chart h-[260px] w-full">
              {barData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-[14px] text-muted-foreground">No earnings to chart yet.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="shortLabel" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} dy={8} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)} />
                    <Tooltip
                      cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }}
                      contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px" }}
                      formatter={(v: any) => [money(Number(v)), "Earned"]}
                    />
                    <Bar dataKey="amount" radius={[6, 6, 0, 0]} maxBarSize={44}>
                      {barData.map((m) => <Cell key={m.key} fill={m.key === thisKey ? "#CAA25F" : "#1099A1"} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* By subject donut */}
          <div className="earnings-bysubject rounded-2xl border bg-card dark:bg-[#182329] shadow-sm p-6">
            <h3 className="text-[15px] font-bold text-[#111] dark:text-white mb-4">Earnings by subject</h3>
            {summary.bySubject.length === 0 ? (
              <div className="h-[180px] flex items-center justify-center text-[14px] text-muted-foreground">No data yet.</div>
            ) : (
              <>
                <div className="relative h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={summary.bySubject} dataKey="amount" nameKey="subject" cx="50%" cy="50%" innerRadius={62} outerRadius={90} paddingAngle={2} stroke="none">
                        {summary.bySubject.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[12px] text-muted-foreground">Total</span>
                    <span className="text-lg font-bold">{money(summary.total)}</span>
                  </div>
                </div>
                <div className="space-y-2 mt-4">
                  {summary.bySubject.map((s, i) => (
                    <div key={s.subject} className="flex items-center justify-between text-[13px]">
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PALETTE[i % PALETTE.length] }} />
                        <span className="truncate text-[#111] dark:text-white">{s.subject}</span>
                      </span>
                      <span className="font-semibold shrink-0">{money(s.amount)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Recent earnings activity */}
        <div className="earnings-activity rounded-2xl border bg-card dark:bg-[#182329] shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-[#e9edef] dark:border-[#2a3942] flex items-center justify-between">
            <h2 className="text-[15px] font-bold text-[#111] dark:text-white">Recent earnings</h2>
            <span className="text-[13px] text-muted-foreground">{summary.activity.length} entries</span>
          </div>
          {summary.activity.length === 0 ? (
            <p className="text-center text-[14px] text-muted-foreground py-12">No completed sessions yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[14px] min-w-[560px]">
                <thead>
                  <tr className="text-left text-[12px] uppercase tracking-wide text-muted-foreground border-b border-[#e9edef] dark:border-[#2a3942]">
                    <th className="px-6 py-3 font-medium">Date</th>
                    <th className="px-6 py-3 font-medium">Activity</th>
                    <th className="px-6 py-3 font-medium">Subject</th>
                    <th className="px-6 py-3 font-medium">Student</th>
                    <th className="px-6 py-3 font-medium text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.activity.slice(0, 20).map((a) => (
                    <tr key={a.id} className="border-b border-[#e9edef] dark:border-[#2a3942] last:border-0">
                      <td className="px-6 py-3.5 text-muted-foreground whitespace-nowrap">{new Date(a.date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</td>
                      <td className="px-6 py-3.5">
                        <span className="inline-flex items-center gap-1.5 text-[#111] dark:text-white"><Database size={14} className="text-primary" /> Earning</span>
                      </td>
                      <td className="px-6 py-3.5 text-[#111] dark:text-white">{a.subject}</td>
                      <td className="px-6 py-3.5 text-muted-foreground">{a.student}</td>
                      <td className="px-6 py-3.5 text-right font-semibold text-green-600 dark:text-green-400 whitespace-nowrap">+{money(a.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="earnings-note flex items-start gap-2.5 rounded-xl border border-[#CAA25F]/40 bg-[#CAA25F]/10 px-4 py-3 text-[13px] text-[#8a6d34] dark:text-[#e0c48a]">
          <Info size={16} className="mt-0.5 shrink-0" />
          <span>Earnings are estimated from your completed sessions at your current rate of {money(rate)}. Payments are settled separately.</span>
        </div>
      </div>
    </PageWrapper>
  );
}
