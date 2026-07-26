import Reveal from "@/components/Reveal";
import { cn } from "@/utils/cn";
import { Users, BookOpen, ArrowRight } from "lucide-react";

// Images for the services
import tutoringImg from "@/assets/images/landing-page/building-effective-study-habits.jpg";
import collegeImg from "@/assets/images/landing-page/how-to-prepare-for-standardized-tests.jpg";

// Design 5: Image-heavy alternating layout
// Professional, straightforward design using large photography.
// No abstract UI, no "vibe" coding, just clear information paired with images.

const services = [
  {
    id: "tutoring",
    badge: "Program 01",
    headline: "Tutoring &\nEnrichment",
    description:
      "Personalized academic support designed to build mastery, confidence, and critical thinking skills across all core subjects. Move beyond rote memorization to...",
    img: tutoringImg,
    format: "1-on-1 & Small Group",
    focus: "Core Subjects & STEM",
    cta: "Explore Tutoring",
  },
  {
    id: "college",
    badge: "Program 02",
    headline: "College Admissions\nConsulting",
    description:
      "Essays, balanced school lists, deadlines, and financial-aid timelines. Guided one-on-one from sophomore year all the way to Decision Day.",
    img: collegeImg,
    format: "Guided 1-on-1",
    focus: "Applications & Essays",
    cta: "Explore Admissions",
  },
];

export default function ServicesV5() {
  return (
    <section id="services" className="w-full bg-white pt-[20px] md:pt-[40px] pb-[20px] md:pb-[40px]">
      <div className="max-w-[1440px] mx-auto px-[24px] md:px-[73px]">
        {/* Header */}
        <Reveal className="mb-[40px] md:mb-[60px] text-center">
          <p className="text-[14px] font-bold uppercase tracking-[2px] mb-4 text-[#1099A1]">
            What We Offer
          </p>
          <h2 className="text-[36px] md:text-[56px] font-semibold leading-[44px] md:leading-[64px] text-[#111]">
            Programs for every goal
          </h2>
        </Reveal>

        {/* Services rows */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 w-full">
          {services.map((svc) => (
            <Reveal
              key={svc.id}
              className="relative rounded-[24px] overflow-hidden group min-h-[500px] md:min-h-[700px] flex flex-col justify-between p-8 md:p-12 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
            >
              {/* Background Image & Gradient Overlay */}
              <div className="absolute inset-0 z-0">
                <img
                  src={svc.img}
                  alt={svc.headline}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                {/* Dark teal gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-b from-[#1099A1]/80 via-[#0a4246]/80 to-[#051e20]/95 mix-blend-multiply" />
              </div>

              {/* Content Top */}
              <div className="relative z-10">
                <span className="inline-block bg-[#1099A1] text-white text-[12px] font-bold uppercase tracking-[1px] px-4 py-1.5 rounded-[500px] mb-6">
                  {svc.badge}
                </span>
                <h3 className="text-[40px] md:text-[56px] font-semibold leading-[1.1] mb-6 text-white whitespace-pre-line">
                  {svc.headline}
                </h3>
                <p className="text-[16px] md:text-[18px] text-white/90 leading-[28px] max-w-[400px]">
                  {svc.description}
                </p>
              </div>

              {/* Content Bottom */}
              <div className="relative z-10 mt-12 md:mt-auto">
                <div className="grid grid-cols-2 gap-6 mb-8 border-b border-white/20 pb-8">
                  <div>
                    <p className="text-[12px] font-bold text-white/60 uppercase tracking-[1px] mb-2">
                      FORMAT
                    </p>
                    <div className="flex items-center gap-2 text-[15px] font-medium text-white">
                      <Users size={18} className="shrink-0" />
                      {svc.format}
                    </div>
                  </div>
                  <div>
                    <p className="text-[12px] font-bold text-white/60 uppercase tracking-[1px] mb-2">
                      FOCUS
                    </p>
                    <div className="flex items-center gap-2 text-[15px] font-medium text-white">
                      <BookOpen size={18} className="shrink-0" />
                      {svc.focus}
                    </div>
                  </div>
                </div>

                {/* CTA */}
                <button 
                  onClick={() => window.open('https://calendly.com/binyammamo01/parent-counseling-session', '_blank')} 
                  className="inline-flex items-center gap-2 px-6 py-3 bg-[#1099A1] text-white rounded-[8px] text-[15px] font-semibold transition-all shadow-sm hover:bg-[#0c7a81]"
                >
                  {svc.cta} <ArrowRight size={18} />
                </button>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
