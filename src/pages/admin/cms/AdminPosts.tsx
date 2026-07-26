import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getPosts, deletePost, BlogPost } from "@/services/cmsService";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { Plus, Edit2, Trash2, Search, Loader2, Image as ImageIcon } from "lucide-react";
import { format } from "date-fns";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { AdminHeader } from "../AdminHeader";
import { cn } from "@/utils/cn";

export function AdminPosts() {
  const [q, setQ] = useState("");
  const [postToDelete, setPostToDelete] = useState<BlogPost | null>(null);
  const qc = useQueryClient();

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["admin-posts"],
    queryFn: getPosts,
  });

  const filtered = posts.filter((p) => p.title.toLowerCase().includes(q.toLowerCase()));

  const stats = [
    { label: "Total Posts", value: posts.length },
    { label: "Published", value: posts.filter((p) => p.status === "published").length },
    { label: "Drafts", value: posts.filter((p) => p.status === "draft").length },
  ];

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
          stats={stats}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">

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
  const excerpt = post.content.replace(/<[^>]*>?/gm, " ").replace(/\s+/g, " ").trim();

  return (
    <div className={`bg-white dark:bg-[#111b21] rounded-[24px] overflow-hidden group shadow-md hover:shadow-xl transition-all duration-300 relative flex flex-col h-[360px] md:h-[400px] ${post.status == "draft" ? "border-4 border-secondary" : ""}`}>

      {/* Background Image */}
      {post.thumbnail_url ? (
        <img src={post.thumbnail_url} className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 z-0" alt={post.title} />
      ) : (
        <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-gray-100 dark:bg-[#182329] text-muted-foreground/30 z-0">
          <ImageIcon size={48} className="mb-2" />
        </div>
      )}

      {/* Dark Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-black/20 z-10 transition-opacity duration-300 group-hover:opacity-90" />

      {/* Edit and Delete Actions */}
      <div className="absolute top-4 right-4 z-30 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 translate-y-[-10px] group-hover:translate-y-0">
        <Link
          to={`/admin/posts/${post.id}/edit`}
          className="w-9 h-9 rounded-full bg-black/40 flex items-center justify-center text-white hover:bg-[#1099A1]/50 hover:scale-110 transition-all ease-in-out duration-200"
          title="Edit Post"
        >
          <Edit2 size={16} />
        </Link>
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(); }}
          className="w-9 h-9 rounded-full bg-black/40 flex items-center justify-center text-white hover:bg-red-500/50 hover:scale-110 transition-all ease-in-out duration-200"
          title="Delete Post"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* Content */}
      <Link to={`/admin/posts/${post.id}/edit`} className={`relative z-20 p-6 flex flex-col flex-1 h-full justify-end`}>
        <div className="flex items-center gap-2 text-[12px] text-white/80 font-medium mb-3">
          <span>{post.read_time_minutes} Min Read</span>
          <span>•</span>
          <span>{format(new Date(post.created_at), "MMM d, yyyy")}</span>

          {post.status === "draft" && (
            <span className="absolute left-4 top-4 bg-white/20 backdrop-blur-sm text-white px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">
              Draft
            </span>
          )}
        </div>

        <h3 className="text-[22px] md:text-[24px] font-bold text-white line-clamp-2 leading-tight mb-3 group-hover:text-[#42e8f1] transition-colors truncate">
          {post.title}
        </h3>

        <p className="text-[14px] text-white/70 line-clamp-2 mb-6 leading-relaxed">
          {excerpt}
        </p>

        <span className="text-[13px] -mt-4 font-bold text-[#1099A1] uppercase tracking-wider inline-flex items-center gap-2 transition-all opacity-90 group-hover:opacity-100">
          Read more... <span className="text-[16px] leading-none group-hover:translate-x-1 transition-transform">&rarr;</span>
        </span>
      </Link>
    </div>
  );
}
