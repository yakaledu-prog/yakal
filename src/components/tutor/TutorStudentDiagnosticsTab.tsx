import { useEffect, useState } from "react";
import { diagnosticService, DiagnosticResult } from "@/services/diagnosticService";
import { diagnosticTests } from "@/data/diagnostics";
import { CheckCircle2, Circle, Lightbulb, BrainCircuit } from "lucide-react";

export function TutorStudentDiagnosticsTab({ studentId }: { studentId: string }) {
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    diagnosticService.getStudentResults(studentId).then(res => {
      setResults(res);
      setLoading(false);
    });
  }, [studentId]);

  const categories = Array.from(new Set(diagnosticTests.map(t => t.categoryName)));

  if (loading) {
    return <div className="p-8 flex justify-center text-muted-foreground">Loading diagnostics...</div>;
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 flex flex-col gap-8 min-h-[500px]">
      <div className="bg-[#1099A1]/5 border border-[#1099A1]/20 rounded-xl p-6">
        <div className="flex gap-3 mb-4 items-center">
          <BrainCircuit className="text-[#1099A1]" size={24} />
          <h3 className="text-lg font-bold text-[#111]">AI Teaching Guide</h3>
        </div>
        <p className="text-[#555] leading-relaxed mb-4">
          Based on the diagnostic scores, this student shows a strong foundation in basic math concepts but struggles with algebraic problem-solving under time pressure. 
        </p>
        <ul className="flex flex-col gap-2">
          <li className="flex items-start gap-2 text-sm text-[#444]">
            <Lightbulb size={16} className="text-[#CAA25F] shrink-0 mt-0.5" />
            <span>Focus on breaking down multi-step word problems.</span>
          </li>
          <li className="flex items-start gap-2 text-sm text-[#444]">
            <Lightbulb size={16} className="text-[#CAA25F] shrink-0 mt-0.5" />
            <span>Avoid rushing into formulas; build intuition for linear equations first.</span>
          </li>
        </ul>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {categories.map(catName => {
          const testsInCategory = diagnosticTests.filter(t => t.categoryName === catName);
          
          return (
            <div key={catName} className="flex flex-col gap-3">
              <h4 className="font-semibold text-[#111] border-b pb-2">{catName}</h4>
              {testsInCategory.map(test => {
                const result = results.find(r => r.id === test.id);
                const isCompleted = !!result;

                return (
                  <div key={test.id} className="bg-white border rounded-lg p-4 flex flex-col gap-2 shadow-sm">
                    <div className="flex items-start justify-between">
                      <span className="text-sm font-medium text-[#333]">{test.title}</span>
                      {isCompleted ? (
                        <CheckCircle2 size={16} className="text-[#1099A1] shrink-0" />
                      ) : (
                        <Circle size={16} className="text-muted-foreground/40 shrink-0" />
                      )}
                    </div>
                    {isCompleted ? (
                      <div className="mt-1">
                        <span className="text-[11px] uppercase tracking-wider text-muted-foreground block mb-0.5">Score</span>
                        <span className="text-lg font-bold text-[#1099A1]">{result.score} / {result.total}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground italic mt-2">Not taken yet</span>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
