import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { diagnosticService, DiagnosticResult } from "@/services/diagnosticService";
import { diagnosticTests, DiagnosticTest } from "@/data/diagnostics";
import { Search, Loader2, Activity, CheckCircle2, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/utils/cn";
import { useMasterDetail } from "@/hooks/useMasterDetail";
import { toast } from "sonner";
import { useSetBreadcrumb } from "@/contexts/BreadcrumbContext";

function MinimalStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col items-center">
      <p className="text-white/70 text-[11px] font-medium uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-xl font-bold leading-none">{value}</p>
    </div>
  );
}

function TabButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn("pb-3 px-1 text-[14px] font-medium transition-colors border-b-2 relative top-[1px] whitespace-nowrap outline-none",
        active ? "text-white border-white" : "text-white/60 border-transparent hover:text-white/90 hover:border-white/30")}
    >
      {label}
    </button>
  );
}

export function StudentDiagnostics() {
  // One column at a time on a phone, both on a desktop.
  const { openDetail, closeDetail, listClass, detailClass } = useMasterDetail();
  const { user } = useAuth();
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterText, setFilterText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // For taking a test inline
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!user) return;
    diagnosticService.getStudentResults(user.id).then(res => {
      setResults(res);
      setLoading(false);
    });
  }, [user]);

  const categories = useMemo(() => Array.from(new Set(diagnosticTests.map(t => t.categoryName))), []);
  const filteredCategories = useMemo(
    () => categories.filter((c) => c.toLowerCase().includes(filterText.toLowerCase())),
    [categories, filterText]
  );

  const [selectedCategory, setSelectedCategory] = useState<string>(categories[0] || "");
  const categoryTests = useMemo(() => diagnosticTests.filter(t => t.categoryName === selectedCategory), [selectedCategory]);

  const [activeTabId, setActiveTabId] = useState<string>("");

  useEffect(() => {
    if (categoryTests.length > 0 && !categoryTests.some(t => t.id === activeTabId)) {
      setActiveTabId(categoryTests[0].id);
      setCurrentQuestionIndex(0);
      setAnswers({});
    }
  }, [categoryTests, activeTabId]);

  const activeTest = categoryTests.find(t => t.id === activeTabId);
  const activeTestResult = results.find(r => r.id === activeTabId);

  useSetBreadcrumb(selectedCategory, "Diagnostics");

  const submitTest = async () => {
    if (!user || !activeTest) return;

    setSubmitting(true);
    let correct = 0;
    activeTest.questions.forEach((q) => {
      if (answers[q.id] === q.correctAnswer) correct++;
    });

    await diagnosticService.saveResult(user.id, activeTest.id, correct, activeTest.questions.length);

    // Refresh results
    const newResults = await diagnosticService.getStudentResults(user.id);
    setResults(newResults);

    toast.success(`You scored ${correct} out of ${activeTest.questions.length}!`);
    setCurrentQuestionIndex(0);
    setAnswers({});
    setSubmitting(false);
  };

  const totalTestsInCategory = categoryTests.length;
  const completedInCategory = categoryTests.filter(t => results.some(r => r.id === t.id)).length;

  return (
    <div className="flex flex-col md:flex-row h-full min-h-0 overflow-y-auto md:overflow-hidden bg-background">
      {/* Left pane */}
      <aside
        className={cn(
          "w-full md:w-[300px] md:shrink-0 flex-col border-b md:border-b-0 md:border-r border-[#e9edef] dark:border-[#2a3942] md:h-full",
          listClass
        )}
      >
        {/* Search bar */}
        <div className="px-3 pt-5 pb-2 border-b border-[#e9edef] dark:border-[#2a3942] bg-white dark:bg-[#111b21]">
          <div className="flex items-center gap-2 border-b-2 border-transparent group focus-within:border-[#1099A1] px-2 py-2 transition ease-in-out">
            <Search size={18} className="text-[#697780] group-focus-within:text-[#1099A1] shrink-0" />
            <input
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Search subjects"
              className="bg-transparent text-[14px] text-[#111] dark:text-white placeholder:text-[#8696a0] flex-1 outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="animate-spin text-primary" /></div>
          ) : (
            <>
              {filteredCategories.map((c) => {
                const active = c === selectedCategory;
                const cTests = diagnosticTests.filter(t => t.categoryName === c);
                const cCompleted = cTests.filter(t => results.some(r => r.id === t.id)).length;

                return (
                  <button key={c} onClick={() => { setSelectedCategory(c); openDetail(); }}
                    className={cn("w-full flex items-center gap-3 p-4 text-left border-l-2 transition-colors",
                      active ? "bg-primary/5 border-l-primary" : "border-l-transparent hover:bg-[#f8f9fa] dark:hover:bg-[#182329]")}>
                    <div className="min-w-0">
                      <p className={cn("text-[14px] font-semibold truncate", active ? "text-primary" : "text-[#111] dark:text-white")}>{c}</p>
                      <p className="text-[12px] text-muted-foreground truncate">{cCompleted} / {cTests.length} completed</p>
                    </div>
                  </button>
                );
              })}
            </>
          )}
        </div>
      </aside>

      {/* Right pane */}
      <section
        className={cn(
          "flex-1 min-w-0 min-h-0 md:h-full overflow-y-auto flex-col",
          detailClass
        )}
      >
        {/* Integrated Header */}
        <div className="bg-[#1099A1] text-white pt-6 px-6 md:pt-8 md:px-8 relative overflow-hidden shrink-0">
          <svg className="absolute right-0 top-0 h-full w-[60%] md:w-[40%] text-white/5 pointer-events-none" viewBox="0 0 400 200" preserveAspectRatio="none" fill="none">
            <path d="M 0 200 Q 100 50, 200 120 T 400 0 L 400 200 Z" fill="currentColor" />
            <path d="M 0 200 L 100 80 L 200 150 L 300 40 L 400 100 L 400 200 Z" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.3" />
            <circle cx="100" cy="80" r="4" fill="currentColor" opacity="0.5" />
            <circle cx="200" cy="150" r="4" fill="currentColor" opacity="0.5" />
            <circle cx="300" cy="40" r="4" fill="currentColor" opacity="0.5" />
          </svg>

          <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
            <div className="flex items-center gap-3 min-w-0">
              {/* Only the phone needs this: on desktop the list is still
                  beside the record. */}
              <button
                type="button"
                onClick={closeDetail}
                aria-label="Back"
                className="-ml-2 shrink-0 rounded-full p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white md:hidden"
              >
                <ChevronLeft size={22} />
              </button>
              <div className="min-w-0">
                <h1 className="text-xl md:text-2xl font-bold tracking-tight truncate">{selectedCategory}</h1>
                <div className="flex flex-wrap items-center gap-4 text-white/80 text-[13px] mt-1">
                  <span className="flex items-center gap-1.5"><Activity size={13} /> {totalTestsInCategory} Tests</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 xl:gap-10 border-t border-white/20 xl:border-t-0 pt-4 xl:pt-0 flex-1 justify-end">
              <div className="flex items-center justify-between xl:justify-end gap-6 sm:gap-12 w-full sm:w-auto">
                <MinimalStat label="Total" value={totalTestsInCategory} />
                <MinimalStat label="Completed" value={completedInCategory} />
                <MinimalStat label="Remaining" value={totalTestsInCategory - completedInCategory} />
              </div>
            </div>
          </div>

          <div className="relative z-10 flex items-center gap-6 mt-8 border-b border-white/20 overflow-x-auto [scrollbar-width:none]">
            {categoryTests.map((t) => (
              <TabButton
                key={t.id}
                active={activeTabId === t.id}
                onClick={() => {
                  setActiveTabId(t.id);
                  setCurrentQuestionIndex(0);
                  setAnswers({});
                }}
                label={t.title}
              />
            ))}
          </div>
        </div>

        <div className="p-4 md:p-8 w-full flex-1">
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="animate-spin text-primary h-8 w-8" />
            </div>
          ) : !activeTest ? (
            <div className="text-center py-16 border border-[#e9edef] dark:border-[#2a3942] rounded-md">
              <Activity size={48} className="mx-auto text-[#aebac1] mb-4" />
              <h3 className="text-[18px] font-bold text-[#111] dark:text-white mb-2">No tests</h3>
              <p className="text-[#54656f] dark:text-[#aebac1] text-[14px]">No diagnostics available in this category.</p>
            </div>
          ) : activeTestResult ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="bg-white dark:bg-[#111b21] border border-[#e9edef] dark:border-[#2a3942] rounded-lg overflow-hidden flex flex-col">
                <div className="bg-[#1099A1]/5 px-6 py-8 border-b border-[#e9edef] dark:border-[#2a3942] flex flex-col items-center text-center">
                  <CheckCircle2 size={48} className="text-[#1099A1] mb-4" />
                  <h3 className="text-xl font-bold text-[#111] dark:text-white mb-1">Test Completed</h3>
                  <p className="text-muted-foreground text-sm max-w-md">You have completed the {activeTest.title} diagnostic test. Your tutor has been notified of your result.</p>
                </div>
                <div className="px-6 py-6 flex items-center justify-center">
                  <div className="bg-[#1099A1]/10 rounded-xl px-8 py-5 border border-[#1099A1]/20 flex flex-col items-center">
                    <span className="text-sm font-semibold text-[#888] uppercase tracking-wide block mb-2">Score</span>
                    <span className="text-3xl font-bold text-[#1099A1]">
                      {activeTestResult.score} / {activeTestResult.total}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300 max-w-3xl">
              <div className="bg-white dark:bg-[#111b21] border border-[#e9edef] dark:border-[#2a3942] rounded-lg overflow-hidden">
                <div className="px-6 py-5 border-b border-[#e9edef] dark:border-[#2a3942] flex items-center justify-between bg-[#f8f9fa] dark:bg-[#182329]">
                  <div className="flex items-center justify-between w-full">
                    <h3 className="text-base font-bold text-[#111] dark:text-white">{activeTest.title} Diagnostic</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">Question {currentQuestionIndex + 1} of {activeTest.questions.length}</p>
                  </div>
                </div>

                <div className="p-6">
                  {(() => {
                    const q = activeTest.questions[currentQuestionIndex];
                    if (!q) return null;
                    const isLast = currentQuestionIndex === activeTest.questions.length - 1;
                    return (
                      <>
                        <h3 className="text-[16px] md:text-lg font-semibold mb-6 text-[#111] dark:text-white">{q.text}</h3>
                        <div className="flex flex-col gap-3 mb-8">
                          {q.options.map((opt, i) => (
                            <button
                              key={i}
                              onClick={() => setAnswers({ ...answers, [q.id]: i })}
                              className={`w-full text-left px-5 py-4 rounded-xl border-2 transition-all ${answers[q.id] === i
                                ? 'border-[#1099A1] bg-[#1099A1]/5'
                                : 'border-[#e9edef] hover:border-[#1099A1]/30 hover:bg-gray-50'
                                }`}
                            >
                              <span className="text-sm font-medium">{opt}</span>
                            </button>
                          ))}
                        </div>

                        <div className="flex justify-between mt-8 pt-6 border-t border-[#e9edef] dark:border-[#2a3942]">
                          <Button
                            variant="outline"
                            disabled={currentQuestionIndex === 0}
                            onClick={() => setCurrentQuestionIndex(i => i - 1)}
                          >
                            Previous
                          </Button>
                          {isLast ? (
                            <Button
                              className="bg-[#1099A1] hover:bg-[#0d848b]"
                              disabled={answers[q.id] === undefined || submitting}
                              onClick={submitTest}
                            >
                              {submitting ? "Submitting..." : "Submit Test"}
                            </Button>
                          ) : (
                            <Button
                              className="bg-[#1099A1] hover:bg-[#0d848b]"
                              disabled={answers[q.id] === undefined}
                              onClick={() => setCurrentQuestionIndex(i => i + 1)}
                            >
                              Next Question
                            </Button>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
