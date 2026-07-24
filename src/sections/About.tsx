import { useState } from "react";
import { ArrowRight, X } from "lucide-react";
import Reveal from "@/components/Reveal";
import imgAboutBanner1 from "@/assets/images/landing-page/about-yakal.webp";


const steps = [
  { num: "1", title: "Choose a format", desc: "Choose and decide a virtual and in-person session." },
  { num: "2", title: "Get to know your tutors", desc: "Look at the website, know your tutors and understand their skills." },
  { num: "3", title: "Book Your Free Sessions", desc: "Click the link below and lets chat!", hasButton: true },
];

export default function About() {
  const [isVideoOpen, setIsVideoOpen] = useState(false);

  return (
    <div id="about" className="w-full flex flex-col gap-[40px] md:gap-[60px] pt-[60px] md:pt-[100px] pb-[20px] md:pb-[40px] items-center bg-[#fafafa]">
      

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
            <button 
              onClick={() => setIsVideoOpen(true)}
              className="btn-shimmer px-[30px] py-[14px] rounded-[500px] text-[15px] md:text-[16px] text-white font-medium uppercase shadow-lg hover:opacity-90 transition-opacity"
            >
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


      {/* 3. How to Get Connected (Clean Steps) */}
      <div className="w-full max-w-[1440px] px-[24px] md:px-[73px]">
        <div className="bg-[#FAFAFA] text-[#111] rounded-[24px] p-[40px] md:p-[80px]">
          <Reveal className="text-center mb-[60px]">
            <h2 className="text-[32px] md:text-[48px] font-semibold leading-[40px] md:leading-[56px]">
              How to get connected
            </h2>
            <p className="text-[#555] mt-4 text-[18px]">Three simple steps to start your journey.</p>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-[40px] md:gap-[60px] relative">
            {/* Connecting line for desktop */}
            <div className="hidden md:block absolute top-[28px] left-[15%] right-[15%] h-[1px] bg-[#eaeaea] z-0" />

            {steps.map((step, idx) => (
              <Reveal key={idx} delay={idx * 200} className="relative z-10 flex flex-col items-center text-center">
                <div className="w-[56px] h-[56px] rounded-full bg-[#1099A1] text-white flex items-center justify-center text-[24px] font-bold mb-[24px] shadow-sm ring-[8px] ring-white">
                  {step.num}
                </div>
                <h3 className="text-[22px] font-medium mb-[12px] text-[#111]">{step.title}</h3>
                <p className="text-[#555] leading-[26px] mb-[20px] max-w-[280px]">{step.desc}</p>
                {step.hasButton && (
                  <button onClick={() => window.open('https://calendly.com/binyammamo01/parent-counseling-session', '_blank')} className="btn-shimmer text-white px-[25px] py-[12px] rounded-[500px] text-[14px] md:text-[15px] uppercase shadow-lg hover:opacity-90 transition-opacity flex items-center gap-[6px]">
                    Book Now <ArrowRight size={18} />
                  </button>
                )}
              </Reveal>
            ))}
          </div>
        </div>
      </div>

      {/* Video Modal Placeholder */}
      {isVideoOpen && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" 
          onClick={() => setIsVideoOpen(false)}
        >
          <div 
            className="relative w-full max-w-[900px] aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200" 
            onClick={e => e.stopPropagation()}
          >
            <button 
              onClick={() => setIsVideoOpen(false)}
              className="absolute top-4 right-4 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/80 transition-colors"
            >
              <X size={20} />
            </button>
            <div className="w-full h-full flex flex-col items-center justify-center text-white p-8 text-center bg-gradient-to-br from-[#1099A1] to-[#0a6c72]">
               <h3 className="text-2xl md:text-4xl font-bold mb-4">Our Pitch Video</h3>
               <p className="text-base md:text-lg opacity-80 max-w-lg">
                 This is a placeholder for your upcoming advertisement or pitch video. 
                 Once ready, we can embed the actual video player here!
               </p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
