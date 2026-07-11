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
    <div id="about" className="w-full flex flex-col gap-[80px] md:gap-[160px] py-[60px] md:py-[100px] items-center bg-[#fafafa]">
      

      {/* 1. About Yakal (Side-by-side layout) */}
      <div className="w-full max-w-[1440px] px-[24px] md:px-[73px]">
        <div className="flex flex-col md:flex-row gap-[40px] md:gap-[80px] items-center">
          <Reveal className="w-full md:w-1/2 flex flex-col items-start text-left">
            <h2 className="text-[36px] md:text-[64px] font-semibold leading-[44px] md:leading-[74px] mb-[24px] text-[#111]">
              Empowering students to excel academically.
            </h2>
            <p className="text-[#555] text-[16px] md:text-[18px] leading-[28px] md:leading-[32px] mb-[32px]">
              Yakal is an educational consultancy dedicated to helping students excel academically. We provide personalized tutoring, flexible learning options, and guidance that empowers every student to reach their full potential.
            </p>
            <button className="px-[30px] py-[14px] bg-[#111] text-white rounded-[8px] text-[15px] font-medium hover:bg-[#333] transition-colors">
              Learn More About Us
            </button>
          </Reveal>
          
          <Reveal className="w-full md:w-1/2" delay={200}>
            <div className="relative aspect-[4/3] rounded-[16px] overflow-hidden shadow-xl border border-[#eee]">
              <img src={imgAboutBanner1} alt="About Yakal" className="w-full h-full object-cover" />
            </div>
          </Reveal>
        </div>
      </div>

      {/* 2. What We Offer (Card Grid Layout) */}
      <div className="w-full max-w-[1440px] px-[24px] md:px-[73px]">
        <Reveal className="text-center mb-[48px] md:mb-[72px]">
          <p className="text-[14px] font-bold uppercase tracking-[2px] mb-4 text-[#1099A1]">
            Our Expertise
          </p>
          <h2 className="text-[32px] md:text-[48px] font-semibold leading-[40px] md:leading-[56px] text-[#111]">
            Comprehensive services designed to help students succeed
          </h2>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[24px]">
          {/* Featured Image Card */}
          <div className="col-span-1 md:col-span-2 lg:col-span-1 lg:row-span-2 rounded-[16px] overflow-hidden shadow-sm border border-[#eaeaea]">
            <img src={imgImg2_1} alt="What We Offer" className="w-full h-full object-cover min-h-[300px]" />
          </div>
          
          {/* Offering Cards */}
          {offerings.map((item, idx) => (
            <Reveal key={idx} delay={idx * 100} className="bg-white p-[32px] rounded-[16px] shadow-sm border border-[#eaeaea] flex flex-col justify-center">
              <CheckCircle size={28} strokeWidth={1.5} className="text-[#1099A1] mb-[20px]" />
              <h3 className="text-[20px] font-semibold text-[#111] mb-[12px]">{item.title}</h3>
              <p className="text-[#555] leading-[26px]">{item.desc}</p>
            </Reveal>
          ))}
        </div>
      </div>

      {/* 3. How to Get Connected (Clean Steps) */}
      <div className="w-full max-w-[1440px] px-[24px] md:px-[73px]">
        <div className="bg-[#111] text-white rounded-[24px] p-[40px] md:p-[80px]">
          <Reveal className="text-center mb-[60px]">
            <h2 className="text-[32px] md:text-[48px] font-semibold leading-[40px] md:leading-[56px]">
              How to get connected
            </h2>
            <p className="text-[#aaa] mt-4 text-[18px]">Three simple steps to start your journey.</p>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-[40px] md:gap-[60px] relative">
            {/* Connecting line for desktop */}
            <div className="hidden md:block absolute top-[28px] left-[15%] right-[15%] h-[1px] bg-white/20 z-0" />

            {steps.map((step, idx) => (
              <Reveal key={idx} delay={idx * 200} className="relative z-10 flex flex-col items-center text-center">
                <div className="w-[56px] h-[56px] rounded-full bg-[#1099A1] text-white flex items-center justify-center text-[24px] font-bold mb-[24px] shadow-lg ring-[8px] ring-[#111]">
                  {step.num}
                </div>
                <h3 className="text-[22px] font-medium mb-[12px] text-white">{step.title}</h3>
                <p className="text-white/70 leading-[26px] mb-[20px] max-w-[280px]">{step.desc}</p>
                {step.hasButton && (
                  <button className="flex items-center gap-2 text-[#1099A1] font-semibold hover:text-white transition-colors">
                    Book Now <ArrowRight size={18} />
                  </button>
                )}
              </Reveal>
            ))}
          </div>
        </div>
      </div>
      
    </div>
  );
}
