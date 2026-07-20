import Reveal from "@/components/Reveal";
import { cn } from "@/utils/cn";

// Images for the services
import tutoringImg from "@/assets/images/landing-page/building-effective-study-habits.jpg";
import collegeImg from "@/assets/images/landing-page/how-to-prepare-for-standardized-tests.jpg";

// Design 5: Image-heavy alternating layout
// Professional, straightforward design using large photography.
// No abstract UI, no "vibe" coding, just clear information paired with images.

const services = [
  {
    id: "tutoring",
    tag: "Tutoring & Enrichment",
    headline: "K-12 academics, test prep & STEM",
    description:
      "One-on-one sessions plus small-group classes, summer camps, STEM bootcamps and Math Labs at our Silver Spring location. Subjects include math, sciences, ELA and SAT/ACT prep, available online or in person.",
    img: tutoringImg,
    ways: [
      "1-on-1 tutoring",
      "Group sessions",
      "Summer camps",
      "STEM bootcamps",
      "Math Labs",
    ],
    roles: [
      { label: "Tutors", sub: "lead sessions & log progress" },
      { label: "Parents", sub: "monitor grades & messages" },
      { label: "Students", sub: "attend & track homework" },
    ],
    primaryCta: "Get started",
    secondaryCta: "Become a tutor",
  },
  {
    id: "college",
    tag: "College Admissions Consulting",
    headline: "Essentials · Premier · Elite",
    description:
      "Essays, balanced school lists, deadlines, and financial-aid timelines. Guided one-on-one from sophomore year all the way to Decision Day.",
    img: collegeImg,
    ways: [],
    roles: [
      { label: "Counselors", sub: "guide essays & applications" },
      { label: "Parents", sub: "monitor the roadmap" },
      { label: "Students", sub: "build their college list" },
    ],
    primaryCta: "Get started",
    secondaryCta: "Join our team",
  },
];

export default function ServicesV5() {
  return (
    <section id="services" className="w-full bg-white py-[60px] md:py-[100px]">
      <div className="max-w-[1440px] mx-auto px-[24px] md:px-[73px]">
        {/* Header */}
        <Reveal className="mb-[60px] md:mb-[100px] text-center">
          <p className="text-[14px] font-bold uppercase tracking-[2px] mb-4 text-[#1099A1]">
            What We Offer
          </p>
          <h2 className="text-[36px] md:text-[56px] font-semibold leading-[44px] md:leading-[64px] text-[#111]">
            Programs for every goal
          </h2>
        </Reveal>

        {/* Services rows */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 w-full">
          {services.map((svc) => (
            <Reveal 
              key={svc.id} 
              className="bg-white rounded-[16px] border border-[#e5e7eb] shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col overflow-hidden"
            >
              {/* Image top */}
              <div className="w-full relative aspect-[16/9] border-b border-[#e5e7eb]">
                <img
                  src={svc.img}
                  alt={svc.tag}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Content bottom */}
              <div className="flex flex-col p-8 md:p-10 flex-1">
                <p className="text-[13px] font-bold uppercase tracking-[2px] mb-3 text-[#1099A1]">
                  {svc.tag}
                </p>
                <h3 className="text-[28px] md:text-[32px] font-semibold leading-tight mb-4 text-[#111]">
                  {svc.headline}
                </h3>
                <p className="text-[16px] text-[#555] leading-[26px] mb-8">
                  {svc.description}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-10 flex-1">
                  {/* Ways to learn */}
                  {svc.ways.length > 0 && (
                    <div>
                      <p className="text-[12px] font-bold text-[#888] uppercase tracking-[1px] mb-3">
                        Ways to learn
                      </p>
                      <ul className="flex flex-col gap-2">
                        {svc.ways.map((w) => (
                          <li key={w} className="flex items-center gap-2 text-[14px] text-[#333]">
                            <span className="w-1.5 h-1.5 bg-[#1099A1] rounded-full shrink-0" />
                            {w}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Who's involved */}
                  <div>
                    <p className="text-[12px] font-bold text-[#888] uppercase tracking-[1px] mb-3">
                      Who's involved
                    </p>
                    <ul className="flex flex-col gap-2">
                      {svc.roles.map((role) => (
                        <li key={role.label} className="text-[14px]">
                          <span className="font-semibold text-[#111]">{role.label}:</span>{" "}
                          <span className="text-[#555]">{role.sub}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* CTAs */}
                <div className="flex flex-wrap gap-3 mt-auto">
                  <button onClick={() => window.open('https://calendly.com/binyammamo01/parent-counseling-session', '_blank')} className="btn-shimmer px-6 py-3 rounded-[500px] text-white text-[14px] font-semibold transition-opacity shadow-sm uppercase hover:opacity-90 w-full sm:w-auto">
                    {svc.primaryCta}
                  </button>
                  <button className="px-6 py-3 bg-white border border-[#ccc] hover:border-[#aaa] text-[#333] rounded-[500px] text-[14px] font-semibold transition-colors uppercase w-full sm:w-auto text-center">
                    {svc.secondaryCta}
                  </button>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
