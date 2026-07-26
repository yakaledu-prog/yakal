import { useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { getPosts, BlogPost } from "@/services/cmsService";
import type { Page } from "@/types";

export default function BlogsPage({ onNavigate, onBack }: { onNavigate: (page: Page) => void; onBack: () => void }) {
  const [blogs, setBlogs] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  useEffect(() => {
    async function loadPosts() {
      const allPosts = await getPosts();
      setBlogs(allPosts.filter(p => p.status === "published"));
      setLoading(false);
    }
    loadPosts();
  }, []);

  return (
    <div className="bg-white min-h-screen w-full">
      <div className="max-w-[1200px] mx-auto px-[24px] md:px-[40px] py-[40px]">
        <button onClick={onBack} className="flex items-center gap-[8px] text-[16px] md:text-[18px] mb-[32px] hover:opacity-70 transition bg-transparent border-none cursor-pointer">
          <ArrowLeft size={20} strokeWidth={2} />
          <span>Back to Home</span>
        </button>

        <h1 className="text-[32px] md:text-[46px] font-medium leading-[42px] md:leading-[56px] mb-[40px]">All Blogs</h1>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[#1099a1]" />
          </div>
        ) : blogs.length === 0 ? (
          <p className="text-[#4a4a4a] text-[16px] md:text-[18px]">No published blogs yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[30px]">
            {blogs.map((blog) => (
              <div key={blog.id} className="group cursor-pointer" onClick={() => onNavigate({ type: "blog", id: blog.id, scrollY: window.scrollY })}>
                <div className="h-[220px] md:h-[280px] rounded-[20px] overflow-hidden mb-[16px] bg-gray-100">
                  {blog.thumbnail_url && (
                    <img src={blog.thumbnail_url} alt={blog.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  )}
                </div>
                <div className="flex items-center gap-[12px] mb-[12px]">
                  <span className="text-[#4a4a4a] text-[14px]">{blog.read_time_minutes} Min Read</span>
                  <div className="w-[5px] h-[5px] bg-[#4a4a4a] rounded-full"></div>
                  <span className="text-[#4a4a4a] text-[14px]">{format(new Date(blog.created_at), "MMM d, yyyy")}</span>
                </div>
                <h4 className="text-[20px] md:text-[24px] font-medium leading-[28px] md:leading-[34px] mb-[8px] group-hover:text-[#1099a1] transition-colors line-clamp-2">{blog.title}</h4>
                <p className="text-[#4a4a4a] text-[15px] leading-[24px] line-clamp-2 mb-[12px]">
                  {blog.content.replace(/<[^>]*>?/gm, " ").replace(/\s+/g, " ").trim()}
                </p>
                <span className="text-[#1099a1] text-[15px] uppercase font-medium group-hover:underline">Learn More</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
