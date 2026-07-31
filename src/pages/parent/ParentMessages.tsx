import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { useAuth } from "@/contexts/AuthContext";
import {
  ContactInfoPanel,
  MessagesPageHeader,
  MessagingLayout,
  useMessaging,
} from "@/components/messaging";

/**
 * `embedded` drops the page banner and the full-height wrapper, for use inside
 * a tab that already has its own header. Without it the child detail page
 * showed a second "Messages" banner under the child's name.
 */
export function ParentMessages({ embedded = false }: { embedded?: boolean } = {}) {
  const { user } = useAuth();
  const location = useLocation();
  const nav = location.state as
    | { openWith?: string; contactId?: string; draftMessage?: string; tutorName?: string }
    | null;

  const [showProfile, setShowProfile] = useState(false);

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
    openWithUserId: nav?.openWith ?? nav?.contactId,
  });

  // Some callers pass a tutor's name instead of an id. Match a real thread; do
  // not fabricate one, since an invented conversation cannot be sent to.
  useEffect(() => {
    if (!nav?.tutorName || nav.openWith || nav.contactId) return;
    const match = conversations.find((c) => c.contact.name === nav.tutorName);
    if (match) setActiveConversationId(match.id);
  }, [nav?.tutorName, nav?.openWith, nav?.contactId, conversations, setActiveConversationId]);

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
          onStartConversation={startConversation}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          currentUserId={user?.id}
          isLoading={isLoading}
          startingContactId={startingContactId}
          onlineIds={onlineIds}
          isPeerTyping={isPeerTyping}
          typingConversationIds={typingConversationIds}
          onSendText={sendMessage}
          onTyping={notifyTyping}
          draft={nav?.draftMessage}
          onProfileClick={() => setShowProfile((v) => !v)}
          aside={
            showProfile && activeConversation ? (
              <ContactInfoPanel
                contact={activeConversation.contact}
                onClose={() => setShowProfile(false)}
              />
            ) : null
          }
        />
    </Wrapper>
  );
}
