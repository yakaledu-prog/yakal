import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

// How long a peer stays in "typing" state after their last broadcast.
const TYPING_EXPIRY_MS = 3000;
// Minimum gap between our own typing broadcasts.
const TYPING_THROTTLE_MS = 1500;

/**
 * Tracks which users are currently online via a shared Supabase Presence
 * channel. Every signed-in client joins the same channel keyed by its user id,
 * so the returned set contains the ids of everyone with the app open.
 */
export function usePresence(userId?: string): Set<string> {
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!userId) return;

    const channel = supabase.channel('presence:online', {
      config: { presence: { key: userId } },
    });

    const sync = () => {
      setOnlineIds(new Set(Object.keys(channel.presenceState())));
    };

    channel
      .on('presence', { event: 'sync' }, sync)
      .on('presence', { event: 'join' }, sync)
      .on('presence', { event: 'leave' }, sync)
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ online_at: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
      setOnlineIds(new Set());
    };
  }, [userId]);

  return onlineIds;
}

/**
 * Typing indicator for one conversation, over a Supabase broadcast channel.
 * Call `notifyTyping` on every keystroke (it self-throttles); `typingUserIds`
 * holds the peers who broadcast recently.
 */
export function useTypingIndicator(conversationId?: string, userId?: string) {
  const [typingUserIds, setTypingUserIds] = useState<Set<string>>(new Set());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastSentRef = useRef(0);
  const expiryTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    if (!conversationId || !userId) return;

    const channel = supabase.channel(`typing:${conversationId}`);
    channelRef.current = channel;
    const expiryTimers = expiryTimersRef.current;

    channel
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        const typerId = payload?.user_id;
        if (!typerId || typerId === userId) return;
        setTypingUserIds((prev) => new Set(prev).add(typerId));
        const existing = expiryTimers.get(typerId);
        if (existing) clearTimeout(existing);
        expiryTimers.set(
          typerId,
          setTimeout(() => {
            setTypingUserIds((prev) => {
              const next = new Set(prev);
              next.delete(typerId);
              return next;
            });
            expiryTimers.delete(typerId);
          }, TYPING_EXPIRY_MS)
        );
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
      expiryTimers.forEach((t) => clearTimeout(t));
      expiryTimers.clear();
      setTypingUserIds(new Set());
    };
  }, [conversationId, userId]);

  const notifyTyping = useCallback(() => {
    if (!channelRef.current || !userId) return;
    const now = Date.now();
    if (now - lastSentRef.current < TYPING_THROTTLE_MS) return;
    lastSentRef.current = now;
    channelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: { user_id: userId },
    });
  }, [userId]);

  return { typingUserIds, notifyTyping };
}
