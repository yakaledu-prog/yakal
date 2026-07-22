import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { diagnosticTests } from "@/data/diagnostics";
import subjMath from "@/assets/images/subject-algebra.webp";

export function StudentDiagnosticOnboardingPreview() {
  const [currentTestIndex, setCurrentTestIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});

  const activeTest = diagnosticTests[currentTestIndex];
  const q = activeTest.questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === activeTest.questions.length - 1;
  const isLastTest = currentTestIndex === diagnosticTests.length - 1;

  const categories = Array.from(new Set(diagnosticTests.map(t => t.categoryName)));

  return (
    <div className="flex h-screen w-full bg-[#f8f9fa] dark:bg-[#111b21] font-sans">
      
      {/* Left Pane: Image & Roadmap */}
      <div className="hidden lg:flex w-[35%] relative flex-col">
        {/* Background Image */}
        <img 
          src={subjMath} 
          alt="Education" 
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Dark Overlay */}
        <div className="absolute inset-0 bg-[#111b21]/80 backdrop-blur-sm" />
        
        <div className="relative z-10 flex flex-col h-full p-10 overflow-y-auto">
          <div className="mb-12">
            <h1 className="text-3xl font-bold text-white mb-2">Diagnostic Assessment</h1>
            <p className="text-white/70 text-[15px]">Measure your skills across all subjects so we can tailor your Yakal experience.</p>
          </div>
          
          <div className="flex-1 flex flex-col gap-8">
            {categories.map((cat, idx) => {
              const testsInCat = diagnosticTests.filter(t => t.categoryName === cat);
              const isActiveCat = activeTest.categoryName === cat;
              const catStartIndex = diagnosticTests.findIndex(t => t.categoryName === cat);
              const isPastCat = currentTestIndex >= catStartIndex + testsInCat.length;

              return (
                <div key={cat} className={`flex gap-4 ${isActiveCat ? 'opacity-100' : isPastCat ? 'opacity-60' : 'opacity-40'}`}>
                  <div className="flex flex-col items-center">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 ${
                      isActiveCat ? 'border-[#1099A1] bg-[#1099A1] text-white' : 
                      isPastCat ? 'border-[#1099A1] bg-transparent text-[#1099A1]' : 
                      'border-white/30 bg-transparent text-transparent'
                    }`}>
                      {isPastCat && <span className="text-[10px] font-bold">✓</span>}
                    </div>
                    {idx < categories.length - 1 && (
                      <div className={`w-0.5 h-full my-2 ${isPastCat ? 'bg-[#1099A1]/50' : 'bg-white/10'}`} />
                    )}
                  </div>
                  <div className="flex-1 pb-4">
                    <h3 className="text-[16px] font-bold text-white mb-2">{cat}</h3>
                    <div className="flex flex-col gap-2">
                      {testsInCat.map(t => {
                        const globalIndex = diagnosticTests.findIndex(test => test.id === t.id);
                        const isCurrent = globalIndex === currentTestIndex;
                        const isDone = globalIndex < currentTestIndex;
                        
                        return (
                          <div key={t.id} className="flex items-center justify-between group">
                            <span className={`text-[13px] ${isCurrent ? 'text-[#1099A1] font-bold' : isDone ? 'text-white/60' : 'text-white/40'}`}>
                              {t.title}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right Pane: Wizard Flow */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <div className="flex-1 overflow-y-auto px-4 md:px-12 py-10">
          <div className="max-w-2xl mx-auto h-full flex flex-col">
            
            <div className="mb-8">
              <span className="text-[13px] font-bold text-[#1099A1] uppercase tracking-widest">{activeTest.categoryName}</span>
              <h2 className="text-3xl font-bold text-[#111] dark:text-white mt-1">{activeTest.title}</h2>
            </div>

            <div className="bg-white dark:bg-[#202c33] border border-[#e9edef] dark:border-[#2a3942] rounded-2xl shadow-sm flex flex-col overflow-hidden flex-1 min-h-[400px]">
              <div className="h-1.5 w-full bg-[#f0f0f0] dark:bg-[#1a2329]">
                <div 
                  className="h-full bg-[#CAA25F] transition-all duration-300"
                  style={{ width: `${((currentQuestionIndex) / activeTest.questions.length) * 100}%` }}
                />
              </div>
              
              <div className="p-8 flex-1 overflow-y-auto">
                <span className="text-sm font-semibold text-[#CAA25F] mb-3 block">
                  Question {currentQuestionIndex + 1} of {activeTest.questions.length}
                </span>
                <h3 className="text-xl font-bold text-[#111] dark:text-white mb-8 leading-relaxed">
                  {q.text}
                </h3>
                
                <div className="flex flex-col gap-3">
                  {q.options.map((opt, i) => {
                    const isSelected = answers[q.id] === i;
                    return (
                      <button
                        key={i}
                        onClick={() => setAnswers({ ...answers, [q.id]: i })}
                        className={`w-full text-left px-5 py-4 rounded-xl border-2 transition-all ${
                          isSelected 
                            ? 'border-[#CAA25F] bg-[#CAA25F]/5 dark:bg-[#CAA25F]/10 text-[#111] dark:text-white' 
                            : 'border-[#e9edef] dark:border-[#2a3942] text-[#555] dark:text-[#ccc] hover:border-[#CAA25F]/30 hover:bg-gray-50 dark:hover:bg-[#1a2329]'
                        }`}
                      >
                        <span className="text-[15px] font-medium">{opt}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="p-6 border-t border-[#e9edef] dark:border-[#2a3942] bg-[#f8f9fa] dark:bg-[#182329] flex items-center justify-between mt-auto">
                <Button 
                  variant="ghost" 
                  disabled={currentQuestionIndex === 0}
                  onClick={() => setCurrentQuestionIndex(i => i - 1)}
                  className="text-muted-foreground"
                >
                  Back
                </Button>
                
                {isLastQuestion ? (
                  <Button 
                    className="bg-[#1099A1] hover:bg-[#0d848b] text-white px-8"
                    disabled={answers[q.id] === undefined}
                    onClick={() => {
                      if (!isLastTest) {
                        setCurrentTestIndex(i => i + 1);
                        setCurrentQuestionIndex(0);
                        setAnswers({});
                      } else {
                        alert("Done!");
                      }
                    }}
                  >
                    Submit Test
                  </Button>
                ) : (
                  <Button 
                    className="bg-[#1099A1] hover:bg-[#0d848b] text-white px-8"
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

        {/* Bottom Bar */}
        <div className="p-6 border-t border-[#e9edef] dark:border-[#2a3942] bg-white dark:bg-[#202c33] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4 flex-1">
            <span className="text-sm font-bold text-muted-foreground">Overall Progress</span>
            <div className="flex-1 max-w-md h-2 bg-[#f0f0f0] dark:bg-[#1a2329] rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#1099A1] transition-all duration-300" 
                style={{ width: `${(currentTestIndex / diagnosticTests.length) * 100}%` }} 
              />
            </div>
            <span className="text-sm font-bold">{Math.round((currentTestIndex / diagnosticTests.length) * 100)}%</span>
          </div>
          <Button variant="outline" className="ml-8 border-transparent text-muted-foreground hover:bg-[#e9edef] dark:hover:bg-[#2a3942]">
            Skip Assessment
          </Button>
        </div>
      </div>

    </div>
  );
}
