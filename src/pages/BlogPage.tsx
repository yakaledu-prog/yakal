import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import type { Blog } from "@/data/blogs";

export default function BlogPage({ blog, onBack }: { blog: Blog; onBack: () => void }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  useEffect(() => {
    function onScroll() {
      const el = document.documentElement;
      const scrolled = el.scrollTop;
      const total = el.scrollHeight - el.clientHeight;
      setProgress(total > 0 ? (scrolled / total) * 100 : 0);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="bg-white min-h-screen w-full">
      {/* Reading progress bar */}
      <div className="fixed top-0 left-0 right-0 z-50 h-[3px] bg-transparent">
        <div
          className="h-full bg-[#1099a1] transition-all duration-100"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="max-w-[900px] mx-auto px-[24px] md:px-[40px] py-[40px]">
        <button onClick={onBack} className="flex items-center gap-[8px] text-[16px] md:text-[18px] mb-[32px] hover:opacity-70 transition bg-transparent border-none cursor-pointer">
          <ArrowLeft size={20} strokeWidth={2} />
          <span>Back</span>
        </button>

        <h1 className="text-[32px] md:text-[46px] font-medium leading-[42px] md:leading-[56px] mb-[12px]">{blog.title}</h1>
        <div className="flex items-center gap-[12px] text-[#4a4a4a] text-[14px] md:text-[16px] mb-[28px]">
          <span>{blog.readTime}</span>
          <span>&#8226;</span>
          <span>{blog.date}</span>
        </div>

        <div className="w-full h-[220px] md:h-[400px] rounded-[16px] overflow-hidden mb-[36px]">
          <img src={blog.img} alt={blog.title} className="w-full h-full object-cover" />
        </div>

        <p className="text-[#4a4a4a] text-[16px] md:text-[18px] leading-[28px] md:leading-[30px] mb-[6px]">{blog.desc}</p>
        <p className="text-[14px] text-[#999] mb-[28px]">Introduction</p>

        <div className="space-y-[28px]">
          {blog.content.map((section, i) => (
            <div key={i}>
              {section.heading && (
                <h2 className="text-[22px] md:text-[28px] font-semibold leading-[32px] md:leading-[38px] mb-[10px]">{section.heading}</h2>
              )}
              <div className="text-[#4a4a4a] text-[16px] md:text-[18px] leading-[28px] md:leading-[30px]">
                {section.body.split("\n\n").map((para, j) => (
                  <p key={j} className="mb-[10px]">{para}</p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
