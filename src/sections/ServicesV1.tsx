import Reveal from "@/components/Reveal";
import { cn } from "@/utils/cn";

// ── Data ────────────────────────────────────────────────────────────────────

const services = [
  {
    number: "01",
    tag: "Tutoring & Enrichment",
    headline: "K-12 Academics, Test Prep & STEM",
    description:
      "One-on-one sessions plus small-group classes, summer camps, STEM bootcamps and Math Labs at our Silver Spring location. Subjects include math, sciences, ELA and SAT/ACT prep, available online or in person.",
    accent: "#1099A1",
    accentLight: "#f0fafa",
    ways: [
      "1-on-1 tutoring",
      "Group sessions",
      "Summer camps",
      "STEM bootcamps",
      "Math Labs",
    ],
    roles: [
      { letter: "T", label: "Tutors", sub: "lead sessions & log progress" },
      { letter: "P", label: "Parents", sub: "monitor grades & messages" },
      { letter: "S", label: "Students", sub: "attend & track homework" },
    ],
    ctas: [
      { label: "Get started", primary: true },
      { label: "Become a tutor", primary: false },
    ],
  },
  {
    number: "02",
    tag: "College Admissions Consulting",
    headline: "Essentials · Premier · Elite",
    description:
      "Essays, balanced school lists, deadlines, and financial-aid timelines. Guided one-on-one from sophomore year all the way to Decision Day.",
    accent: "#CAA25F",
    accentLight: "#fdf8ef",
    ways: [],
    roles: [
      { letter: "C", label: "Counselors", sub: "guide essays & applications" },
      { letter: "P", label: "Parents", sub: "monitor the roadmap" },
      { letter: "S", label: "Students", sub: "build their college list" },
    ],
    ctas: [
      { label: "Get started", primary: true },
      { label: "Join our team", primary: false },
    ],
  },
];

// ── Component ────────────────────────────────────────────────────────────────

export default function ServicesV1() {
  return (
    <section
      id="services"
      className="w-full max-w-[1440px] px-[24px] md:px-[73px] py-[60px] md:py-[110px]"
    >
      {/* Header */}
      <Reveal className="mb-[56px] md:mb-[80px]">
        <p className="text-[#1099A1] text-[14px] font-semibold uppercase tracking-[3px] mb-4">
          What We Offer
        </p>
        <h2 className="text-[36px] md:text-[60px] font-medium leading-[44px] md:leading-[70px] max-w-[760px]">
          Programs built for every stage of the journey
        </h2>
      </Reveal>

      {/* Services */}
      <div className="flex flex-col gap-[32px] md:gap-[24px]">
        {services.map((svc, i) => (
          <Reveal key={i} delay={i * 120}>
            <div
              className="group relative rounded-[24px] md:rounded-[32px] overflow-hidden border border-[#f0f0f0] hover:border-transparent transition-all duration-500 hover:shadow-[0_24px_70px_rgba(0,0,0,0.10)]"
              style={{ background: svc.accentLight }}
            >
              {/* Number watermark */}
              <span
                className="absolute top-[-18px] right-[-12px] text-[120px] md:text-[180px] font-black leading-none select-none pointer-events-none opacity-[0.06] transition-opacity duration-500 group-hover:opacity-[0.10]"
                style={{ color: svc.accent }}
              >
                {svc.number}
              </span>

              <div className="relative z-10 p-[32px] md:p-[56px] grid grid-cols-1 md:grid-cols-12 gap-[40px] md:gap-[56px]">
                {/* Left: main content */}
                <div className="md:col-span-7">
                  {/* Tag - plain text label, no pill */}
                  <p
                    className="text-[13px] font-bold uppercase tracking-[2px] mb-5"
                    style={{ color: svc.accent }}
                  >
                    {svc.tag}
                  </p>

                  <h3 className="text-[28px] md:text-[40px] font-semibold leading-[36px] md:leading-[52px] mb-5">
                    {svc.headline}
                  </h3>
                  <p className="text-[#555] text-[16px] md:text-[18px] leading-[28px] max-w-[560px]">
                    {svc.description}
                  </p>

                  {/* Ways to learn */}
                  {svc.ways.length > 0 && (
                    <div className="mt-8">
                      <p className="text-[12px] font-bold text-[#888] uppercase tracking-[2px] mb-3">
                        Ways to learn
                      </p>
                      <div className="flex flex-col gap-2">
                        {svc.ways.map((w) => (
                          <div
                            key={w}
                            className="flex items-center gap-2.5 text-[15px]"
                            style={{ color: svc.accent }}
                          >
                            <span className="w-3 h-px inline-block shrink-0" style={{ backgroundColor: svc.accent }} />
                            <span className="text-[#444] font-medium">{w}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* CTAs */}
                  <div className="flex flex-wrap gap-3 mt-10">
                    {svc.ctas.map((cta) => (
                      <button
                        key={cta.label}
                        className={cn(
                          "px-6 py-3 rounded-full text-[15px] font-semibold transition-all duration-200",
                          cta.primary
                            ? "text-white hover:opacity-90 shadow-sm hover:shadow-md"
                            : "border text-[#333] hover:bg-white/80"
                        )}
                        style={
                          cta.primary
                            ? { backgroundColor: svc.accent }
                            : { borderColor: `${svc.accent}40` }
                        }
                      >
                        {cta.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Right: Who's involved */}
                <div className="md:col-span-5 flex flex-col justify-center">
                  <p className="text-[12px] font-bold text-[#888] uppercase tracking-[2px] mb-5">
                    Who's involved
                  </p>
                  <div className="flex flex-col gap-4">
                    {svc.roles.map((role) => (
                      <div key={role.letter} className="flex items-center gap-4">
                        <div
                          className="w-11 h-11 rounded-full flex items-center justify-center text-[18px] font-bold text-white shrink-0"
                          style={{ backgroundColor: svc.accent }}
                        >
                          {role.letter}
                        </div>
                        <div>
                          <p className="text-[15px] font-semibold text-[#111]">
                            {role.label}
                          </p>
                          <p className="text-[13px] text-[#777]">{role.sub}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
