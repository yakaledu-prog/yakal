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

export function StudentMessages() {
  const { user } = useAuth();
  const location = useLocation();
  // Set when arriving from another page: `openWith` names the person, and
  // `draftMessage` pre-fills the composer.
  const nav = location.state as
    | { openWith?: string; draftMessage?: string; tutorName?: string }
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
  } = useMessaging({ userId: user?.id, openWithUserId: nav?.openWith });

  // Older callers pass a tutor's name rather than an id. Match it against a
  // real conversation; if there is none, leave the selection alone rather than
  // inventing a thread that cannot be sent to.
  useEffect(() => {
    if (!nav?.tutorName || nav.openWith) return;
    const match = conversations.find((c) => c.contact.name === nav.tutorName);
    if (match) setActiveConversationId(match.id);
  }, [nav?.tutorName, nav?.openWith, conversations, setActiveConversationId]);

  return (
    <PageWrapper className="!p-0 h-full overflow-hidden">
      <div className="flex flex-col h-full min-h-0 bg-background dark:bg-[#111b21]">
        <MessagingLayout
          header={
            <MessagesPageHeader
              subtitle="Reach your tutors, counselor and support team"
            />
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
      </div>
    </PageWrapper>
  );
}
