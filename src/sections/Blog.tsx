import { useEffect, useState } from "react";
import Reveal from "@/components/Reveal";
import SkeletonImg from "@/components/SkeletonImg";
import { getPosts, BlogPost } from "@/services/cmsService";
import { format } from "date-fns";
import type { Page } from "@/types";

export default function Blog({ onNavigate }: { onNavigate: (page: Page) => void }) {
  const [blogs, setBlogs] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPosts() {
      const allPosts = await getPosts();
      setBlogs(allPosts.filter(p => p.status === "published").slice(0, 4)); // Get first 4
      setLoading(false);
    }
    loadPosts();
  }, []);

  if (loading) return null; // Or a simple skeleton

  const featured = blogs[0];

  return (
    <div id="blog" className="w-full max-w-[1440px] pb-[40px] md:pb-[77px]">
      <Reveal className="text-center mb-[40px] md:mb-[70px] max-w-[1290px] mx-auto px-[24px] md:px-[18px]">
        <h2 className="text-[44px] md:text-[76px] font-medium leading-[52px] md:leading-[86px] mb-[16px] md:mb-[20px]">From Our Blog</h2>
        <p className="text-[#4a4a4a] text-[16px] md:text-[18px] leading-[26px] md:leading-[30px]">
          Explore tips, guides, and insights to help students excel academically.
        </p>
      </Reveal>

      {/* Featured */}
      {featured && (
        <div className="bg-[#f4f4f4] rounded-[20px] md:rounded-[30px] p-[24px] md:p-[56px] mb-[40px] md:mb-[70px]">
          <div className="flex flex-col md:flex-row items-center justify-between gap-[32px]">
            <div className="w-full md:max-w-[520px]">
              <div className="flex md:hidden w-full md:w-[500px] md:h-[500px] h-[240px] rounded-[20px] md:rounded-[30px] overflow-hidden">
                {featured.thumbnail_url && <img src={featured.thumbnail_url} alt="Blog" className="w-full h-full object-cover" />}
              </div>
              <div className="flex items-center gap-[12px] mb-[12px] mt-[14px] px-2">
                <span className="text-[#4a4a4a] text-[14px] md:text-[18px]">{featured.read_time_minutes} Min Read</span>
                <div className="w-[5px] h-[5px] bg-[#4a4a4a] rounded-full"></div>
                <span className="text-[#4a4a4a] text-[14px] md:text-[18px]">{format(new Date(featured.created_at), "MMM d, yyyy")}</span>
              </div>
              <h3 className="text-[28px] md:text-[46px] font-medium leading-[36px] md:leading-[56px] mb-[12px] md:mb-[16px] px-2 truncate md:whitespace-normal md:overflow-visible md:text-clip">{featured.title}</h3>
              <p className="text-[#4a4a4a] text-[16px] md:text-[18px] leading-[26px] md:leading-[30px] mb-[28px] md:mb-[48px] px-2 text-justify line-clamp-4">
                {featured.content.replace(/<[^>]*>?/gm, " ").replace(/\s+/g, " ").trim()}
              </p>
              <button
                onClick={() => onNavigate({ type: "blog", id: featured.id, scrollY: window.scrollY })}
                className="bg-[#1099a1] px-[40px] md:px-[60px] py-[14px] md:py-[15px] rounded-[500px] text-white text-[16px] md:text-[18px] uppercase hover:bg-[#0d7d84] transition mx-auto md:mx-0 block"
              >
                Read the Article
              </button>
            </div>
            <div className="hidden md:flex w-full md:w-[500px] md:h-[500px] h-[240px] rounded-[20px] md:rounded-[30px] overflow-hidden bg-gray-200">
              {featured.thumbnail_url && <img src={featured.thumbnail_url} alt="Blog" className="w-full h-full object-cover" />}
            </div>
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-[24px] md:gap-[30px] px-[12px] md:px-0">
        {blogs.slice(1).map((blog, idx) => (
          <Reveal key={blog.id} delay={idx * 100}>
            <div className="px-2">
              <div className="h-[220px] md:h-[350px] rounded-[20px] md:rounded-[30px] overflow-hidden mb-[16px] md:mb-[20px] bg-gray-100">
                {blog.thumbnail_url && <SkeletonImg src={blog.thumbnail_url} alt={blog.title} className="w-full h-full object-cover" />}
              </div>
              <div className="flex items-center gap-[12px] mb-[12px] px-2">
                <span className="text-[#4a4a4a] text-[14px] md:text-[18px]">{blog.read_time_minutes} Min Read</span>
                <div className="w-[5px] h-[5px] bg-[#4a4a4a] rounded-full"></div>
                <span className="text-[#4a4a4a] text-[14px] md:text-[18px]">{format(new Date(blog.created_at), "MMM d, yyyy")}</span>
              </div>
              <h4 className="text-[20px] md:text-[24px] font-medium leading-[28px] md:leading-[34px] mb-[8px] md:mb-[10px] px-2 truncate line-clamp-1 md:whitespace-normal">{blog.title}</h4>
              <p className="text-[#4a4a4a] text-[15px] md:text-[18px] leading-[24px] md:leading-[30px] mb-[12px] md:mb-[16px] px-2 line-clamp-2">
                {blog.content.replace(/<[^>]*>?/gm, " ").replace(/\s+/g, " ").trim()}
              </p>
              <button
                onClick={() => onNavigate({ type: "blog", id: blog.id, scrollY: window.scrollY })}
                className="text-[#1099a1] text-[15px] md:text-[18px] uppercase font-medium hover:underline bg-transparent border-none cursor-pointer px-2"
              >
                Learn More
              </button>
            </div>
          </Reveal>
        ))}
      </div>

      <div className="mt-[40px] md:mt-[60px] flex justify-center">
        <button
          onClick={() => onNavigate({ type: "blogs", scrollY: window.scrollY })}
          className="text-[#1099a1] font-medium text-[16px] md:text-[18px] uppercase hover:underline"
        >
          View All Blogs &rarr;
        </button>
      </div>
    </div>
  );
}
