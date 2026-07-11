/**
 * Landing page variant 5 - Services section uses ServicesV5
 * Design: Classic, image-heavy alternating layout. No vibe-coded UI.
 * Preview: /landing/5
 */
import { useState, useEffect, useRef } from "react";
import Hero from "@/sections/Hero";
import WhyJoinUs from "@/sections/WhyJoinUs";
import ServicesV5 from "@/sections/ServicesV5";
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

export default function LandingV5() {
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
      <Hero onNav={scrollTo} />
      <WhyJoinUs />
      <ServicesV5 />
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
