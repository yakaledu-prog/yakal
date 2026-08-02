import { Loader2, MessageCircleWarning, Search } from "lucide-react";
import type { ChatConversation, ContactProfile } from "@/services/messageService";
import { cn } from "@/utils/cn";
import { formatListDate, lastMessage, previewText } from "./format";
import { RoleBadge } from "./RoleIcon";

// ============================================================
// The list of people you can talk to: existing threads first, then everyone
// you have not messaged yet.
//
// A row shows the last message rather than the person's role - the role is the
// icon beside the name. An untouched contact gets a prompt in the brand colour
// instead, so it reads as an invitation rather than an empty thread.
// ============================================================

function Row({
  avatarUrl,
  name,
  role,
  isOnline,
  isActive,
  onClick,
  timestamp,
  subtitle,
  preview,
  previewUnread,
  previewIsPrompt,
  isTyping,
  isFlagged,
  unreadCount,
  busy,
  disabled,
}: {
  avatarUrl: string;
  name: string;
  role: string;
  isOnline?: boolean;
  isActive?: boolean;
  onClick: () => void;
  timestamp?: string;
  subtitle?: string;
  preview: string;
  previewUnread?: boolean;
  previewIsPrompt?: boolean;
  isTyping?: boolean;
  /** The scan found something in this conversation and nobody has looked. */
  isFlagged?: boolean;
  unreadCount?: number;
  busy?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-current={isActive ? "true" : undefined}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors",
        // One background, chosen here rather than layered: cn is a plain join,
        // so two bg classes would race on stylesheet order instead of the
        // order they are written in. A flagged row keeps its tint when
        // selected, only deeper, because it is still the row worth reading.
        isFlagged
          ? isActive
            ? "bg-[#CAA25F]/20"
            : "bg-[#CAA25F]/10 hover:bg-[#CAA25F]/15"
          : isActive
            ? "bg-[#f0f2f5] dark:bg-[#2a3942]"
            : "hover:bg-[#f5f6f6] dark:hover:bg-[#202c33]",
        disabled && "opacity-60 pointer-events-none"
      )}
    >
      <div className="relative shrink-0">
        <img src={avatarUrl} alt="" className="w-12 h-12 rounded-full object-cover" />
        {isOnline && (
          <span className="absolute bottom-0.5 right-0.5 w-3 h-3 bg-[#97CE9D] border-2 border-white dark:border-[#111b21] rounded-full" />
        )}
      </div>

      <div className="flex-1 min-w-0 border-b border-[#e9edef] dark:border-[#2a3942] pb-2.5">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <div className="flex items-center gap-1 min-w-0">
            <RoleBadge role={role} />
            <span
              className={cn(
                "text-[15px] truncate text-[#333] dark:text-[#e9edef]",
                unreadCount ? "font-semibold" : "font-medium"
              )}
            >
              {name}
            </span>
          </div>
          <span className="flex items-center gap-1.5 shrink-0">
            {/* Beside the timestamp rather than under the preview: a row is
                scanned down its right edge, and this has to be found without
                reading the message it is about. */}
            {isFlagged && (
              <MessageCircleWarning
                size={15}
                className="concern-pulse text-[#CAA25F]"
                aria-label="Something here needs a look"
              />
            )}
            {busy && <Loader2 size={13} className="animate-spin text-[#1099A1]" />}
            {timestamp && (
              <span
                className={cn(
                  "text-[12px]",
                  unreadCount ? "text-[#1099A1] font-semibold" : "text-[#667781] dark:text-[#8696a0]"
                )}
              >
                {timestamp}
              </span>
            )}
          </span>
        </div>

        {subtitle && (
          <p className="text-[12px] text-[#1099A1] font-medium truncate mb-0.5">{subtitle}</p>
        )}

        <div className="flex items-center justify-between gap-2">
          {/* Typing wins over the last message: it is the newer fact, and it
              is what you would look at the row to find out. */}
          {isTyping ? (
            <span className="text-[13px] truncate flex-1 text-[#1099A1] font-medium flex items-center gap-1.5">
              <span className="flex items-center gap-[3px]" aria-hidden="true">
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay}
                    className="w-1 h-1 rounded-full bg-[#1099A1] animate-bounce"
                    style={{ animationDelay: `${delay}ms` }}
                  />
                ))}
              </span>
              typing...
            </span>
          ) : (
            <span
              className={cn(
                "text-[13px] truncate flex-1",
                previewIsPrompt
                  ? "text-[#1099A1] font-medium"
                  : previewUnread
                    ? "text-[#111] dark:text-[#e9edef] font-semibold"
                    : "text-[#667781] dark:text-[#8696a0]"
              )}
            >
              {preview}
            </span>
          )}
          {!!unreadCount && (
            <span className="min-w-[20px] h-5 px-1.5 bg-[#1099A1] text-white text-[11px] font-bold rounded-full flex items-center justify-center leading-none shrink-0">
              {unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

export function ConversationList({
  conversations,
  contacts,
  activeConversationId,
  onSelectConversation,
  onStartConversation,
  searchQuery,
  onSearchChange,
  isLoading = false,
  startingContactId,
  onlineIds,
  typingConversationIds,
  flaggedConversationIds,
  className,
}: {
  conversations: ChatConversation[];
  /** People with no thread yet. Pass an empty array to hide the section. */
  contacts?: ContactProfile[];
  activeConversationId?: string;
  onSelectConversation: (conversationId: string) => void;
  onStartConversation?: (contact: ContactProfile) => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  isLoading?: boolean;
  startingContactId?: string | null;
  onlineIds?: Set<string>;
  /** Conversations someone is typing in right now. */
  typingConversationIds?: Set<string>;
  /** Conversations the message scan has picked something out of. */
  flaggedConversationIds?: Set<string>;
  className?: string;
}) {
  const query = searchQuery.trim().toLowerCase();
  const matches = (name: string) => name.toLowerCase().includes(query);

  const visibleConversations = conversations.filter((c) => matches(c.contact.name));

  // Anyone already in a thread is shown above, so keep them out of the
  // "start a new chat" section.
  const existing = new Set(conversations.map((c) => c.contact.id));
  const visibleContacts = (contacts ?? []).filter(
    (c) => !existing.has(c.id) && matches(c.name)
  );

  const nothingToShow =
    !isLoading && visibleConversations.length === 0 && visibleContacts.length === 0;

  return (
    <div className={cn("flex flex-col min-h-0 bg-white dark:bg-[#111b21]", className)}>
      <div className="px-3 py-3 border-b border-[#e9edef] dark:border-[#2a3942] shrink-0">
        <div className="flex items-center gap-2 border-b-2 border-[#1099A1] px-2 py-2">
          <Search size={18} className="text-[#1099A1] shrink-0" />
          <input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            // Nothing can be started from a watching view, so the field
            // should not offer it.
            placeholder={onStartConversation ? "Search or start new chat" : "Search"}
            aria-label="Search conversations"
            className="bg-transparent text-[14px] text-[#111] dark:text-white placeholder:text-[#8696a0] flex-1 outline-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {isLoading && (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-[#1099A1]" size={22} />
          </div>
        )}

        {visibleConversations.map((conv) => {
          const last = lastMessage(conv.messages);
          const preview = previewText(last);
          return (
            <Row
              key={conv.id}
              avatarUrl={conv.contact.avatarUrl}
              name={conv.contact.name}
              role={conv.contact.role}
              isOnline={onlineIds?.has(conv.contact.id) ?? conv.contact.isOnline}
              isActive={conv.id === activeConversationId}
              onClick={() => onSelectConversation(conv.id)}
              timestamp={last ? formatListDate(last.createdAt) : ""}
              subtitle={conv.subtitle}
              preview={preview || "Start the conversation"}
              previewIsPrompt={!preview}
              previewUnread={conv.unreadCount > 0}
              unreadCount={conv.unreadCount}
              isTyping={typingConversationIds?.has(conv.id)}
              isFlagged={flaggedConversationIds?.has(conv.id)}
            />
          );
        })}

        {/* People with no thread yet continue the same list. They read as
            ordinary rows with an invitation in place of a last message, rather
            than sitting under a heading that splits the list in two. */}
        {visibleContacts.map((contact) => (
          <Row
            key={contact.id}
            avatarUrl={contact.avatarUrl}
            name={contact.name}
            role={contact.role}
            isOnline={onlineIds?.has(contact.id)}
            onClick={() => onStartConversation?.(contact)}
            preview="Start the conversation"
            previewIsPrompt
            busy={startingContactId === contact.id}
            disabled={!!startingContactId && startingContactId !== contact.id}
          />
        ))}

        {nothingToShow && (
          <p className="px-4 py-8 text-center text-[13px] text-[#667781] dark:text-[#8696a0]">
            {query ? `No one matching "${searchQuery}".` : "No conversations yet."}
          </p>
        )}
      </div>
    </div>
  );
}
