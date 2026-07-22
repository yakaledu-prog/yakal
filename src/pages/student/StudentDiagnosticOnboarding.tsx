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
  const indexInCategory = testsInCategory.findIndex(t => t.id === activeTest.id);

  const q = activeTest.questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === activeTest.questions.length - 1;

  return (
    <div className="h-screen flex flex-col bg-[#f8f9fa] dark:bg-[#111b21] overflow-hidden font-sans">

      {/* Header with SVG Pattern */}
      <div className="bg-[#1099A1] text-white pt-6 px-6 md:pt-10 md:px-10 pb-0 relative shrink-0">
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
            {/* Card Header (Embedded Breadcrumb) */}
            <div className="bg-[#f8f9fa] dark:bg-[#182329] px-6 py-4 border-b border-[#e9edef] dark:border-[#2a3942] flex items-center justify-between">
               <div className="flex items-center gap-2 text-[14px] font-semibold text-[#54656f] dark:text-[#aebac1]">
                 <span>{activeTest.categoryName}</span>
                 <span className="text-[#aebac1] dark:text-[#54656f]">&rsaquo;</span>
                 <span className="text-[#111] dark:text-white">{activeTest.title}</span>
               </div>
               <span className="text-[12px] font-bold text-[#1099A1] bg-[#1099A1]/10 px-2.5 py-1 rounded-md uppercase tracking-wider">
                 Test {indexInCategory + 1} of {testsInCategory.length}
               </span>
            </div>
            
            {/* Inner progress bar for questions */}
            <div className="h-1 w-full bg-[#f0f0f0] dark:bg-[#1a2329]">
              <div
                className="h-full bg-[#1099A1] transition-all duration-300"
                style={{ width: `${((currentQuestionIndex) / activeTest.questions.length) * 100}%` }}
              />
            </div>

            <div className="p-6 md:p-10 flex-1 flex flex-col overflow-y-auto">
              <span className="text-sm font-semibold text-[#1099A1] uppercase tracking-wider mb-2">
                Question {currentQuestionIndex + 1} of {activeTest.questions.length}
              </span>
              <h3 className="text-lg md:text-xl font-bold text-[#111] dark:text-white mb-8">
                {q.text}
              </h3>

              <div className="flex flex-col gap-3">
                {q.options.map((opt, i) => {
                  const isSelected = answers[q.id] === i;
                  return (
                    <button
                      key={i}
                      onClick={() => setAnswers({ ...answers, [q.id]: i })}
                      className={`w-full text-left px-5 py-4 rounded-xl border-2 transition-all ${isSelected
                        ? 'border-[#1099A1] bg-[#1099A1]/5 dark:bg-[#1099A1]/10 text-[#111] dark:text-white'
                        : 'border-[#e9edef] dark:border-[#2a3942] text-[#555] dark:text-[#ccc] hover:border-[#1099A1]/30 hover:bg-gray-50 dark:hover:bg-[#1a2329]'
                        }`}
                    >
                      <span className="text-[15px] font-medium">{opt}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-4 md:p-6 border-t border-[#e9edef] dark:border-[#2a3942] bg-[#f8f9fa] dark:bg-[#182329] flex flex-col gap-4 mt-auto">
              <div className="flex items-center justify-end">
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
                      className="bg-[#1099A1] hover:bg-[#0d848b] text-white px-8"
                      disabled={answers[q.id] === undefined || submitting}
                      onClick={submitCurrentTest}
                    >
                      {submitting ? "Submitting..." : isLastTest ? "Finish Assessment" : "Submit Test"}
                    </Button>
                  ) : (
                    <Button
                      className="bg-[#1099A1] hover:bg-[#0d848b] text-white px-8"
                      disabled={answers[q.id] === undefined}
                      onClick={() => setCurrentQuestionIndex(i => i + 1)}
                    >
                      Next
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">{activeTest.categoryName} Progress</span>
                <div className="h-1 flex-1 bg-[#e9edef] dark:bg-[#2a3942] rounded-full overflow-hidden">
                  <div className="h-full bg-[#CAA25F] transition-all duration-300" style={{ width: `${((indexInCategory + 1) / testsInCategory.length) * 100}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Status Indicator / Progress Bar */}
      <div className="bg-white dark:bg-[#202c33] border-t border-[#e9edef] dark:border-[#2a3942] shrink-0 p-4 md:px-10 flex flex-col md:flex-row items-center justify-between gap-6 w-full">
        <div className="flex-1 w-full flex items-center gap-4">
          <div className="text-[13px] font-bold text-[#111] dark:text-white shrink-0 whitespace-nowrap">
            Test {currentTestIndex + 1} / {diagnosticTests.length}
          </div>
          <div className="flex-1 flex items-center gap-1.5 overflow-hidden">
            {diagnosticTests.map((_, i) => (
              <div
                key={i}
                className={`h-2 flex-1 rounded-full transition-colors ${i < currentTestIndex
                  ? "bg-[#1099A1]"
                  : i === currentTestIndex
                    ? "bg-[#1099A1]/60"
                    : "bg-[#e9edef] dark:bg-[#2a3942]"
                  }`}
              />
            ))}
          </div>
        </div>
        <Button
          variant="outline"
          onClick={handleFinishOnboarding}
          className="text-muted-foreground border-[#e9edef] dark:border-[#2a3942] hover:bg-[#e9edef] dark:hover:bg-[#2a3942] shrink-0 w-full md:w-auto font-bold"
          disabled={loading}
        >
          Skip
        </Button>
      </div>

    </div>
  );
}
