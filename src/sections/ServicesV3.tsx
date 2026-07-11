import { useState } from "react";
import Reveal from "@/components/Reveal";
import { cn } from "@/utils/cn";

// ── Design 3: Bento/tab-switcher style — inspired by Apple, Notion, Raycast
// Light off-white background, two large clickable service cards that expand
// via a tab switcher. No pill badges, no program numbers.

const services = [
  {
    id: "tutoring",
    tag: "Tutoring & Enrichment",
    headline: "K-12 academics,\ntest prep & STEM",
    description:
      "One-on-one sessions plus small-group classes, summer camps, STEM bootcamps and Math Labs at our Silver Spring location — in math, sciences, ELA and SAT/ACT prep, online or in person.",
    color: "#1099A1",
    bgGrad: "from-[#f0fafa] to-white",
    ways: [
      { icon: "◎", label: "1-on-1 tutoring" },
      { icon: "⊞", label: "Group sessions" },
      { icon: "☀", label: "Summer camps" },
      { icon: "⟡", label: "STEM bootcamps" },
      { icon: "∑", label: "Math Labs" },
    ],
    roles: [
      { letter: "T", label: "Tutors", sub: "lead sessions & log progress", bg: "#1099A1" },
      { letter: "P", label: "Parents", sub: "monitor grades & messages", bg: "#97CE9D" },
      { letter: "S", label: "Students", sub: "attend & track homework", bg: "#0d7a80" },
    ],
    primaryCta: "Get started",
    secondaryCta: "Become a tutor",
  },
  {
    id: "college",
    tag: "College Admissions Consulting",
    headline: "Essentials · Premier\n· Elite",
    description:
      "Essays, balanced school lists, deadlines, and financial-aid timelines — guided one-on-one from sophomore year all the way to Decision Day.",
    color: "#CAA25F",
    bgGrad: "from-[#fdf8ef] to-white",
    ways: [],
    roles: [
      { letter: "C", label: "Counselors", sub: "guide essays & applications", bg: "#CAA25F" },
      { letter: "P", label: "Parents", sub: "monitor the roadmap", bg: "#b88b40" },
      { letter: "S", label: "Students", sub: "build their college list", bg: "#e0bc7f" },
    ],
    primaryCta: "Get started",
    secondaryCta: "Join our team",
  },
];

export default function ServicesV3() {
  const [active, setActive] = useState<string>("tutoring");
  const activeSvc = services.find((s) => s.id === active)!;

  return (
    <section
      id="services"
      className="w-full max-w-[1440px] px-[24px] md:px-[73px] py-[70px] md:py-[110px]"
    >
      {/* Header */}
      <Reveal className="text-center mb-[56px] md:mb-[72px]">
        <p
          className="text-[13px] font-bold uppercase tracking-[3px] mb-4"
          style={{ color: activeSvc.color }}
        >
          What We Offer
        </p>
        <h2 className="text-[36px] md:text-[62px] font-semibold leading-[44px] md:leading-[74px] max-w-[700px] mx-auto">
          Two programs. Every goal covered.
        </h2>
      </Reveal>

      {/* Tab selector — plain text tabs, no pill styling */}
      <div className="flex gap-8 mb-[40px] justify-center border-b border-[#e8e8e8]">
        {services.map((svc) => (
          <button
            key={svc.id}
            onClick={() => setActive(svc.id)}
            className={cn(
              "pb-3 text-[15px] font-semibold transition-all duration-200 border-b-2 -mb-px",
              active === svc.id
                ? "border-current"
                : "border-transparent text-[#aaa] hover:text-[#555]"
            )}
            style={active === svc.id ? { color: svc.color } : {}}
          >
            {svc.tag}
          </button>
        ))}
      </div>

      {/* Active service panel */}
      <Reveal key={activeSvc.id}>
        <div
          className={cn(
            "rounded-[28px] md:rounded-[40px] bg-gradient-to-br overflow-hidden border border-[#f0f0f0]",
            activeSvc.bgGrad
          )}
        >
          <div className="grid grid-cols-1 md:grid-cols-2">
            {/* Left pane */}
            <div className="p-[40px] md:p-[64px] flex flex-col justify-between min-h-[460px]">
              <div>
                <h3 className="text-[30px] md:text-[44px] font-semibold leading-[38px] md:leading-[56px] mb-6 whitespace-pre-line">
                  {activeSvc.headline}
                </h3>
                <p className="text-[#555] text-[16px] md:text-[18px] leading-[28px] md:leading-[30px] max-w-[460px]">
                  {activeSvc.description}
                </p>
              </div>

              {/* CTAs */}
              <div className="flex flex-wrap gap-3 mt-10">
                <button
                  className="px-7 py-3.5 rounded-full text-white text-[15px] font-semibold hover:opacity-90 transition-opacity shadow-md"
                  style={{ backgroundColor: activeSvc.color }}
                >
                  {activeSvc.primaryCta}
                </button>
                <button className="px-7 py-3.5 rounded-full text-[#333] text-[15px] font-semibold bg-white border border-[#e0e0e0] hover:border-[#bbb] transition-colors shadow-sm">
                  {activeSvc.secondaryCta}
                </button>
              </div>
            </div>

            {/* Right pane */}
            <div
              className="p-[40px] md:p-[64px] flex flex-col gap-8"
              style={{ backgroundColor: `${activeSvc.color}08` }}
            >
              {/* Ways to learn */}
              {activeSvc.ways.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold text-[#888] uppercase tracking-[2px] mb-5">
                    Ways to learn
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {activeSvc.ways.map((w) => (
                      <div
                        key={w.label}
                        className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 shadow-sm border border-[#f0f0f0]"
                      >
                        <span
                          className="text-[18px] shrink-0"
                          style={{ color: activeSvc.color }}
                        >
                          {w.icon}
                        </span>
                        <span className="text-[15px] font-medium text-[#333]">
                          {w.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Who's involved */}
              <div>
                <p className="text-[11px] font-bold text-[#888] uppercase tracking-[2px] mb-5">
                  Who's involved
                </p>
                <div className="flex flex-col gap-4">
                  {activeSvc.roles.map((role) => (
                    <div
                      key={role.letter}
                      className="flex items-center gap-4 bg-white rounded-2xl px-5 py-4 shadow-sm border border-[#f0f0f0]"
                    >
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-[16px] font-bold text-white shrink-0"
                        style={{ backgroundColor: role.bg }}
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
        </div>
      </Reveal>

      {/* Dot switcher */}
      <div className="flex justify-center gap-2 mt-8">
        {services.map((svc) => (
          <button
            key={svc.id}
            onClick={() => setActive(svc.id)}
            className="h-2 rounded-full transition-all duration-300"
            style={{
              backgroundColor: activeSvc.color,
              width: active === svc.id ? "24px" : "8px",
              opacity: active === svc.id ? 1 : 0.25,
            }}
          />
        ))}
      </div>
    </section>
  );
}
