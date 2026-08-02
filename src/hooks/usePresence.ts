import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

// How long a peer stays in "typing" state after their last broadcast.
const TYPING_EXPIRY_MS = 3000;
// Minimum gap between our own typing broadcasts.
const TYPING_THROTTLE_MS = 1500;

// ------------------------------------------------------------
// Online presence, shared by every screen that asks for it.
//
// The channel topic is fixed, and the Supabase client caches channels by
// topic, so a second `supabase.channel('presence:online')` hands back the one
// that has already joined. Calling `.on('presence', ...)` on it throws
// "cannot add `presence` callbacks", which took the whole page down through
// the error boundary.
//
// That happened whenever two screens using this mounted together, and in
// development on every mount, because StrictMode runs the effect twice and
// removeChannel does not finish before the second run starts.
//
// So the channel lives here rather than inside the effect: one for the whole
// app, counted in and out, with the callbacks registered exactly once.
// ------------------------------------------------------------

let channel: ReturnType<typeof supabase.channel> | null = null;
let refCount = 0;
let lastOnline = new Set<string>();
const listeners = new Set<(ids: Set<string>) => void>();

function join(userId: string) {
  refCount += 1;
  if (channel) {
    // Somebody else already opened it; just take the current state.
    return;
  }

  const ch = supabase.channel("presence:online", {
    config: { presence: { key: userId } },
  });
  channel = ch;

  const sync = () => {
    lastOnline = new Set(Object.keys(ch.presenceState()));
    for (const listener of listeners) listener(lastOnline);
  };

  ch.on("presence", { event: "sync" }, sync)
    .on("presence", { event: "join" }, sync)
    .on("presence", { event: "leave" }, sync)
    .subscribe((status) => {
      if (status === "SUBSCRIBED") void ch.track({ online_at: new Date().toISOString() });
    });
}

function leave() {
  refCount = Math.max(0, refCount - 1);
  if (refCount > 0 || !channel) return;
  const ch = channel;
  channel = null;
  lastOnline = new Set();
  void supabase.removeChannel(ch);
}

/**
 * Tracks which users are currently online via a shared Supabase Presence
 * channel. Every signed-in client joins the same channel keyed by its user id,
 * so the returned set contains the ids of everyone with the app open.
 *
 * Safe to call from several components at once: they share one channel.
 */
export function usePresence(userId?: string): Set<string> {
  const [onlineIds, setOnlineIds] = useState<Set<string>>(lastOnline);

  useEffect(() => {
    if (!userId) return;

    listeners.add(setOnlineIds);
    join(userId);
    // Whatever is already known, so a late mount is not blank until the next
    // sync event arrives.
    setOnlineIds(lastOnline);

    return () => {
      listeners.delete(setOnlineIds);
      leave();
    };
  }, [userId]);

  return onlineIds;
}

/**
 * Typing indicators for a set of conversations at once.
 *
 * Watches every conversation the user can see, not just the open one, so a row
 * in the sidebar can say "typing..." while you are reading a different thread.
 * One broadcast channel per conversation, reconciled as the list changes
 * rather than torn down and rebuilt on every render.
 *
 * `notifyTyping` self-throttles, so it is safe to call on every keystroke.
 */
export function useTypingIndicators(conversationIds: string[], userId?: string) {
  // conversation id -> the peers typing in it right now
  const [typingByConversation, setTypingByConversation] = useState<Map<string, Set<string>>>(
    new Map()
  );

  const channelsRef = useRef<Map<string, ReturnType<typeof supabase.channel>>>(new Map());
  const expiryRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const lastSentRef = useRef<Map<string, number>>(new Map());

  // Sorted so a reorder of the same conversations does not resubscribe.
  const key = [...conversationIds].sort().join(",");

  useEffect(() => {
    if (!userId) return;

    const wanted = new Set(key ? key.split(",") : []);
    const channels = channelsRef.current;
    const expiry = expiryRef.current;

    const clearTyper = (conversationId: string, typerId: string) => {
      setTypingByConversation((prev) => {
        const peers = prev.get(conversationId);
        if (!peers?.has(typerId)) return prev;
        const next = new Map(prev);
        const remaining = new Set(peers);
        remaining.delete(typerId);
        if (remaining.size) next.set(conversationId, remaining);
        else next.delete(conversationId);
        return next;
      });
    };

    // Drop channels for conversations that are gone.
    for (const [id, channel] of channels) {
      if (wanted.has(id)) continue;
      supabase.removeChannel(channel);
      channels.delete(id);
      setTypingByConversation((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
    }

    // Add channels for new ones.
    for (const id of wanted) {
      if (channels.has(id)) continue;

      const channel = supabase
        .channel(`typing:${id}`)
        .on("broadcast", { event: "typing" }, ({ payload }) => {
          const typerId = payload?.user_id;
          if (!typerId || typerId === userId) return;

          setTypingByConversation((prev) => {
            const next = new Map(prev);
            next.set(id, new Set(prev.get(id) ?? []).add(typerId));
            return next;
          });

          // Nobody sends a "stopped typing" event, so each burst carries its
          // own expiry and the last one wins.
          const timerKey = `${id}:${typerId}`;
          const running = expiry.get(timerKey);
          if (running) clearTimeout(running);
          expiry.set(
            timerKey,
            setTimeout(() => {
              clearTyper(id, typerId);
              expiry.delete(timerKey);
            }, TYPING_EXPIRY_MS)
          );
        })
        .subscribe();

      channels.set(id, channel);
    }
  }, [key, userId]);

  // Tear everything down when the component using this goes away.
  useEffect(() => {
    const channels = channelsRef.current;
    const expiry = expiryRef.current;
    return () => {
      channels.forEach((c) => supabase.removeChannel(c));
      channels.clear();
      expiry.forEach((t) => clearTimeout(t));
      expiry.clear();
    };
  }, []);

  const notifyTyping = useCallback(
    (conversationId?: string) => {
      if (!conversationId || !userId) return;
      const channel = channelsRef.current.get(conversationId);
      if (!channel) return;

      const now = Date.now();
      if (now - (lastSentRef.current.get(conversationId) ?? 0) < TYPING_THROTTLE_MS) return;
      lastSentRef.current.set(conversationId, now);

      channel.send({
        type: "broadcast",
        event: "typing",
        payload: { user_id: userId, conversation_id: conversationId },
      });
    },
    [userId]
  );

  return { typingByConversation, notifyTyping };
}

// How often the signed-in user stamps profiles.last_seen_at.
const HEARTBEAT_MS = 60_000;

/**
 * Records that the signed-in user is around, so other people can be told when
 * they were last seen.
 *
 * Presence covers "online now" but goes silent the moment a tab closes, and
 * nothing survives a reload. This writes a timestamp instead, slowly, and only
 * while the tab is actually visible, so a window left open in the background
 * does not keep someone looking active forever.
 */
export function useLastSeenHeartbeat(userId?: string) {
  useEffect(() => {
    if (!userId) return;

    let stopped = false;

    const beat = async () => {
      if (stopped || document.visibilityState !== "visible") return;

      // Confirm there is still a session before writing. Without this the beat
      // can fire against a torn-down or expired one during a reload and come
      // back 401, which is noise rather than a real failure.
      const { data } = await supabase.auth.getSession();
      if (stopped || !data.session) return;

      const { error } = await supabase
        .from("profiles")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", userId);

      // Not worth surfacing: a missed beat only makes "last seen" a little
      // staler than it should be.
      if (error) console.warn("Could not record last seen", error.message);
    };

    const tick = () => void beat();

    tick();
    const interval = setInterval(tick, HEARTBEAT_MS);
    document.addEventListener("visibilitychange", tick);

    return () => {
      stopped = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [userId]);
}
