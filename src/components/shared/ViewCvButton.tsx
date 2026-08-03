import { useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { getResumeUrl } from "@/services/resumeService";
import { cn } from "@/utils/cn";

/**
 * Open an applicant's CV.
 *
 * profiles.resume_url holds a storage path, not a URL, because the bucket is
 * private: a CV carries a home address and a phone number, so readers get a
 * link that expires rather than one that works forever.
 *
 * Putting that path straight into an href, which two places did, makes the
 * browser treat it as a relative route. The router then matches nothing and
 * serves the not-found page, so the button looked broken rather than
 * forbidden. The link is minted on click instead.
 */
export function ViewCvButton({
  path,
  className,
  label = "View CV",
}: {
  path: string | null | undefined;
  className?: string;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);

  if (!path) return null;

  async function open() {
    setBusy(true);
    try {
      const url = await getResumeUrl(path);
      if (!url) {
        toast.error("That CV could not be opened. It may have been removed.");
        return;
      }
      window.open(url, "_blank", "noopener");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void open()}
      disabled={busy}
      className={cn(
        "flex items-center gap-1.5 rounded-xl border border-[#e9edef] px-3.5 py-2 text-[13px] font-medium transition-colors hover:bg-muted/60 disabled:opacity-50 dark:border-[#2a3942]",
        className
      )}
    >
      {busy ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
      {label}
    </button>
  );
}
