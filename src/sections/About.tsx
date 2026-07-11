import { CheckCircle, ArrowRight } from "lucide-react";
import Reveal from "@/components/Reveal";
import imgAboutBanner1 from "@/assets/images/landing-page/about-yakal.webp";
import imgImg2_1 from "@/assets/images/landing-page/what-we-offer.webp";

const offerings = [
  { title: "Subject-Specific Tutoring:", desc: "Focused support in Algebra, Geometry, Physics, pre-calculus, calculus, and other STEM subjects." },
  { title: "Test Preparation:", desc: "Expert guidance for SAT, ACT, AP Exams, and other standardized tests." },
  { title: "Homework Assistance:", desc: "Daily or weekly help with assignments to ensure understanding and completion." },
  { title: "Study Skills Coaching:", desc: "Time management, note-taking strategies, and organizational skills." },
  { title: "College Prep Support:", desc: "Guidance with college applications, personal statement writing, and scholarship essays." },
];

const steps = [
  { num: "1", title: "Choose a format", desc: "Choose and decide a virtual and in-person session." },
  { num: "2", title: "Get to know your tutors", desc: "Look at the website, know your tutors and understand their skills." },
  { num: "3", title: "Book Your Free Sessions", desc: "Click the link below and lets chat!", hasButton: true },
];

export default function About() {
  return (
    <div id="about" className="w-full max-w-[1440px] flex flex-col gap-[60px] md:gap-[120px] items-center px-[24px] md:px-0">
      <div className="flex flex-col gap-[40px] md:gap-[40px] items-center">
        <Reveal className="flex flex-col md:flex-col items-start md:items-start justify-between w-full max-w-[1254px] gap-[24px] px-[24px] md:px-0">
          <h2 className="text-[44px] md:text-[76px] font-medium leading-[52px] md:leading-[86px] text-center md:text-left mx-auto md:mx-0">About Yakal</h2>
          <p className="text-[#4a4a4a] text-[16px] md:text-[18px] leading-[26px] md:leading-[30px] text-center md:text-left">
            Yakal is an educational consultancy dedicated to helping students excel academically. We provide personalized tutoring, flexible learning options, and guidance that empowers every student to reach their full potential.
          </p>
        </Reveal>
        <Reveal from="none" className="w-full h-[240px] md:h-[728px] rounded-[20px] md:rounded-[30px] overflow-hidden">
          <img src={imgAboutBanner1} alt="About Yakal" className="w-full h-full object-cover" />
        </Reveal>
      </div>

      {/* What We Offer */}
      <div className="bg-[#f4f4f4] rounded-[20px] md:rounded-[30px] px-[24px] md:px-[73px] py-[48px] md:py-[100px]">
        <div className="flex flex-col md:flex-row items-center justify-between gap-[40px]">
          <div className="w-full md:w-[594px] h-[280px] md:h-[594px] rounded-[20px] md:rounded-[30px] overflow-hidden  hidden md:inline-block">
            <img src={imgImg2_1} alt="What We Offer" className="w-full h-full object-cover" />
          </div>
          <div className="md:max-w-[560px]">
            <h3 className="text-[32px] md:text-[56px] font-medium leading-[40px] md:leading-[66px] mb-[12px] md:mb-[16px]">What We Offer</h3>
            <p className="text-[#4a4a4a] text-[16px] md:text-[18px] leading-[26px] md:leading-[30px] mb-[24px] md:mb-[30px]">
              Comprehensive services designed to help students succeed
            </p>
            <div className="space-y-[12px]">
              {offerings.map((item, idx) => (
                <div key={idx} className="flex gap-[12px]">
                  <div className="mt-[5px] shrink-0">
                    <CheckCircle size={20} strokeWidth={2} className="text-[#1099a1]" />
                  </div>
                  <p className="text-[16px] md:text-[18px] leading-[26px] md:leading-[30px]">
                    <span className="font-medium">{item.title}</span>
                    <span className="text-[#4a4a4a]"> {item.desc}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* How to Get Connected */}
      <div className="max-w-[1290px] px-[24px] md:px-[18px] mx-auto w-full">
        <h2 className="text-[28px] md:text-[56px] font-medium leading-[36px] md:leading-[66px] text-center mb-[48px] md:mb-[84px]">
          How to get connected with our tutors
        </h2>
        <div className="flex flex-col md:flex-row gap-[32px] md:gap-[50px] justify-center items-center">
          {steps.map((step, idx) => (
            <Reveal key={idx} from="scale" delay={idx * 320} className="max-w-[70vw] md:max-w-[400px] text-center md:text-left">
              <p className="text-[40px] md:text-[55px] font-medium leading-[48px] md:leading-[55px] mb-[12px] text-[#1099a1]">{step.num}</p>
              <h3 className="text-[20px] md:text-[25px] font-medium leading-[28px] md:leading-[35px] mb-[12px]">{step.title}</h3>
              <p className="text-[#4a4a4a] text-[16px] md:text-[18px] leading-[26px] md:leading-[30px] mb-[12px]">{step.desc}</p>
              {step.hasButton && (
                <button className="text-[#1099a1] text-[16px] md:text-[18px] uppercase hover:text-[#1099a199] transition bg-transparent border-none cursor-pointer">
                  Book Now <ArrowRight size={16} strokeWidth={2} className="inline ml-1" />
                </button>
              )}
            </Reveal>
          ))}
        </div>
      </div>
    </div>
  );
}
