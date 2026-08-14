import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { postAuthPath } from "@/utils/roleRoutes";
import { fireConfetti } from "@/utils/confetti";
import { toast } from "sonner";
import { diagnosticTests } from "@/data/diagnostics";
import { diagnosticService } from "@/services/diagnosticService";
import { initialsAvatarUrl } from "@/utils/avatar";

export function StudentDiagnosticOnboarding() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // High level wizard state
  const [currentTestIndex, setCurrentTestIndex] = useState(0);
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);

  // Question level state
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});

  const activeTest = diagnosticTests[currentTestIndex];
  const isLastTest = currentTestIndex === diagnosticTests.length - 1;

  const handleFinishOnboarding = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const fullName = profile?.full_name || "Student";
      const avatarUrl = profile?.avatar_url || initialsAvatarUrl(fullName);

      const { error } = await supabase.from("profiles").update({
        is_onboarded: true,
        avatar_url: avatarUrl
      }).eq("id", user.id);

      if (error) throw error;

      const fresh = await refreshProfile();
      const dest = postAuthPath(fresh ?? { role: "student", status: "active", is_onboarded: true });
      fireConfetti();
      toast.success("Welcome to Yakal!");
      setTimeout(() => navigate(dest), 450);
    } catch (err: any) {
      toast.error("Failed to complete setup.");
    } finally {
      setLoading(false);
    }
  };

  const handleNextTest = () => {
    if (isLastTest) {
      handleFinishOnboarding();
    } else {
      setCurrentTestIndex(i => i + 1);
      setCurrentQuestionIndex(0);
      setAnswers({});
    }
  };

  const categories = Array.from(new Set(diagnosticTests.map(t => t.categoryName)));

  const handleCategoryClick = (catName: string) => {
    const firstTestIndex = diagnosticTests.findIndex(t => t.categoryName === catName);
    if (firstTestIndex !== -1) {
      setCurrentTestIndex(firstTestIndex);
      setCurrentQuestionIndex(0);
      setAnswers({});
    }
  };

  const submitCurrentTest = async () => {
    if (!user || !activeTest) return;

    setSubmitting(true);
    let correct = 0;
    activeTest.questions.forEach((q) => {
      if (answers[q.id] === q.correctAnswer) correct++;
    });

    await diagnosticService.saveResult(user.id, activeTest.id, correct, activeTest.questions.length);
    toast.success(`Scored ${correct} out of ${activeTest.questions.length} on ${activeTest.title}!`);
    setSubmitting(false);

    handleNextTest();
  };

  if (!activeTest) return null;

  const testsInCategory = diagnosticTests.filter(t => t.categoryName === activeTest.categoryName);

  const q = activeTest.questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === activeTest.questions.length - 1;

  return (
    <div className="h-screen flex-grow flex flex-col bg-[#f8f9fa] dark:bg-[#111b21] overflow-hidden font-sans">

      {/* Header with SVG Pattern */}
      <div className="bg-primary text-white pt-6 px-6 md:pt-10 md:px-10 pb-0 relative shrink-0">
        <svg className="absolute right-0 top-0 h-full w-[60%] md:w-[40%] text-white/5 pointer-events-none" viewBox="0 0 400 200" preserveAspectRatio="none" fill="none">
          <path d="M 0 200 Q 100 50, 200 120 T 400 0 L 400 200 Z" fill="currentColor" />
          <path d="M 0 200 L 100 80 L 200 150 L 300 40 L 400 100 L 400 200 Z" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.3" />
          <circle cx="100" cy="80" r="4" fill="currentColor" opacity="0.5" />
          <circle cx="200" cy="150" r="4" fill="currentColor" opacity="0.5" />
          <circle cx="300" cy="40" r="4" fill="currentColor" opacity="0.5" />
        </svg>

        <div className="relative z-10 max-w-4xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Diagnostic Assessment</h1>
          </div>
        </div>

        <div className="relative z-10 max-w-4xl mx-auto flex items-center gap-6 mt-8 border-b pb-1 border-white/20 overflow-x-auto [scrollbar-width:none]">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => handleCategoryClick(c)}
              className={`pb-3 px-1 text-[14px] font-medium transition-colors border-b-2 relative top-[1px] whitespace-nowrap outline-none ${c === activeTest.categoryName
                ? "text-white border-white"
                : "text-white/60 border-transparent hover:text-white/90 hover:border-white/30"
                }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-8">
        <div className="max-w-3xl mx-auto h-full flex flex-col">

          <div className="bg-white dark:bg-[#202c33] border border-[#e9edef] dark:border-[#2a3942] rounded-2xl shadow-sm flex flex-col overflow-hidden flex-1 max-h-[600px]">
            {/* Card Header (Sub-subject Tabs) */}
            <div className="bg-[#f8f9fa] dark:bg-[#182329] px-6 pt-4 border-b-2 border-[#e9edef] dark:border-[#2a3942] flex items-center justify-between">
              <div className="flex items-center gap-6 overflow-x-auto [scrollbar-width:none]">
                {testsInCategory.map(t => {
                  const isActive = t.id === activeTest.id;
                  return (
                    <div
                      key={t.id}
                      className={`pb-3 border-b-2 font-semibold text-[14px] whitespace-nowrap transition-colors ${isActive ? 'border-primary text-[#111] dark:text-white' : 'border-transparent text-muted-foreground'}`}
                    >
                      {t.title}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Inner progress bar for questions */}
            {/* <div className="h-0.5 w-full bg-[#f0f0f0] dark:bg-[#1a2329]">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${((currentQuestionIndex) / activeTest.questions.length) * 100}%` }}
              />
            </div> */}

            <div className="p-6 py-2 md:p-10 md:py-5 flex-1 flex flex-col overflow-y-auto min-h-0">
              <div className="flex items-start justify-between gap-4 mb-8">
                <h3 className="text-lg md:text-xl font-bold text-[#111] dark:text-white">
                  {q.text}
                </h3>
              </div>

              <div className="flex flex-col gap-3">
                {q.options.map((opt, i) => {
                  const isSelected = answers[q.id] === i;
                  return (
                    <button
                      key={i}
                      onClick={() => setAnswers({ ...answers, [q.id]: i })}
                      className={`w-full text-left px-5 py-4 rounded-xl border-2 transition-all ${isSelected
                        ? 'border-primary bg-primary/5 dark:bg-primary/10 text-[#111] dark:text-white'
                        : 'border-[#e9edef] dark:border-[#2a3942] text-[#555] dark:text-[#ccc] hover:border-primary/30 hover:bg-gray-50 dark:hover:bg-[#1a2329]'
                        }`}
                    >
                      <span className="text-[15px] font-medium">{opt}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-4 md:p-6 md:py-4 border-t border-[#e9edef] dark:border-[#2a3942] bg-[#f8f9fa] dark:bg-[#182329] flex items-center justify-between mt-auto">
              <span className="text-[14px] font-semibold text-primary shrink-0 mt-1">
                Question {currentQuestionIndex + 1} / {activeTest.questions.length}
              </span>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  disabled={currentQuestionIndex === 0}
                  onClick={() => setCurrentQuestionIndex(i => i - 1)}
                  className="border-[#e9edef] dark:border-[#2a3942]"
                >
                  Back
                </Button>
                {isLastQuestion ? (
                  <Button
                    className="bg-primary hover:bg-primary-hover text-white px-8"
                    disabled={answers[q.id] === undefined || submitting}
                    onClick={submitCurrentTest}
                  >
                    {submitting ? "Submitting..." : isLastTest ? "Finish Assessment" : "Submit Test"}
                  </Button>
                ) : (
                  <Button
                    className="bg-primary hover:bg-primary-hover text-white px-8"
                    disabled={answers[q.id] === undefined}
                    onClick={() => setCurrentQuestionIndex(i => i + 1)}
                  >
                    Next
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Status Indicator / Progress Bar */}
      <div className="bg-white dark:bg-[#202c33] border-t border-[#e9edef] dark:border-[#2a3942] shrink-0 p-4 py-1 md:px-10 flex flex-col md:flex-row items-center justify-between gap-6 w-full">
        <div className="flex-1 w-full flex items-center gap-4">
          {/* <div className="text-[13px] font-semibold text-[#111] dark:text-white shrink-0 whitespace-nowrap">
            {currentTestIndex + 1} / {diagnosticTests.length}
          </div> */}
          <div className="flex-1 flex items-center gap-1.5 overflow-hidden">
            {diagnosticTests.map((_, i) => (
              <div
                key={i}
                className={`h-2 flex-1 rounded-full transition-colors ${i < currentTestIndex
                  ? "bg-primary"
                  : i === currentTestIndex
                    ? "bg-primary/60"
                    : "bg-[#e9edef] dark:bg-[#2a3942]"
                  }`}
              />
            ))}
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => setShowSkipConfirm(true)}
          className="text-muted-foreground border-[#e9edef] dark:border-[#2a3942] hover:bg-[#e9edef] dark:hover:bg-[#2a3942] shrink-0 w-full md:w-auto font-bold"
          disabled={loading}
        >
          Skip
        </Button>
      </div>

      {/* Skip Confirmation Dialog */}
      {showSkipConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#202c33] max-w-md w-full rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <h3 className="text-xl font-bold text-[#111] dark:text-white mb-2">Skip Assessment?</h3>
              <p className="text-[#54656f] dark:text-[#aebac1] text-[15px] leading-relaxed">
                Are you sure you want to skip the diagnostic assessment? Our tutors use these results to tailor your sessions to your exact needs. You can always take these tests later from your dashboard.
              </p>
            </div>
            <div className="p-4 bg-[#f8f9fa] dark:bg-[#182329] border-t border-[#e9edef] dark:border-[#2a3942] flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowSkipConfirm(false)} className="border-[#e9edef] dark:border-[#2a3942] hover:bg-[#e9edef] dark:hover:bg-[#2a3942]">
                Cancel
              </Button>
              <Button onClick={() => { setShowSkipConfirm(false); handleFinishOnboarding(); }} disabled={loading} className="bg-[#111] dark:bg-white text-white dark:text-[#111] hover:opacity-80">
                {loading ? "Skipping..." : "Skip Assessment"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
