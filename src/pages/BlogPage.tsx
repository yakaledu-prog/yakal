import { useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { getPost, BlogPost } from "@/services/cmsService";
import { BlockEditor } from "@/components/ui/BlockEditor";

export default function BlogPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const fromBlogs = location.state?.from === '/posts';
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
      if (!id) return;
      const res = await getPost(id);
      if (res) setBlog(res);
      setLoading(false);
    }
    loadPost();
  }, [id]);

  if (loading) {
    return (
      <div className="bg-white text-[#111827] min-h-screen w-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#1099a1]" />
      </div>
    );
  }

  if (!blog) {
    return (
      <div className="bg-white text-[#111827] min-h-screen w-full flex flex-col items-center justify-center">
        <p className="text-xl font-medium mb-4">Post not found</p>
        <button onClick={() => navigate("/#blog")} className="text-[#1099a1] hover:underline">Go Back</button>
      </div>
    );
  }

  const handleBack = () => {
    if (fromBlogs) {
      navigate("/posts");
    } else {
      navigate("/#blog");
    }
  };

  return (
    <div className="min-h-screen flex font-sans bg-white text-[#111827]">
      {/* Reading progress bar */}
      <div className="fixed top-0 left-0 right-0 z-50 h-[3px] bg-transparent pointer-events-none">
        <div
          className="h-full bg-[#1099a1] transition-all duration-100"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Left side: Immersive Image (Hidden on small screens) */}
      <div className="hidden lg:block lg:w-[45%] sticky top-0 h-screen overflow-hidden">
        {blog.thumbnail_url ? (
          <img src={blog.thumbnail_url} alt={blog.title} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 w-full h-full bg-[#1099a1]/10" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-black/20" />

        {/* Back Button */}
        <div className="absolute top-8 left-8">
          <button onClick={handleBack} className="flex items-center text-white hover:text-white/85 gap-2 px-4 py-2 text-[14px] font-medium">
            <ArrowLeft size={18} strokeWidth={2.5} />
            <span>{fromBlogs ? "Back to Blogs" : "Back to Home"}</span>
          </button>
        </div>

        {/* Text overlay on the image */}
        <div className="absolute bottom-16 left-10 right-10">
          <div className="flex items-center gap-3 text-[13px] text-white/80 font-medium mb-4 uppercase tracking-wider">
            <span>{blog.read_time_minutes} Min Read</span>
            <span className="w-1.5 h-1.5 rounded-full bg-white/50"></span>
            <span>{format(new Date(blog.created_at), "MMM d, yyyy")}</span>
          </div>
          <h2 className="text-[36px] md:text-[42px] font-bold text-white leading-tight">
            {blog.title}
          </h2>
        </div>
      </div>

      {/* Mobile Header (visible only on small screens) */}
      <div className="lg:hidden w-full relative h-[300px]">
        {blog.thumbnail_url ? (
          <img src={blog.thumbnail_url} alt={blog.title} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 w-full h-full bg-[#1099a1]/10" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/30" />

        <div className="absolute top-4 left-4 z-10">
          <button onClick={handleBack} className="flex items-center gap-2 text-white/90 hover:text-white transition-colors bg-white/10 hover:bg-white/20 backdrop-blur-md px-4 py-2 rounded-full text-[13px] font-medium border border-white/20">
            <ArrowLeft size={16} strokeWidth={2.5} />
            <span>{fromBlogs ? "Back to Blogs" : "Back to Home"}</span>
          </button>
        </div>

        <div className="absolute bottom-6 left-6 right-6">
          <div className="flex items-center gap-2 text-[12px] text-white/80 font-medium mb-2 uppercase tracking-wider">
            <span>{blog.read_time_minutes} Min Read</span>
            <span className="w-1.5 h-1.5 rounded-full bg-white/50"></span>
            <span>{format(new Date(blog.created_at), "MMM d, yyyy")}</span>
          </div>
          <h1 className="text-[28px] font-bold text-white leading-tight">{blog.title}</h1>
        </div>
      </div>

      {/* Right side: Content */}
      <div className="w-full lg:w-[55%] lg:h-screen lg:overflow-y-auto">
        <div className="max-w-[800px] mx-auto px-6 py-10 lg:px-16 lg:py-16">
          {/* Light regardless of the reader's app theme. The page around it is
              a hardcoded white, so an editor following the dark class put a
              black article body in the middle of it. */}
          <BlockEditor value={blog.content} editable={false} theme="light" />
        </div>
      </div>
    </div>
  );
}
