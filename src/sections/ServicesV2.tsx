import Reveal from "@/components/Reveal";

// ── Design 2: Linear/agency style — inspired by Linear, Stripe, Vercel
// Full-bleed dark section, horizontal rule dividers, minimal typography,
// sticky service number on scroll, text-forward.

const services = [
  {
    number: "01",
    tag: "Tutoring & Enrichment",
    headline: "K-12 academics, test prep & STEM",
    description:
      "One-on-one sessions plus small-group classes, summer camps, STEM bootcamps and Math Labs at our Silver Spring location — in math, sciences, ELA and SAT/ACT prep, online or in person.",
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
    ctas: [{ label: "Get started →" }, { label: "Become a tutor" }],
  },
  {
    number: "02",
    tag: "College Admissions Consulting",
    headline: "Essentials · Premier · Elite",
    description:
      "Essays, balanced school lists, deadlines, and financial-aid timelines — guided one-on-one from sophomore year all the way to Decision Day.",
    ways: [],
    roles: [
      { letter: "C", label: "Counselors", sub: "guide essays & applications" },
      { letter: "P", label: "Parents", sub: "monitor the roadmap" },
      { letter: "S", label: "Students", sub: "build their college list" },
    ],
    ctas: [{ label: "Get started →" }, { label: "Join our team" }],
  },
];

export default function ServicesV2() {
  return (
    <section
      id="services"
      className="w-full bg-[#0a0a0a] text-white"
    >
      <div className="max-w-[1440px] mx-auto px-[24px] md:px-[73px]">
        {/* Top label row */}
        <div className="flex items-center justify-between py-[28px] border-b border-white/10">
          <span className="text-[13px] text-white/40 uppercase tracking-[3px] font-medium">
            What We Offer
          </span>
          <span className="text-[13px] text-white/30 font-mono">
            02 programs
          </span>
        </div>

        {/* Headline */}
        <Reveal>
          <h2 className="text-[40px] md:text-[72px] font-semibold leading-[48px] md:leading-[84px] py-[48px] md:py-[72px] max-w-[900px]">
            Programs built for every stage of the{" "}
            <span className="text-[#1099A1]">journey</span>.
          </h2>
        </Reveal>

        {/* Services list — divider rows */}
        {services.map((svc, i) => (
          <Reveal key={i} delay={i * 100}>
            <div className="border-t border-white/[0.08] py-[48px] md:py-[64px] grid grid-cols-1 md:grid-cols-12 gap-[32px] md:gap-[48px] group">

              {/* Col 1: Number + tag */}
              <div className="md:col-span-3">
                <p className="text-[#1099A1] font-mono text-[13px] mb-3">
                  {svc.number}
                </p>
                <p className="text-white/50 text-[14px] leading-snug max-w-[200px]">
                  {svc.tag}
                </p>
              </div>

              {/* Col 2: Main body */}
              <div className="md:col-span-6">
                <h3 className="text-[28px] md:text-[38px] font-semibold leading-[36px] md:leading-[50px] mb-6 group-hover:text-[#1099A1] transition-colors duration-300">
                  {svc.headline}
                </h3>
                <p className="text-white/55 text-[16px] md:text-[17px] leading-[28px] mb-8">
                  {svc.description}
                </p>

                {/* Ways */}
                {svc.ways.length > 0 && (
                  <div className="mb-8">
                    <p className="text-[11px] text-white/30 uppercase tracking-[2px] mb-3">
                      Ways to learn
                    </p>
                    <div className="flex flex-col gap-[10px]">
                      {svc.ways.map((w) => (
                        <div
                          key={w}
                          className="flex items-center gap-3 text-[15px] text-white/70"
                        >
                          <span className="w-4 h-px bg-[#1099A1] inline-block shrink-0" />
                          {w}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* CTAs */}
                <div className="flex flex-wrap gap-3 mt-2">
                  {svc.ctas.map((cta, ci) => (
                    <button
                      key={cta.label}
                      className={
                        ci === 0
                          ? "px-6 py-3 bg-[#1099A1] hover:bg-[#0d848b] text-white rounded-lg text-[15px] font-semibold transition-colors duration-200"
                          : "px-6 py-3 border border-white/20 hover:border-white/50 text-white/70 hover:text-white rounded-lg text-[15px] transition-colors duration-200"
                      }
                    >
                      {cta.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Col 3: Who's involved */}
              <div className="md:col-span-3">
                <p className="text-[11px] text-white/30 uppercase tracking-[2px] mb-5">
                  Who's involved
                </p>
                <div className="flex flex-col gap-5">
                  {svc.roles.map((role) => (
                    <div key={role.letter} className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-md bg-white/10 flex items-center justify-center text-[13px] font-bold text-white shrink-0">
                        {role.letter}
                      </div>
                      <div>
                        <p className="text-[14px] font-semibold text-white/90">
                          {role.label}
                        </p>
                        <p className="text-[13px] text-white/40 leading-snug">
                          {role.sub}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        ))}

        {/* Bottom pad */}
        <div className="border-t border-white/[0.08] py-[28px] flex items-center justify-between">
          <span className="text-white/20 text-[13px]">Yakal Education Services</span>
          <span className="text-white/20 text-[13px]">Silver Spring, MD</span>
        </div>
      </div>
    </section>
  );
}
