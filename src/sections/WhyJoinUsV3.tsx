import { ClipboardList, CalendarCheck, TrendingUp } from "lucide-react";
import Reveal from "@/components/Reveal";

const features = [
  { title: "Personalized Learning Plans", description: "Each student receives a tailored study plan designed around their strengths, weaknesses, and academic goals.", icon: <ClipboardList size={24} strokeWidth={1.5} className="text-[#111]" /> },
  { title: "Flexible Scheduling", description: "We understand how busy high school life can be. Choose virtual or in-person sessions to fit your schedule without stress.", icon: <CalendarCheck size={24} strokeWidth={1.5} className="text-[#111]" /> },
  { title: "Progress Tracking", description: "Students and parents receive regular updates that show improvements, learning pace, and areas to work on making progress visible and measurable.", icon: <TrendingUp size={24} strokeWidth={1.5} className="text-[#111]" /> },
];

export default function WhyJoinUsV3() {
  return (
    <div className="bg-[#f7f9f9] py-[80px] md:py-[120px] w-full max-w-[1440px] rounded-[30px] my-[40px]">
      
      {/* V3 Header Badge */}
      <div className="px-[24px] md:px-[73px] mb-8">
         <div className="inline-block bg-[#1099A1] text-white px-4 py-1 text-sm font-bold tracking-widest uppercase">
           Why Join Us V3: Side-by-Side Agency
         </div>
      </div>

      <div className="max-w-[1440px] px-[24px] md:px-[73px]">
        <div className="flex flex-col lg:flex-row gap-[60px] lg:gap-[120px]">
          
          {/* Left Column (Headline) */}
          <div className="w-full lg:w-1/3">
            <Reveal>
              <p className="text-[14px] font-bold uppercase tracking-[2px] mb-4 text-[#1099A1]">
                The Yakal Difference
              </p>
              <h2 className="text-[36px] md:text-[52px] font-semibold leading-[44px] md:leading-[60px] text-[#111]">
                Why students succeed with Yakal
              </h2>
            </Reveal>
          </div>

          {/* Right Column (Features List) */}
          <div className="w-full lg:w-2/3 flex flex-col gap-[48px]">
            {features.map((feature, idx) => (
              <Reveal key={idx} delay={idx * 150} className="flex gap-[24px] md:gap-[32px]">
                <div className="shrink-0 mt-1 w-[48px] h-[48px] rounded-full border border-[#ccc] bg-white flex items-center justify-center">
                  {feature.icon}
                </div>
                <div className="flex flex-col">
                  <h3 className="text-[22px] md:text-[26px] font-semibold leading-[32px] mb-[12px] text-[#111]">
                    {feature.title}
                  </h3>
                  <p className="text-[#555] text-[16px] md:text-[18px] leading-[28px] max-w-[500px]">
                    {feature.description}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
          
        </div>
      </div>
    </div>
  );
}
