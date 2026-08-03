import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import Reveal from "@/components/Reveal";
import Carousel from "@/components/Carousel";
import { getPublicTutors } from "@/services/tutorService";
import { dicebearUrl } from "@/utils/avatar";
import imgTeam1 from "@/assets/images/team-eyasu.webp";
import imgTeam2 from "@/assets/images/team-daniel.webp";
import imgTeam3 from "@/assets/images/team-bethlehem.webp";
import imgTeam4 from "@/assets/images/team-hana.webp";

type Member = { name: string; subjects: string; img: string; details: string };

// The founding four, kept in the source with their own photographs. They are
// the page's floor: a database reset, a failed request or a fresh environment
// still shows a full team rather than an empty scroller. Tutors from the
// database are appended to them.
const founders: Member[] = [
  {
    name: "Eyasu (Josh)",
    subjects: "Physics | Geometry 1 & 2 | Algebra 1 & 2",
    img: imgTeam1,
    details: "Eyasu holds a deep passion for the sciences and mathematics. With years of experience guiding students through complex concepts, he focuses on practical problem-solving and building strong foundational understanding that helps students excel not just in exams, but in their overall academic journeys."
  },
  {
    name: "Daniel",
    subjects: "Physics | Geometry 1 & 2 | Algebra 1 & 2",
    img: imgTeam2,
    details: "Daniel specializes in making advanced mathematics and physics accessible and engaging. He adapts his teaching methods to match each student's unique learning style, ensuring that even the most challenging topics become clear, intuitive, and manageable."
  },
  {
    name: "Bethlehem",
    subjects: "Physics | Geometry 1 & 2 | Algebra 1 & 2",
    img: imgTeam3,
    details: "Bethlehem is dedicated to empowering students by building their confidence in STEM subjects. Her patient, step-by-step approach breaks down difficult algebraic and physical principles, fostering a supportive environment where students feel comfortable asking questions and making mistakes."
  },
  {
    name: "Hana",
    subjects: "Physics | Geometry 1 & 2 | Algebra 1 & 2",
    img: imgTeam4,
    details: "Hana brings a dynamic and highly interactive approach to tutoring. By connecting theoretical physics and geometry to real-world scenarios, she helps students see the 'why' behind the math, dramatically improving both retention and genuine interest in the subjects."
  },
];

/** Pixels a second. Slow enough to read a name as it passes. */
const DRIFT_SPEED = 22;
/** How long the row rests at each end before turning back. */
const DRIFT_DWELL_MS = 1400;

/**
 * Drifts a horizontal row back and forth on its own.
 *
 * Only while there is something off screen to reveal, only while the row is
 * in view, and never while a pointer is over it: somebody reading a card or
 * reaching for Read Full Bio should not have it slide away from them.
 */
function useAutoScroll(ref: React.RefObject<HTMLDivElement | null>, deps: unknown[]) {
  const paused = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Somebody who has asked the system for less movement has asked for this
    // too. The row stays put and scrolls by hand.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let visible = true;
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0 });
    io.observe(el);

    const pause = () => { paused.current = true; };
    const resume = () => { paused.current = false; };
    el.addEventListener("pointerenter", pause);
    el.addEventListener("pointerleave", resume);
    el.addEventListener("focusin", pause);
    el.addEventListener("focusout", resume);

    let direction = 1;
    let restUntil = 0;
    let last = performance.now();
    let frame = requestAnimationFrame(function step(now) {
      frame = requestAnimationFrame(step);
      const elapsed = (now - last) / 1000;
      last = now;

      if (paused.current || !visible || document.hidden || now < restUntil) return;

      const furthest = el.scrollWidth - el.clientWidth;
      if (furthest <= 1) return; // everything already fits

      const next = el.scrollLeft + direction * DRIFT_SPEED * elapsed;
      if (next >= furthest) {
        el.scrollLeft = furthest;
        direction = -1;
        restUntil = now + DRIFT_DWELL_MS;
      } else if (next <= 0) {
        el.scrollLeft = 0;
        direction = 1;
        restUntil = now + DRIFT_DWELL_MS;
      } else {
        el.scrollLeft = next;
      }
    });

    return () => {
      cancelAnimationFrame(frame);
      io.disconnect();
      el.removeEventListener("pointerenter", pause);
      el.removeEventListener("pointerleave", resume);
      el.removeEventListener("focusin", pause);
      el.removeEventListener("focusout", resume);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

function TeamCard({
  member,
  expanded,
  onToggle,
}: {
  member: Member;
  /** Left out on desktop, where each card opens on its own. */
  expanded?: boolean;
  onToggle?: () => void;
}) {
  const [ownExpanded, setOwnExpanded] = useState(false);
  const controlled = expanded !== undefined;
  const isOpen = controlled ? expanded : ownExpanded;

  return (
    <div className="bg-white rounded-tl-[20px] rounded-tr-[20px] md:rounded-[30px] border border-[#eaecf0] overflow-hidden flex flex-col h-full shadow-sm hover:shadow-md transition-shadow">
      <div className="bg-[#a4d5f0] h-[240px] md:h-[230px] overflow-hidden shrink-0">
        <img src={member.img} alt={member.name} className="w-full h-full object-cover" />
      </div>
      <div className="p-[16px] md:p-[20px] text-center flex flex-col flex-grow">
        <h4 className="text-[16px] md:text-[18px] font-bold mb-[6px] md:mb-[8px] text-[#111]">{member.name}</h4>
        <p className="text-[#1099A1] font-medium text-[12px] md:text-[14px] mb-3">{member.subjects}</p>

        {/* Animated Accordion for Details */}
        <div
          className={`grid transition-all duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr] opacity-100 mb-4 mt-2' : 'grid-rows-[0fr] opacity-0'
            }`}
        >
          <div className="overflow-hidden">
            <p className="text-[13px] md:text-[14px] text-[#555] leading-relaxed text-left border-t border-gray-100 pt-3">
              {member.details}
            </p>
          </div>
        </div>

        <div className="mt-auto pt-2">
          <button
            onClick={() => (controlled ? onToggle?.() : setOwnExpanded(!ownExpanded))}
            className="flex items-center justify-center gap-[6px] w-full text-[13px] md:text-[14px] font-semibold text-[#54656f] hover:text-[#1099A1] transition-colors py-2 rounded-lg bg-gray-50 hover:bg-[#1099a1]/5"
          >
            {isOpen ? "Show Less" : "Read Full Bio"}
            <ChevronDown size={16} className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Team() {
  const { data: tutors = [] } = useQuery({
    queryKey: ["public-tutors"],
    queryFn: getPublicTutors,
  });

  // Every card in the carousel opens together. The track is as tall as its
  // tallest slide, so opening one card on its own stretched every other slide
  // to match and left them with a bio's worth of empty space under a button
  // that said Read Full Bio.
  const [openAll, setOpenAll] = useState(false);

  const rowRef = useRef<HTMLDivElement>(null);

  const members: Member[] = [
    ...founders,
    ...tutors.map((t) => ({
      name: t.full_name,
      subjects: (t.subjects ?? []).join(" | "),
      // Rings when a tutor has not uploaded a photograph: a placeholder that
      // reads as a placeholder, rather than one pretending to be a portrait.
      img: t.avatar_url || dicebearUrl(t.full_name, "rings"),
      details: t.bio ?? "",
    })),
  ];

  // Re-measured when the tutor list arrives, since the row is not scrollable
  // until there are more cards than fit.
  useAutoScroll(rowRef, [members.length]);

  return (
    <div className="w-full max-w-[1440px] py-[50px]">
      <Reveal className="text-center mb-[40px] md:mb-[70px]">
        <p className="text-[#acacac] text-[16px] md:text-[20px] font-semibold uppercase mb-[12px] md:mb-[16px]">Yakal Tutor</p>
        <h2 className="text-[32px] md:text-[56px] font-medium leading-[40px] md:leading-[66px]">Our Team</h2>
      </Reveal>

      {/* Mobile: one card per view, infinite carousel */}
      <div className="md:hidden px-[40px]">
        <Carousel
          slides={members.map((member, idx) => (
            <TeamCard
              key={idx}
              member={member}
              expanded={openAll}
              onToggle={() => setOpenAll((v) => !v)}
            />
          ))}
        />
      </div>

      {/* Desktop: four across, the rest scrolled to, drifting on its own so
          the fifth tutor is discoverable without a scrollbar to hint at them.
          A grid wrapped that fifth card onto a second row that sat mostly
          empty, and grew another gap with every signup. */}
      <div
        ref={rowRef}
        className="hidden md:flex gap-[30px] px-[10px] items-start overflow-x-auto hide-scrollbar"
      >
        {members.map((member, idx) => (
          <Reveal key={idx} delay={idx * 80} className="shrink-0 w-[calc((100%-90px)/4)]">
            <TeamCard member={member} />
          </Reveal>
        ))}
      </div>
    </div>
  );
}
