import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { subjects, type Subject } from "@/data/subjects";
import { cn } from "@/utils/cn";

export default function SubjectPage({
  subject,
  onBack,
}: {
  subject: { name: string; img: string };
  onBack: () => void;
}) {
  const currentSubject = subjects.find((s) => s.name === subject.name) as Subject;
  
  // Default to the first subcourse tab if there are multiple
  const [activeTabIndex, setActiveTabIndex] = useState(0);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  if (!currentSubject) return null;

  const hasMultipleCourses = currentSubject.details.length > 1;
  const activeDetail = currentSubject.details[activeTabIndex] || currentSubject.details[0];

  return (
    <div className="bg-white min-h-screen w-full font-sans">
      <div className="max-w-[1440px] mx-auto px-[24px] md:px-[73px] py-[40px]">
        <button onClick={onBack} className="flex items-center gap-[8px] text-[15px] md:text-[16px] font-medium text-[#54656f] hover:text-[#111] mb-[40px] md:mb-[60px] transition-colors bg-transparent border-none cursor-pointer p-0">
          <ArrowLeft size={18} strokeWidth={2.5} />
          <span>Back to Courses</span>
        </button>

        <div className="flex flex-col lg:flex-row gap-[40px] lg:gap-[80px] items-start">
          {/* Left Side: Image */}
          <div className="w-full lg:w-[480px] h-[280px] md:h-[400px] lg:h-[520px] rounded-[16px] md:rounded-[24px] overflow-hidden shrink-0 shadow-sm border border-[#e9edef]">
            <img src={currentSubject.img} alt={currentSubject.name} className="w-full h-full object-cover" />
          </div>
          
          {/* Right Side: Content */}
          <div className="flex-1 w-full pt-0 lg:pt-[10px]">
            {/* Header */}
            <h1 className="text-[32px] md:text-[48px] font-bold leading-[1.1] text-[#111] mb-[12px] tracking-tight">{currentSubject.name}</h1>
            {currentSubject.tagline && (
              <p className="text-[18px] md:text-[22px] font-medium text-[#1099a1] mb-[32px] md:mb-[48px]">{currentSubject.tagline}</p>
            )}

            {/* Clean Minimal Tabs (Option A) */}
            {hasMultipleCourses && (
              <div className="flex flex-wrap gap-[8px] md:gap-[12px] mb-[32px] md:mb-[40px]">
                {currentSubject.details.map((detail, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveTabIndex(idx)}
                    className={cn(
                      "px-[18px] py-[10px] text-[14px] md:text-[15px] font-semibold rounded-full transition-all border",
                      activeTabIndex === idx
                        ? "bg-[#111] text-white border-[#111] shadow-sm"
                        : "bg-transparent text-[#54656f] border-[#e9edef] hover:border-[#111] hover:text-[#111]"
                    )}
                  >
                    {detail.title}
                  </button>
                ))}
              </div>
            )}

            {/* Active Content */}
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 ease-out">
              <h2 className="text-[20px] md:text-[24px] font-bold text-[#111] mb-[16px]">
                {hasMultipleCourses ? activeDetail.title : "About this course"}
              </h2>
              <p className="text-[#4a4a4a] text-[15px] md:text-[17px] leading-[28px] mb-[32px] max-w-[650px]">
                {activeDetail.desc}
              </p>
              
              {activeDetail.learn && activeDetail.learn.length > 0 && (
                <div className="mb-[40px]">
                  <h3 className="text-[13px] md:text-[14px] font-bold text-[#111] mb-[16px] uppercase tracking-widest opacity-80">What you'll learn</h3>
                  <ul className="space-y-[14px]">
                    {activeDetail.learn.map((item, i) => (
                      <li key={i} className="flex items-start gap-[12px] text-[15px] md:text-[16px] leading-[26px] text-[#4a4a4a] max-w-[650px]">
                        <span className="mt-[4px] text-[#1099a1] shrink-0 font-bold text-[20px] leading-none">&#8226;</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <button className="bg-[#1099a1] px-[32px] md:px-[40px] py-[16px] rounded-full text-white text-[15px] md:text-[16px] font-bold hover:bg-[#0d848b] transition-colors shadow-sm">
              Book Your Free Session
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
