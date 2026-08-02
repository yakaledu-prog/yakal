import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { useAuth } from "@/contexts/AuthContext";
import {
  ContactInfoPanel,
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

/**
 * The parent's messages.
 *
 * `embedded` drops the page banner and the full-height wrapper, for use inside
 * a tab that already has its own header. Without it the child detail page
 * showed a second "Messages" banner under the child's name.
 *
 * `childId` switches this from the parent's own threads to that child's. The
 * child tab used to show the parent's conversations under a heading with the
 * child's name, which was simply the wrong list.
 *
 * It also decides whose messages sit on the right. Watching a child, the
 * parent is a third party to the conversation: passing their own id put every
 * message on the left and labelled the child's own words with the tutor's
 * name, because the bubble names anything that is not yours after the contact.
 */
export function ParentMessages({
  embedded = false,
  childId,
  childName,
  childAvatarUrl,
}: {
  embedded?: boolean;
  childId?: string;
  childName?: string;
  childAvatarUrl?: string | null;
} = {}) {
  const { user } = useAuth();
  const location = useLocation();
  const nav = location.state as
    | { openWith?: string; contactId?: string; draftMessage?: string; tutorName?: string }
    | null;

  const [showProfile, setShowProfile] = useState(false);
  const [flagging, setFlagging] = useState(false);

  const {
    conversations,
    contacts,
    activeConversation,
    setActiveConversationId,
    openConversation,
    startConversation,
    sendMessage,
    searchQuery,
    setSearchQuery,
    isLoading,
    startingContactId,
    onlineIds,
    isPeerTyping,
    typingConversationIds,
    notifyTyping,
  } = useMessaging({
    userId: user?.id,
    openWithUserId: childId ? undefined : (nav?.openWith ?? nav?.contactId),
    monitorChildId: childId,
  });

  // Some callers pass a tutor's name instead of an id. Match a real thread; do
  // not fabricate one, since an invented conversation cannot be sent to.
  useEffect(() => {
    if (!nav?.tutorName || nav.openWith || nav.contactId) return;
    const match = conversations.find((c) => c.contact.name === nav.tutorName);
    if (match) setActiveConversationId(match.id);
  }, [nav?.tutorName, nav?.openWith, nav?.contactId, conversations, setActiveConversationId]);

  // Whether this parent has already reported the open conversation, so the
  // flag can show as set rather than inviting a second report that the unique
  // index would reject anyway.
  const { data: myFlags = [], refetch: refetchFlag } = useQuery({
    queryKey: ["conversation-flags", activeConversation?.id, user?.id],
    queryFn: () => getMyFlags(activeConversation!.id, user!.id),
    enabled: !!activeConversation?.id && !!user?.id,
  });

  // What the scan picked out of this conversation. Only a linked parent and an
  // admin can read these rows at all, so for anyone else this comes back empty
  // and nothing is marked.
  const { data: reports } = useQuery({
    queryKey: ["message-reports", activeConversation?.id],
    queryFn: () => getConversationReports(activeConversation!.id),
    enabled: !!activeConversation?.id,
  });

  const { data: flaggedIds } = useQuery({
    queryKey: ["flagged-conversations", user?.id],
    queryFn: getFlaggedConversationIds,
    enabled: !!user?.id,
  });

  // The bubbles need a label, not the categories behind it.
  const reportLabels = useMemo(() => {
    const labels = new Map<string, { severity: "high" | "medium"; label: string }>();
    for (const [id, report] of reports ?? []) {
      labels.set(id, { severity: report.severity, label: describeReport(report) });
    }
    return labels;
  }, [reports]);

  // One wrapper for both modes: embedded fills its tab, standalone fills the page.
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    embedded ? (
      <div className="flex flex-col flex-1 min-h-0 h-full bg-background dark:bg-[#111b21]">
        {children}
      </div>
    ) : (
      <PageWrapper className="!p-0 h-full overflow-hidden">
        <div className="flex flex-col h-full min-h-0 bg-background dark:bg-[#111b21]">
          {children}
        </div>
      </PageWrapper>
    );

  return (
    <Wrapper>
        <MessagingLayout
          header={
            embedded ? undefined : (
              <MessagesPageHeader subtitle="Talk to your children's tutors and counselors" />
            )
          }
          conversations={conversations}
          contacts={contacts}
          activeConversation={activeConversation}
          onSelectConversation={(id) => {
            openConversation(id);
            setShowProfile(false);
          }}
          onStartConversation={childId ? undefined : startConversation}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          currentUserId={childId ?? user?.id}
          isLoading={isLoading}
          startingContactId={startingContactId}
          onlineIds={onlineIds}
          isPeerTyping={isPeerTyping}
          typingConversationIds={typingConversationIds}
          onSendText={childId ? undefined : sendMessage}
          onTyping={notifyTyping}
          draft={nav?.draftMessage}
          onProfileClick={() => setShowProfile((v) => !v)}
          // Embedded, the sidebar already shows whose conversation is open, so
          // the contact header would only repeat the name. Contact info moves
          // to the composer instead.
          hideChatHeader={embedded}
          // Watching, not taking part. The composer, emoji picker and
          // attachment button have nothing to do here, so the footer carries
          // only the two things a watcher can act on.
          readOnly={embedded || !!childId}
          readOnlyNotice="Viewing only"
          readOnlyTooltip="These are your child's conversations. You can read them and report anything of concern, but you cannot take part."
          emptyState={
            childId ? (
              <>
                <p className="text-[15px] font-semibold text-[#111] dark:text-white">
                  No conversations yet
                </p>
                <p className="max-w-xs text-[13px] text-[#667781] dark:text-[#8696a0]">
                  Your child's messages with their tutors and counselor appear here.
                </p>
              </>
            ) : undefined
          }
          onFlag={() => setFlagging(true)}
          isFlagged={myFlags.length > 0}
          messageReports={reportLabels}
          flaggedConversationIds={flaggedIds}
          aside={
            showProfile && activeConversation ? (
              <ContactInfoPanel
                contact={activeConversation.contact}
                onClose={() => setShowProfile(false)}
              />
            ) : null
          }
        />
        {activeConversation && user && (
          <FlagConversationDialog
            open={flagging}
            contactName={activeConversation.contact.name}
            conversationId={activeConversation.id}
            userId={user.id}
            messages={activeConversation.messages}
            subjectId={childId ?? user.id}
            subjectName={childId ? (childName ?? "Your child") : "You"}
            subjectAvatarUrl={childId ? childAvatarUrl : undefined}
            contactAvatarUrl={activeConversation.contact.avatarUrl}
            existing={myFlags}
            reports={reports}
            onClose={() => setFlagging(false)}
            onDone={() => void refetchFlag()}
          />
        )}
    </Wrapper>
  );
}
