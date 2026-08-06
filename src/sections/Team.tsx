import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Star } from "lucide-react";
import Reveal from "@/components/Reveal";
import Carousel from "@/components/Carousel";
import { getPublicTutors } from "@/services/tutorService";
import { dicebearUrl } from "@/utils/avatar";
import imgTeam1 from "@/assets/images/team-eyasu.webp";
import imgTeam2 from "@/assets/images/team-daniel.webp";
import imgTeam3 from "@/assets/images/team-bethlehem.webp";
import imgTeam4 from "@/assets/images/team-hana.webp";

type Member = {
  name: string;
  subjects: string;
  img: string;
  details: string;
  /** Absent on the founders, who are not rated. Null on a tutor nobody rated. */
  averageStars?: number | null;
  ratingCount?: number;
};

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
/** Matches the gap-[30px] between cards, needed to work out card offsets. */
const CARD_GAP = 30;

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
        <p className="text-[#1099A1] font-medium text-[12px] md:text-[14px] mb-2">{member.subjects}</p>

        {/* Only for tutors, and only once somebody has rated them. The founders
            carry no rating, and an unrated tutor shows nothing rather than an
            empty row of stars, which reads as a bad score. */}
        {member.averageStars != null && (member.ratingCount ?? 0) > 0 && (
          <div className="mb-3 flex items-center justify-center gap-1.5">
            <Star size={14} className="text-[#CAA25F]" fill="currentColor" strokeWidth={0} />
            <span className="text-[13px] font-semibold text-[#111]">{member.averageStars.toFixed(1)}</span>
            <span className="text-[12px] text-[#667781]">({member.ratingCount})</span>
          </div>
        )}

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

/**
 * The desktop row: four cards across, the rest scrolled to.
 *
 * It drifts on its own and carries the same pill indicators as the phone
 * carousel, because with the scrollbar hidden there was otherwise nothing at
 * all to say that a fifth tutor existed.
 */
function TeamRow({ members }: { members: Member[] }) {
  const rowRef = useRef<HTMLDivElement>(null);
  const paused = useRef(false);
  const [active, setActive] = useState(0);
  const [scrollable, setScrollable] = useState(false);

  /** Width of one card plus its gap, measured rather than assumed. */
  const stride = () => {
    const el = rowRef.current;
    if (!el) return 0;
    const first = el.firstElementChild as HTMLElement | null;
    return first ? first.getBoundingClientRect().width + CARD_GAP : 0;
  };

  const syncIndicator = () => {
    const el = rowRef.current;
    if (!el) return;
    setScrollable(el.scrollWidth - el.clientWidth > 1);
    const step = stride();
    if (step > 0) setActive(Math.round(el.scrollLeft / step));
  };

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;

    syncIndicator();
    const onResize = () => syncIndicator();
    window.addEventListener("resize", onResize);

    // Somebody who has asked the system for less movement has asked for this
    // too. The row stays put, and the indicators still say it scrolls.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return () => window.removeEventListener("resize", onResize);
    }

    let visible = true;
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0 });
    io.observe(el);

    const pause = () => { paused.current = true; };
    const resume = () => { paused.current = false; };
    el.addEventListener("pointerenter", pause);
    el.addEventListener("pointerleave", resume);
    el.addEventListener("focusin", pause);
    el.addEventListener("focusout", resume);

    // Position is tracked here rather than read back from scrollLeft each
    // frame. At this speed a frame moves about a third of a pixel, and a
    // browser that rounds scrollLeft to whole pixels would hand back the same
    // value every time, leaving the row apparently motionless.
    let position = el.scrollLeft;
    let direction = 1;
    let restUntil = 0;
    let last = performance.now();

    let frame = requestAnimationFrame(function step(now) {
      frame = requestAnimationFrame(step);
      const elapsed = (now - last) / 1000;
      last = now;

      if (paused.current || !visible || document.hidden || now < restUntil) {
        // Keep up with a scroll the reader did by hand.
        position = el.scrollLeft;
        return;
      }

      const furthest = el.scrollWidth - el.clientWidth;
      if (furthest <= 1) return; // everything already fits

      position += direction * DRIFT_SPEED * elapsed;
      if (position >= furthest) {
        position = furthest;
        direction = -1;
        restUntil = now + DRIFT_DWELL_MS;
      } else if (position <= 0) {
        position = 0;
        direction = 1;
        restUntil = now + DRIFT_DWELL_MS;
      }
      el.scrollLeft = position;
    });

    return () => {
      cancelAnimationFrame(frame);
      io.disconnect();
      window.removeEventListener("resize", onResize);
      el.removeEventListener("pointerenter", pause);
      el.removeEventListener("pointerleave", resume);
      el.removeEventListener("focusin", pause);
      el.removeEventListener("focusout", resume);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members.length]);

  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (resumeTimer.current) clearTimeout(resumeTimer.current); }, []);

  const goTo = (i: number) => {
    const el = rowRef.current;
    if (!el) return;
    // Held while the smooth scroll runs. The drift writes scrollLeft on every
    // frame, so without this it would overwrite the jump before it had moved
    // a pixel and the indicator would look dead.
    paused.current = true;
    el.scrollTo({ left: i * stride(), behavior: "smooth" });
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => { paused.current = false; }, 900);
  };

  return (
    <div className="hidden md:block">
      <div
        ref={rowRef}
        onScroll={syncIndicator}
        // overflow-y pinned shut on purpose. Setting only overflow-x makes the
        // other axis scrollable too under CSS rules, and the reveal animation
        // starts each card 22px low, which was enough to give the row its own
        // vertical scroll and let cards disappear up out of it.
        className="flex gap-[30px] px-[10px] py-[10px] items-start overflow-x-auto overflow-y-hidden hide-scrollbar"
      >
        {members.map((member, idx) => (
          // Four across, with the next card's edge just showing. A row that
          // ends exactly on a card boundary looks like the whole list.
          <Reveal key={idx} delay={idx * 80} className="shrink-0 w-[calc((100%-110px)/4)]">
            <TeamCard member={member} />
          </Reveal>
        ))}
      </div>

      {scrollable && (
        <div className="flex justify-center items-center gap-[6px] mt-[22px]">
          {members.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              aria-label={`Show tutor ${i + 1}`}
              className="border-none cursor-pointer rounded-full transition-all duration-300 p-0"
              style={{
                height: "4px",
                width: i === active ? "28px" : "8px",
                backgroundColor: i === active ? "#1099a1" : "rgba(0,0,0,0.2)",
              }}
            />
          ))}
        </div>
      )}
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

  const members: Member[] = [
    ...founders,
    ...tutors.map((t) => ({
      name: t.full_name,
      subjects: (t.subjects ?? []).join(" | "),
      // Rings when a tutor has not uploaded a photograph: a placeholder that
      // reads as a placeholder, rather than one pretending to be a portrait.
      img: t.avatar_url || dicebearUrl(t.full_name, "rings"),
      details: t.bio ?? "",
      averageStars: t.average_stars,
      ratingCount: t.rating_count,
    })),
  ];

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

      <TeamRow members={members} />
    </div>
  );
}
