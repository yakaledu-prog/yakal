import { supabase } from "@/lib/supabase";

export interface Conversation {
  id: string;
  created_at: string;
  updated_at: string;
  participants: { user_id: string }[];
  otherParticipant?: {
    id: string;
    full_name: string;
    role: string;
    avatar_url?: string | null;
  };
  messages?: Message[];
  lastMessage?: Message;
  unreadCount?: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

// Fetch all conversations for a user
export async function getConversations(userId: string): Promise<Conversation[]> {
  console.log('📋 [getConversations] Called for userId:', userId);
  
  // Check Supabase session
  const { data: { session } } = await supabase.auth.getSession();
  console.log('📋 [getConversations] Supabase auth session:', {
    hasSession: !!session,
    supabaseUserId: session?.user?.id || 'NONE',
    email: session?.user?.email || 'NONE',
    passedUserId: userId,
    userIdMatch: session?.user?.id === userId,
  });
  
  if (!session) {
    console.error('📋 [getConversations] ❌ NO SUPABASE SESSION! RLS will block everything.');
  }
  
  const { data: participants, error: pError } = await supabase
    .from('conversation_participants')
    .select('conversation_id')
    .eq('user_id', userId);

  console.log('📋 [getConversations] Participants query result:', { data: participants, error: pError });

  if (pError) throw pError;
  if (!participants || participants.length === 0) return [];

  const conversationIds = participants.map((p) => p.conversation_id);

  // Fetch the conversations along with all participants
  const { data: conversationsData, error: cError } = await supabase
    .from('conversations')
    .select(`
      id,
      created_at,
      updated_at,
      participants:conversation_participants(user_id)
    `)
    .in('id', conversationIds)
    .order('updated_at', { ascending: false });

  if (cError) throw cError;

  // We need to fetch details for the OTHER participant in each conversation
  const enhancedConversations = await Promise.all(
    (conversationsData || []).map(async (conv) => {
      const otherParticipantId = conv.participants.find((p: any) => p.user_id !== userId)?.user_id;

      let otherParticipantInfo = null;
      if (otherParticipantId) {
        // Fetch user info from profiles
        const { data: profileData, error: profErr } = await supabase
          .from('profiles')
          .select('id, full_name, role, avatar_url')
          .eq('id', otherParticipantId)
          .single();
        if (profErr) console.warn('📋 [getConversations] Profile fetch error:', profErr);
        else console.log('📋 [getConversations] Other participant profile:', profileData);
        otherParticipantInfo = profileData;
      }

      // Fetch all messages
      const { data: messagesData } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: true });

      // Fetch unread count
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('conversation_id', conv.id)
        .neq('sender_id', userId)
        .eq('is_read', false);

      return {
        ...conv,
        otherParticipant: otherParticipantInfo,
        messages: messagesData || [],
        unreadCount: count || 0,
      } as any;
    })
  );

  // Sort by updated_at or last message created_at
  return enhancedConversations.sort((a, b) => {
    const aLastMsg = a.messages && a.messages.length > 0 ? a.messages[a.messages.length - 1] : null;
    const bLastMsg = b.messages && b.messages.length > 0 ? b.messages[b.messages.length - 1] : null;
    const timeA = aLastMsg ? new Date(aLastMsg.created_at).getTime() : new Date(a.updated_at).getTime();
    const timeB = bLastMsg ? new Date(bLastMsg.created_at).getTime() : new Date(b.updated_at).getTime();
    return timeB - timeA;
  });
}

export interface Contact {
  id: string;
  full_name: string;
  role: string;
  avatar_url: string | null;
}

// All other profiles the user can start a chat with (includes the seeded demo users).
export async function getContacts(userId: string): Promise<Contact[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, role, avatar_url')
    .neq('id', userId)
    .order('full_name');
  if (error) throw error;
  return (data || []).filter((p) => p.full_name);
}

// --- Parent read-only view of a linked child's conversations --
export interface ParentConversationView {
  id: string;
  childId: string;
  childName: string;
  contact: { id: string; name: string; role: string; avatar: string | null };
  messages: { id: string; content: string; sender_id: string; created_at: string; type: string }[];
  lastAt: string;
}

export async function getLinkedStudentConversations(parentId: string): Promise<ParentConversationView[]> {
  // 1. Active linked children
  const { data: links } = await supabase
    .from("parent_student_links")
    .select("student_id")
    .eq("parent_id", parentId)
    .eq("status", "active");
  const childIds = (links || []).map((l) => l.student_id);
  if (childIds.length === 0) return [];

  // 2. Conversations each child participates in
  const { data: childParts } = await supabase
    .from("conversation_participants")
    .select("conversation_id, user_id")
    .in("user_id", childIds);
  const convIds = [...new Set((childParts || []).map((p) => p.conversation_id))];
  if (convIds.length === 0) return [];

  // 3. All participants of those conversations (to find the non-child peer)
  const { data: allParts } = await supabase
    .from("conversation_participants")
    .select("conversation_id, user_id")
    .in("conversation_id", convIds);

  // 4. Profiles for children + peers
  const peerIds = [...new Set((allParts || []).map((p) => p.user_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, role, avatar_url")
    .in("id", peerIds);
  const profileById = new Map((profiles || []).map((p) => [p.id, p]));

  // 5. Messages of those conversations
  const { data: msgs } = await supabase
    .from("messages")
    .select("id, conversation_id, content, sender_id, created_at, type")
    .in("conversation_id", convIds)
    .order("created_at", { ascending: true });
  const msgsByConv = new Map<string, any[]>();
  (msgs || []).forEach((m) => {
    const list = msgsByConv.get(m.conversation_id) || [];
    list.push(m);
    msgsByConv.set(m.conversation_id, list);
  });

  const childIdSet = new Set(childIds);
  const views: ParentConversationView[] = [];
  for (const convId of convIds) {
    const parts = (allParts || []).filter((p) => p.conversation_id === convId);
    const child = parts.find((p) => childIdSet.has(p.user_id));
    const peer = parts.find((p) => !childIdSet.has(p.user_id));
    if (!child) continue;
    const childProfile = profileById.get(child.user_id);
    const peerProfile = peer ? profileById.get(peer.user_id) : null;
    const convMsgs = msgsByConv.get(convId) || [];
    views.push({
      id: convId,
      childId: child.user_id,
      childName: childProfile?.full_name || "Your child",
      contact: {
        id: peerProfile?.id || "unknown",
        name: peerProfile?.full_name || "Unknown",
        role: peerProfile?.role || "user",
        avatar: peerProfile?.avatar_url ?? null,
      },
      messages: convMsgs,
      lastAt: convMsgs.length ? convMsgs[convMsgs.length - 1].created_at : new Date(0).toISOString(),
    });
  }

  return views.sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime());
}

// Fetch all messages for a specific conversation
export async function getMessages(conversationId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data as Message[];
}

// Send a new message
export async function sendMessage(conversationId: string, senderId: string, content: string, type = 'text'): Promise<Message> {
  console.log('📨 [sendMessage] Called with:', { conversationId, senderId, content, type });
  
  // Check auth session
  const { data: { session } } = await supabase.auth.getSession();
  console.log('📨 [sendMessage] Supabase session:', session ? `YES - user=${session.user.id}, email=${session.user.email}` : 'NO SESSION (auth.uid() will be NULL!)');
  console.log('📨 [sendMessage] Access token present:', !!session?.access_token);
  
  const { data, error } = await supabase
    .from('messages')
    .insert([
      { conversation_id: conversationId, sender_id: senderId, content, type }
    ])
    .select()
    .single();

  if (error) {
    console.error('📨 [sendMessage] INSERT failed:', error);
    throw error;
  }
  
  console.log('📨 [sendMessage] Message inserted successfully:', data.id);

  // Update conversation updated_at
  const { error: updateErr } = await supabase
    .from('conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId);

  if (updateErr) {
    console.warn('📨 [sendMessage] UPDATE conversations.updated_at failed (non-fatal):', updateErr);
  }

  return data as Message;
}

// Mark messages as read in a conversation
export async function markMessagesAsRead(conversationId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('messages')
    .update({ is_read: true })
    .eq('conversation_id', conversationId)
    .neq('sender_id', userId)
    .eq('is_read', false);

  if (error) throw error;
}

// Get or Create a conversation between two users
export async function getOrCreateConversation(user1Id: string, user2Id: string): Promise<string> {
  console.log('🔗 [getOrCreateConversation] Called with:', { user1Id, user2Id });
  
  // -- CRITICAL: Check Supabase auth session --
  const { data: { session } } = await supabase.auth.getSession();
  console.log('🔗 [getOrCreateConversation] Supabase auth session:', {
    hasSession: !!session,
    userId: session?.user?.id || 'NONE',
    email: session?.user?.email || 'NONE',
    accessTokenPresent: !!session?.access_token,
    tokenExpiry: session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : 'NONE',
  });

  if (!session) {
    console.error('🔗 [getOrCreateConversation] ❌ NO SUPABASE SESSION! auth.uid() will be NULL in RLS policies. This is why INSERT fails with 42501.');
    console.error('🔗 [getOrCreateConversation] The user is probably authenticated via Firebase/custom auth but NOT via Supabase Auth.');
  }

  // Step 1: Check if a conversation already exists between these two users.
  console.log('🔗 [getOrCreateConversation] Step 1: Checking for existing conversations...');
  const { data: u1Convs, error: u1Err } = await supabase
    .from('conversation_participants')
    .select('conversation_id')
    .eq('user_id', user1Id);

  console.log('🔗 [getOrCreateConversation] User1 conversations:', { data: u1Convs, error: u1Err });

  if (!u1Err && u1Convs && u1Convs.length > 0) {
    const u1ConvIds = u1Convs.map(c => c.conversation_id);
    console.log('🔗 [getOrCreateConversation] User1 conv IDs:', u1ConvIds);
    
    const { data: sharedConvs, error: sharedErr } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', user2Id)
      .in('conversation_id', u1ConvIds);

    console.log('🔗 [getOrCreateConversation] Shared conversations:', { data: sharedConvs, error: sharedErr });

    if (sharedConvs && sharedConvs.length > 0) {
      console.log('🔗 [getOrCreateConversation] ✅ Found existing conversation:', sharedConvs[0].conversation_id);
      return sharedConvs[0].conversation_id;
    }
  }

  // Step 2: No existing conversation found. Create a new one.
  console.log('🔗 [getOrCreateConversation] Step 2: Creating new conversation...');
  const { data: newConv, error: cError } = await supabase
    .from('conversations')
    .insert([{}])
    .select()
    .single();

  if (cError) {
    console.error('🔗 [getOrCreateConversation] ❌ Failed to INSERT into conversations:', {
      code: cError.code,
      message: cError.message,
      details: cError.details,
      hint: cError.hint,
    });
    console.error('🔗 [getOrCreateConversation] 💡 If code=42501, it means auth.uid() IS NULL. Check if Supabase Auth session exists above.');
    throw cError;
  }

  console.log('🔗 [getOrCreateConversation] ✅ Conversation created:', newConv.id);

  // Step 3: Add both users as participants.
  console.log('🔗 [getOrCreateConversation] Step 3: Adding participants...');
  const { error: p1Error } = await supabase
    .from('conversation_participants')
    .insert([
      { conversation_id: newConv.id, user_id: user1Id },
      { conversation_id: newConv.id, user_id: user2Id }
    ]);

  if (p1Error) {
    console.error('🔗 [getOrCreateConversation] ❌ Failed to INSERT participants:', p1Error);
    throw p1Error;
  }

  console.log('🔗 [getOrCreateConversation] ✅ Both participants added. Conversation ready:', newConv.id);
  return newConv.id;
}

export function subscribeToMessages(callback: (payload: any) => void) {
  const channel = supabase
    .channel('public:messages')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages' },
      callback
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'messages' },
      callback
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function mapDbToLocalConversations(dbConvs: Conversation[]): any[] {
  return dbConvs.map(c => ({
    id: c.id,
    contact: {
      id: c.otherParticipant?.id || "unknown",
      name: c.otherParticipant?.full_name || "Unknown User",
      role: c.otherParticipant?.role || "User",
      avatar: c.otherParticipant?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(c.otherParticipant?.full_name || 'U')}&backgroundColor=1099A1`,
      isOnline: false,
      lastSeen: new Date(c.updated_at),
    },
    messages: (c.messages as any[] || []).map(m => ({
      id: m.id,
      text: m.content,
      senderId: m.sender_id,
      timestamp: new Date(m.created_at),
      isRead: m.is_read,
      // Single tick once stored, double (primary) tick once the recipient read it.
      status: m.is_read ? "delivered" : "sent",
      attachment: m.type !== 'text' ? { type: m.type, url: m.content } : undefined
    })),
    unreadCount: c.unreadCount || 0,
    isPinned: false,
  }));
}
