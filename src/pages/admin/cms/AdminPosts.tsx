import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getPosts, deletePost, BlogPost } from "@/services/cmsService";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { Plus, Edit2, Trash2, Search, Loader2, MoreVertical, Image as ImageIcon } from "lucide-react";
import { format } from "date-fns";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { AdminHeader } from "../AdminHeader";
import { cn } from "@/utils/cn";
import { useEffect, useRef } from "react";

export function AdminPosts() {
  const [q, setQ] = useState("");
  const [postToDelete, setPostToDelete] = useState<BlogPost | null>(null);
  const qc = useQueryClient();

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["admin-posts"],
    queryFn: getPosts,
  });

  const filtered = posts.filter((p) => p.title.toLowerCase().includes(q.toLowerCase()));

  async function handleDeleteConfirm() {
    if (!postToDelete) return;
    const res = await deletePost(postToDelete.id);
    if (!res.success) return toast.error(res.error || "Failed to delete post.");
    toast.success("Post deleted.");
    qc.invalidateQueries({ queryKey: ["admin-posts"] });
    setPostToDelete(null);
  }

  return (
    <PageWrapper className="!p-0">
      <div className="flex-1 min-h-screen bg-background dark:bg-[#111b21]">
        <AdminHeader
          title="Blog Posts"
          subtitle="Manage your CMS content"
        />
        
      <div className="max-w-[1440px] mx-auto p-6 md:p-10 space-y-5">
        <div className="flex flex-col md:flex-row items-center gap-4 mb-6">
          <div className="relative flex-1 w-full md:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <input
              type="text"
              placeholder="Search posts..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white dark:bg-[#111b21] border border-[#e9edef] dark:border-[#2a3942] rounded-full text-[13px] focus:outline-none focus:border-[#1099A1] transition-colors"
            />
          </div>
          <div className="flex-1" />
          <Link
            to="/admin/posts/new"
            className="flex items-center gap-2 bg-[#1099A1] hover:bg-[#0d848b] text-white px-5 py-2.5 rounded-full text-[13px] font-bold transition-colors w-full md:w-auto justify-center"
          >
            <Plus size={16} /> New Post
          </Link>
        </div>

        {isLoading ? (
          <div className="p-12 flex flex-col items-center justify-center bg-white dark:bg-[#111b21] rounded-2xl border border-[#e9edef] dark:border-[#2a3942]">
            <Loader2 className="w-8 h-8 animate-spin text-[#1099A1]" />
            <p className="mt-4 text-[13px] text-muted-foreground font-medium">Loading posts...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center bg-white dark:bg-[#111b21] rounded-2xl border border-[#e9edef] dark:border-[#2a3942]">
            <div className="w-16 h-16 bg-gray-100 dark:bg-[#182329] rounded-full flex items-center justify-center mb-4">
              <Search className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-[14px] font-bold text-[#111] dark:text-white">No posts found</p>
            <p className="text-[13px] text-muted-foreground mt-1">Try adjusting your search or create a new post.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filtered.map((post) => (
              <PostCard 
                key={post.id} 
                post={post} 
                onDelete={() => setPostToDelete(post)} 
              />
            ))}
          </div>
        )}
      </div>
      </div>
      <ConfirmModal
        isOpen={!!postToDelete}
        onClose={() => setPostToDelete(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Post"
        message={
          <>
            Are you sure you want to delete <strong>{postToDelete?.title}</strong>? This action cannot be undone.
          </>
        }
        confirmText="Delete"
        isDestructive={true}
      />
    </PageWrapper>
  );
}

function PostCard({ post, onDelete }: { post: BlogPost; onDelete: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const excerpt = post.content.replace(/<[^>]*>?/gm, " ").replace(/\s+/g, " ").trim();

  return (
    <div className="bg-white dark:bg-[#111b21] rounded-[20px] overflow-hidden group shadow-[0_2px_12px_rgba(0,0,0,0.04)] dark:shadow-none border border-[#e9edef] dark:border-[#2a3942] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] transition-all duration-300 relative flex flex-col h-full">
      
      {/* Kebab Menu */}
      <div className="absolute top-3 right-3 z-20" ref={menuRef}>
        <button 
          onClick={(e) => { e.preventDefault(); setMenuOpen(!menuOpen); }}
          className="w-8 h-8 rounded-full bg-white/90 dark:bg-black/50 backdrop-blur flex items-center justify-center text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-black transition-colors shadow-sm"
        >
          <MoreVertical size={16} />
        </button>
        
        {menuOpen && (
          <div className="absolute right-0 mt-1 w-36 bg-white dark:bg-[#182329] rounded-xl shadow-lg border border-[#e9edef] dark:border-[#2a3942] overflow-hidden py-1 animate-in fade-in zoom-in-95 duration-100">
            <Link
              to={`/admin/posts/${post.id}/edit`}
              className="flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#202c33] transition-colors"
            >
              <Edit2 size={14} /> Edit
            </Link>
            <button
              onClick={(e) => { e.preventDefault(); setMenuOpen(false); onDelete(); }}
              className="flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 w-full text-left transition-colors"
            >
              <Trash2 size={14} /> Delete
            </button>
          </div>
        )}
      </div>

      <Link to={`/admin/posts/${post.id}/edit`} className="flex flex-col h-full">
        {/* Cover */}
        <div className="aspect-[4/3] w-full bg-gray-100 dark:bg-[#182329] overflow-hidden relative">
          {post.thumbnail_url ? (
            <img src={post.thumbnail_url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt={post.title} />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/30">
              <ImageIcon size={48} className="mb-2" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col flex-1">
          <div className="flex items-center gap-2 text-[12px] text-muted-foreground font-medium mb-3">
            <span>{post.read_time_minutes} Min Read</span>
            <span>•</span>
            <span>{format(new Date(post.created_at), "MMM d, yyyy")}</span>
            
            {post.status === "draft" && (
              <span className="ml-auto bg-gray-100 text-gray-700 dark:bg-[#202c33] dark:text-gray-400 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">
                Draft
              </span>
            )}
          </div>

          <h3 className="text-[18px] font-bold text-[#111] dark:text-white line-clamp-2 leading-snug mb-2 group-hover:text-[#1099A1] transition-colors">
            {post.title}
          </h3>

          <p className="text-[14px] text-muted-foreground line-clamp-2 mb-6 flex-1 leading-relaxed">
            {excerpt}
          </p>

          <span className="text-[12px] font-bold text-[#1099A1] uppercase tracking-wider mt-auto inline-flex items-center gap-1 group-hover:gap-2 transition-all">
            Learn More <span className="text-[16px] leading-none">&rarr;</span>
          </span>
        </div>
      </Link>
    </div>
  );
}
