import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Download, ExternalLink, FileText, Loader2, MoreVertical, Upload } from "lucide-react";

import { cn } from "@/utils/cn";
import { getResumeUrl, resumeFileName, uploadResume } from "@/services/resumeService";

// ============================================================
// A tutor's CV: see it, download it, replace it.
//
// The same card on the profile page and inside a course application, the way a
// job board does it. The CV given at onboarding is the one that gets sent, and
// a tutor can check what that actually is before it goes rather than having to
// remember.
//
// The bucket is private, so links are signed and short lived. A CV carries a
// home address and a phone number; a durable public URL would leave that
// readable by anyone who came across it.
// ============================================================

const ACCEPT = ".pdf,.doc,.docx,application/pdf";

/** Uploads are stored as `<user>/cv_<epoch-ms>.<ext>`, so the date is in the path. */
function uploadedOn(path: string | null): string | null {
  const stamp = path?.match(/cv_(\d{10,})\./)?.[1];
  if (!stamp) return null;
  const d = new Date(Number(stamp));
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function extensionOf(path: string | null): string {
  const ext = path?.split(".").pop()?.toUpperCase() ?? "";
  return ext.length <= 4 ? ext : "FILE";
}

/**
 * A document glyph with a folded corner and ruled lines.
 *
 * Drawn here rather than taken from the icon set: this stands in for the file
 * itself and wants to read as a page, not as another interface icon at the
 * same weight as the buttons beside it.
 */
function DocumentGlyph({ label }: { label: string }) {
  return (
    <span className="relative block">
      <svg
        width="44"
        height="54"
        viewBox="0 0 44 54"
        fill="none"
        aria-hidden="true"
        className="text-[#c9d1d6] dark:text-[#3a4a52]"
      >
        <path
          d="M4 3a2 2 0 0 1 2-2h20l14 13.5V51a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V3Z"
          fill="currentColor"
          fillOpacity="0.25"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path d="M26 1v11a2 2 0 0 0 2 2h12" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.85">
          <path d="M11 24h22" />
          <path d="M11 31h22" />
          <path d="M11 38h13" />
        </g>
      </svg>
      <span className="absolute -bottom-1 left-0 rounded bg-primary px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-white">
        {label}
      </span>
    </span>
  );
}

/**
 * Open / Download / Replace.
 *
 * Module level: a component declared during render is a new type each render,
 * so React would remount the menu and lose the open state under it.
 */
function ResumeMenu({
  onOpen,
  onDownload,
  onReplace,
}: {
  onOpen: () => void;
  onDownload: () => void;
  onReplace: () => void;
}) {
  return (
    <div className="absolute right-0 top-9 z-20 w-44 overflow-hidden rounded-lg border border-border bg-card py-1 shadow-lg">
      {[
        { label: "Open", icon: ExternalLink, run: onOpen },
        { label: "Download", icon: Download, run: onDownload },
        { label: "Replace", icon: Upload, run: onReplace },
      ].map((item) => (
        <button
          key={item.label}
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={item.run}
          className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13.5px] text-foreground transition-colors hover:bg-muted/60"
        >
          <item.icon size={15} className="text-muted-foreground" />
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function ResumePanel({
  userId,
  resumePath,
  onReplaced,
  className,
  /**
   * "row" is the student profile's contact rail, where this sits under an
   * email written as a DetailRow. A dashed drop-target the size of four of
   * those rows made the CV the loudest thing in the column, and it is the
   * least of what is on the page.
   */
  variant = "card",
}: {
  userId: string;
  /** profiles.resume_url: a storage path, not a URL. */
  resumePath: string | null;
  onReplaced?: (path: string) => void;
  className?: string;
  variant?: "card" | "row";
}) {
  const [path, setPath] = useState(resumePath);
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState(false);
  const [menu, setMenu] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => setPath(resumePath), [resumePath]);

  async function open(download: boolean) {
    if (!path) return;
    setMenu(false);
    setOpening(true);
    const url = await getResumeUrl(path);
    setOpening(false);
    if (!url) return toast.error("Could not open that resume.");
    if (download) {
      const a = document.createElement("a");
      a.href = url;
      a.download = resumeFileName(path);
      a.click();
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }

  async function replace(file: File) {
    setBusy(true);
    const res = await uploadResume(userId, file);
    setBusy(false);
    if (!res.success || !res.path) return toast.error(res.error ?? "Could not upload that resume.");
    setPath(res.path);
    onReplaced?.(res.path);
    toast.success("Resume updated.");
  }

  const picker = (
    <input
      ref={input}
      type="file"
      accept={ACCEPT}
      className="hidden"
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) void replace(file);
        e.target.value = "";
      }}
    />
  );

  if (!path && variant === "row") {
    return (
      <div className={cn("flex items-start gap-4", className)}>
        <div className="mt-0.5 shrink-0 text-muted-foreground">
          <Upload size={18} />
        </div>
        <div className="min-w-0">
          <p className="mb-0.5 text-[12px] font-medium text-muted-foreground">Resume</p>
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={busy}
            className="inline-flex items-center gap-2 text-[14px] text-primary transition-opacity hover:underline disabled:opacity-50"
          >
            {busy && <Loader2 size={13} className="animate-spin" />}
            Upload your resume
          </button>
        </div>
        {picker}
      </div>
    );
  }

  if (path && variant === "row") {
    return (
      <div className={cn("relative flex items-start gap-4", className)}>
        <div className="mt-0.5 shrink-0 text-muted-foreground">
          <FileText size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="mb-0.5 text-[12px] font-medium text-muted-foreground">Resume</p>
          <button
            type="button"
            onClick={() => void open(false)}
            className="block max-w-full truncate text-left text-[14px] text-primary hover:underline"
          >
            {resumeFileName(path)}
          </button>
        </div>
        {busy || opening ? (
          <Loader2 size={15} className="mt-0.5 shrink-0 animate-spin text-primary" />
        ) : (
          <button
            type="button"
            onClick={() => setMenu((m) => !m)}
            onBlur={() => setTimeout(() => setMenu(false), 160)}
            aria-label="Resume options"
            aria-expanded={menu}
            className="-mt-1 shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          >
            <MoreVertical size={16} />
          </button>
        )}
        {menu && <ResumeMenu onOpen={() => void open(false)} onDownload={() => void open(true)} onReplace={() => { setMenu(false); input.current?.click(); }} />}
        {picker}
      </div>
    );
  }

  if (!path) {
    return (
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        className={cn(
          "flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-border p-6 text-center transition-colors hover:border-primary hover:bg-muted/30 disabled:opacity-50",
          className
        )}
      >
        {busy ? (
          <Loader2 size={22} className="animate-spin text-primary" />
        ) : (
          <Upload size={22} className="text-primary" />
        )}
        <span className="text-[14px] font-medium text-foreground">Upload your resume</span>
        <span className="text-[12.5px] text-muted-foreground">PDF or Word document</span>
        <input
          ref={input}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void replace(file);
            e.target.value = "";
          }}
        />
      </button>
    );
  }

  const added = uploadedOn(path);

  return (
    <div className={cn("relative rounded-xl border border-border bg-card p-4", className)}>
      <div className="flex items-center gap-4">
        <div className="shrink-0">
          <DocumentGlyph label={extensionOf(path)} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[14.5px] font-medium text-foreground">
            {resumeFileName(path)}
          </p>
          {added && <p className="mt-0.5 text-[12.5px] text-muted-foreground">Added {added}</p>}
        </div>

        {busy || opening ? (
          <Loader2 size={16} className="animate-spin text-primary" />
        ) : (
          <button
            type="button"
            onClick={() => setMenu((m) => !m)}
            onBlur={() => setTimeout(() => setMenu(false), 160)}
            aria-label="Resume options"
            aria-expanded={menu}
            className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          >
            <MoreVertical size={18} />
          </button>
        )}
      </div>

      {menu && (
        <div className="absolute right-3 top-3">
          <ResumeMenu
            onOpen={() => void open(false)}
            onDownload={() => void open(true)}
            onReplace={() => {
              setMenu(false);
              input.current?.click();
            }}
          />
        </div>
      )}

      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void replace(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
