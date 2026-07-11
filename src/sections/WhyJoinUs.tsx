import Reveal from "@/components/Reveal";
import imgFeature1 from "@/assets/images/landing-page/building-effective-study-habits.jpg";
import imgFeature2 from "@/assets/images/landing-page/maximizing-online-tutoring-sessions.jpg";
import imgFeature3 from "@/assets/images/landing-page/5-tips-to-improve-math-grades.jpg";

const features = [
  { title: "Personalized Learning Plans", description: "Each student receives a tailored study plan designed around their strengths, weaknesses, and academic goals.", image: imgFeature1 },
  { title: "Flexible Scheduling", description: "We understand how busy high school life can be. Choose virtual or in-person sessions to fit your schedule without stress.", image: imgFeature2 },
  { title: "Progress Tracking", description: "Students and parents receive regular updates that show improvements, learning pace, and areas to work on making progress visible and measurable.", image: imgFeature3 },
];

export default function WhyJoinUs() {
  return (
    <div className="bg-white py-[60px] md:py-[100px] w-full max-w-[1440px]">
      

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
              <div className="w-full aspect-[4/3] rounded-[16px] overflow-hidden mb-[32px] bg-[#f7f9f9]">
                <img src={feature.image} alt={feature.title} className="w-full h-full object-cover" />
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
