import { useEffect, useState } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { Wallet, TrendingUp, CheckCircle, Coins, Info } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getTutorSessionsFull, computeEarnings, EarningsSummary } from "@/services/tutorService";

export function TutorEarnings() {
  const { user, profile } = useAuth();
  const [summary, setSummary] = useState<EarningsSummary | null>(null);
  const currency = profile?.rate_currency || "ETB";
  const rate = profile?.hourly_rate ?? 0;

  useEffect(() => {
    if (!user) return;
    getTutorSessionsFull(user.id).then((s) => setSummary(computeEarnings(s, rate)));
  }, [user, rate]);

  const money = (n: number) => `${n.toLocaleString()} ${currency}`;

  if (!summary) {
    return <PageWrapper><div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div></PageWrapper>;
  }

  const cards = [
    { label: "Total Earned", value: money(summary.total), icon: <Wallet size={18} />, cls: "bg-primary/10 text-primary" },
    { label: "This Month", value: money(summary.thisMonth), icon: <TrendingUp size={18} />, cls: "bg-green-50 dark:bg-green-900/10 text-green-600 dark:text-green-400" },
    { label: "Completed Sessions", value: String(summary.completedCount), icon: <CheckCircle size={18} />, cls: "bg-[#CAA25F]/10 text-[#CAA25F]" },
    { label: "Rate / Session", value: money(summary.avg), icon: <Coins size={18} />, cls: "bg-primary/10 text-primary" },
  ];

  return (
    <PageWrapper>
      <div className="earnings-page mx-auto w-full p-4 md:p-8 space-y-8">
        <div className="earnings-cards grid grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((c) => (
            <div key={c.label} className="stat-card rounded-xl border bg-card dark:bg-[#182329] shadow-sm p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] text-muted-foreground truncate">{c.label}</p>
                  <p className="text-2xl font-bold mt-1.5 leading-none truncate">{c.value}</p>
                </div>
                <div className={`shrink-0 p-2.5 rounded-xl ${c.cls}`}>{c.icon}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="earnings-note flex items-start gap-2.5 rounded-xl border border-[#CAA25F]/40 bg-[#CAA25F]/10 px-4 py-3 text-[13px] text-[#8a6d34] dark:text-[#e0c48a]">
          <Info size={16} className="mt-0.5 shrink-0" />
          <span>Earnings are estimated from your completed sessions at your current rate of {money(rate)}. Payments are settled separately.</span>
        </div>

        <div className="earnings-months rounded-2xl border bg-card dark:bg-[#182329] shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-[#e9edef] dark:border-[#2a3942]">
            <h2 className="text-[15px] font-bold text-[#111] dark:text-white">Monthly breakdown</h2>
          </div>
          {summary.months.length === 0 ? (
            <p className="text-center text-[14px] text-[#54656f] dark:text-[#aebac1] py-12">No completed sessions yet.</p>
          ) : (
            <table className="w-full text-[14px]">
              <thead>
                <tr className="text-left text-[12px] uppercase tracking-wide text-muted-foreground border-b border-[#e9edef] dark:border-[#2a3942]">
                  <th className="px-6 py-3 font-medium">Month</th>
                  <th className="px-6 py-3 font-medium text-center">Sessions</th>
                  <th className="px-6 py-3 font-medium text-right">Earned</th>
                </tr>
              </thead>
              <tbody>
                {summary.months.map((m) => (
                  <tr key={m.key} className="border-b border-[#e9edef] dark:border-[#2a3942] last:border-0">
                    <td className="px-6 py-3.5 font-medium text-[#111] dark:text-white">{m.label}</td>
                    <td className="px-6 py-3.5 text-center text-muted-foreground">{m.count}</td>
                    <td className="px-6 py-3.5 text-right font-semibold text-[#111] dark:text-white">{money(m.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </PageWrapper>
  );
}
