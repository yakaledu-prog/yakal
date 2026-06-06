import { ClipboardList, CalendarCheck, TrendingUp } from "lucide-react";
import Reveal from "@/components/Reveal";

const features = [
  { title: "Personalized Learning Plans", description: "Each student receives a tailored study plan designed around their strengths, weaknesses, and academic goals.", icon: <ClipboardList size={32} strokeWidth={1.7} className="text-[#1099a1]" /> },
  { title: "Flexible Scheduling", description: "We understand how busy high school life can be. Choose virtual or in-person sessions to fit your schedule without stress.", icon: <CalendarCheck size={32} strokeWidth={1.7} className="text-[#1099a1]" /> },
  { title: "Progress Tracking", description: "Students and parents receive regular updates that show improvements, learning pace, and areas to work on making progress visible and measurable.", icon: <TrendingUp size={32} strokeWidth={1.7} className="text-[#1099a1]" /> },
];

export default function WhyJoinUs() {
  return (
    <div className="bg-[#fafafa] rounded-[20px] md:rounded-[30px] py-[48px] md:py-[71px] w-full max-w-[1440px]">
      <div className="max-w-[1290px] mx-auto px-[24px] md:px-[18px]">
        <Reveal className="text-center mb-[40px] md:mb-[70px]">
          <h2 className="text-[32px] md:text-[56px] font-medium leading-[40px] md:leading-[66px] mb-[12px] md:mb-[16px]">Why Students Succeed With Yakal</h2>
          <p className="text-[#4a4a4a] text-[16px] md:text-[18px] leading-[26px] md:leading-[30px]">
            We combine structured guidance with flexible support to help every learner thrive.
          </p>
        </Reveal>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-[20px] md:gap-[30px]">
          {features.map((feature, idx) => (
            <Reveal key={idx} delay={idx * 100}>
              <div className="bg-white rounded-[20px] md:rounded-[30px] p-[30px] md:p-[45px] shadow-[0px_24px_50px_rgba(0,0,0,0.05)] h-full flex flex-col items-center text-center">
                <div className="w-[60px] h-[60px] md:w-[70px] md:h-[70px] bg-[rgba(16,153,161,0.1)] rounded-[15px] flex items-center justify-center mb-[28px] md:mb-[44px]">
                  {feature.icon}
                </div>
                <h3 className="text-[22px] md:text-[28px] font-medium leading-[32px] md:leading-[40px] mb-[12px] md:mb-[16px]">{feature.title}</h3>
                <p className="text-[#4a4a4a] text-[16px] md:text-[18px] leading-[26px] md:leading-[30px]">{feature.description}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </div>
  );
}
