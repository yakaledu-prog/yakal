import { ArrowRight } from "lucide-react";
import Reveal from "@/components/Reveal";
import SkeletonImg from "@/components/SkeletonImg";
import { subjects } from "@/data/subjects";
import type { Page } from "@/types";

export default function Subjects({ onNavigate }: { onNavigate: (page: Page) => void }) {
  return (
    <div id="courses" className="w-full max-w-[1440px]">
      <div className="max-w-[1290px] mx-auto px-[24px] md:px-[18px]">
        <Reveal className="text-center mb-[40px] md:mb-[70px]">
          <h2 className="text-[32px] md:text-[56px] font-medium leading-[40px] md:leading-[66px] mb-[12px] md:mb-[16px]">Subjects We Offer</h2>
          <p className="text-[#4a4a4a] text-[16px] md:text-[18px] leading-[26px] md:leading-[30px]">
            From Math to SAT prep, we provide structured, personalized tutoring for every student's needs.
          </p>
        </Reveal>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-[16px] md:gap-[55px]">
          {subjects.map((subject, idx) => (
            <Reveal key={idx} delay={idx * 80}>
              <div
                onClick={() => onNavigate({ type: "subject", name: subject.name, img: subject.img, scrollY: window.scrollY })}
                className="relative h-[160px] md:h-[227px] rounded-[14px] md:rounded-[18px] overflow-hidden group cursor-pointer"
              >
                <SkeletonImg src={subject.img} alt={subject.name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/80" />
                {/* hover overlay */}
                <div className="absolute inset-0 bg-[#4a4a4a]/55 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-[6px] ease-in-out">
                </div>
                <h3 className="absolute bottom-[20px] md:bottom-[28px] left-1/2 -translate-x-1/2 text-white text-[15px] md:text-[18.5px] font-medium whitespace-nowrap group-hover:opacity-100 scale-100 group-hover:scale-0 origin-left group-hover:-translate-x-full transition-all duration-300 ease-in-out">
                  {subject.name}
                </h3>
                <h3 className="absolute bottom-[20px] md:bottom-[28px] text-white text-[15px] md:text-[18.5px] font-medium whitespace-nowrap left-full group-hover:left-1/2 group-hover:-translate-x-1/2 transition-all duration-500 ease-in-out flex items-center justify-center gap-2">
                  <span className="text-white text-[14px] md:text-[16px] font-semibold tracking-wide leading-none">View Course</span>
                  <ArrowRight size={16} className="text-white" strokeWidth={2.2} />
                </h3>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </div>
  );
}
