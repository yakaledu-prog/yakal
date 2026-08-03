import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRightIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { getPosts, BlogPost } from "@/services/cmsService";
import { useNavigate } from "react-router-dom";

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
    // Text colour pinned rather than inherited. The page hardcodes a white
    // background, so in dark mode the inherited near-white heading colour left
    // every post title invisible.
    <div className="min-h-screen flex flex-col font-sans bg-white text-[#111827]">
      {/* No photograph at any width. The stock cover was decoration standing
          between the reader and the posts, and it was the only thing that
          differed between the phone and the desktop layouts. */}
      <div className="w-full border-b border-[#eaecf0]">
        <div className="max-w-[1200px] mx-auto px-6 pt-8 pb-8 lg:px-12 lg:pt-10 lg:pb-10">
          <button
            onClick={() => navigate("/#blog")}
            className="flex items-center gap-2 text-[#54656f] hover:text-[#1099a1] transition-colors text-[13px] font-medium mb-6"
          >
            <ArrowLeft size={16} strokeWidth={2.5} />
            <span>Back</span>
          </button>

          <h1 className="text-[32px] md:text-[42px] font-bold leading-tight mb-3">Blogs</h1>
          <p className="text-[#4a4a4a] text-[15px] md:text-[17px] leading-[26px] max-w-[600px]">
            Discover tips, news, and strategies from our expert educators to help you succeed.
          </p>
        </div>
      </div>

      <div className="w-full">
        <div className="max-w-[1200px] mx-auto px-6 py-10 lg:px-12 lg:py-14">

          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-[#1099a1]" />
            </div>
          ) : blogs.length === 0 ? (
            <p className="text-[#4a4a4a] text-[16px] md:text-[18px]">No published blogs yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
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
