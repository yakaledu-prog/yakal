import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { getPost, createPost, updatePost } from "@/services/cmsService";
import { BlockEditor } from "@/components/ui/BlockEditor";
import { useSetBreadcrumb } from "@/contexts/BreadcrumbContext";
import { useTopbarActions } from "@/contexts/TopbarActionsContext";
import { Loader2, Image as ImageIcon, Save, CloudUploadIcon, ImageMinusIcon, Repeat2Icon, CheckCheckIcon } from "lucide-react";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { cn } from "@/utils/cn";

export function AdminPostEditor() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === "new";
  const navigate = useNavigate();



  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [status, setStatus] = useState<"draft" | "published">("draft");

  const [isLoading, setIsLoading] = useState(!isNew);
  const [isSaving, setIsSaving] = useState(false);
  const [showCoverUpload, setShowCoverUpload] = useState(false);

  // Track changes
  const [originalData, setOriginalData] = useState({
    title: "",
    content: "",
    thumbnailUrl: "",
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
        setStatus(post.status);
        if (post.thumbnail_url) setShowCoverUpload(true);
        setOriginalData({
          title: post.title,
          content: post.content,
          thumbnailUrl: post.thumbnail_url || "",
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
    status !== originalData.status;

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
        setOriginalData({ title, content, thumbnailUrl, status: saveStatus });
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
        setOriginalData({ title, content, thumbnailUrl, status: saveStatus });
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to save post.");
    } finally {
      setIsSaving(false);
    }
  }

  const actions = useMemo(() => (
    <div className="flex items-center gap-3 mr-2">
      {!hasChanges && !isSaving && !isNew && (
        <span className="text-[12px] text-muted-foreground hidden sm:inline-block mr-2">
          All changes saved.
        </span>
      )}
      {isSaving && (
        <span className="text-[12px] text-muted-foreground hidden sm:inline-block mr-2">
          Saving...
        </span>
      )}
      {hasChanges && (
        <button
          onClick={() => handleSave("draft")}
          disabled={isSaving}
          className="gap-1 px-4 py-2 rounded-lg text-[13px] font-medium bg-[#87bE8D] text-white hover:bg-[#97CE9D] dark:hover:bg-[#182329] transition-colors disabled:opacity-50 flex items-center shadow-sm"
        >
          <Save size={14} strokeWidth={2} />
          <span>{status === "published" ? "Save as Draft" : "Save Draft"}</span>
        </button>
      )}
      <button
        onClick={() => handleSave("published")}
        disabled={isSaving || (status === "published" && !hasChanges)}
        className="flex items-center gap-1.5 px-5 py-2 font-medium bg-[#1099A1] hover:bg-[#0c7f86] text-white rounded-lg text-[13px] transition-colors disabled:opacity-50 shadow-sm"
      >
        {status === "published" ? hasChanges ? <Repeat2Icon strokeWidth={2} size={16} /> : <CheckCheckIcon strokeWidth={2} size={16} /> : <CloudUploadIcon size={16} />}
        {status === "published" ? hasChanges ? "Update" : "Published" : "Publish"}
      </button>
    </div>
  ), [hasChanges, isSaving, isNew, status]);

  useTopbarActions(actions);

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
    </div>
  );
}
