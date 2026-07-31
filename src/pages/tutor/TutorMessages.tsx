import { useState } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { useAuth } from "@/contexts/AuthContext";
import {
  ContactInfoPanel,
  MessagesPageHeader,
  MessagingLayout,
  useMessaging,
} from "@/components/messaging";

export function TutorMessages() {
  const { user } = useAuth();
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
  } = useMessaging({ userId: user?.id });

  return (
    <PageWrapper className="!p-0 h-full overflow-hidden">
      <div className="flex flex-col h-full min-h-0 bg-background dark:bg-[#111b21]">
        <MessagingLayout
          header={
            <MessagesPageHeader
              subtitle="Stay connected with your students and parents"
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
              />
            ) : null
          }
        />
      </div>
    </PageWrapper>
  );
}
