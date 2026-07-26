import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { getPost, createPost, updatePost } from "@/services/cmsService";
import { BlockEditor } from "@/components/ui/BlockEditor";
import { useSetBreadcrumb } from "@/contexts/BreadcrumbContext";
import { Loader2, Image as ImageIcon, Save, Check, CloudUploadIcon, ImageMinusIcon } from "lucide-react";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { cn } from "@/utils/cn";

export function AdminPostEditor() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === "new";
  const navigate = useNavigate();

  useSetBreadcrumb(id, isNew ? "New Post" : "Edit Post");

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [status, setStatus] = useState<"draft" | "published">("draft");

  const [isLoading, setIsLoading] = useState(!isNew);
  const [isSaving, setIsSaving] = useState(false);
  const [showCoverUpload, setShowCoverUpload] = useState(false);

  useEffect(() => {
    if (isNew) return;
    setIsLoading(true);
    getPost(id).then((post) => {
      if (post) {
        setTitle(post.title);
        setContent(post.content);
        setThumbnailUrl(post.thumbnail_url || "");
        setStatus(post.status);
        if (post.thumbnail_url) setShowCoverUpload(true);
      } else {
        toast.error("Post not found");
        navigate("/admin/posts");
      }
      setIsLoading(false);
    });
  }, [id, isNew, navigate]);

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
          status: saveStatus,
        });
        if (!res.success) throw new Error(res.error);
        toast.success(saveStatus === "published" ? "Post published!" : "Draft saved.");
        navigate(`/admin/posts/${res.data}/edit`, { replace: true });
        setStatus(saveStatus);
      } else {
        const res = await updatePost(id, {
          title,
          content,
          thumbnail_url: thumbnailUrl || null,
          status: saveStatus,
        });
        if (!res.success) throw new Error(res.error);
        toast.success(saveStatus === "published" ? "Post updated & published!" : "Draft updated.");
        setStatus(saveStatus);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to save post.");
    } finally {
      setIsSaving(false);
    }
  }

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

      {/* Bottom Sticky Action Bar */}
      <div className="shrink-0 bg-white dark:bg-[#111b21] border-t border-[#e9edef] dark:border-[#2a3942] p-4 px-6 flex items-center justify-between sticky bottom-0 z-10 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] dark:shadow-none">
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-muted-foreground hidden sm:inline-block">
            {isSaving ? "Saving..." : "All changes saved locally"}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {status === "draft" && (
            <button
              onClick={() => handleSave("draft")}
              disabled={isSaving}
              className="gap-1 px-4 py-2 rounded-lg text-[14px] bg-[#87bE8D] text-white hover:bg-[#97CE9D] dark:hover:bg-[#182329] transition-colors disabled:opacity-50 flex items-center"
            >
              <Save size={14} strokeWidth={2} />
              <span>Save Draft</span>
            </button>
          )}
          <button
            onClick={() => handleSave("published")}
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-2 bg-primary hover:bg-primary/85 text-white rounded-lg text-[13px] font-bold transition-colors disabled:opacity-50 shadow-sm"
          >
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : (status === "published" ? <Check size={16} /> : <CloudUploadIcon size={16} />)}
            {status === "published" ? "Update" : "Publish"}
          </button>
        </div>
      </div>
    </div>
  );
}
