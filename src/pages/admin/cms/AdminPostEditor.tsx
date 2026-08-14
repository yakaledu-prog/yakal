import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  BLOG_CATEGORIES,
  getPost,
  createPost,
  updatePost,
  type BlogCategory,
} from "@/services/cmsService";
import { BlockEditor } from "@/components/ui/BlockEditor";
import { useSetBreadcrumb } from "@/contexts/BreadcrumbContext";
import { Loader2, Image as ImageIcon, Save, CloudUploadIcon, ImageMinusIcon, Repeat2Icon, CheckCheckIcon } from "lucide-react";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { broadcastPost } from "@/services/newsletterService";
import { cn } from "@/utils/cn";
import { Dropdown, type DropdownOption } from "@/components/ui/Dropdown";

type CategorySelection = BlogCategory | "";

const categoryOptions: DropdownOption<CategorySelection>[] = [
  { value: "", label: "No category" },
  ...BLOG_CATEGORIES.map((category) => ({ value: category, label: category })),
];

export function AdminPostEditor() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === "new";
  const navigate = useNavigate();



  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [category, setCategory] = useState<CategorySelection>("");
  const [status, setStatus] = useState<"draft" | "published">("draft");

  const [isLoading, setIsLoading] = useState(!isNew);
  const [isSaving, setIsSaving] = useState(false);
  const [showCoverUpload, setShowCoverUpload] = useState(false);
  // Null means the newsletter for this post has never been sent, which is the
  // only state in which offering to send it makes sense.
  const [sentAt, setSentAt] = useState<string | null>(null);
  const [askBroadcast, setAskBroadcast] = useState<string | null>(null);
  const [broadcasting, setBroadcasting] = useState(false);

  // Track changes
  const [originalData, setOriginalData] = useState({
    title: "",
    content: "",
    thumbnailUrl: "",
    category: "" as CategorySelection,
    status: "draft",
  });

  useSetBreadcrumb(id, "HIDDEN");
  useSetBreadcrumb("edit", isNew ? "New Post" : (originalData?.title || "Post Details"));

  useEffect(() => {
    if (isNew) return;
    setIsLoading(true);
    getPost(id).then((post) => {
      if (post) {
        setTitle(post.title);
        setContent(post.content);
        setThumbnailUrl(post.thumbnail_url || "");
        setCategory(post.category || "");
        setStatus(post.status);
        setSentAt(post.newsletter_sent_at);
        if (post.thumbnail_url) setShowCoverUpload(true);
        setOriginalData({
          title: post.title,
          content: post.content,
          thumbnailUrl: post.thumbnail_url || "",
          category: post.category || "",
          status: post.status,
        });
      } else {
        toast.error("Post not found");
        navigate("/admin/posts");
      }
      setIsLoading(false);
    });
  }, [id, isNew, navigate]);

  const hasChanges = isNew ||
    title !== originalData.title ||
    content !== originalData.content ||
    thumbnailUrl !== originalData.thumbnailUrl ||
    category !== originalData.category ||
    status !== originalData.status;

  async function sendNewsletter(postId: string) {
    setBroadcasting(true);
    const res = await broadcastPost(postId);
    setBroadcasting(false);
    setAskBroadcast(null);
    if (res.error) return toast.error(res.error);
    setSentAt(new Date().toISOString());
    toast.success(`Sent to ${res.sent} subscriber${res.sent === 1 ? "" : "s"}.`);
  }

  async function handleSave(newStatus?: "draft" | "published") {
    if (!title.trim()) {
      return toast.error("Please enter a title for your post.");
    }

    setIsSaving(true);
    const saveStatus = newStatus || status;

    try {
      if (isNew) {
        const res = await createPost({
          title,
          content,
          thumbnail_url: thumbnailUrl || null,
          category: category || null,
          status: saveStatus,
        });
        if (!res.success) throw new Error(res.error);
        toast.success(saveStatus === "published" ? "Post published!" : "Draft saved.");
        navigate(`/admin/posts/${res.data}/edit`, { replace: true });
        setStatus(saveStatus);
        setOriginalData({ title, content, thumbnailUrl, category, status: saveStatus });
        // Asked, not assumed. Publishing and mailing the list are different
        // decisions, and only one of them can be taken back.
        if (saveStatus === "published" && res.data) setAskBroadcast(res.data);
      } else {
        const res = await updatePost(id, {
          title,
          content,
          thumbnail_url: thumbnailUrl || null,
          category: category || null,
          status: saveStatus,
        });
        if (!res.success) throw new Error(res.error);
        toast.success(saveStatus === "published" ? "Post updated & published!" : "Draft updated.");
        setStatus(saveStatus);
        setOriginalData({ title, content, thumbnailUrl, category, status: saveStatus });
        // Only if it has never gone out. Editing a post that was already
        // mailed must not offer to mail it again.
        if (saveStatus === "published" && !sentAt) setAskBroadcast(id);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to save post.");
    } finally {
      setIsSaving(false);
    }
  }

  // The topbar keeps whatever node it is given until that node changes, so
  // `actions` has to be referentially stable or setActions fires on every
  // render. Stable and closing over state is the trap: for a new post isNew
  // pins hasChanges to true, so the memo below never recomputed while anyone
  // typed and the button went on calling the very first handleSave, which
  // still saw an empty title. Hence the ref: one stable node, always the
  // current values.
  const saveRef = useRef(handleSave);
  useEffect(() => {
    saveRef.current = handleSave;
  });

  /**
   * A status bar along the bottom, rather than buttons in the topbar.
   *
   * The editor is a long scroll and the buttons were pinned to a bar shared
   * with the breadcrumb and the search, so on a long post they were nowhere
   * near what you were writing. Down here the save state and the two things
   * you can do about it sit together, out of the way of the page.
   */
  const actionBar = (
    <div className="flex h-11 shrink-0 items-center justify-between gap-4 border-t border-[#e9edef] bg-white px-4 dark:border-[#2a3942] dark:bg-[#111b21]">
      <span className="truncate text-[12.5px] text-muted-foreground">
        {isSaving
          ? "Saving..."
          : hasChanges
            ? status === "published" ? "Unpublished changes" : "Draft, not published"
            : isNew ? "" : "All changes saved."}
      </span>

      <div className="flex shrink-0 items-center gap-5">
        {hasChanges && (
          <button
            onClick={() => saveRef.current("draft")}
            disabled={isSaving}
            className="flex items-center gap-1.5 text-[13px] font-normal text-muted-foreground transition-colors hover:text-secondary disabled:opacity-50"
          >
            <Save size={14} strokeWidth={2} />
            {status === "published" ? "Save as draft" : "Save draft"}
          </button>
        )}

        <button
          onClick={() => saveRef.current("published")}
          disabled={isSaving || (status === "published" && !hasChanges)}
          className="flex items-center gap-1.5 text-[13px] font-medium text-primary transition-all hover:font-bold disabled:opacity-40 disabled:hover:font-medium"
        >
          {status === "published" ? hasChanges ? <Repeat2Icon strokeWidth={2} size={15} /> : <CheckCheckIcon strokeWidth={2} size={15} /> : <CloudUploadIcon size={15} />}
          {status === "published" ? hasChanges ? "Update" : "Published" : "Publish"}
        </button>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen">
        <Loader2 className="w-10 h-10 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-[calc(100vh-4rem)] bg-white dark:bg-[#111b21]">
      <div className="flex-1 overflow-y-auto custom-scrollbar relative group">

        {/* Cover Image Area (Notion style) */}
        {showCoverUpload || thumbnailUrl ? (
          <div className="relative group/cover w-full h-[30vh] sm:h-[40vh] bg-gray-100 dark:bg-[#182329] mb-12">
            {thumbnailUrl ? (
              <img src={thumbnailUrl} alt="Cover" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-6 border-b border-[#e9edef] dark:border-[#2a3942]">
                <ImageUpload
                  value={thumbnailUrl}
                  onChange={setThumbnailUrl}
                  className="w-full h-full"
                />
              </div>
            )}

            {/* Remove cover button - appears on hover */}
            {thumbnailUrl && <div className="absolute top-4 right-4 opacity-0 group-hover/cover:opacity-100 transition-opacity">
              <button
                onClick={() => { setThumbnailUrl(""); setShowCoverUpload(false); }}
                className="bg-black/50 hover:bg-black/70 text-white p-3 rounded-lg text-[12px] font-semibold backdrop-blur-sm transition-colors"
              >
                <ImageMinusIcon />
              </button>
            </div>}

            {/* Reposition/Change upload overlay if we already have an image */}
            {thumbnailUrl && (
              <div className="absolute bottom-4 right-4 opacity-0 group-hover/cover:opacity-100 transition-opacity">
                <div className="bg-black/50 backdrop-blur-sm rounded-lg p-2">
                  <ImageUpload
                    value={thumbnailUrl}
                    onChange={setThumbnailUrl}
                    className="!h-10 !border-0 !bg-transparent"
                  />
                </div>
              </div>
            )}
          </div>
        ) : null}

        {/* Editor Container */}
        <div className={cn("max-w-6xl mx-auto px-6 sm:px-12 w-full", showCoverUpload ? "" : "pt-14 md:pt-20")}>

          {/* Add Cover Button (shows when no cover) */}
          {!showCoverUpload && (
            <button
              onClick={() => setShowCoverUpload(true)}
              className="flex items-center gap-2 text-muted-foreground hover:text-[#111] dark:hover:text-white transition-colors text-[14px] font-medium mb-6 opacity-0 group-hover:opacity-100"
            >
              <ImageIcon size={16} /> Add cover
            </button>
          )}

          {/* Title Input */}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Post Title..."
            className="w-full text-4xl sm:text-5xl font-black bg-transparent outline-none placeholder:text-gray-300 dark:placeholder:text-[#2a3942] text-[#111] dark:text-white mb-8"
          />

          <div className="mb-8 w-full max-w-[220px]">
            <label className="mb-2 block text-[12px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Category
            </label>
            <Dropdown<CategorySelection>
              value={category}
              onChange={setCategory}
              options={categoryOptions}
              ariaLabel="Blog category"
              placeholder="No category"
            />
          </div>

          {/* BlockNote Editor */}
          <div className="w-full -mx-12">
            <BlockEditor
              value={content}
              onChange={setContent}
              fullHeight={true}
              placeholder="Press '/' for commands..."
            />
          </div>
        </div>
      </div>

      {actionBar}

      <ConfirmModal
        isOpen={!!askBroadcast}
        onClose={() => (broadcasting ? null : setAskBroadcast(null))}
        onConfirm={() => askBroadcast && sendNewsletter(askBroadcast)}
        title="Send to subscribers"
        message="Email this post to everyone on the newsletter list? A post can only be sent once, and it cannot be taken back. You can also skip this and send it later from the posts list."
        confirmText={broadcasting ? "Sending..." : "Send"}
        cancelText="Not now"
      />
    </div>
  );
}
