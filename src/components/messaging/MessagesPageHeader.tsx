import { MessageSquare } from "lucide-react";
import { cn } from "@/utils/cn";

// ============================================================
// The teal banner above the conversation area.
//
// Same shape as the Sessions header (title, an icon and one line of context
// under it, wave motif behind) so the messages screen reads as part of the
// same set of pages.
//
// Only rendered while nothing is selected - once a conversation is open the
// contact header replaces it, so the history gets the whole column. No
// counters: "Unread 0 / Chats 5" repeated what the list beside it already
// shows, row by row.
// ============================================================

export function MessagesPageHeader({
  title = "Messages",
  subtitle,
  className,
}: {
  title?: string;
  subtitle?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-primary text-white pt-6 px-6 pb-6 md:pt-8 md:px-8 md:pb-8 relative overflow-hidden shrink-0",
        className
      )}
    >
      <svg
        className="absolute right-0 top-0 h-full w-[60%] md:w-[40%] text-white/5 pointer-events-none"
        viewBox="0 0 400 200"
        preserveAspectRatio="none"
        fill="none"
        aria-hidden="true"
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

      <div className="relative z-10 flex items-center gap-4 min-w-0">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight truncate">{title}</h1>
          {subtitle && (
            <div className="flex flex-wrap items-center gap-4 text-white/80 text-[13px] mt-1">
              <span className="flex items-center gap-1.5">
                <MessageSquare size={13} /> {subtitle}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
