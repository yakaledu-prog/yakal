import { useEffect, useState } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { useAuth } from "@/contexts/AuthContext";
import { diagnosticTests } from "@/data/diagnostics";
import { diagnosticService, DiagnosticResult } from "@/services/diagnosticService";
import { Button } from "@/components/ui/Button";
import { CheckCircle2, Circle, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function StudentDiagnostics() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    diagnosticService.getStudentResults(user.id).then(res => {
      setResults(res);
      setLoading(false);
    });
  }, [user]);

  const categories = Array.from(new Set(diagnosticTests.map(t => t.categoryName)));

  if (loading) {
    return (
      <PageWrapper>
        <div className="p-8 flex justify-center">Loading diagnostics...</div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <div className="max-w-[1100px] mx-auto p-6 md:p-10">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-[#111] mb-2">My Diagnostics</h1>
          <p className="text-[#555] text-lg">
            Track your diagnostic test progress and view your scores across different subjects.
          </p>
        </div>

        <div className="flex flex-col gap-10">
          {categories.map(catName => {
            const testsInCategory = diagnosticTests.filter(t => t.categoryName === catName);
            
            return (
              <div key={catName}>
                <h2 className="text-xl font-bold text-[#111] mb-4 pb-2 border-b border-[#e9edef]">
                  {catName}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {testsInCategory.map(test => {
                    const result = results.find(r => r.id === test.id);
                    const isCompleted = !!result;

                    return (
                      <div 
                        key={test.id} 
                        className={`bg-white border p-5 flex flex-col rounded-xl transition-all ${
                          isCompleted ? 'border-[#1099A1]/30 bg-[#1099A1]/5' : 'border-[#e9edef]'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-semibold text-[#111]">{test.title}</h3>
                          {isCompleted ? (
                            <CheckCircle2 size={20} className="text-[#1099A1] shrink-0" />
                          ) : (
                            <Circle size={20} className="text-[#ccc] shrink-0" />
                          )}
                        </div>
                        <p className="text-sm text-[#666] mb-4 flex-1">{test.description}</p>
                        
                        {isCompleted ? (
                          <div className="bg-white rounded-lg px-4 py-2 border border-[#1099A1]/20 inline-block self-start">
                            <span className="text-xs font-semibold text-[#888] uppercase tracking-wide block mb-0.5">Score</span>
                            <span className="text-lg font-bold text-[#1099A1]">
                              {result.score} / {result.total}
                            </span>
                          </div>
                        ) : (
                          <Button 
                            variant="outline" 
                            className="self-start text-[#1099A1] border-[#1099A1]/20 hover:bg-[#1099A1]/5 h-9 px-4 mt-auto"
                            onClick={() => navigate("/onboarding")} // Or a dedicated take-test page later
                          >
                            Take Test <ArrowRight size={14} className="ml-1.5" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </PageWrapper>
  );
}
