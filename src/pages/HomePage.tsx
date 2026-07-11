import Hero from "@/sections/Hero";
import WhyJoinUs from "@/sections/WhyJoinUs";
import ServicesV5 from "@/sections/ServicesV5";
import Subjects from "@/sections/Subjects";
import ParentResources from "@/sections/ParentResources";
import About from "@/sections/About";
import AboutV2 from "@/sections/AboutV2";
import Testimonials from "@/sections/Testimonials";
import Team from "@/sections/Team";
import Faq from "@/sections/Faq";
import Blog from "@/sections/Blog";
import Contact from "@/sections/Contact";
import Footer from "@/sections/Footer";
import type { Page } from "@/types";

export default function HomePage({ onNavigate }: { onNavigate: (page: Page) => void }) {
  function scrollTo(id: string) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div className="bg-white flex flex-col gap-[60px] md:gap-[110px] items-center md:p-[20px] p-0 min-h-screen w-full">
      <Hero onNav={scrollTo} />
      <About />
      <AboutV2 />
      <WhyJoinUs />
      <ServicesV5 />
      <Subjects onNavigate={onNavigate} />
      <ParentResources scrollTo={scrollTo} />
      <Testimonials />
      <Team />
      <Faq scrollTo={scrollTo} />
      <Blog onNavigate={onNavigate} />
      <Contact />
      <Footer scrollTo={scrollTo} />
    </div>
  );
}
