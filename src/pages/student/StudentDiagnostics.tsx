import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { diagnosticService, DiagnosticResult } from "@/services/diagnosticService";
import type { StudentDiagnosticQuestion as DiagnosticQuestion } from "@/services/diagnosticService";
import { useQuery } from "@tanstack/react-query";
import { Search, Loader2, Activity, CheckCircle2, ChevronLeft, Check, X, Lightbulb, RotateCcw, TrendingUp } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
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

// One question, after the fact: what the student picked, what was right, and
// why. Defined at module scope, not inside the page, so it is a stable
// component type and its subtree is not remounted on every render.
function QuestionReview({
  index,
  question,
  chosen,
  correct,
  explanation,
}: {
  index: number;
  question: DiagnosticQuestion;
  chosen: number;
  /** From the stored result, not the diagnostic: the browser no longer has the key. */
  correct: number;
  explanation?: string | null;
}) {
  const isCorrect = chosen === correct;

  return (
    <div className="border border-[#e9edef] dark:border-[#2a3942] rounded-lg overflow-hidden">
      <div className="px-5 py-4">
        <div className="flex items-start gap-3">
          <span className="shrink-0 w-6 h-6 rounded-full bg-[#f0f2f5] dark:bg-[#182329] text-[#54656f] dark:text-[#aebac1] text-[12px] font-bold flex items-center justify-center mt-0.5">
            {index + 1}
          </span>
          <div className="min-w-0 flex-1">
            {/* Colour lives on the icon and the option rows below; the status
                word stays in the neutral text colour so it always reads. */}
            <div className="flex items-center gap-1.5 mb-2">
              {isCorrect ? (
                <>
                  <Check size={15} className="text-[#97CE9D]" />
                  <span className="text-[12px] font-semibold uppercase tracking-wide text-[#111] dark:text-white">Correct</span>
                </>
              ) : (
                <>
                  <X size={15} className="text-[#CAA25F]" />
                  <span className="text-[12px] font-semibold uppercase tracking-wide text-[#111] dark:text-white">Incorrect</span>
                </>
              )}
            </div>

            <p className="text-[15px] font-medium text-[#111] dark:text-white mb-3">{question.text}</p>

            <div className="flex flex-col gap-2">
              {question.options.map((opt, i) => {
                const isRight = i === correct;
                const isChosenWrong = i === chosen && !isRight;
                return (
                  <div
                    key={i}
                    className={cn(
                      "flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg border text-[14px]",
                      isRight && "border-[#97CE9D] bg-[#97CE9D]/10",
                      isChosenWrong && "border-[#CAA25F] bg-[#CAA25F]/10",
                      !isRight && !isChosenWrong && "border-[#e9edef] dark:border-[#2a3942]"
                    )}
                  >
                    <span className="text-[#111] dark:text-white">{opt}</span>
                    {isRight && (
                      <span className="shrink-0 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-[#54656f] dark:text-[#aebac1]">
                        <Check size={13} className="text-[#97CE9D]" /> Correct answer
                      </span>
                    )}
                    {isChosenWrong && (
                      <span className="shrink-0 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-[#54656f] dark:text-[#aebac1]">
                        <X size={13} className="text-[#CAA25F]" /> Your answer
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {explanation && (
              <div className="mt-3 flex items-start gap-2 bg-[#1099A1]/5 border-l-2 border-[#1099A1] rounded-r-lg px-3 py-2.5">
                <Lightbulb size={15} className="text-[#CAA25F] mt-0.5 shrink-0" />
                <p className="text-[13px] text-[#444] dark:text-[#ccc] leading-relaxed">{explanation}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Score across a student's attempts at one test, oldest to newest. Only shown
// once there is more than one attempt, so a single sitting is not a flat line.
function ScoreTrend({ attempts }: { attempts: DiagnosticResult[] }) {
  const data = attempts.map((a, i) => ({
    label: `#${i + 1}`,
    pct: a.total > 0 ? Math.round((a.score / a.total) * 100) : 0,
  }));
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-3">
        <TrendingUp size={15} className="text-[#1099A1]" />
        <h3 className="text-[15px] font-bold text-[#111] dark:text-white">Your progress</h3>
      </div>
      <div className="h-[180px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="diagTrend" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#1099a1" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#1099a1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis domain={[0, 100]} unit="%" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
            <Tooltip
              contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px" }}
              itemStyle={{ color: "hsl(var(--foreground))" }}
              formatter={(v) => [`${v}%`, "Score"]}
            />
            <Area type="monotone" dataKey="pct" stroke="#1099a1" strokeWidth={2} fill="url(#diagTrend)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function StudentDiagnostics() {
  // One column at a time on a phone, both on a desktop.
  const { openDetail, closeDetail, listClass, detailClass } = useMasterDetail();
  const { user } = useAuth();
  // The full attempt history; the latest per test is derived from it below.
  const [attempts, setAttempts] = useState<DiagnosticResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterText, setFilterText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // The test currently being retaken, if any: shows the form over an existing
  // result until it is submitted as a fresh attempt.
  const [retakingId, setRetakingId] = useState<string | null>(null);

  // For taking a test inline
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!user) return;
    diagnosticService.getStudentAttempts(user.id).then(res => {
      setAttempts(res);
      setLoading(false);
    });
  }, [user]);

  // Latest attempt per test, for the list and the completed view. Attempts come
  // back oldest first, so the last write for a slug is the latest.
  const results = useMemo(() => {
    const m = new Map<string, DiagnosticResult>();
    for (const a of attempts) m.set(a.id, a);
    return [...m.values()];
  }, [attempts]);

  // From the database, without the answer key. There used to be a fallback to
  // src/data/diagnostics.ts, which shipped correctAnswer to the browser and
  // meant an admin's edits were ignored whenever the fetch was slow or empty.
  const { data: tests = [] } = useQuery({
    queryKey: ["student-diagnostics"],
    queryFn: () => diagnosticService.listForStudent(),
    staleTime: 5 * 60_000,
  });

  const categories = useMemo(() => Array.from(new Set(tests.map(t => t.categoryName))), [tests]);
  const filteredCategories = useMemo(
    () => categories.filter((c) => c.toLowerCase().includes(filterText.toLowerCase())),
    [categories, filterText]
  );

  // Derived, not seeded. This was useState(categories[0] || ""), which reads
  // categories on the first render only. That was fine while the tests were
  // imported synchronously from a file; now they are fetched, the first render
  // has none, and the page sat on "No diagnostics available in this category"
  // for ever with a full list beside it.
  const [pickedCategory, setPickedCategory] = useState<string>("");
  const selectedCategory =
    pickedCategory && categories.includes(pickedCategory) ? pickedCategory : categories[0] ?? "";
  const setSelectedCategory = setPickedCategory;
  const categoryTests = useMemo(() => tests.filter(t => t.categoryName === selectedCategory), [tests, selectedCategory]);

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
  // Every attempt at the active test, oldest first, for the progress chart.
  const activeAttempts = useMemo(
    () => attempts.filter(a => a.id === activeTabId),
    [attempts, activeTabId]
  );
  // Show the form over an existing result only while this test is being retaken.
  const takingTest = activeTest && (!activeTestResult || retakingId === activeTabId);
  // The whole stored answer, keyed by question id, so the review can line each
  // one up against its question. The correct index and the explanation come
  // from here rather than from the diagnostic: the browser no longer receives
  // the answer key, and what somebody was shown when they sat it should not
  // change because a question was reworded since. Cheap to rebuild per render.
  const answerByQuestion = new Map(
    (activeTestResult?.answers ?? []).map(a => [a.questionId, a])
  );

  const startRetake = () => {
    if (!activeTest) return;
    setRetakingId(activeTest.id);
    setCurrentQuestionIndex(0);
    setAnswers({});
  };

  useSetBreadcrumb(selectedCategory, "Diagnostics");

  const submitTest = async () => {
    if (!user || !activeTest) return;

    setSubmitting(true);

    // What was chosen, and nothing else. submit_diagnostic marks it against
    // the stored key and writes the row; the browser no longer decides either.
    const answerList = activeTest.questions.map((q) => ({
      questionId: q.id,
      chosen: answers[q.id] ?? -1,
    }));

    const res = await diagnosticService.saveResult(activeTest.id, answerList);
    if (!res.ok) {
      toast.error("Could not save your result. Please try again.");
      setSubmitting(false);
      return;
    }

    // Refresh the attempt history and leave retake mode; the completed view now
    // shows this fresh attempt and, if there is more than one, the trend.
    const newAttempts = await diagnosticService.getStudentAttempts(user.id);
    setAttempts(newAttempts);
    setRetakingId(null);

    toast.success(`You scored ${res.score} out of ${res.total}!`);
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
          <div className="flex items-center gap-2 border-b-2 border-transparent group focus-within:border-primary px-2 py-2 transition ease-in-out">
            <Search size={18} className="text-[#697780] group-focus-within:text-primary shrink-0" />
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
                const cTests = tests.filter(t => t.categoryName === c);
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
        <div className="bg-primary text-white pt-6 px-6 md:pt-8 md:px-8 relative overflow-hidden shrink-0">
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
          ) : activeTestResult && !takingTest ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="bg-white dark:bg-[#111b21] border border-[#e9edef] dark:border-[#2a3942] rounded-lg overflow-hidden flex flex-col">
                <div className="bg-primary/5 px-6 py-8 border-b border-[#e9edef] dark:border-[#2a3942] flex flex-col items-center text-center">
                  <CheckCircle2 size={48} className="text-primary mb-4" />
                  <h3 className="text-xl font-bold text-[#111] dark:text-white mb-1">Test Completed</h3>
                  <p className="text-muted-foreground text-sm max-w-md">You have completed the {activeTest.title} diagnostic test. Your tutor can see this result.</p>
                </div>
                <div className="px-6 py-6 flex flex-col items-center gap-4">
                  <div className="bg-primary/10 rounded-xl px-8 py-5 border border-primary/20 flex flex-col items-center">
                    <span className="text-sm font-semibold text-[#888] uppercase tracking-wide block mb-2">Score</span>
                    <span className="text-3xl font-bold text-primary">
                      {activeTestResult.score} / {activeTestResult.total}
                    </span>
                  </div>
                  {/* Retaking records a new attempt; the old one stays in the
                      history behind the progress chart. */}
                  <Button variant="outline" onClick={startRetake} className="gap-1.5">
                    <RotateCcw size={15} /> Retake test
                  </Button>
                </div>
              </div>

              {/* Only meaningful once there is more than one sitting. */}
              {activeAttempts.length >= 2 && <ScoreTrend attempts={activeAttempts} />}

              {/* The point of storing answers, not just a tally: the student can
                  see which questions they missed and read the explanation. */}
              <div>
                <h3 className="text-[15px] font-bold text-[#111] dark:text-white mb-3">Review your answers</h3>
                <div className="flex flex-col gap-3">
                  {activeTest.questions.map((q, i) => (
                    <QuestionReview
                      key={q.id}
                      index={i}
                      question={q}
                      chosen={answerByQuestion.get(q.id)?.chosen ?? -1}
                      correct={answerByQuestion.get(q.id)?.correct ?? -1}
                      explanation={answerByQuestion.get(q.id)?.explanation}
                    />
                  ))}
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
                                ? 'border-primary bg-primary/5'
                                : 'border-[#e9edef] hover:border-primary/30 hover:bg-gray-50'
                                }`}
                            >
                              <span className="text-sm font-medium">{opt}</span>
                            </button>
                          ))}
                        </div>

                        <div className="flex items-center justify-between mt-8 pt-6 border-t border-[#e9edef] dark:border-[#2a3942]">
                          {/* No going back, the same as the onboarding sitting.
                              Answering, moving on, then returning to change it
                              makes the score meaningless, and a diagnostic whose
                              score means nothing is worse than no diagnostic:
                              a tutor plans around it. Retaking the whole test is
                              the honest way to have another go, and it is one
                              click away once this attempt is handed in. */}
                          <span className="text-[12.5px] text-muted-foreground">
                            Answers are final once you move on
                          </span>
                          {isLast ? (
                            <Button
                              className="bg-primary hover:bg-primary-hover"
                              disabled={answers[q.id] === undefined || submitting}
                              onClick={submitTest}
                            >
                              {submitting ? "Submitting..." : "Submit Test"}
                            </Button>
                          ) : (
                            <Button
                              className="bg-primary hover:bg-primary-hover"
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
