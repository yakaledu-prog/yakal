import { supabase } from "@/lib/supabase";
import { initialsAvatarUrl } from "@/utils/avatar";

// ============================================================
// Messaging data access.
//
// One conversation is a row in `conversations`, its members are rows in
// `conversation_participants`, and the history is rows in `messages`. Reads are
// scoped by RLS to conversations you belong to (plus, for a parent, those of a
// linked child - read only).
// ============================================================

export type ChatRole = "student" | "tutor" | "parent" | "counselor" | "admin";

export interface ChatContact {
  id: string;
  name: string;
  role: ChatRole | string;
  avatarUrl: string;
  isOnline: boolean;
  lastSeen: Date | null;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  type: string;
  isRead: boolean;
  createdAt: Date;
  /** Set while an optimistic message is still in flight. */
  pending?: boolean;
  failed?: boolean;
}

export interface ChatConversation {
  id: string;
  contact: ChatContact;
  messages: ChatMessage[];
  unreadCount: number;
  updatedAt: Date;
  /**
   * Extra line for the list row. Used by the parent's monitoring view to name
   * which child a conversation belongs to, since the contact is the other side.
   */
  subtitle?: string;
}

export interface ContactProfile {
  id: string;
  name: string;
  role: ChatRole | string;
  avatarUrl: string;
}

interface ProfileRow {
  id: string;
  full_name: string | null;
  role: string | null;
  avatar_url: string | null;
}

function toContact(p: ProfileRow | undefined, fallbackId: string): ChatContact {
  const name = p?.full_name?.trim() || "Unknown user";
  return {
    id: p?.id ?? fallbackId,
    name,
    role: p?.role ?? "student",
    avatarUrl: p?.avatar_url || initialsAvatarUrl(name),
    isOnline: false,
    lastSeen: null,
  };
}

function toMessage(row: any): ChatMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    text: row.content ?? "",
    type: row.type ?? "text",
    isRead: !!row.is_read,
    createdAt: new Date(row.created_at),
  };
}

/**
 * Every conversation the user takes part in, newest activity first, with the
 * full history and the other person attached.
 *
 * Four queries regardless of how many conversations there are. The previous
 * version issued three per conversation, which made the list slower with every
 * thread the user opened.
 */
export async function getConversations(userId: string): Promise<ChatConversation[]> {
  const { data: mine, error: mineErr } = await supabase
    .from("conversation_participants")
    .select("conversation_id")
    .eq("user_id", userId);
  if (mineErr) throw mineErr;

  const conversationIds = (mine ?? []).map((r) => r.conversation_id);
  if (conversationIds.length === 0) return [];

  const { data: convRows, error: convErr } = await supabase
    .from("conversations")
    .select("id, updated_at, participants:conversation_participants(user_id)")
    .in("id", conversationIds)
    .order("updated_at", { ascending: false });
  if (convErr) throw convErr;

  const peerIds = [
    ...new Set(
      (convRows ?? [])
        .flatMap((c: any) => (c.participants ?? []).map((p: any) => p.user_id))
        .filter((id: string) => id !== userId)
    ),
  ];

  const [profilesRes, messagesRes] = await Promise.all([
    peerIds.length
      ? supabase.from("profiles").select("id, full_name, role, avatar_url").in("id", peerIds)
      : Promise.resolve({ data: [], error: null } as any),
    supabase
      .from("messages")
      .select("*")
      .in("conversation_id", conversationIds)
      .order("created_at", { ascending: true }),
  ]);
  if (profilesRes.error) throw profilesRes.error;
  if (messagesRes.error) throw messagesRes.error;

  const profileById = new Map<string, ProfileRow>(
    (profilesRes.data ?? []).map((p: ProfileRow) => [p.id, p])
  );

  const messagesByConversation = new Map<string, ChatMessage[]>();
  for (const row of messagesRes.data ?? []) {
    const list = messagesByConversation.get(row.conversation_id) ?? [];
    list.push(toMessage(row));
    messagesByConversation.set(row.conversation_id, list);
  }

  const conversations: ChatConversation[] = (convRows ?? []).map((c: any) => {
    const peerId = (c.participants ?? []).find((p: any) => p.user_id !== userId)?.user_id;
    const messages = messagesByConversation.get(c.id) ?? [];
    return {
      id: c.id,
      contact: toContact(peerId ? profileById.get(peerId) : undefined, peerId ?? c.id),
      messages,
      unreadCount: messages.filter((m) => m.senderId !== userId && !m.isRead).length,
      updatedAt: new Date(c.updated_at),
    };
  });

  // Order by real activity. `updated_at` only moves when a message is sent, so
  // it drifts from the history for threads created but never used.
  return conversations.sort((a, b) => {
    const at = a.messages[a.messages.length - 1]?.createdAt ?? a.updatedAt;
    const bt = b.messages[b.messages.length - 1]?.createdAt ?? b.updatedAt;
    return bt.getTime() - at.getTime();
  });
}

/** Everyone the user could start a conversation with. */
export async function getContacts(userId: string): Promise<ContactProfile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, avatar_url")
    .neq("id", userId)
    .order("full_name");
  if (error) throw error;

  return (data ?? [])
    .filter((p: ProfileRow) => p.full_name)
    .map((p: ProfileRow) => {
      const c = toContact(p, p.id);
      return { id: c.id, name: c.name, role: c.role, avatarUrl: c.avatarUrl };
    });
}

export async function getMessages(conversationId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(toMessage);
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  content: string,
  type = "text"
): Promise<ChatMessage> {
  const { data, error } = await supabase
    .from("messages")
    .insert([{ conversation_id: conversationId, sender_id: senderId, content, type }])
    .select()
    .single();
  if (error) throw error;

  // Bump the thread so it sorts to the top for everyone. Not worth failing the
  // send over: the message itself is already stored.
  const { error: touchErr } = await supabase
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);
  if (touchErr) {
    console.warn("Could not update conversation timestamp", touchErr);
  }

  return toMessage(data);
}

export async function markMessagesAsRead(conversationId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("messages")
    .update({ is_read: true })
    .eq("conversation_id", conversationId)
    .neq("sender_id", userId)
    .eq("is_read", false);
  if (error) throw error;
}

/**
 * The id of the caller's one-to-one conversation with `peerId`, creating it if
 * this is the first contact.
 *
 * Runs server side as a single atomic statement. Doing it from the client took
 * three round trips and could race two people into duplicate threads for the
 * same pair.
 */
export async function getOrCreateConversation(peerId: string): Promise<string> {
  const { data, error } = await supabase.rpc("get_or_create_conversation", {
    p_peer_id: peerId,
  });
  if (error) throw error;
  return data as string;
}

/**
 * Fires on any message change. The callback gets the raw payload; callers
 * generally just invalidate their conversation query.
 */
export function subscribeToMessages(callback: (payload: any) => void) {
  const channel = supabase
    .channel("public:messages")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, callback)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, callback)
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// ---------- parent read-only view of a linked child's chats ----------

export interface ParentConversationView {
  id: string;
  childId: string;
  childName: string;
  contact: ChatContact;
  messages: ChatMessage[];
  lastAt: Date;
}

export async function getLinkedStudentConversations(
  parentId: string
): Promise<ParentConversationView[]> {
  const { data: links, error: linkErr } = await supabase
    .from("parent_student_links")
    .select("student_id")
    .eq("parent_id", parentId)
    .eq("status", "active");
  if (linkErr) throw linkErr;

  const childIds = (links ?? []).map((l) => l.student_id);
  if (childIds.length === 0) return [];

  const { data: childParts, error: cpErr } = await supabase
    .from("conversation_participants")
    .select("conversation_id")
    .in("user_id", childIds);
  if (cpErr) throw cpErr;

  const conversationIds = [...new Set((childParts ?? []).map((p) => p.conversation_id))];
  if (conversationIds.length === 0) return [];

  const [partsRes, messagesRes] = await Promise.all([
    supabase
      .from("conversation_participants")
      .select("conversation_id, user_id")
      .in("conversation_id", conversationIds),
    supabase
      .from("messages")
      .select("*")
      .in("conversation_id", conversationIds)
      .order("created_at", { ascending: true }),
  ]);
  if (partsRes.error) throw partsRes.error;
  if (messagesRes.error) throw messagesRes.error;

  const allParts = partsRes.data ?? [];
  const everyoneIds = [...new Set(allParts.map((p) => p.user_id))];
  const { data: profiles, error: profErr } = await supabase
    .from("profiles")
    .select("id, full_name, role, avatar_url")
    .in("id", everyoneIds);
  if (profErr) throw profErr;

  const profileById = new Map<string, ProfileRow>(
    (profiles ?? []).map((p: ProfileRow) => [p.id, p])
  );

  const messagesByConversation = new Map<string, ChatMessage[]>();
  for (const row of messagesRes.data ?? []) {
    const list = messagesByConversation.get(row.conversation_id) ?? [];
    list.push(toMessage(row));
    messagesByConversation.set(row.conversation_id, list);
  }

  const childIdSet = new Set(childIds);
  const views: ParentConversationView[] = [];

  for (const conversationId of conversationIds) {
    const parts = allParts.filter((p) => p.conversation_id === conversationId);
    const child = parts.find((p) => childIdSet.has(p.user_id));
    if (!child) continue;
    const peer = parts.find((p) => !childIdSet.has(p.user_id));
    const messages = messagesByConversation.get(conversationId) ?? [];

    views.push({
      id: conversationId,
      childId: child.user_id,
      childName: profileById.get(child.user_id)?.full_name || "Your child",
      contact: toContact(peer ? profileById.get(peer.user_id) : undefined, peer?.user_id ?? conversationId),
      messages,
      lastAt: messages[messages.length - 1]?.createdAt ?? new Date(0),
    });
  }

  return views.sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime());
}
