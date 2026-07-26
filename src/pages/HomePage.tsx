import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import Hero from "@/sections/Hero";
import WhyJoinUs from "@/sections/WhyJoinUs";
import Services from "@/sections/Services";
import Subjects from "@/sections/Subjects";
import ParentResources from "@/sections/ParentResources";
import About from "@/sections/About";
import Testimonials from "@/sections/Testimonials";
import Team from "@/sections/Team";
import Faq from "@/sections/Faq";
import Blog from "@/sections/Blog";
import Contact from "@/sections/Contact";
import Footer from "@/sections/Footer";
import type { Page } from "@/types";

export default function HomePage({ onNavigate }: { onNavigate: (page: Page) => void }) {
  const location = useLocation();

  useEffect(() => {
    if (location.hash === '#blog' || location.state?.scrollTo === 'blog') {
      // Small timeout to ensure DOM layout is complete before scrolling
      setTimeout(() => {
        const el = document.getElementById('blog');
        if (el) {
          el.scrollIntoView({ behavior: "auto" });
        }
      }, 100);
    }
  }, [location.hash, location.state]);

  function scrollTo(id: string) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div className="bg-white flex flex-col gap-[20px] md:gap-[60px] items-center md:p-[20px] p-0 min-h-screen w-full">
      <Hero onNav={scrollTo} />
      <About />
      <WhyJoinUs />
      <Services />
      <Subjects onNavigate={onNavigate} />
      <ParentResources scrollTo={scrollTo} />
      <Testimonials />
      <Team />
      <Blog />
      <Faq scrollTo={scrollTo} />
      <Contact />
      <Footer scrollTo={scrollTo} />
    </div>
  );
}
