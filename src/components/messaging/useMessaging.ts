import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getContacts,
  getConversations,
  getOrCreateConversation,
  markMessagesAsRead,
  sendMessage as persistMessage,
  subscribeToMessages,
  type ChatConversation,
  type ChatMessage,
  type ContactProfile,
} from "@/services/messageService";
import { usePresence, useTypingIndicators } from "@/hooks/usePresence";

// ============================================================
// Everything the messaging screens need: loading, selection, sending, presence.
//
// Lived in four near-identical copies across the student, tutor, parent and
// counselor pages before this.
// ============================================================

export interface UseMessagingOptions {
  userId?: string;
  /** Open the most recent thread on load. Wanted on desktop, not on mobile. */
  autoSelectFirst?: boolean;
  /** Set false on embedded views that should not offer new chats. */
  includeContacts?: boolean;
  /**
   * Deep link: open (creating if needed) the thread with this person as soon
   * as the page loads. Used by the "Message" button on a student detail page.
   */
  openWithUserId?: string;
}

export function useMessaging({
  userId,
  autoSelectFirst = true,
  includeContacts = true,
  openWithUserId,
}: UseMessagingOptions) {
  const queryClient = useQueryClient();
  const conversationsKey = useMemo(() => ["conversations", userId], [userId]);

  const {
    data: conversations = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: conversationsKey,
    queryFn: () => getConversations(userId!),
    enabled: !!userId,
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts", userId],
    queryFn: () => getContacts(userId!),
    enabled: !!userId && includeContacts,
  });

  const [activeConversationId, setActiveConversationId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [startingContactId, setStartingContactId] = useState<string | null>(null);

  const onlineIds = usePresence(userId);

  // Watch every thread, not just the open one, so the sidebar can show that
  // someone is typing in a conversation you are not currently reading.
  const conversationIds = useMemo(() => conversations.map((c) => c.id), [conversations]);
  const { typingByConversation, notifyTyping: notifyTypingIn } = useTypingIndicators(
    conversationIds,
    userId
  );

  const notifyTyping = useCallback(
    () => notifyTypingIn(activeConversationId),
    [notifyTypingIn, activeConversationId]
  );

  const typingConversationIds = useMemo(
    () => new Set(typingByConversation.keys()),
    [typingByConversation]
  );

  // Overlay live presence so a green dot appears without a refetch.
  const liveConversations = useMemo(
    () =>
      conversations.map((c) => ({
        ...c,
        contact: { ...c.contact, isOnline: onlineIds.has(c.contact.id) },
      })),
    [conversations, onlineIds]
  );

  const activeConversation = liveConversations.find((c) => c.id === activeConversationId);

  useEffect(() => {
    if (!autoSelectFirst) return;
    // A deep link decides what to open, so do not race it with the newest thread.
    if (openWithUserId) return;
    if (activeConversationId) return;
    if (conversations.length > 0) setActiveConversationId(conversations[0].id);
  }, [autoSelectFirst, openWithUserId, activeConversationId, conversations]);

  // A thread that disappears (or was never really there) should not leave the
  // pane wedged on a missing id.
  useEffect(() => {
    if (!activeConversationId) return;
    if (isLoading) return;
    if (!conversations.some((c) => c.id === activeConversationId)) {
      setActiveConversationId("");
    }
  }, [activeConversationId, conversations, isLoading]);

  useEffect(() => {
    if (!userId) return;
    return subscribeToMessages(() => {
      queryClient.invalidateQueries({ queryKey: ["conversations", userId] });
    });
  }, [userId, queryClient]);

  const patchConversation = useCallback(
    (conversationId: string, update: (c: ChatConversation) => ChatConversation) => {
      queryClient.setQueryData<ChatConversation[]>(conversationsKey, (prev) =>
        (prev ?? []).map((c) => (c.id === conversationId ? update(c) : c))
      );
    },
    [queryClient, conversationsKey]
  );

  const openConversation = useCallback(
    (conversationId: string) => {
      setActiveConversationId(conversationId);
      if (!userId) return;

      // Clear the badge straight away, then persist so the sender's ticks turn
      // double. A failure here is cosmetic, so it does not surface.
      patchConversation(conversationId, (c) => ({
        ...c,
        unreadCount: 0,
        messages: c.messages.map((m) => (m.senderId === userId ? m : { ...m, isRead: true })),
      }));
      markMessagesAsRead(conversationId, userId).catch((err) =>
        console.warn("Could not mark conversation as read", err)
      );
    },
    [userId, patchConversation]
  );

  const startConversationWith = useCallback(
    async (peerId: string) => {
      if (!userId) return;
      setStartingContactId(peerId);
      try {
        const conversationId = await getOrCreateConversation(peerId);
        // Refetch before selecting, so the thread exists in the list by the
        // time the pane tries to render it.
        await queryClient.invalidateQueries({ queryKey: ["conversations", userId] });
        setActiveConversationId(conversationId);
        return conversationId;
      } catch (err) {
        console.error("Could not start conversation", err);
        throw err;
      } finally {
        setStartingContactId(null);
      }
    },
    [userId, queryClient]
  );

  const startConversation = useCallback(
    (contact: ContactProfile) => startConversationWith(contact.id),
    [startConversationWith]
  );

  // Deep link. Runs once per target so a re-render does not reopen it after
  // the user has navigated somewhere else in the list.
  const [deepLinked, setDeepLinked] = useState<string | null>(null);
  useEffect(() => {
    if (!userId || !openWithUserId) return;
    if (deepLinked === openWithUserId) return;
    setDeepLinked(openWithUserId);
    void startConversationWith(openWithUserId);
  }, [userId, openWithUserId, deepLinked, startConversationWith]);

  const sendMessage = useCallback(
    async (text: string, conversationId = activeConversationId) => {
      if (!userId || !conversationId || !text.trim()) return;

      const optimistic: ChatMessage = {
        id: `pending-${Date.now()}`,
        conversationId,
        senderId: userId,
        text: text.trim(),
        type: "text",
        isRead: false,
        createdAt: new Date(),
        pending: true,
      };

      patchConversation(conversationId, (c) => ({
        ...c,
        messages: [...c.messages, optimistic],
        updatedAt: optimistic.createdAt,
      }));

      try {
        const saved = await persistMessage(conversationId, userId, optimistic.text);
        patchConversation(conversationId, (c) => ({
          ...c,
          messages: c.messages.map((m) => (m.id === optimistic.id ? saved : m)),
        }));
      } catch (err) {
        console.error("Could not send message", err);
        patchConversation(conversationId, (c) => ({
          ...c,
          messages: c.messages.map((m) =>
            m.id === optimistic.id ? { ...m, pending: false, failed: true } : m
          ),
        }));
        throw err;
      }
    },
    [userId, activeConversationId, patchConversation]
  );

  const isPeerTyping =
    !!activeConversation &&
    !!typingByConversation.get(activeConversation.id)?.has(activeConversation.contact.id);

  return {
    conversations: liveConversations,
    contacts,
    activeConversation,
    activeConversationId,
    setActiveConversationId,
    openConversation,
    startConversation,
    startConversationWith,
    sendMessage,
    searchQuery,
    setSearchQuery,
    isLoading,
    error,
    refetch,
    startingContactId,
    onlineIds,
    isPeerTyping,
    /** Conversations someone is typing in right now, for the sidebar. */
    typingConversationIds,
    notifyTyping,
    totalUnread: conversations.reduce((sum, c) => sum + c.unreadCount, 0),
  };
}
