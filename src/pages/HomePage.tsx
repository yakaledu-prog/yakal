import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Hero from "@/sections/Hero";
import WhyJoinUs from "@/sections/WhyJoinUs";
import Services from "@/sections/Services";
import CounsellingTiers from "@/sections/CounsellingTiers";
import Subjects from "@/sections/Subjects";
import ParentResources from "@/sections/ParentResources";
import About from "@/sections/About";
import Testimonials from "@/sections/Testimonials";
import Team from "@/sections/Team";
import Faq from "@/sections/Faq";
import Blog from "@/sections/Blog";
import Contact from "@/sections/Contact";
import Footer from "@/sections/Footer";
import { LandingAssistant } from "@/components/assistant/LandingAssistant";
import type { Page } from "@/types";

export default function HomePage({ onNavigate }: { onNavigate: (page: Page) => void }) {
  const location = useLocation();
  const navigate = useNavigate();

  /**
   * Land on the section the URL names.
   *
   * Only "#blog" was handled, so every other anchor did nothing: opening
   * /#counselling, reloading one, or following a link somebody had shared all
   * came up at the top of the page.
   *
   * The retry is the part that matters. This is a single page app, so on a
   * cold load React has not drawn the sections yet when the browser would
   * normally do the jump, and the fonts and hero image move everything down
   * again as they arrive. Rather than the fixed 100ms guess this replaces,
   * it looks for the element each frame for a second and stops as soon as it
   * finds one.
   */
  useEffect(() => {
    const id = location.hash.slice(1) || (location.state?.scrollTo as string | undefined);
    if (!id) return;

    let frame = 0;
    let raf = 0;
    const tryScroll = () => {
      const el = document.getElementById(id);
      if (el) {
        // Instant, not smooth: arriving with a hash should feel like the page
        // opened there, not like it scrolled while you watched.
        el.scrollIntoView({ behavior: "auto" });
        return;
      }
      if (frame++ < 60) raf = requestAnimationFrame(tryScroll);
    };
    raf = requestAnimationFrame(tryScroll);
    return () => cancelAnimationFrame(raf);
  }, [location.hash, location.state]);

  /**
   * Scroll, and say so in the address bar.
   *
   * It used to only scroll. The URL stayed at "/" however far down you were,
   * so there was nothing to copy, nothing to send somebody, and a reload put
   * you back at the top. Pushing the hash makes those work and makes the back
   * button walk the sections, which is what a plain anchor would have done.
   */
  function scrollTo(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth" });
    navigate(`#${id}`, { replace: false });
  }

  return (
    <div className="bg-white text-[#111827] flex flex-col gap-[20px] md:gap-[60px] items-center md:p-[20px] p-0 min-h-screen w-full">
      <Hero onNav={scrollTo} />
      <About />
      <WhyJoinUs />
      <Services />
      <Subjects onNavigate={onNavigate} />
      {/* After Services, which introduces admissions consulting as a program,
          so the prices arrive once somebody knows what they are for. */}
      <CounsellingTiers scrollTo={scrollTo} />
      <ParentResources />
      <Testimonials />
      <Team />
      <Blog />
      <Faq scrollTo={scrollTo} />
      <Contact />
      <Footer scrollTo={scrollTo} />

      {/* Here rather than in a shared layout: it answers questions a visitor
          has, and a signed-in parent asking "when is my next session" would get
          "I cannot see that", which is worse than no button at all. */}
      <LandingAssistant />
    </div>
  );
}
