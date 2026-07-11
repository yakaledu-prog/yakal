import Reveal from "@/components/Reveal";

// Design 2: Row-divider style, light theme to match the rest of the page.
// Clean editorial layout with a 3-column grid, horizontal rule dividers, minimal typography.

const services = [
  {
    number: "01",
    tag: "Tutoring & Enrichment",
    headline: "K-12 academics, test prep & STEM",
    description:
      "One-on-one sessions plus small-group classes, summer camps, STEM bootcamps and Math Labs at our Silver Spring location. Subjects include math, sciences, ELA and SAT/ACT prep, available online or in person.",
    ways: [
      "1-on-1 tutoring",
      "Group sessions",
      "Summer camps",
      "STEM bootcamps",
      "Math Labs",
    ],
    roles: [
      { letter: "T", label: "Tutors", sub: "lead sessions & log progress", bg: "#1099A1" },
      { letter: "P", label: "Parents", sub: "monitor grades & messages", bg: "#97CE9D" },
      { letter: "S", label: "Students", sub: "attend & track homework", bg: "#0d7a80" },
    ],
    ctas: [{ label: "Get started", primary: true }, { label: "Become a tutor", primary: false }],
  },
  {
    number: "02",
    tag: "College Admissions Consulting",
    headline: "Essentials · Premier · Elite",
    description:
      "Essays, balanced school lists, deadlines, and financial-aid timelines. Guided one-on-one from sophomore year all the way to Decision Day.",
    ways: [],
    roles: [
      { letter: "C", label: "Counselors", sub: "guide essays & applications", bg: "#CAA25F" },
      { letter: "P", label: "Parents", sub: "monitor the roadmap", bg: "#b88b40" },
      { letter: "S", label: "Students", sub: "build their college list", bg: "#e0bc7f" },
    ],
    ctas: [{ label: "Get started", primary: true }, { label: "Join our team", primary: false }],
  },
];

export default function ServicesV2() {
  return (
    <section
      id="services"
      className="w-full max-w-[1440px] px-[24px] md:px-[73px] py-[70px] md:py-[110px]"
    >
      {/* Top label row */}
      <div className="flex items-center justify-between pb-[28px] border-b border-[#e8e8e8] mb-[48px] md:mb-[64px]">
        <span className="text-[13px] text-[#1099A1] uppercase tracking-[3px] font-bold">
          What We Offer
        </span>
        <span className="text-[13px] text-[#aaa] font-medium">
          2 programs
        </span>
      </div>

      {/* Headline */}
      <Reveal>
        <h2 className="text-[36px] md:text-[62px] font-semibold leading-[44px] md:leading-[74px] max-w-[820px] mb-[56px] md:mb-[80px]">
          Programs built for every stage of the journey
        </h2>
      </Reveal>

      {/* Services list */}
      {services.map((svc, i) => (
        <Reveal key={i} delay={i * 100}>
          <div className="border-t border-[#ebebeb] py-[48px] md:py-[60px] grid grid-cols-1 md:grid-cols-12 gap-[32px] md:gap-[48px] group">

            {/* Col 1: Number + tag */}
            <div className="md:col-span-3">
              <p className="text-[#1099A1] text-[13px] font-bold mb-2">{svc.number}</p>
              <p className="text-[#888] text-[14px] leading-snug">{svc.tag}</p>
            </div>

            {/* Col 2: Main body */}
            <div className="md:col-span-6">
              <h3 className="text-[26px] md:text-[36px] font-semibold leading-[34px] md:leading-[48px] mb-5 group-hover:text-[#1099A1] transition-colors duration-300">
                {svc.headline}
              </h3>
              <p className="text-[#555] text-[16px] md:text-[17px] leading-[28px] mb-8">
                {svc.description}
              </p>

              {/* Ways to learn */}
              {svc.ways.length > 0 && (
                <div className="mb-8">
                  <p className="text-[11px] font-bold text-[#aaa] uppercase tracking-[2px] mb-4">
                    Ways to learn
                  </p>
                  <div className="flex flex-col gap-3">
                    {svc.ways.map((w) => (
                      <div
                        key={w}
                        className="flex items-center gap-3 text-[15px] text-[#444]"
                      >
                        <span className="w-4 h-px bg-[#1099A1] inline-block shrink-0" />
                        {w}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* CTAs */}
              <div className="flex flex-wrap gap-3 mt-4">
                {svc.ctas.map((cta) => (
                  <button
                    key={cta.label}
                    className={
                      cta.primary
                        ? "px-6 py-3 bg-[#1099A1] hover:bg-[#0d848b] text-white rounded-full text-[15px] font-semibold transition-colors duration-200"
                        : "px-6 py-3 border border-[#ddd] hover:border-[#bbb] text-[#333] rounded-full text-[15px] transition-colors duration-200"
                    }
                  >
                    {cta.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Col 3: Who's involved */}
            <div className="md:col-span-3">
              <p className="text-[11px] font-bold text-[#aaa] uppercase tracking-[2px] mb-5">
                Who's involved
              </p>
              <div className="flex flex-col gap-4">
                {svc.roles.map((role) => (
                  <div key={role.letter} className="flex items-start gap-3">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold text-white shrink-0"
                      style={{ backgroundColor: role.bg }}
                    >
                      {role.letter}
                    </div>
                    <div>
                      <p className="text-[14px] font-semibold text-[#111]">{role.label}</p>
                      <p className="text-[13px] text-[#888] leading-snug">{role.sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      ))}

      {/* Bottom rule */}
      <div className="border-t border-[#ebebeb]" />
    </section>
  );
}
