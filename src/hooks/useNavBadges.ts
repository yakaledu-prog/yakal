import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { getNotifications, subscribeToNotifications } from "@/services/notificationService";
import { getConversations, subscribeToMessages } from "@/services/messageService";
import { useNow } from "@/hooks/useNow";

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
 *
 * The sessions count is a different shape and needs no such column: it is not
 * "unread", it is "happening now or within the quarter hour", which is derived
 * from the booked time and clears itself when the session ends.
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

  // Today's sessions, whichever side of them this person is on. Fetched once
  // for the day and then filtered against a ticking clock, rather than
  // refetched every time a countdown moves.
  const today = new Date().toISOString().slice(0, 10);
  const { data: todaysSessions = [] } = useQuery({
    queryKey: ["nav-sessions", userId, today],
    queryFn: async () => {
      const { data } = await supabase
        .from("sessions")
        .select("id, date, start_time, duration_minutes, status")
        .eq("status", "upcoming")
        .eq("date", today);
      return data ?? [];
    },
    enabled: !!userId,
    // RLS already limits this to sessions they are part of, so there is no
    // filter on the person here and nothing to get wrong.
    staleTime: 5 * 60_000,
  });

  const now = useNow();
  const startingSoon = todaysSessions.filter((s: any) => {
    const start = new Date(`${s.date}T${String(s.start_time).slice(0, 8)}`).getTime();
    const end = start + (s.duration_minutes || 60) * 60_000;
    return now >= start - 15 * 60_000 && now < end;
  }).length;

  // Money that wants a person. For a payee, earnings past their hold with
  // nowhere to go; for a family, an invoice nobody has paid. Both are states
  // rather than unread flags, so both clear themselves when acted on.
  const { data: billing = 0 } = useQuery({
    queryKey: ["nav-billing", userId],
    queryFn: async () => {
      const [owed, unpaid] = await Promise.all([
        supabase
          .from("earnings")
          .select("id", { count: "exact", head: true })
          .eq("payee_id", userId!)
          .eq("status", "pending")
          .lte("releasable_at", new Date().toISOString()),
        supabase
          .from("invoices")
          .select("id", { count: "exact", head: true })
          .eq("status", "open"),
      ]);
      return (owed.count ?? 0) + (unpaid.count ?? 0);
    },
    enabled: !!userId,
    staleTime: 60_000,
  });

  return {
    notifications: notifications.filter((n) => !n.isRead && !n.archived).length,
    messages: conversations.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0),
    sessions: startingSoon,
    billing,
  };
}
