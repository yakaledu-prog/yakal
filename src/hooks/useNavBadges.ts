import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { getNotifications, subscribeToNotifications } from "@/services/notificationService";
import { getConversations, subscribeToMessages } from "@/services/messageService";

/**
 * The unread counts the sidebar puts beside Notifications and Messages.
 *
 * Both are already published over Supabase realtime, so this needs no polling
 * and no webhook: the same subscription the bell uses invalidates the query,
 * and the count re-renders. That is the whole mechanism. Anything else wanting
 * a live badge needs its table added to the `supabase_realtime` publication
 * first, otherwise the subscription is silent and the badge only moves on a
 * refetch.
 *
 * Counts are deliberately the only thing here. A dot meaning "something
 * changed since you last looked" needs somewhere to record when you last
 * looked, and there is no such column, so a dot would either never clear or
 * clear on a guess.
 */
export function useNavBadges() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const userId = user?.id;

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications", userId],
    queryFn: () => getNotifications(userId!),
    enabled: !!userId,
  });

  const { data: conversations = [] } = useQuery({
    queryKey: ["conversations", userId],
    queryFn: () => getConversations(userId!),
    enabled: !!userId,
  });

  // The bell subscribes to the same rows under the same key, so when both are
  // mounted this is one subscription's worth of work shared, not two.
  useEffect(() => {
    if (!userId) return;
    return subscribeToNotifications(userId, () => {
      void qc.invalidateQueries({ queryKey: ["notifications", userId] });
    });
  }, [userId, qc]);

  useEffect(() => {
    if (!userId) return;
    return subscribeToMessages(() => {
      void qc.invalidateQueries({ queryKey: ["conversations", userId] });
    });
  }, [userId, qc]);

  return {
    notifications: notifications.filter((n) => !n.isRead && !n.archived).length,
    messages: conversations.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0),
  };
}
