import { ClipboardList, CalendarCheck, TrendingUp } from "lucide-react";
import Reveal from "@/components/Reveal";

const features = [
  { title: "Personalized Learning Plans", description: "Each student receives a tailored study plan designed around their strengths, weaknesses, and academic goals.", icon: <ClipboardList size={28} strokeWidth={1.5} className="text-[#1099A1]" /> },
  { title: "Flexible Scheduling", description: "We understand how busy high school life can be. Choose virtual or in-person sessions to fit your schedule without stress.", icon: <CalendarCheck size={28} strokeWidth={1.5} className="text-[#1099A1]" /> },
  { title: "Progress Tracking", description: "Students and parents receive regular updates that show improvements, learning pace, and areas to work on making progress visible and measurable.", icon: <TrendingUp size={28} strokeWidth={1.5} className="text-[#1099A1]" /> },
];

export default function WhyJoinUsV2() {
  return (
    <div className="bg-white py-[60px] md:py-[100px] w-full max-w-[1440px]">
      
      {/* V2 Header Badge */}
      <div className="px-[24px] md:px-[73px] mb-8">
         <div className="inline-block bg-[#1099A1] text-white px-4 py-1 text-sm font-bold tracking-widest uppercase">
           Why Join Us V2: Minimal Editorial
         </div>
      </div>

      <div className="max-w-[1440px] px-[24px] md:px-[73px]">
        <Reveal className="mb-[60px] md:mb-[80px]">
          <h2 className="text-[32px] md:text-[56px] font-semibold leading-[40px] md:leading-[66px] mb-[16px] text-[#111]">
            Why students succeed with Yakal
          </h2>
          <p className="text-[#555] text-[18px] md:text-[20px] leading-[30px] md:leading-[34px] max-w-[700px]">
            We combine structured guidance with flexible support to help every learner thrive. No gimmicks, just results.
          </p>
        </Reveal>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-[40px] md:gap-[80px]">
          {features.map((feature, idx) => (
            <Reveal key={idx} delay={idx * 100} className="flex flex-col border-t border-[#eaeaea] pt-[32px]">
              <div className="w-[48px] h-[48px] flex items-center justify-center bg-[#f0fafa] rounded-full mb-[24px]">
                {feature.icon}
              </div>
              <h3 className="text-[20px] md:text-[24px] font-semibold leading-[32px] mb-[12px] text-[#111]">
                {feature.title}
              </h3>
              <p className="text-[#555] text-[16px] leading-[26px]">
                {feature.description}
              </p>
            </Reveal>
          ))}
        </div>
      </div>
    </div>
  );
}
