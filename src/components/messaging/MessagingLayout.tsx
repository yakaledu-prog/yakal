import { useEffect, useState, type ReactNode } from "react";
import { MessageSquarePlus } from "lucide-react";
import type { ChatConversation, ContactProfile } from "@/services/messageService";
import { cn } from "@/utils/cn";
import { ChatBody } from "./ChatBody";
import { ChatHeader } from "./ChatHeader";
import { ConversationList } from "./ConversationList";

// ============================================================
// The full messages screen: list on the left, conversation on the right.
//
// The page header (`header`) sits inside the right column, beside the list
// rather than across the top of it, so the list runs the full height of the
// screen and the header stays with the conversation it describes.
//
// On small screens the two columns become one: the list, then the conversation
// once something is picked, with a back arrow in the chat header.
// ============================================================

export function MessagingLayout({
  header,
  conversations,
  contacts,
  activeConversation,
  onSelectConversation,
  onStartConversation,
  searchQuery,
  onSearchChange,
  currentUserId,
  isLoading,
  startingContactId,
  onlineIds,
  isPeerTyping,
  onSendText,
  onTyping,
  onProfileClick,
  draft,
  aside,
  emptyState,
  readOnly,
  readOnlyNotice,
  className,
}: {
  /**
   * Page banner. Shown beside the list only while nothing is selected; once a
   * conversation is open the contact header takes its place.
   */
  header?: ReactNode;
  conversations: ChatConversation[];
  contacts?: ContactProfile[];
  activeConversation?: ChatConversation;
  onSelectConversation: (conversationId: string) => void;
  onStartConversation?: (contact: ContactProfile) => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  currentUserId?: string;
  isLoading?: boolean;
  startingContactId?: string | null;
  onlineIds?: Set<string>;
  isPeerTyping?: boolean;
  onSendText?: (text: string) => void | Promise<void>;
  onTyping?: () => void;
  onProfileClick?: () => void;
  /** Pre-fills the composer, e.g. a message started from another page. */
  draft?: string;
  /** Optional panel beside the history, below the contact header. */
  aside?: ReactNode;
  emptyState?: ReactNode;
  readOnly?: boolean;
  readOnlyNotice?: string;
  className?: string;
}) {
  // Which column the phone shows. Desktop shows both regardless.
  const [showChatOnMobile, setShowChatOnMobile] = useState(false);

  useEffect(() => {
    if (!activeConversation) setShowChatOnMobile(false);
  }, [activeConversation]);

  function selectConversation(conversationId: string) {
    onSelectConversation(conversationId);
    setShowChatOnMobile(true);
  }

  async function startConversation(contact: ContactProfile) {
    await onStartConversation?.(contact);
    setShowChatOnMobile(true);
  }

  return (
    <div
      className={cn(
        "flex-1 min-h-0 flex flex-col md:flex-row bg-white dark:bg-[#111b21] overflow-hidden",
        className
      )}
    >
      <ConversationList
        conversations={conversations}
        contacts={contacts}
        activeConversationId={activeConversation?.id}
        onSelectConversation={selectConversation}
        onStartConversation={onStartConversation ? startConversation : undefined}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        isLoading={isLoading}
        startingContactId={startingContactId}
        onlineIds={onlineIds}
        className={cn(
          "w-full md:w-[340px] md:shrink-0 border-r border-[#e9edef] dark:border-[#2a3942]",
          showChatOnMobile ? "hidden md:flex" : "flex"
        )}
      />

      <div
        className={cn(
          "flex-1 min-w-0 min-h-0 flex-col",
          showChatOnMobile ? "flex" : "hidden md:flex"
        )}
      >
        {activeConversation ? (
          <>
            {/* Once a conversation is open, the person you are talking to is
                the heading. The page banner would only push the history down. */}
            <ChatHeader
              contact={activeConversation.contact}
              isTyping={isPeerTyping}
              onBack={() => setShowChatOnMobile(false)}
              onProfileClick={onProfileClick}
            />
            <div className="flex-1 min-h-0 flex">
              <ChatBody
                conversation={activeConversation}
                currentUserId={currentUserId}
                onSendText={onSendText}
                onTyping={onTyping}
                isPeerTyping={isPeerTyping}
                draft={draft}
                readOnly={readOnly}
                readOnlyNotice={readOnlyNotice}
              />
              {aside}
            </div>
          </>
        ) : (
          <>
            {header}
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6 bg-[#f0faf0] dark:bg-[#0d2528]">
              {emptyState ?? (
                <>
                  <MessageSquarePlus size={40} className="text-[#aebac1]" />
                  <p className="text-[15px] font-semibold text-[#111] dark:text-white">
                    No conversation selected
                  </p>
                  <p className="text-[13px] text-[#667781] dark:text-[#8696a0] max-w-xs">
                    Pick a conversation on the left, or start a new chat with one of the people
                    listed there.
                  </p>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
