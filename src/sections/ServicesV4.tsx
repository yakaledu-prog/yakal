import Reveal from "@/components/Reveal";
import { cn } from "@/utils/cn";

// ── Design 4: Side-by-side variant of Design 3
// Both service panels visible at the same time in a two-column layout.
// Same card aesthetic as V3 - no pill badges, no program numbers.

const services = [
  {
    id: "tutoring",
    tag: "Tutoring & Enrichment",
    headline: "K-12 academics, test prep & STEM",
    description:
      "One-on-one sessions plus small-group classes, summer camps, STEM bootcamps and Math Labs at our Silver Spring location. Subjects include math, sciences, ELA and SAT/ACT prep, available online or in person.",
    color: "#1099A1",
    bg: "#f0fafa",
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
    headline: "Essentials · Premier · Elite",
    description:
      "Essays, balanced school lists, deadlines, and financial-aid timelines. Guided one-on-one from sophomore year all the way to Decision Day.",
    color: "#CAA25F",
    bg: "#fdf8ef",
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

function ServiceCard({ svc, delay }: { svc: typeof services[0]; delay: number }) {
  return (
    <Reveal delay={delay} className="flex-1 min-w-0">
      <div
        className="rounded-[28px] md:rounded-[36px] overflow-hidden border border-[#f0f0f0] h-full flex flex-col"
        style={{ backgroundColor: svc.bg }}
      >
        {/* Top: text content */}
        <div className="p-[36px] md:p-[52px] flex flex-col flex-1">
          {/* Service name */}
          <p
            className="text-[13px] font-bold uppercase tracking-[2px] mb-5"
            style={{ color: svc.color }}
          >
            {svc.tag}
          </p>

          <h3 className="text-[24px] md:text-[34px] font-semibold leading-[32px] md:leading-[44px] mb-5">
            {svc.headline}
          </h3>
          <p className="text-[#555] text-[15px] md:text-[17px] leading-[26px] md:leading-[28px] mb-8">
            {svc.description}
          </p>

          {/* Ways to learn */}
          {svc.ways.length > 0 && (
            <div className="mb-8">
              <p className="text-[11px] font-bold text-[#888] uppercase tracking-[2px] mb-4">
                Ways to learn
              </p>
              <div className="grid grid-cols-2 gap-2">
                {svc.ways.map((w) => (
                  <div
                    key={w.label}
                    className="flex items-center gap-2.5 bg-white rounded-xl px-3 py-2.5 shadow-sm border border-[#f0f0f0]"
                  >
                    <span
                      className="text-[16px] shrink-0"
                      style={{ color: svc.color }}
                    >
                      {w.icon}
                    </span>
                    <span className="text-[13px] font-medium text-[#333] leading-tight">
                      {w.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Who's involved */}
          <div className="mb-8">
            <p className="text-[11px] font-bold text-[#888] uppercase tracking-[2px] mb-4">
              Who's involved
            </p>
            <div
              className="rounded-2xl overflow-hidden border border-[#f0f0f0]"
              style={{ backgroundColor: `${svc.color}06` }}
            >
              {svc.roles.map((role, i) => (
                <div
                  key={role.letter}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3.5 bg-white",
                    i !== svc.roles.length - 1 && "border-b border-[#f0f0f0]"
                  )}
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-[14px] font-bold text-white shrink-0"
                    style={{ backgroundColor: role.bg }}
                  >
                    {role.letter}
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold text-[#111] leading-tight">
                      {role.label}
                    </p>
                    <p className="text-[12px] text-[#777]">{role.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CTAs - pushed to bottom */}
          <div className="flex flex-wrap gap-3 mt-auto pt-2">
            <button
              className="px-6 py-3 rounded-full text-white text-[14px] font-semibold hover:opacity-90 transition-opacity shadow-sm"
              style={{ backgroundColor: svc.color }}
            >
              {svc.primaryCta}
            </button>
            <button className="px-6 py-3 rounded-full text-[#333] text-[14px] font-semibold bg-white border border-[#e0e0e0] hover:border-[#bbb] transition-colors shadow-sm">
              {svc.secondaryCta}
            </button>
          </div>
        </div>
      </div>
    </Reveal>
  );
}

export default function ServicesV4() {
  return (
    <section
      id="services"
      className="w-full max-w-[1440px] px-[24px] md:px-[73px] py-[70px] md:py-[110px]"
    >
      {/* Header */}
      <Reveal className="text-center mb-[56px] md:mb-[72px]">
        <p className="text-[13px] font-bold uppercase tracking-[3px] mb-4 text-[#1099A1]">
          What We Offer
        </p>
        <h2 className="text-[36px] md:text-[62px] font-semibold leading-[44px] md:leading-[74px] max-w-[700px] mx-auto">
          Two programs. Every goal covered.
        </h2>
      </Reveal>

      {/* Side-by-side cards */}
      <div className="flex flex-col md:flex-row gap-[20px] md:gap-[24px] items-stretch">
        {services.map((svc, i) => (
          <ServiceCard key={svc.id} svc={svc} delay={i * 100} />
        ))}
      </div>
    </section>
  );
}
