import { useEffect, useState } from "react";
import { diagnosticService, DiagnosticResult } from "@/services/diagnosticService";
import { diagnosticTests, DiagnosticTest } from "@/data/diagnostics";
import { Lightbulb, ChevronDown, ChevronUp } from "lucide-react";

function getAIAdvice(testId: string) {
  // Simple mocked AI advice generator based on test ID
  switch (testId) {
    case "algebra":
      return "Strong foundation in basic math concepts but struggles with algebraic problem-solving under time pressure. Focus on breaking down multi-step word problems. Avoid rushing into formulas; build intuition for linear equations first.";
    case "geometry":
      return "Good spatial reasoning. Needs more practice with formal proofs and theorem applications. Try using visual aids and real-world examples for volume calculations.";
    case "reading":
      return "Excellent reading speed. Needs to work on inferencing and identifying the main author's intent. Practice with more diverse passages, especially historical documents.";
    case "sat-math":
      return "Comfortable with most topics but struggles with pacing. Introduce timed practice sessions focusing on the no-calculator section.";
    default:
      return "The student shows a solid grasp of core concepts but would benefit from targeted practice on more advanced application questions.";
  }
}

function DiagnosticListItem({ test, result }: { test: DiagnosticTest; result?: DiagnosticResult }) {
  const isCompleted = !!result;
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="flex flex-col border-b border-[#e9edef] dark:border-[#2a3942] last:border-0 bg-transparent py-4 transition-colors hover:bg-gray-50/50 dark:hover:bg-[#182329]/50">
      <div className="flex items-center justify-between px-2">
        <div className="flex flex-col flex-1 min-w-0 pr-4 justify-center">
          <div className="flex items-center gap-2">
            <h4 className="text-[14px] text-[#111] dark:text-white truncate">
              {test.title}
            </h4>
          </div>
        </div>

        <div className="flex items-center gap-6 shrink-0">
          {isCompleted ? (
            <div className="flex flex-col items-end w-32">
              <div className="flex justify-between w-full mb-1">
                <span className="text-[11px] uppercase text-muted-foreground font-semibold">Score</span>
                <span className="text-[13px] font-semibold text-[#111] dark:text-white">{result.score}/{result.total}</span>
              </div>
              <div className="h-1.5 w-full bg-[#e9edef] dark:bg-[#2a3942] rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full"
                  style={{ width: `${(result.score / result.total) * 100}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="w-32 text-right">
              <span className="text-[13px] text-muted-foreground italic">Not taken yet</span>
            </div>
          )}

          {isCompleted && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-primary hover:bg-primary/10 p-1.5 rounded-md transition-colors flex items-center justify-center shrink-0"
              title="Toggle AI Guide"
            >
              {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>
          )}
        </div>
      </div>

      {expanded && isCompleted && (
        <div className="mt-4 mx-2 p-4 bg-[#f8f9fa] dark:bg-[#182329] border-l-2 border-primary rounded-r-lg">
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb size={16} className="text-secondary" />
            <span className="text-[13px] font-bold text-[#111] dark:text-white uppercase tracking-wider">AI Teaching Guide</span>
          </div>
          <p className="text-[14px] text-[#444] dark:text-[#ccc] leading-relaxed">
            {getAIAdvice(test.id)}
          </p>
        </div>
      )}
    </div>
  );
}

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
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 flex flex-col min-h-[500px]">
      <div className="p-0">
        {categories.map(catName => {
          const testsInCategory = diagnosticTests.filter(t => t.categoryName === catName);
          return (
            <div key={catName} className="border-b-4 mb-8 border-[#f8f9fa] dark:border-[#182329] last:border-b-0">
              <div className="px-5 py-2 bg-gray-50/50 dark:bg-[#182329]/50 border-b border-[#e9edef] dark:border-[#2a3942]">
                <h4 className="text-[12px] font-bold uppercase tracking-widest text-primary dark:text-[#aebac1]">{catName}</h4>
              </div>
              <div className="px-3">
                {testsInCategory.map(test => {
                  const result = results.find(r => r.id === test.id);
                  return <DiagnosticListItem key={test.id} test={test} result={result} />;
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
