import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Loader2, X } from "lucide-react";
import { cn } from "@/utils/cn";

/**
 * Confirmation dialog with the same banded header as the page headers, so a
 * destructive prompt reads as part of the product rather than a browser alert.
 *
 * Portalled and focus-trapped at the entry point: the confirm button takes
 * focus on open, so Enter confirms and Escape cancels without touching the
 * mouse. Deliberately not defaulted to the destructive action being safest to
 * reach, since the dialog only ever appears when the user asked for it.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => confirmRef.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, busy, onCancel]);

  if (!open) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onMouseDown={(e) => e.target === e.currentTarget && !busy && onCancel()}
    >
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl animate-in zoom-in-95 duration-200 dark:bg-[#111b21]">
        <header className="relative overflow-hidden bg-[#1099A1] px-5 py-4 text-white">
          <svg
            className="pointer-events-none absolute right-0 top-0 h-full w-[55%] text-white/10"
            viewBox="0 0 400 200"
            preserveAspectRatio="none"
            fill="none"
            aria-hidden
          >
            <path d="M 0 200 Q 100 50, 200 120 T 400 0 L 400 200 Z" fill="currentColor" />
            <path
              d="M 0 200 L 100 80 L 200 150 L 300 40 L 400 100 L 400 200 Z"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              opacity="0.3"
            />
            <circle cx="100" cy="80" r="4" fill="currentColor" opacity="0.5" />
            <circle cx="200" cy="150" r="4" fill="currentColor" opacity="0.5" />
            <circle cx="300" cy="40" r="4" fill="currentColor" opacity="0.5" />
          </svg>

          <div className="relative z-10 flex items-center gap-3">
            <h2 className="flex-1 text-[16px] font-semibold">{title}</h2>
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              aria-label="Cancel"
              className="text-white/70 transition-colors hover:text-white disabled:opacity-40"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="px-5 py-4">
          <div className="text-[14px] leading-relaxed text-[#54656f] dark:text-[#aebac1]">
            {message}
          </div>
        </div>

        <footer className="flex justify-end gap-2 px-5 pb-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="h-10 rounded-xl px-3 text-[14px] font-medium text-[#54656f] transition-colors hover:text-[#111] disabled:opacity-40 dark:text-[#aebac1] dark:hover:text-white"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={cn(
              "inline-flex h-10 items-center gap-1.5 rounded-xl px-4 text-[14px] font-semibold text-white transition-colors disabled:opacity-60",
              destructive
                ? "bg-[#d4183d] hover:bg-[#b31333]"
                : "bg-[#1099A1] hover:bg-[#0d848b]"
            )}
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            {confirmLabel}
          </button>
        </footer>
      </div>
    </div>,
    document.body
  );
}
