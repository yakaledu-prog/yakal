import { useQuery } from "@tanstack/react-query";
import { diagnosticService, DiagnosticResult } from "@/services/diagnosticService";
import type { StudentDiagnostic } from "@/services/diagnosticService";
import { overall, byCategory } from "@/services/diagnosticReport";
import { Target, Activity } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from "recharts";

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#e9edef] dark:border-[#2a3942] px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">{label}</p>
      <p className="text-xl font-bold text-[#111] dark:text-white">{value}</p>
    </div>
  );
}

// A test the student has sat shows the real score; one they have not is left
// plainly as such, so the tutor can see the gaps as well as the marks.
function TestRow({ test, result }: { test: StudentDiagnostic; result?: DiagnosticResult }) {
  return (
    <div className="flex items-center justify-between px-2 py-3 border-b border-[#e9edef] dark:border-[#2a3942] last:border-0">
      <h4 className="text-[14px] text-[#111] dark:text-white truncate pr-4">{test.title}</h4>
      {result ? (
        <div className="flex flex-col items-end w-32 shrink-0">
          <div className="flex justify-between w-full mb-1">
            <span className="text-[11px] uppercase text-muted-foreground font-semibold">Score</span>
            <span className="text-[13px] font-semibold text-[#111] dark:text-white">{result.score}/{result.total}</span>
          </div>
          <div className="h-1.5 w-full bg-[#e9edef] dark:bg-[#2a3942] rounded-full overflow-hidden">
            <div className="h-full bg-[#1099A1] rounded-full" style={{ width: `${(result.score / result.total) * 100}%` }} />
          </div>
        </div>
      ) : (
        <span className="text-[13px] text-muted-foreground italic w-32 text-right shrink-0">Not taken yet</span>
      )}
    </div>
  );
}

export function TutorStudentDiagnosticsTab({ studentId }: { studentId: string }) {
  // Which results the tutor may see is decided by RLS; this call just names the
  // student. react-query owns the loading state, so there is no setState in an
  // effect to trip the compiler rule.
  const { data: results = [], isLoading } = useQuery({
    queryKey: ["diagnostic-results", studentId],
    queryFn: () => diagnosticService.getStudentResults(studentId),
    enabled: !!studentId,
  });
  // The database, with no fallback to the file. The fallback meant a tutor
  // could be reading a list of tests an admin had already replaced.
  const { data: tests = [] } = useQuery({
    queryKey: ["student-diagnostics"],
    queryFn: () => diagnosticService.listForStudent(),
    staleTime: 5 * 60_000,
  });

  if (isLoading) {
    return <div className="p-8 flex justify-center text-muted-foreground">Loading diagnostics...</div>;
  }

  if (results.length === 0) {
    return (
      <div className="p-10 text-center">
        <Activity size={40} className="mx-auto text-[#aebac1] mb-3" />
        <h4 className="text-[16px] font-bold text-[#111] dark:text-white mb-1">No diagnostics yet</h4>
        <p className="text-[14px] text-muted-foreground">This student has not taken any diagnostics.</p>
      </div>
    );
  }

  const o = overall(results);
  const cats = byCategory(results, tests); // weakest first
  const weakest = cats[0];
  const strongest = cats[cats.length - 1];
  const categories = Array.from(new Set(tests.map((t) => t.categoryName)));

  return (
    <div className="p-5 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Overall accuracy" value={`${o.accuracy}%`} />
        <StatCard label="Tests completed" value={`${results.length} / ${tests.length}`} />
        <StatCard label="Questions answered" value={`${o.total}`} />
      </div>

      {/* Real, computed guidance in place of the old canned paragraph: where the
          student is weakest, and where they are strongest, from their answers. */}
      {weakest && (
        <div className="flex items-start gap-2.5 bg-[#1099A1]/5 border-l-2 border-[#1099A1] rounded-r-lg px-4 py-3">
          <Target size={16} className="text-[#CAA25F] mt-0.5 shrink-0" />
          {/* "The weakest at 100%" is what this said when only one category had
              been sat, which is the common case early on and reads as nonsense.
              With one category there is nothing to compare, so it says what was
              done instead of ranking it against nothing. */}
          <p className="text-[14px] text-[#444] dark:text-[#ccc] leading-relaxed">
            {cats.length < 2 ? (
              <>
                So far: <span className="font-semibold text-[#111] dark:text-white">{weakest.category}</span> at{" "}
                {weakest.accuracy}% ({weakest.correct} of {weakest.total} correct). Another subject would
                give this something to compare against.
              </>
            ) : (
              <>
                Focus area: <span className="font-semibold text-[#111] dark:text-white">{weakest.category}</span>, the
                weakest at {weakest.accuracy}% ({weakest.correct} of {weakest.total} correct).
                {strongest && strongest.category !== weakest.category && (
                  <> Strongest is <span className="font-semibold text-[#111] dark:text-white">{strongest.category}</span> at {strongest.accuracy}%.</>
                )}
              </>
            )}
          </p>
        </div>
      )}

      <div>
        <h4 className="text-[13px] font-bold uppercase tracking-widest text-primary dark:text-[#aebac1] mb-3">Accuracy by category</h4>
        <div style={{ height: cats.length * 44 + 24 }} className="w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={cats} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
              <XAxis type="number" domain={[0, 100]} unit="%" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis type="category" dataKey="category" width={120} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip
                cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
                contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px" }}
                itemStyle={{ color: "hsl(var(--foreground))" }}
                formatter={(v) => [`${v}%`, "Accuracy"]}
              />
              <Bar dataKey="accuracy" radius={[0, 4, 4, 0]}>
                {/* Teal where they are comfortable, gold where they need work. */}
                {cats.map((c) => (
                  <Cell key={c.category} fill={c.accuracy >= 70 ? "#1099a1" : "#CAA25F"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        {categories.map((catName) => {
          const testsInCategory = tests.filter((t) => t.categoryName === catName);
          if (testsInCategory.length === 0) return null;
          return (
            <div key={catName} className="mb-6 last:mb-0">
              <div className="px-2 py-2 border-b border-[#e9edef] dark:border-[#2a3942]">
                <h4 className="text-[12px] font-bold uppercase tracking-widest text-primary dark:text-[#aebac1]">{catName}</h4>
              </div>
              {testsInCategory.map((test) => (
                <TestRow key={test.id} test={test} result={results.find((r) => r.id === test.id)} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
