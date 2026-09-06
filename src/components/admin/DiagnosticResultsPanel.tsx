import { useQuery } from "@tanstack/react-query";
import { diagnosticService } from "@/services/diagnosticService";
import type { DiagnosticTest } from "@/data/diagnostics";
import { BarChart3, Loader2 } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from "recharts";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-background px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">{label}</p>
      <p className="text-xl font-bold text-foreground">{value}</p>
    </div>
  );
}

/**
 * The diagnostics results the admin never had a screen for.
 *
 * The numbers are aggregated in Postgres (diagnostic_result_stats), so this
 * fetches one small summary rather than the whole results history: attempts,
 * students, overall accuracy, and average score per test with the ones students
 * struggle with at the top. Renders nothing until there are results, so it does
 * not clutter a fresh authoring page.
 *
 * `tests` gives each test its title; it comes from the page's own query, so this
 * does not fetch the catalogue twice. A slug with no matching test (a built-in,
 * or a since-deleted one) falls back to showing the slug.
 */
export function DiagnosticResultsPanel({ tests }: { tests: DiagnosticTest[] }) {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-diagnostic-stats"],
    queryFn: () => diagnosticService.getResultStats(),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center rounded-xl border border-border bg-card py-10">
        <Loader2 className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Nothing sat yet (or the call failed): say nothing rather than draw an empty chart.
  if (!stats || stats.overview.attempts === 0) return null;

  const titleOf = new Map(tests.map((t) => [t.id, t.title]));
  const { attempts, students, correct, total } = stats.overview;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
  const chartData = stats.byTest.map((s) => ({ ...s, title: titleOf.get(s.slug) ?? s.slug }));

  return (
    <div className="space-y-5 rounded-xl border border-border bg-card p-5 md:p-6">
      <div className="flex items-center gap-2">
        <BarChart3 size={16} className="text-[#1099A1]" />
        <h3 className="text-[15px] font-semibold text-foreground">Results across all students</h3>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Attempts" value={attempts} />
        <Stat label="Students assessed" value={students} />
        <Stat label="Overall accuracy" value={`${accuracy}%`} />
      </div>

      <div>
        <h4 className="mb-3 text-[13px] font-medium text-muted-foreground">Average score by test</h4>
        <div style={{ height: chartData.length * 40 + 24 }} className="w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
              <XAxis type="number" domain={[0, 100]} unit="%" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis type="category" dataKey="title" width={140} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip
                cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
                contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px" }}
                itemStyle={{ color: "hsl(var(--foreground))" }}
                formatter={(v, _n, item) => [`${v}% over ${item?.payload?.attempts ?? 0} attempt(s)`, "Avg score"]}
              />
              <Bar dataKey="avgAccuracy" radius={[0, 4, 4, 0]}>
                {chartData.map((s) => (
                  <Cell key={s.slug} fill={s.avgAccuracy >= 70 ? "#1099a1" : "#CAA25F"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
