import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getPosts, deletePost, BlogPost } from "@/services/cmsService";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { Plus, Edit2, Trash2, Search, Loader2 } from "lucide-react";
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

      <div className="bg-white dark:bg-[#111b21] rounded-2xl border border-[#e9edef] dark:border-[#2a3942] overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-12 flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#1099A1]" />
            <p className="mt-4 text-[13px] text-muted-foreground font-medium">Loading posts...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <div className="w-16 h-16 bg-gray-100 dark:bg-[#182329] rounded-full flex items-center justify-center mb-4">
              <Search className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-[14px] font-bold text-[#111] dark:text-white">No posts found</p>
            <p className="text-[13px] text-muted-foreground mt-1">Try adjusting your search or create a new post.</p>
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-gray-50/50 dark:bg-[#182329]/50 border-b border-[#e9edef] dark:border-[#2a3942]">
                  <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Post</th>
                  <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Status</th>
                  <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Read Time</th>
                  <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Created</th>
                  <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e9edef] dark:divide-[#2a3942]">
                {filtered.map((post) => (
                  <tr key={post.id} className="hover:bg-gray-50/50 dark:hover:bg-[#182329]/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {post.thumbnail_url ? (
                          <img src={post.thumbnail_url} alt={post.title} className="w-10 h-10 rounded-lg object-cover bg-gray-100 shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-[#202c33] shrink-0 flex items-center justify-center text-[10px] text-muted-foreground font-bold">Img</div>
                        )}
                        <p className="text-[13px] font-bold text-[#111] dark:text-white line-clamp-1">{post.title}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "text-[10px] font-bold uppercase px-2 py-1 rounded-md",
                        post.status === "published" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-gray-100 text-gray-700 dark:bg-[#202c33] dark:text-gray-400"
                      )}>
                        {post.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-[12px] text-muted-foreground font-medium">
                      {post.read_time_minutes} min read
                    </td>
                    <td className="px-6 py-4 text-[12px] text-muted-foreground font-medium">
                      {format(new Date(post.created_at), "MMM d, yyyy")}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Link
                          to={`/admin/posts/${post.id}/edit`}
                          className="p-1.5 rounded-md text-muted-foreground hover:bg-gray-100 dark:hover:bg-[#182329] transition-colors"
                          title="Edit Post"
                        >
                          <Edit2 size={16} />
                        </Link>
                        <button
                          onClick={() => setPostToDelete(post)}
                          className="p-1.5 rounded-md text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-colors"
                          title="Delete Post"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
        </div>
      </div>
    </PageWrapper>
  );
}
