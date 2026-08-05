import { supabase } from "@/lib/supabase";
import {
  renderNotification,
  type TemplateKey,
  type TemplateVars,
} from "@/lib/notifications";

// ============================================================
// In-app notifications.
//
// Every role's notification screen used a hardcoded array, so a real
// notification, like a student asking their parent to unlock a service, was
// written to the database and then never shown to anybody.
// ============================================================

export interface AppNotification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  archived: boolean;
  createdAt: Date;
  /** Which template wrote this. Null on rows written before templates existed. */
  template: string | null;
  /** The facts it was about. The words are rendered from these, not stored. */
  vars: Record<string, unknown> | null;
}

function toNotification(row: any): AppNotification {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type ?? "system",
    title: row.title ?? "",
    message: row.message ?? "",
    link: row.link ?? null,
    isRead: !!row.is_read,
    archived: !!row.archived,
    createdAt: new Date(row.created_at),
    template: row.template ?? null,
    vars: (row.vars as Record<string, unknown> | null) ?? null,
  };
}

/** Everything addressed to this user, newest first. RLS scopes it to them. */
export async function getNotifications(userId: string): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("id, user_id, type, title, message, link, is_read, archived, created_at, template, vars")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toNotification);
}

export async function markNotificationRead(id: string, isRead = true): Promise<void> {
  const { error } = await supabase.from("notifications").update({ is_read: isRead }).eq("id", id);
  if (error) throw error;
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", userId)
    .eq("is_read", false);
  if (error) throw error;
}

export async function setNotificationArchived(id: string, archived: boolean): Promise<void> {
  const { error } = await supabase.from("notifications").update({ archived }).eq("id", id);
  if (error) throw error;
}

/**
 * Sends a notification to someone else.
 *
 * The INSERT policy currently allows any signed-in user to write a row for any
 * user_id, which is what makes student-to-parent requests possible without a
 * server. That is a known shortcut, tracked in the hardening checklist.
 */
export async function sendNotification(input: {
  userId: string;
  title: string;
  message: string;
  type?: string;
  link?: string | null;
  /** The template that wrote this, and what it was about. */
  template?: string | null;
  vars?: Record<string, unknown> | null;
}): Promise<void> {
  const { error } = await supabase.from("notifications").insert({
    user_id: input.userId,
    type: input.type ?? "system",
    title: input.title,
    message: input.message,
    link: input.link ?? null,
    template: input.template ?? null,
    vars: input.vars ?? null,
  });
  if (error) throw error;
}

/**
 * Send one from a template.
 *
 * The title and the line are stored so a row still reads if the template is
 * ever renamed, and the facts are stored so everything else can be rendered
 * fresh each time it is drawn.
 */
export async function sendFromTemplate<K extends TemplateKey>(
  userId: string,
  key: K,
  vars: TemplateVars<K>
): Promise<void> {
  const n = renderNotification(key, vars);
  await sendNotification({
    userId,
    type: n.type,
    title: n.title,
    message: n.message,
    link: n.link,
    template: key,
    vars: vars as Record<string, unknown>,
  });
}

/** Fires whenever a row for this user changes, so a badge can update live. */
export function subscribeToNotifications(userId: string, onChange: () => void) {
  const channel = supabase
    .channel(`notifications:${userId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
      onChange
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
