import { Link } from "react-router-dom";
import { Lock } from "lucide-react";

// ============================================================
// The gate shown over a page the current plan does not include.
//
// Lives here rather than inside DashboardLayout so any surface can use the
// same treatment. The layout applies it per nav item, which covers every role
// at once, but a single panel or tab can reach for it too.
// ============================================================

export function LockedOverlay({
  featureName,
  onRequestAccess,
  requesting = false,
  homePath,
}: {
  /** What is locked, named the way it appears in the nav. */
  featureName: string;
  /** Omit to hide the request button, e.g. where there is nobody to ask. */
  onRequestAccess?: () => void;
  requesting?: boolean;
  homePath?: string;
}) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-background/20 dark:bg-background/40 backdrop-blur-[2px] animate-in fade-in duration-300">
      <div className="max-w-sm w-full bg-white dark:bg-[#202c33] px-8 py-10 rounded-2xl shadow-xl border border-[#e9edef] dark:border-[#2a3942] text-center pointer-events-auto">
        {/* Bare icon. No tinted circle, no ring: the card is already a
            contained surface, so wrapping the glyph again just adds noise. */}
        <Lock size={44} strokeWidth={1.25} className="mx-auto mb-6 text-[#1099A1]" />
        <h2 className="text-2xl font-bold text-[#111] dark:text-white mb-2.5">Access restricted</h2>
        <p className="text-[14px] leading-relaxed text-[#54656f] dark:text-[#aebac1] mb-7">
          {featureName} is not part of your current plan. Ask your parent to unlock it to
          get access.
        </p>

        {onRequestAccess && (
          <button
            onClick={onRequestAccess}
            disabled={requesting}
            className="w-full rounded-xl bg-[#1099A1] px-6 py-3 text-[14px] font-bold text-white transition-colors hover:bg-[#0d848b] disabled:opacity-60"
          >
            {requesting ? "Sending..." : "Request access from parent"}
          </button>
        )}

        {homePath && (
          <Link
            to={homePath}
            className="mt-4 inline-block text-[13px] text-[#54656f] transition-colors hover:text-[#111] dark:text-[#aebac1] dark:hover:text-white"
          >
            Return to dashboard
          </Link>
        )}
      </div>
    </div>
  );
}
