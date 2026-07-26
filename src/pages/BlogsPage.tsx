import { useEffect, useState } from "react";
import { ArrowLeft, ArrowLeftIcon, ArrowRightIcon, ChevronLeftIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { getPosts, BlogPost } from "@/services/cmsService";
import { useNavigate } from "react-router-dom";
import imgCover from "@/assets/images/landing-page/hero-cover.jpg";

export default function BlogsPage() {
  const navigate = useNavigate();
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
    <div className="min-h-screen flex font-sans bg-white">
      {/* Left side: Immersive Image (Hidden on small screens) */}
      <div className="hidden lg:block lg:w-[40%] sticky top-0 h-screen overflow-hidden">
        <img src={imgCover} alt="Yakal Education" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

        {/* Back Button */}
        <div className="absolute top-8 left-8">
          <button onClick={() => navigate("/")} className="mix-blend-hard-light flex items-center gap-1 text-white/90 hover:text-white transition-colors px-4 py-2 text-[14px] font-medium">
            <ArrowLeftIcon size={14} strokeWidth={2.5} />
            <span className="leading-none">Back to Home</span>
          </button>
        </div>

        {/* Text overlay on the image */}
        <div className="absolute bottom-16 left-10 right-10">
          <h2 className="text-[36px] md:text-[42px] font-bold text-white leading-tight mb-4">
            Our Blogs
          </h2>
          <p className="text-[18px] text-white/90 leading-[28px]">
            Discover tips, news, and strategies from our expert educators to help you succeed.
          </p>
        </div>
      </div>

      {/* Mobile Header (visible only on small screens) */}
      <div className="lg:hidden w-full relative h-[250px]">
        <img src={imgCover} alt="Yakal Education" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/30" />

        <div className="absolute top-4 left-4 z-10">
          <button onClick={() => navigate("/")} className="flex items-center gap-2 text-white/90 hover:text-white transition-colors bg-white/10 hover:bg-white/20 backdrop-blur-md px-4 py-2 rounded-full text-[13px] font-medium border border-white/20">
            <ArrowLeft size={16} strokeWidth={2.5} />
            <span>Back</span>
          </button>
        </div>

        <div className="absolute bottom-6 left-6 right-6">
          <h1 className="text-[28px] font-bold text-white leading-tight mb-2">Blogs</h1>
        </div>
      </div>

      {/* Right side: Content */}
      <div className="w-full lg:w-[60%] lg:min-h-screen">
        <div className="max-w-[1000px] mx-auto px-6 py-10 lg:px-12 lg:py-16">

          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-[#1099a1]" />
            </div>
          ) : blogs.length === 0 ? (
            <p className="text-[#4a4a4a] text-[16px] md:text-[18px]">No published blogs yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {blogs.map((blog) => (
                <div key={blog.id} className="group cursor-pointer flex flex-col h-full" onClick={() => navigate(`/post/${blog.id}`, { state: { from: '/posts' } })}>
                  <div className="aspect-[4/3] w-full rounded-[20px] overflow-hidden mb-5 bg-gray-100">
                    {blog.thumbnail_url && (
                      <img src={blog.thumbnail_url} alt={blog.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                    )}
                  </div>
                  <div className="flex flex-col flex-1">
                    <div className="flex items-center gap-2 text-[#4a4a4a] text-[13px] mb-2 font-medium">
                      <span>{blog.read_time_minutes} Min Read</span>
                      <div className="w-1 h-1 bg-[#4a4a4a] rounded-full"></div>
                      <span>{format(new Date(blog.created_at), "MMM d, yyyy")}</span>
                    </div>
                    <h4 className="text-[20px] md:text-[22px] font-bold leading-tight mb-3 group-hover:text-[#1099a1] transition-colors line-clamp-2">{blog.title}</h4>
                    <p className="text-[#54656f] text-[14px] leading-relaxed line-clamp-3 mb-5">
                      {blog.content.replace(/<[^>]*>?/gm, " ").replace(/\s+/g, " ").trim()}
                    </p>
                    <span className="text-[13px] -mt-2 font-bold text-[#1099A1] uppercase tracking-wider inline-flex items-center gap-0.5 transition-all opacity-90 group-hover:opacity-100">
                      <span className="group-hover:italic transition duration-500 ease-in-out">Read more...</span>
                      <ArrowRightIcon size={12} strokeWidth={3} className="text-[16px] leading-none group-hover:translate-x-1 transition-transform" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
