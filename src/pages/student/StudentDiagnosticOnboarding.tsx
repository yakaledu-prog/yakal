import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { postAuthPath } from "@/utils/roleRoutes";
import { fireConfetti } from "@/utils/confetti";
import { toast } from "sonner";
import { diagnosticTests, DiagnosticTest } from "@/data/diagnostics";
import { diagnosticService } from "@/services/diagnosticService";
import { initialsAvatarUrl } from "@/utils/avatar";

export function StudentDiagnosticOnboarding() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [selectedTest, setSelectedTest] = useState<DiagnosticTest | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  
  // Group tests by category
  const categories = Array.from(new Set(diagnosticTests.map(t => t.categoryName)));

  const handleFinishOnboarding = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Auto-generate avatar if missing
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

  const submitTest = async () => {
    if (!user || !selectedTest) return;
    
    // Calculate score
    let correct = 0;
    selectedTest.questions.forEach((q) => {
      if (answers[q.id] === q.correctAnswer) correct++;
    });
    
    await diagnosticService.saveResult(user.id, selectedTest.id, correct, selectedTest.questions.length);
    toast.success(`You scored ${correct} out of ${selectedTest.questions.length}!`);
    
    setSelectedTest(null);
    setCurrentQuestionIndex(0);
    setAnswers({});
  };

  if (selectedTest) {
    const q = selectedTest.questions[currentQuestionIndex];
    const isLast = currentQuestionIndex === selectedTest.questions.length - 1;
    
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex flex-col items-center py-10 px-4 font-sans">
        <div className="w-full max-w-2xl bg-white rounded-2xl shadow-sm border border-[#e9edef] overflow-hidden">
          <div className="bg-[#1099A1] text-white px-8 py-6">
            <h2 className="text-2xl font-bold">{selectedTest.title} Diagnostic</h2>
            <p className="opacity-90 mt-1">Question {currentQuestionIndex + 1} of {selectedTest.questions.length}</p>
          </div>
          
          <div className="p-8">
            <h3 className="text-xl font-semibold mb-6 text-[#111]">{q.text}</h3>
            <div className="flex flex-col gap-3 mb-8">
              {q.options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => setAnswers({ ...answers, [q.id]: i })}
                  className={`w-full text-left px-6 py-4 rounded-xl border-2 transition-all ${
                    answers[q.id] === i 
                      ? 'border-[#1099A1] bg-[#1099A1]/5' 
                      : 'border-[#e9edef] hover:border-[#1099A1]/30 hover:bg-gray-50'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
            
            <div className="flex justify-between mt-8 pt-6 border-t border-[#e9edef]">
              <Button 
                variant="outline" 
                onClick={() => setSelectedTest(null)}
              >
                Cancel
              </Button>
              {isLast ? (
                <Button 
                  className="bg-[#1099A1] hover:bg-[#0d848b]"
                  disabled={answers[q.id] === undefined}
                  onClick={submitTest}
                >
                  Submit Quiz
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
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex flex-col items-center py-10 px-4 font-sans">
      <div className="w-full max-w-4xl">
        <div className="mb-10 text-center">
          <h1 className="text-[32px] font-bold text-[#111] mb-3">Diagnostic Assessment</h1>
          <p className="text-[#555] text-lg max-w-2xl mx-auto">
            Take a quick diagnostic test to measure your current status. This helps our tutors understand your strengths and adjust their teaching style.
          </p>
        </div>

        <div className="flex flex-col gap-8">
          {categories.map((catName) => (
            <div key={catName} className="bg-white p-6 rounded-2xl shadow-sm border border-[#e9edef]">
              <h2 className="text-xl font-bold mb-4 text-[#111]">{catName}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {diagnosticTests.filter(t => t.categoryName === catName).map(test => (
                  <div key={test.id} className="border border-[#e9edef] rounded-xl p-5 hover:border-[#1099A1]/30 transition-all">
                    <h3 className="font-semibold text-[#111] mb-1">{test.title}</h3>
                    <p className="text-sm text-[#666] mb-4 line-clamp-2">{test.description}</p>
                    <Button 
                      variant="outline" 
                      className="w-full text-[#1099A1] border-[#1099A1]/20 hover:bg-[#1099A1]/5"
                      onClick={() => {
                        setSelectedTest(test);
                        setCurrentQuestionIndex(0);
                        setAnswers({});
                      }}
                    >
                      Take Test
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 flex justify-center pb-20">
          <Button
            size="lg"
            className="bg-[#111] text-white hover:bg-[#333] px-10 h-14 rounded-full text-base font-semibold"
            disabled={loading}
            onClick={handleFinishOnboarding}
          >
            {loading ? "Please wait..." : "Skip to Dashboard"}
          </Button>
        </div>
      </div>
    </div>
  );
}
