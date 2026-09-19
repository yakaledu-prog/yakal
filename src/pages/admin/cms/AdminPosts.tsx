import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getPosts, deletePost, BLOG_CATEGORIES, BlogPost } from "@/services/cmsService";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { Plus, Edit2, Trash2, Search, Loader2, Image as ImageIcon, Send, LayoutGrid, List } from "lucide-react";
import { format } from "date-fns";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Dropdown } from "@/components/ui/Dropdown";
import { SortHeader, sortRows, type Sort } from "@/components/ui/SortHeader";
import { cn } from "@/utils/cn";
import { broadcastPost, getSubscribers } from "@/services/newsletterService";
import { AdminHeader } from "../AdminHeader";

type PostCol = "title" | "status" | "newsletter" | "read" | "created";

const STATUSES = [
  { value: "all", label: "Any status" },
  { value: "published", label: "Published" },
  { value: "draft", label: "Draft" },
];

const CATEGORIES = [
  { value: "all", label: "Any category" },
  ...BLOG_CATEGORIES.map((c) => ({ value: c, label: c })),
];
export function AdminPosts() {
  const [q, setQ] = useState("");
  const [postToDelete, setPostToDelete] = useState<BlogPost | null>(null);
  const [postToSend, setPostToSend] = useState<BlogPost | null>(null);
  const [sending, setSending] = useState(false);
  const qc = useQueryClient();

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["admin-posts"],
    queryFn: getPosts,
  });

  // Only the count is used here. It is what turns "send this" into a decision
  // with a size attached.
  const { data: list } = useQuery({
    queryKey: ["admin-subscribers"],
    queryFn: () => getSubscribers(),
  });
  const subscriberCount = list?.subscribed ?? 0;

  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  // Newest first: a blog is read from the top, and the post somebody is looking
  // for is almost always the one they just wrote.
  const [sort, setSort] = useState<Sort<PostCol>>({ col: "created", dir: "desc" });

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const matched = posts.filter((p) => {
      if (status !== "all" && p.status !== status) return false;
      if (category !== "all" && p.category !== category) return false;
      if (!needle) return true;
      return p.title.toLowerCase().includes(needle) || (p.category ?? "").toLowerCase().includes(needle);
    });
    return sortRows(matched, sort, (p) => {
      switch (sort.col) {
        case "status": return p.status === "published" ? 0 : 1;
        case "newsletter": return p.newsletter_sent_at ? new Date(p.newsletter_sent_at).getTime() : 0;
        case "read": return p.read_time_minutes;
        case "created": return new Date(p.created_at).getTime();
        default: return p.title.toLowerCase();
      }
    });
  }, [posts, q, status, category, sort]);

  const filtering = q.trim() !== "" || status !== "all" || category !== "all";

  const stats = [
    { label: "Total Posts", value: posts.length },
    { label: "Published", value: posts.filter((p) => p.status === "published").length },
    { label: "Drafts", value: posts.filter((p) => p.status === "draft").length },
  ];

  async function handleSendConfirm() {
    if (!postToSend) return;
    setSending(true);
    const res = await broadcastPost(postToSend.id);
    setSending(false);
    if (res.error) return toast.error(res.error);
    toast.success(
      res.failed
        ? `Sent to ${res.sent}. ${res.failed} could not be delivered.`
        : `Sent to ${res.sent} subscriber${res.sent === 1 ? "" : "s"}.`
    );
    qc.invalidateQueries({ queryKey: ["admin-posts"] });
    setPostToSend(null);
  }

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
          {/* The same toolbar as Courses: search, filters, then the view
              toggle, so the two admin lists are read the same way. */}
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <div className="relative min-w-[260px] flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <input
                type="text"
                placeholder="Search by title or category"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-[#111b21] border border-[#e9edef] dark:border-[#2a3942] rounded-full text-[13px] focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            <Dropdown value={status} onChange={setStatus} options={STATUSES} className="w-[150px]" />
            <Dropdown value={category} onChange={setCategory} options={CATEGORIES} className="w-[170px]" />

            <div className="flex bg-gray-100 dark:bg-[#182329] p-1 rounded-lg border border-[#e9edef] dark:border-[#2a3942]">
              <button
                onClick={() => setViewMode("list")}
                title="List"
                className={cn("p-1.5 rounded-md transition-colors", viewMode === "list" ? "bg-white dark:bg-[#202c33] shadow-sm" : "text-muted-foreground hover:text-[#111] dark:hover:text-white")}
              >
                <List size={18} />
              </button>
              <button
                onClick={() => setViewMode("grid")}
                title="Grid"
                className={cn("p-1.5 rounded-md transition-colors", viewMode === "grid" ? "bg-white dark:bg-[#202c33] shadow-sm" : "text-muted-foreground hover:text-[#111] dark:hover:text-white")}
              >
                <LayoutGrid size={18} />
              </button>
            </div>

            <Link
              to="/admin/posts/new"
              className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-5 py-2.5 rounded-full text-[13px] font-medium transition-colors justify-center"
            >
              <Plus size={16} /> New Post
            </Link>
          </div>

          {isLoading ? (
            <div className="p-12 flex flex-col items-center justify-center bg-white dark:bg-[#111b21] rounded-2xl border border-[#e9edef] dark:border-[#2a3942]">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="mt-4 text-[13px] text-muted-foreground font-medium">Loading posts...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center justify-center bg-white dark:bg-[#111b21] rounded-2xl border border-[#e9edef] dark:border-[#2a3942]">
              <div className="w-16 h-16 bg-gray-100 dark:bg-[#182329] rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-[14px] font-medium text-[#111] dark:text-white">No posts found</p>
              <p className="text-[13px] text-muted-foreground mt-1">
                {filtering ? "Try different filters, or create a new post." : "Create your first post."}
              </p>
            </div>
          ) : viewMode === "list" ? (
            <PostsTable
              posts={filtered}
              sort={sort}
              onSort={setSort}
              onDelete={setPostToDelete}
              onSend={setPostToSend}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">

              {filtered.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onDelete={() => setPostToDelete(post)}
                  onSend={() => setPostToSend(post)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
      <ConfirmModal
        isOpen={!!postToSend}
        onClose={() => (sending ? null : setPostToSend(null))}
        onConfirm={handleSendConfirm}
        title="Send to subscribers"
        message={`Email "${postToSend?.title}" to ${subscriberCount} subscriber${subscriberCount === 1 ? "" : "s"}? This cannot be undone, and a post can only be sent once.`}
        confirmText={sending ? "Sending..." : "Send"}
      />

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

/**
 * Every post as a row, which the cards cannot be.
 *
 * The cards are the blog as a reader sees it, and they are worth keeping for
 * that; this is the view for working through fifty of them, where what matters
 * is whether a post is published, whether the newsletter has gone out, and
 * when it was written.
 */
function PostsTable({
  posts,
  sort,
  onSort,
  onDelete,
  onSend,
}: {
  posts: BlogPost[];
  sort: Sort<PostCol>;
  onSort: (s: Sort<PostCol>) => void;
  onDelete: (p: BlogPost) => void;
  onSend: (p: BlogPost) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] table-fixed">
        <thead>
          <tr className="border-b border-border">
            <SortHeader label="Post" col="title" sort={sort} onSort={onSort} className="w-[42%] whitespace-nowrap pr-4" />
            <SortHeader label="Status" col="status" sort={sort} onSort={onSort} className="w-[12%] whitespace-nowrap pr-4" />
            <SortHeader label="Newsletter" col="newsletter" sort={sort} onSort={onSort} className="w-[16%] whitespace-nowrap pr-4" />
            <SortHeader label="Read time" col="read" sort={sort} onSort={onSort} align="right" className="w-[11%] whitespace-nowrap pr-8" />
            <SortHeader label="Written" col="created" sort={sort} onSort={onSort} align="right" className="w-[13%] whitespace-nowrap pr-6" />
            <th className="w-[96px] pb-2.5" />
          </tr>
        </thead>
        <tbody>
          {posts.map((post) => (
            <tr key={post.id} className="border-b border-border transition-colors hover:bg-primary/5">
              <td className="py-3 pr-4 align-middle">
                <Link to={`/admin/posts/${post.id}/edit`} className="flex items-center gap-3">
                  <div className="grid h-10 w-14 shrink-0 place-items-center overflow-hidden rounded-md bg-gray-100 text-muted-foreground/40 dark:bg-[#202c33]">
                    {post.thumbnail_url ? (
                      <img src={post.thumbnail_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <ImageIcon size={16} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-medium text-[#111] dark:text-white">{post.title}</p>
                    <p className="truncate text-[12px] text-muted-foreground">{post.category ?? "No category"}</p>
                  </div>
                </Link>
              </td>

              {/* Plain coloured text rather than a capsule, like the rest of
                  the admin tables. */}
              <td
                className={cn(
                  "py-3 pr-4 align-middle text-[12.5px] font-medium",
                  post.status === "published" ? "text-primary" : "text-[#8a6a2a] dark:text-secondary"
                )}
              >
                {post.status === "published" ? "Published" : "Draft"}
              </td>

              {/* Sending is the one thing here with no undo, so the row says
                  plainly whether it has already happened. */}
              <td className="py-3 pr-4 align-middle text-[12.5px] text-muted-foreground">
                {post.newsletter_sent_at
                  ? `Sent ${format(new Date(post.newsletter_sent_at), "MMM d, yyyy")}`
                  : post.status === "published"
                    ? "Not sent"
                    : "-"}
              </td>

              <td className="py-3 pr-8 text-right align-middle text-[13px] tabular-nums text-muted-foreground">
                {post.read_time_minutes} min
              </td>
              <td className="py-3 pr-6 text-right align-middle text-[13px] text-muted-foreground">
                {format(new Date(post.created_at), "MMM d, yyyy")}
              </td>

              <td className="py-3 align-middle">
                <div className="flex items-center justify-end gap-1">
                  <Link
                    to={`/admin/posts/${post.id}/edit`}
                    title="Edit post"
                    className="rounded-md p-1.5 text-muted-foreground transition-colors hover:text-primary"
                  >
                    <Edit2 size={15} />
                  </Link>
                  {post.status === "published" && !post.newsletter_sent_at && (
                    <button
                      type="button"
                      onClick={() => onSend(post)}
                      title="Send to newsletter subscribers"
                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:text-primary"
                    >
                      <Send size={15} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onDelete(post)}
                    title="Delete post"
                    className="rounded-md p-1.5 text-muted-foreground transition-colors hover:text-destructive"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PostCard({ post, onDelete, onSend }: { post: BlogPost; onDelete: () => void; onSend: () => void }) {
  const excerpt = post.content.replace(/<[^>]*>?/gm, " ").replace(/\s+/g, " ").trim();

  return (
    <div className={`bg-white dark:bg-[#111b21] rounded-[24px] overflow-hidden group shadow-md hover:shadow-xl transition-all duration-300 relative flex flex-col h-[360px] md:h-[400px] ${post.status === "draft" ? "border-4 border-secondary" : ""}`}>

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
          className="w-9 h-9 rounded-full bg-black/40 flex items-center justify-center text-white hover:bg-primary/50 hover:scale-110 transition-all ease-in-out duration-200"
          title="Edit Post"
        >
          <Edit2 size={16} />
        </Link>
        {/* Only on a published post, and only once. Sending is the one
            action here with no undo, so the button disappears rather than
            greying out after it has been used. */}
        {post.status === "published" && !post.newsletter_sent_at && (
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSend(); }}
            className="w-9 h-9 rounded-full bg-black/40 flex items-center justify-center text-white hover:bg-primary/50 hover:scale-110 transition-all ease-in-out duration-200"
            title="Send to newsletter subscribers"
          >
            <Send size={16} />
          </button>
        )}
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
            <span className="absolute left-4 top-4 bg-white/20 backdrop-blur-sm text-white px-2 py-0.5 rounded text-[10px] uppercase font-medium tracking-wider">
              Draft
            </span>
          )}
        </div>

        <h3 className="text-[22px] md:text-[24px] font-medium text-white line-clamp-2 leading-tight mb-3 group-hover:text-[#42e8f1] transition-colors truncate">
          {post.title}
        </h3>

        <p className="text-[14px] text-white/70 line-clamp-2 mb-6 leading-relaxed">
          {excerpt}
        </p>

        <span className="text-[13px] -mt-4 font-medium text-primary uppercase tracking-wider inline-flex items-center gap-2 transition-all opacity-90 group-hover:opacity-100">
          Read more... <span className="text-[16px] leading-none group-hover:translate-x-1 transition-transform">&rarr;</span>
        </span>
      </Link>
    </div>
  );
}
