import { ArrowLeft, MoreVertical, Search } from "lucide-react";
import type { ChatContact } from "@/services/messageService";
import { cn } from "@/utils/cn";
import { formatListDate } from "./format";
import { RoleBadge, ROLE_LABEL, normalizeRole } from "./RoleIcon";

// ============================================================
// Who you are talking to, above the conversation.
//
// Separate from ChatBody because plenty of places already say who the peer is -
// the tutor's student detail page has the student's name in the page header -
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
  const status = isTyping
    ? "typing..."
    : contact.isOnline
      ? "online"
      : contact.lastSeen
        ? `last seen ${formatListDate(contact.lastSeen)}`
        : ROLE_LABEL[normalizeRole(contact.role)];

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 md:px-4 py-2 bg-[#f0f2f5] dark:bg-[#202c33] border-b border-[#e9edef] dark:border-[#2a3942] shrink-0",
        className
      )}
    >
      {onBack && (
        <button
          onClick={onBack}
          aria-label="Back to conversations"
          className="md:hidden p-2 -ml-1 rounded-full text-[#54656f] dark:text-[#aebac1] hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
      )}

      <button
        onClick={onProfileClick}
        disabled={!onProfileClick}
        className="flex-1 min-w-0 flex items-center gap-3 text-left enabled:hover:opacity-80 transition-opacity disabled:cursor-default"
      >
        <div className="relative shrink-0">
          <img
            src={contact.avatarUrl}
            alt={contact.name}
            className="w-10 h-10 rounded-full object-cover"
          />
          {contact.isOnline && (
            <span className="absolute bottom-0.5 right-0.5 w-2.5 h-2.5 bg-[#97CE9D] border-2 border-[#f0f2f5] dark:border-[#202c33] rounded-full" />
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <h2 className="text-[15px] font-semibold text-[#111] dark:text-[#e9edef] truncate">
              {contact.name}
            </h2>
            <RoleBadge role={contact.role} />
          </div>
          <p
            className={cn(
              "text-[12px] truncate",
              isTyping || contact.isOnline ? "text-[#1099A1]" : "text-[#667781] dark:text-[#8696a0]"
            )}
          >
            {status}
          </p>
        </div>
      </button>

      <div className="flex items-center gap-0.5 text-[#54656f] dark:text-[#aebac1] shrink-0">
        {onSearch && (
          <button
            onClick={onSearch}
            aria-label="Search in conversation"
            className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          >
            <Search size={20} />
          </button>
        )}
        {onMenu && (
          <button
            onClick={onMenu}
            aria-label="Conversation options"
            className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          >
            <MoreVertical size={20} />
          </button>
        )}
      </div>
    </div>
  );
}
