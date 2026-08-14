import { ArrowLeft, MoreVertical, Search } from "lucide-react";
import type { ChatContact } from "@/services/messageService";
import { cn } from "@/utils/cn";
import { formatLastSeen } from "./format";
import { RoleBadge, ROLE_LABEL, normalizeRole } from "./RoleIcon";

// ============================================================
// Who you are talking to, above the conversation.
//
// Built to the same pattern as the course and sessions headers: teal ground
// with the wave motif, the name set large, one line of context under it, and
// figures on the right. A conversation is a page in its own right here, not a
// grey strip bolted to the top of one.
//
// Separate from ChatBody because plenty of places already say who the peer is,
// and repeating it there wastes a row.
// ============================================================

export function ChatHeader({
  contact,
  isTyping = false,
  onProfileClick,
  onBack,
  onSearch,
  onMenu,
  className,
}: {
  contact: ChatContact;
  isTyping?: boolean;
  onProfileClick?: () => void;
  /** Shown on small screens to get back to the conversation list. */
  onBack?: () => void;
  onSearch?: () => void;
  onMenu?: () => void;
  className?: string;
}) {
  const role = normalizeRole(contact.role);

  // One slot after the role, sharing it between the three things worth saying:
  // what they are doing now, or when they were last around.
  const lastSeen = formatLastSeen(contact.lastSeen);
  const status = isTyping
    ? "typing..."
    : contact.isOnline
      ? "online"
      : lastSeen
        ? `last seen ${lastSeen}`
        : null;
  const statusIsLive = isTyping || contact.isOnline;

  return (
    <div
      className={cn(
        "bg-primary text-white px-4 py-4 md:px-8 md:py-5 relative overflow-hidden shrink-0",
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

      <div className="relative z-10 flex items-center gap-3 md:gap-4">
        {onBack && (
          <button
            onClick={onBack}
            aria-label="Back to conversations"
            className="md:hidden p-1.5 -ml-1.5 rounded-full text-white/90 hover:bg-white/15 transition-colors shrink-0"
          >
            <ArrowLeft size={20} />
          </button>
        )}

        <button
          onClick={onProfileClick}
          disabled={!onProfileClick}
          className="flex-1 min-w-0 flex items-center gap-3 md:gap-4 text-left enabled:hover:opacity-90 transition-opacity disabled:cursor-default"
        >
          <span className="relative shrink-0">
            <img
              src={contact.avatarUrl}
              alt=""
              className="w-11 h-11 md:w-12 md:h-12 rounded-full object-cover ring-2 ring-white/30"
            />
            {contact.isOnline && (
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-tertiary border-2 border-primary rounded-full" />
            )}
          </span>

          <span className="min-w-0">
            <h1 className="text-lg md:text-2xl font-bold tracking-tight truncate">
              {contact.name}
            </h1>
            <span className="flex items-center gap-1.5 text-white/80 text-[13px] mt-0.5">
              {/* Both variants, or the badge's own dark rule would leave a
                  grey glyph on the teal in dark mode. */}
              <RoleBadge role={role} size={13} className="text-white/70 dark:text-white/70" />
              {ROLE_LABEL[role]}
              {status && (
                <>
                  <span className="w-1 h-1 rounded-full bg-white/40 shrink-0" aria-hidden="true" />
                  <span className={cn("truncate", statusIsLive && "text-white font-medium")}>
                    {status}
                  </span>
                </>
              )}
            </span>
          </span>
        </button>

        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-0.5 text-white/90">
            {onSearch && (
              <button
                onClick={onSearch}
                aria-label="Search in conversation"
                className="p-2 rounded-full hover:bg-white/15 transition-colors"
              >
                <Search size={20} />
              </button>
            )}
            {onMenu && (
              <button
                onClick={onMenu}
                aria-label="Conversation options"
                className="p-2 rounded-full hover:bg-white/15 transition-colors"
              >
                <MoreVertical size={20} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
