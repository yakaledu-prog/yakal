/**
 * Landing page variant 1 — Services section uses ServicesV1
 * Design: Clean card layout with large number watermark, pill tags, split grid
 * Preview: /landing/1
 */
import { useState, useEffect, useRef } from "react";
import Hero from "@/sections/Hero";
import WhyJoinUs from "@/sections/WhyJoinUs";
import ServicesV1 from "@/sections/ServicesV1";
import Subjects from "@/sections/Subjects";
import ParentResources from "@/sections/ParentResources";
import About from "@/sections/About";
import Testimonials from "@/sections/Testimonials";
import Team from "@/sections/Team";
import Faq from "@/sections/Faq";
import Blog from "@/sections/Blog";
import Contact from "@/sections/Contact";
import Footer from "@/sections/Footer";
import SubjectPage from "@/pages/SubjectPage";
import BlogPage from "@/pages/BlogPage";
import { blogs } from "@/data/blogs";
import type { Page } from "@/types";

function VariantBadge() {
  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-[#1099A1] text-white text-[13px] font-bold px-4 py-2 rounded-full shadow-lg select-none pointer-events-none">
      <span className="opacity-70">Services design</span>
      <span className="bg-white/20 rounded-full px-2 py-0.5">v1</span>
    </div>
  );
}

export default function LandingV1() {
  const [page, setPage] = useState<Page>({ type: "home" });
  const savedScrollY = useRef(0);

  useEffect(() => {
    if (page.type === "home") {
      const target = page.scrollY ?? 0;
      requestAnimationFrame(() => window.scrollTo({ top: target, behavior: "instant" as ScrollBehavior }));
    }
  }, [page]);

  function navigateTo(nextPage: Page) {
    savedScrollY.current = window.scrollY;
    window.scrollTo(0, 0);
    setPage(nextPage);
  }

  function goHome() { setPage({ type: "home", scrollY: savedScrollY.current }); }

  if (page.type === "subject")
    return <SubjectPage subject={{ name: page.name, img: page.img }} onBack={goHome} />;
  if (page.type === "blog") {
    const blog = blogs.find((b) => b.slug === page.slug);
    if (blog) return <BlogPage blog={blog} onBack={goHome} />;
  }

  function scrollTo(id: string) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div className="bg-white flex flex-col gap-[60px] md:gap-[110px] items-center md:p-[20px] p-0 min-h-screen w-full">
      <VariantBadge />
      <Hero onNav={scrollTo} />
      <WhyJoinUs />
      <ServicesV1 />
      <Subjects onNavigate={navigateTo} />
      <ParentResources scrollTo={scrollTo} />
      <About />
      <Testimonials />
      <Team />
      <Faq scrollTo={scrollTo} />
      <Blog onNavigate={navigateTo} />
      <Contact />
      <Footer scrollTo={scrollTo} />
    </div>
  );
}
