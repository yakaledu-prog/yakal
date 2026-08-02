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
  last_seen_at?: string | null;
}

function toContact(p: ProfileRow | undefined, fallbackId: string): ChatContact {
  const name = p?.full_name?.trim() || "Unknown user";
  return {
    id: p?.id ?? fallbackId,
    name,
    role: p?.role ?? "student",
    avatarUrl: p?.avatar_url || initialsAvatarUrl(name),
    isOnline: false,
    lastSeen: p?.last_seen_at ? new Date(p.last_seen_at) : null,
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
      ? supabase.from("profiles").select("id, full_name, role, avatar_url, last_seen_at").in("id", peerIds)
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
    .select("id, full_name, role, avatar_url, last_seen_at")
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
// One channel for the whole app, counted in and out.
//
// The topic is fixed and the Supabase client caches channels by topic, so a
// second `supabase.channel("public:messages")` hands back the one that has
// already subscribed. Calling `.on("postgres_changes", ...)` on it throws
// "cannot add postgres_changes callbacks after subscribe()", which took the
// page down through the error boundary.
//
// That happened whenever two screens subscribed at once - the parent's child
// tab renders the messages view inside a page that has its own - and on every
// mount in development, where StrictMode runs the effect twice and
// removeChannel has not finished before the second run starts.
let messageChannel: ReturnType<typeof supabase.channel> | null = null;
let messageRefs = 0;
const messageListeners = new Set<(payload: any) => void>();

export function subscribeToMessages(callback: (payload: any) => void) {
  messageListeners.add(callback);
  messageRefs += 1;

  if (!messageChannel) {
    // Fan out here rather than registering a handler per subscriber, so the
    // callbacks are attached exactly once, before subscribe.
    const fanOut = (payload: any) => {
      for (const listener of messageListeners) listener(payload);
    };
    messageChannel = supabase
      .channel("public:messages")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, fanOut)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, fanOut)
      .subscribe();
  }

  let released = false;
  return () => {
    // Guard against a double unsubscribe dropping the count below the number
    // of live subscribers and closing the channel out from under them.
    if (released) return;
    released = true;

    messageListeners.delete(callback);
    messageRefs = Math.max(0, messageRefs - 1);
    if (messageRefs > 0 || !messageChannel) return;

    const channel = messageChannel;
    messageChannel = null;
    void supabase.removeChannel(channel);
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
    .select("id, full_name, role, avatar_url, last_seen_at")
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

/**
 * A single child's conversations, shaped like any other conversation list.
 *
 * The parent's child tab used to render the parent's own threads, so a tab
 * headed with the child's name listed conversations the child was not in. This
 * returns what the child is actually part of.
 *
 * Read only by construction: a parent's row level security grants SELECT on a
 * linked child's messages and nothing else, so there is no send path here even
 * if a caller wanted one. `subtitle` names the other party's role, since the
 * parent is looking at somebody else's correspondence and "who is this person
 * to my child" is the question they have.
 */
export async function getChildConversations(
  parentId: string,
  childId: string
): Promise<ChatConversation[]> {
  const views = await getLinkedStudentConversations(parentId);
  return views
    .filter((v) => v.childId === childId)
    .map((v) => ({
      id: v.id,
      contact: v.contact,
      messages: v.messages,
      // Unread belongs to the child, not to the parent reading over their
      // shoulder. Marking it here would clear the child's own badge.
      unreadCount: 0,
      updatedAt: v.lastAt,
      // No subtitle. The tab is already headed with the child's name and the
      // row already names the other person, so "Amen and Bethlehem" only says
      // it a third time.
    }));
}
