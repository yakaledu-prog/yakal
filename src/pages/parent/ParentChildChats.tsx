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
  FlagConversationDialog,
  MessagesPageHeader,
  MessagingLayout,
  useMessaging,
} from "@/components/messaging";
import {
  describeReport,
  getConversationReports,
  getFlaggedConversationIds,
  getMyFlags,
} from "@/services/reports";

// ============================================================
// A parent watching a linked child's conversations. Read only by policy: there
// is no INSERT grant for a parent on messages, so the composer is hidden
// rather than left to fail.
//
// The child's messages are the ones drawn on the right, so ChatBody is given
// the child's id as the "current user".
//
// This is where the scan surfaces. A parent sent here by a notification lands
// on the conversation, sees the message that caused it marked in place, and
// reports it without having to find it again.
// ============================================================

export function ParentChildChats() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeId, setActiveId] = useState("");
  const [flagging, setFlagging] = useState(false);

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

  // What the scan picked out. Only a linked parent and an admin can read these
  // rows, so for anybody else this comes back empty and nothing is marked.
  const { data: reports } = useQuery({
    queryKey: ["message-reports", activeId],
    queryFn: () => getConversationReports(activeId),
    enabled: !!activeId,
  });

  const reportLabels = useMemo(() => {
    const labels = new Map<string, { severity: "high" | "medium"; label: string }>();
    for (const [id, report] of reports ?? []) {
      labels.set(id, { severity: report.severity, label: describeReport(report) });
    }
    return labels;
  }, [reports]);

  // Which conversations have something in them, so the list can say so before
  // one is opened. Opening each of them to find out defeats the point.
  const { data: flaggedIds } = useQuery({
    queryKey: ["flagged-conversations", user?.id],
    queryFn: getFlaggedConversationIds,
    enabled: !!user?.id,
  });

  const { data: myFlags = [], refetch: refetchFlags } = useQuery({
    queryKey: ["conversation-flags", activeId, user?.id],
    queryFn: () => getMyFlags(activeId, user!.id),
    enabled: !!activeId && !!user?.id,
  });

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
          messageReports={reportLabels}
          flaggedConversationIds={flaggedIds}
          onFlag={() => setFlagging(true)}
          isFlagged={myFlags.length > 0}
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

        {active && user && (
          <FlagConversationDialog
            open={flagging}
            contactName={active.contact.name}
            conversationId={active.id}
            userId={user.id}
            messages={active.messages}
            subjectId={activeChildId}
            subjectName={views.find((v) => v.id === activeId)?.childName ?? "Your child"}
            contactAvatarUrl={active.contact.avatarUrl}
            existing={myFlags}
            reports={reports}
            onClose={() => setFlagging(false)}
            onDone={() => void refetchFlags()}
          />
        )}
      </div>
    </PageWrapper>
  );
}
