import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye, MessagesSquare } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { PageWrapper } from "@/components/ui/PageWrapper";
import {
  getLinkedStudentConversations,
  type ChatConversation,
} from "@/services/messageService";
import {
  MessagesPageHeader,
  MessagingLayout,
  useMessaging,
} from "@/components/messaging";

// ============================================================
// A parent watching a linked child's conversations. Read only by policy: there
// is no INSERT grant for a parent on messages, so the composer is hidden
// rather than left to fail.
//
// The child's messages are the ones drawn on the right, so ChatBody is given
// the child's id as the "current user".
// ============================================================

export function ParentChildChats() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeId, setActiveId] = useState("");

  const { data: views = [], isLoading } = useQuery({
    queryKey: ["parent-child-chats", user?.id],
    queryFn: () => getLinkedStudentConversations(user!.id),
    enabled: !!user?.id,
  });

  // Presence and typing are shared with the rest of messaging; the composer is
  // off, so only the online dots matter here.
  const { onlineIds } = useMessaging({
    userId: user?.id,
    autoSelectFirst: false,
    includeContacts: false,
  });

  const conversations: ChatConversation[] = useMemo(
    () =>
      views.map((v) => ({
        id: v.id,
        contact: v.contact,
        messages: v.messages,
        unreadCount: 0,
        updatedAt: v.lastAt,
        subtitle: v.childName,
      })),
    [views]
  );

  useEffect(() => {
    if (!activeId && conversations.length > 0) setActiveId(conversations[0].id);
  }, [conversations, activeId]);

  const active = conversations.find((c) => c.id === activeId);
  const activeChildId = views.find((v) => v.id === activeId)?.childId;

  return (
    <PageWrapper className="!p-0 h-full overflow-hidden">
      <div className="flex flex-col h-full min-h-0 bg-background dark:bg-[#111b21]">
        <MessagingLayout
          header={
            <MessagesPageHeader
              title="Children's Chats"
              subtitle="Read-only view of your children's conversations"
            />
          }
          conversations={conversations}
          activeConversation={active}
          onSelectConversation={setActiveId}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          currentUserId={activeChildId}
          isLoading={isLoading}
          onlineIds={onlineIds}
          readOnly
          readOnlyNotice="Read only - you can follow this conversation but not take part in it."
          emptyState={
            <>
              <MessagesSquare size={40} className="text-[#aebac1]" />
              <p className="text-[15px] font-semibold text-[#111] dark:text-white">
                Select a conversation
              </p>
              <p className="text-[13px] text-[#667781] dark:text-[#8696a0] max-w-xs flex items-center gap-1.5">
                <Eye size={13} /> Conversations your children have with their tutors and
                counselors appear here.
              </p>
            </>
          }
        />
      </div>
    </PageWrapper>
  );
}
