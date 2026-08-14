import { Link } from "react-router-dom";
import { useSiteSettings, openBookingUrl } from "@/hooks/useSiteSettings";
import Reveal from "@/components/Reveal";
import { Users, ArrowRight, CheckCircle2, UserCircle2, GraduationCap, Compass, Rocket, Crown } from "lucide-react";

// Images for the services
import tutoringImg from "@/assets/images/landing-page/building-effective-study-habits.jpg";
import collegeImg from "@/assets/images/landing-page/how-to-prepare-for-standardized-tests.jpg";

// Design 5: Image-heavy alternating layout
// Professional, straightforward design using large photography.
// No abstract UI, no "vibe" coding, just clear information paired with images.

type ServiceItem = { label: string; sub?: string; icon?: React.ReactNode };

const services = [
  {
    id: "tutoring",
    badge: "Program 01",
    headline: "Tutoring &\nEnrichment",
    description:
      "Personalized academic support designed to build mastery, confidence, and critical thinking skills across all core subjects. Move beyond rote memorization to...",
    img: tutoringImg,
    col1Title: "Focus",
    col1Items: [
      { label: "1-on-1 Tutoring" },
      { label: "Group Sessions" },
      { label: "STEM Bootcamps" },
      { label: "Summer Camps" },
      { label: "Math Labs" },
    ] as ServiceItem[],
    col2Title: "For",
    roles: [
      { icon: "tutor", label: "Tutors", sub: "Lead sessions & track progress" },
      { icon: "parent", label: "Parents", sub: "Monitor grades & communication" },
      { icon: "student", label: "Students", sub: "Learn, practice & improve" },
    ],
    primaryCta: "Free consultation",
    secondaryCta: "Become a Tutor",
  },
  {
    id: "college",
    badge: "Program 02",
    headline: "College Admissions\nConsulting",
    description:
      "Essays, balanced school lists, deadlines, and financial-aid timelines. Guided one-on-one from sophomore year all the way to Decision Day.",
    img: collegeImg,
    col1Title: "Plans",
    col1Items: [
      { label: "Essentials", sub: "Build a strong admissions foundation.", icon: <Compass size={18} className="text-white shrink-0 mt-[2px]" /> },
      { label: "Premier", sub: "More strategy, guidance, and momentum.", icon: <Rocket size={18} className="text-white shrink-0 mt-[2px]" /> },
      { label: "Elite", sub: "Complete end-to-end admissions support.", icon: <Crown size={18} className="text-white shrink-0 mt-[2px]" /> }
    ] as ServiceItem[],
    col2Title: "For",
    roles: [
      { icon: "counselor", label: "Counselors", sub: "Guide applications & essays" },
      { icon: "parent", label: "Parents", sub: "Track deadlines & milestones" },
      { icon: "student", label: "Students", sub: "Build a competitive application" },
    ],
    primaryCta: "Free consultation",
    secondaryCta: "Join Our Team",
  },
];

function getRoleIcon(type: string) {
  switch (type) {
    case "tutor":
    case "counselor":
      return <Users size={16} className="text-white shrink-0 mt-[2px]" />;
    case "parent":
      return <UserCircle2 size={16} className="text-white shrink-0 mt-[2px]" />;
    case "student":
      return <GraduationCap size={16} className="text-white shrink-0 mt-[2px]" />;
    default:
      return <Users size={16} className="text-white shrink-0 mt-[2px]" />;
  }
}

export default function Services() {
  const { bookingUrl } = useSiteSettings();
  return (
    <section id="services" className="w-full bg-white pt-[20px] md:pt-[40px] pb-[20px] md:pb-[40px]">
      <div className="max-w-[1440px] mx-auto px-[24px] md:px-[73px]">
        {/* Header */}
        <Reveal className="mb-[40px] md:mb-[60px] text-center">
          <p className="text-[14px] font-bold uppercase tracking-[2px] mb-4 text-primary">
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
                <div className="absolute inset-0 bg-gradient-to-b from-primary/80 via-[#0a4246]/80 to-[#051e20]/95 mix-blend-multiply" />
              </div>

              {/* Content Top */}
              <div className="relative z-10">
                {/* <span className="inline-block bg-primary text-white text-[12px] font-bold uppercase tracking-[1px] px-4 py-1.5 rounded-[500px] mb-6">
                  {svc.badge}
                </span> */}
                <h3 className="text-[40px] md:text-[56px] font-semibold leading-[1.1] mb-6 text-white whitespace-pre-line">
                  {svc.headline}
                </h3>
                <p className="text-[16px] md:text-[18px] text-white/90 leading-[28px] text-justify">
                  {svc.description}
                </p>
              </div>

              {/* Content Bottom */}
              <div className="relative z-10 mt-12 md:mt-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-8 border-b border-white/20 pb-8 flex-1">
                  {/* Column 1 */}
                  {svc.col1Items.length > 0 && (
                    <div>
                      <p className="text-[12px] font-bold text-white/60 uppercase tracking-[1px] mb-4">
                        {svc.col1Title}
                      </p>
                      <ul className="flex flex-col gap-3">
                        {svc.col1Items.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-3">
                            {item.icon ? item.icon : <CheckCircle2 size={16} className="text-white shrink-0 mt-[2px]" />}
                            <div className="flex flex-col">
                              <span className="text-[14px] text-white/90 font-medium leading-tight mb-0.5">
                                {item.label}
                              </span>
                              {item.sub && (
                                <span className="text-[13px] text-white/70 leading-tight">
                                  {item.sub}
                                </span>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Column 2 */}
                  <div>
                    <p className="text-[12px] font-bold text-white/60 uppercase tracking-[1px] mb-4">
                      {svc.col2Title}
                    </p>
                    <ul className="flex flex-col gap-4">
                      {svc.roles.map((role) => (
                        <li key={role.label} className="flex items-start gap-2.5">
                          {getRoleIcon(role.icon)}
                          <div className="flex flex-col">
                            <span className="text-[14px] font-semibold text-white leading-tight mb-0.5">{role.label}</span>
                            <span className="text-[13px] text-white/70 leading-tight">{role.sub}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* CTAs */}
                <div className="flex flex-wrap gap-3 mt-auto">
                  <button onClick={() => openBookingUrl(bookingUrl)} className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white rounded-[8px] text-[14px] font-semibold transition-all shadow-sm hover:bg-[#0c7a81] w-full sm:w-auto">
                    {svc.primaryCta} <ArrowRight size={16} />
                  </button>
                  {/* Applying is a sign-up, so it goes where signing up happens
                      rather than to a call. */}
                  <Link to="/login" className="px-6 py-3 bg-transparent border border-white hover:bg-white/10 text-white rounded-[8px] text-[14px] font-semibold transition-colors w-full sm:w-auto text-center">
                    {svc.secondaryCta}
                  </Link>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
