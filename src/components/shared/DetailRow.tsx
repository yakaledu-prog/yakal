import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/utils/cn";

/**
 * Copy text, falling back to a hidden selection.
 *
 * navigator.clipboard resolves in places where nothing actually reaches the
 * clipboard: an unfocused document, or any non-secure origin. Reporting
 * success on the strength of that promise alone showed "copied" over an empty
 * clipboard, so the result is verified and the old execCommand path is kept
 * for when it is not available.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the selection path.
  }

  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

/**
 * A labelled contact detail.
 *
 * `href` makes the value a link, for an email where mailto does the obvious
 * thing. `copy` makes it click to copy instead, which is what a phone number
 * actually needs: a tel: link does nothing on a desktop browser, and the
 * reason anyone clicks a number is to paste it somewhere else.
 */
export function DetailRow({
  icon,
  label,
  value,
  href,
  copy,
  truncate,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href?: string;
  copy?: boolean;
  truncate?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const body = cn("text-[14px]", truncate && "truncate max-w-[220px]");

  return (
    <div className="flex items-start gap-4">
      <div className="shrink-0 text-muted-foreground mt-0.5">{icon}</div>
      <div className="min-w-0">
        <p className="text-[12px] text-muted-foreground font-medium mb-0.5">{label}</p>

        {href ? (
          <a href={href} className={cn(body, "text-primary hover:underline")}>
            {value}
          </a>
        ) : copy ? (
          <button
            type="button"
            onClick={async () => {
              if (await copyText(value)) {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              } else {
                toast.error("Could not copy that.");
              }
            }}
            title="Copy to clipboard"
            className={cn(
              body,
              "group flex items-center gap-1.5 text-foreground transition-colors hover:text-primary"
            )}
          >
            {value}
            {copied ? (
              <Check size={13} className="text-primary" />
            ) : (
              <Copy size={13} className="opacity-0 transition-opacity group-hover:opacity-60" />
            )}
          </button>
        ) : (
          <p className={cn(body, "text-foreground")}>{value}</p>
        )}
      </div>
    </div>
  );
}
