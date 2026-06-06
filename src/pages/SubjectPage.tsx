import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { subjectDetails } from "@/data/subjects";

export default function SubjectPage({
  subject,
  onBack,
}: {
  subject: { name: string; img: string };
  onBack: () => void;
}) {
  const detail = subjectDetails[subject.name] ?? {
    title: subject.name,
    desc: "Expert one-on-one tutoring tailored to your specific needs and learning goals.",
    learn: ["Core concepts and fundamentals", "Problem-solving strategies", "Exam preparation and practice"],
  };

  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <div className="bg-white min-h-screen w-full">
      <div className="max-w-[1440px] mx-auto px-[24px] md:px-[73px] py-[40px]">
        <button onClick={onBack} className="flex items-center gap-[8px] text-[16px] md:text-[18px] mb-[40px] md:mb-[60px] hover:opacity-70 transition bg-transparent border-none cursor-pointer">
          <ArrowLeft size={20} strokeWidth={2} />
          <span>Back to Courses</span>
        </button>

        <div className="flex flex-col md:flex-row gap-[40px] md:gap-[80px] items-start">
          <div className="w-full md:w-[580px] h-[280px] md:h-[580px] rounded-[24px] overflow-hidden shrink-0">
            <img src={subject.img} alt={subject.name} className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 pt-0 md:pt-[20px]">
            <h1 className="text-[36px] md:text-[56px] font-medium leading-[44px] md:leading-[66px] mb-[24px]">{detail.title}</h1>
            <p className="text-[#4a4a4a] text-[16px] md:text-[18px] leading-[28px] md:leading-[30px] mb-[32px]">{detail.desc}</p>
            <p className="text-[16px] md:text-[18px] font-bold mb-[16px]">What you'll learn:</p>
            <ul className="space-y-[12px] mb-[48px]">
              {detail.learn.map((item, i) => (
                <li key={i} className="flex items-start gap-[12px] text-[16px] md:text-[18px] leading-[28px] text-[#4a4a4a]">
                  <span className="mt-[6px] shrink-0">&#8226;</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <button className="bg-[#1099a1] px-[40px] md:px-[60px] py-[14px] md:py-[18px] rounded-[500px] text-white text-[16px] md:text-[18px] uppercase tracking-wide hover:bg-[#0d7d84] transition">
              Book Your Free Session
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
