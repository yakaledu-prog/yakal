import { useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { getPost, BlogPost } from "@/services/cmsService";

export default function BlogPage({ id, onBack }: { id: string; onBack: () => void }) {
  const [progress, setProgress] = useState(0);
  const [blog, setBlog] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    async function loadPost() {
      const res = await getPost(id);
      if (res) setBlog(res);
      setLoading(false);
    }
    loadPost();
  }, [id]);

  if (loading) {
    return (
      <div className="bg-white min-h-screen w-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#1099a1]" />
      </div>
    );
  }

  if (!blog) {
    return (
      <div className="bg-white min-h-screen w-full flex flex-col items-center justify-center">
        <p className="text-xl font-medium mb-4">Post not found</p>
        <button onClick={onBack} className="text-[#1099a1] hover:underline">Go Back</button>
      </div>
    );
  }

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
          <span>{blog.read_time_minutes} Min Read</span>
          <span>&#8226;</span>
          <span>{format(new Date(blog.created_at), "MMM d, yyyy")}</span>
        </div>

        {blog.thumbnail_url && (
          <div className="w-full h-[220px] md:h-[400px] rounded-[16px] overflow-hidden mb-[36px]">
            <img src={blog.thumbnail_url} alt={blog.title} className="w-full h-full object-cover" />
          </div>
        )}

        <div className="prose prose-lg max-w-none prose-headings:font-semibold prose-a:text-[#1099a1]">
          <div dangerouslySetInnerHTML={{ __html: blog.content }} />
        </div>
      </div>
    </div>
  );
}
