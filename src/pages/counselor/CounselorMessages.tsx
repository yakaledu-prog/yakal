import { useState } from "react";
import { useLocation } from "react-router-dom";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { useAuth } from "@/contexts/AuthContext";
import {
  ContactInfoPanel,
  MessagesPageHeader,
  MessagingLayout,
  useMessaging,
} from "@/components/messaging";

export function CounselorMessages() {
  const { user } = useAuth();
  const location = useLocation();
  // Set by the "Message" button on a student detail page.
  const openWith = (location.state as { openWith?: string } | null)?.openWith;
  const [showProfile, setShowProfile] = useState(false);

  const {
    conversations,
    contacts,
    activeConversation,
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
  } = useMessaging({ userId: user?.id, openWithUserId: openWith });

  return (
    <PageWrapper className="!p-0 h-full overflow-hidden">
      <div className="flex flex-col h-full min-h-0 bg-background dark:bg-[#111b21]">
        <MessagingLayout
          header={
            <MessagesPageHeader
              subtitle="Advise your students on their applications"
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
          onProfileClick={() => setShowProfile((v) => !v)}
          aside={
            showProfile && activeConversation ? (
              <ContactInfoPanel
                contact={activeConversation.contact}
                onClose={() => setShowProfile(false)}
                className="hidden lg:flex"
              />
            ) : null
          }
        />
      </div>
    </PageWrapper>
  );
}
