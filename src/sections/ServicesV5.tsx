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
        <div className="flex w-full gap-[8px] md:gap-[80px]">
          {services.map((svc, index) => {
            const isEven = index % 2 === 0;

            return (
              <Reveal key={svc.id} className="bg-white rounded ">
                {/* Image half */}
                <div className="w-full md:w-[80%] py-8 mx-auto">
                  <div className="relative aspect-[4/3] rounded-[16px] overflow-hidden shadow-lg border border-[#eee]">
                    <img
                      src={svc.img}
                      alt={svc.tag}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
                <div
                  className={cn(
                    "flex flex-col gap-[40px] md:gap-[80px] items-center",
                    isEven ? "md:flex-row" : "md:flex-row-reverse"
                  )}
                >

                  {/* Content half */}
                  <div className="w-full max-w-[90%] flex flex-col justify-center">
                    <h3 className="text-[32px] md:text-[42px] font-semibold leading-[40px] md:leading-[52px] mb-6 text-[#111]">
                      {svc.headline}
                    </h3>
                    <p className="text-[14px] font-bold uppercase tracking-[2px] mb-4 text-[#1099A1]">
                      {svc.tag}
                    </p>
                    <p className="text-[16px] md:text-[18px] text-[#555] leading-[28px] mb-8 max-w-[500px]">
                      {svc.description}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-10">
                      {/* Ways to learn */}
                      {svc.ways.length > 0 && (
                        <div>
                          <p className="text-[13px] font-bold text-[#888] uppercase tracking-[1px] mb-4">
                            Ways to learn
                          </p>
                          <ul className="flex flex-col gap-2">
                            {svc.ways.map((w) => (
                              <li key={w} className="flex items-center gap-2 text-[15px] text-[#333]">
                                <span className="w-1.5 h-1.5 bg-[#1099A1] rounded-full shrink-0" />
                                {w}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Who's involved */}
                      <div>
                        <p className="text-[13px] font-bold text-[#888] uppercase tracking-[1px] mb-4">
                          Who's involved
                        </p>
                        <ul className="flex flex-col gap-3">
                          {svc.roles.map((role) => (
                            <li key={role.label} className="text-[15px]">
                              <span className="font-semibold text-[#111]">{role.label}:</span>{" "}
                              <span className="text-[#555]">{role.sub}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* CTAs */}
                    <div className="flex flex-wrap gap-4">
                      <button onClick={() => window.open('https://calendly.com/binyammamo01/parent-counseling-session', '_blank')} className="btn-shimmer px-8 py-3.5 rounded-[500px] text-white text-[15px] font-semibold transition-opacity shadow-sm uppercase hover:opacity-90">
                        {svc.primaryCta}
                      </button>
                      <button className="px-8 py-3.5 bg-white border border-[#ccc] hover:border-[#aaa] text-[#333] rounded-[500px] text-[15px] font-semibold transition-colors uppercase">
                        {svc.secondaryCta}
                      </button>
                    </div>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
