import { useCallback, useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { initialsAvatarUrl } from "@/utils/avatar";
import type { ChatConversation } from "@/services/messageService";
import { useMessaging } from "./useMessaging";

// ============================================================
// The conversation with one particular person, for places that already make
// the peer obvious - a tutor's student detail page, a course page.
//
// The thread is created on the first message rather than on render, so opening
// a Messages tab to look around does not litter the database with empty
// conversations.
// ============================================================

export function useDirectConversation({
  userId,
  peerId,
  peerName,
  peerRole,
  peerAvatarUrl,
}: {
  userId?: string;
  peerId?: string;
  /** Used until the profile loads, and if the peer has no profile row. */
  peerName?: string;
  peerRole?: string;
  peerAvatarUrl?: string | null;
}) {
  const {
    conversations,
    sendMessage,
    startConversationWith,
    openConversation,
    isLoading,
    onlineIds,
    isPeerTyping,
    notifyTyping,
  } = useMessaging({ userId, autoSelectFirst: false, includeContacts: false });

  const { data: profile } = useQuery({
    queryKey: ["profile-brief", peerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, role, avatar_url")
        .eq("id", peerId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!peerId && !peerName,
  });

  const existing = conversations.find((c) => c.contact.id === peerId);

  // Mark as read once the thread is on screen, the same as clicking it in the
  // list would.
  const markedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!existing || markedRef.current === existing.id) return;
    if (existing.unreadCount === 0) return;
    markedRef.current = existing.id;
    openConversation(existing.id);
  }, [existing, openConversation]);

  const conversation: ChatConversation | undefined = useMemo(() => {
    if (existing) {
      return {
        ...existing,
        contact: { ...existing.contact, isOnline: onlineIds.has(existing.contact.id) },
      };
    }
    if (!peerId) return undefined;

    const name = peerName || profile?.full_name || "this person";
    // A stand-in so the composer and empty state can render before any message
    // exists. It is never persisted; sending creates the real row.
    return {
      id: `new:${peerId}`,
      contact: {
        id: peerId,
        name,
        role: peerRole || profile?.role || "student",
        avatarUrl: peerAvatarUrl || profile?.avatar_url || initialsAvatarUrl(name),
        isOnline: onlineIds.has(peerId),
        lastSeen: null,
      },
      messages: [],
      unreadCount: 0,
      updatedAt: new Date(),
    };
  }, [existing, peerId, peerName, peerRole, peerAvatarUrl, profile, onlineIds]);

  const send = useCallback(
    async (text: string) => {
      if (!peerId || !userId) return;
      const conversationId = existing?.id ?? (await startConversationWith(peerId));
      if (!conversationId) return;
      await sendMessage(text, conversationId);
    },
    [peerId, userId, existing, startConversationWith, sendMessage]
  );

  return {
    conversation,
    send,
    isLoading,
    isPeerTyping: existing ? isPeerTyping : false,
    notifyTyping,
  };
}
