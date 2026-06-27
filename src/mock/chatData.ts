// ─── Message Status ─────────────────────────────────────────────────────────
export type MessageStatus = "sending" | "sent" | "delivered" | "read";

// ─── Single Message ──────────────────────────────────────────────────────────
export type Message = {
  id: string;
  conversationId: string;
  senderId: string;        // userId or contact.id
  text: string;
  timestamp: Date;         // proper Date for sorting/formatting
  status: MessageStatus;   // only meaningful for messages sent by currentUser
  isRead: boolean;         // whether the recipient has read it
};

// ─── Conversation Participant ────────────────────────────────────────────────
export type ConversationMember = {
  userId: string;
  isOnline: boolean;
  lastSeen: Date;
};

// ─── Conversation (the unit that appears in the left pane) ───────────────────
export type Conversation = {
  id: string;
  contact: Contact;        // the other person
  messages: Message[];
  unreadCount: number;     // messages not read by currentUser
  isPinned: boolean;
};

// ─── Contact / User profile ──────────────────────────────────────────────────
export type Contact = {
  id: string;
  name: string;
  role: "Tutor" | "Peer" | "Admin";
  avatar: string;
  isOnline: boolean;
  lastSeen: Date;
};

// ─── The current logged-in user ──────────────────────────────────────────────
export const currentUser = {
  id: "current-user",
  name: "Brooklyn",
  avatar: "https://loremfaces.net/96/id/5.jpg",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
/** Returns how many messages in a conversation are unread by the current user */
export function countUnread(messages: Message[]): number {
  return messages.filter(
    (m) => m.senderId !== currentUser.id && !m.isRead
  ).length;
}

/** Returns the last message of a conversation */
export function lastMessage(messages: Message[]): Message | undefined {
  return messages[messages.length - 1];
}

// ─── Mock Data ───────────────────────────────────────────────────────────────
export const mockConversations: Conversation[] = [
  {
    id: "conv-1",
    isPinned: false,
    unreadCount: 0,
    contact: {
      id: "u1",
      name: "Dr. Alex",
      role: "Tutor",
      avatar: "https://loremfaces.net/96/id/1.jpg",
      isOnline: true,
      lastSeen: new Date(),
    },
    messages: [
      {
        id: "msg-1",
        conversationId: "conv-1",
        senderId: currentUser.id,
        text: "Hi Dr. Alex, thank you for the reminder! I'll be there at 8:30am. Let me know if I need to bring anything specific.",
        timestamp: new Date("2024-11-16T17:00:00"),
        status: "read",
        isRead: true,
      },
      {
        id: "msg-2",
        conversationId: "conv-1",
        senderId: "u1",
        text: "I wanted to let you know that we've received your lab results. Everything looks good, but I'd like to discuss a few preventive measures during our next appointment.",
        timestamp: new Date("2024-11-16T17:02:00"),
        status: "read",
        isRead: true,
      },
      {
        id: "msg-3",
        conversationId: "conv-1",
        senderId: currentUser.id,
        text: "Thank you, Dr. Alex. I appreciate the update. Can I schedule a time to discuss it?",
        timestamp: new Date("2024-11-16T17:30:00"),
        status: "delivered",
        isRead: true,
      },
    ],
  },
  {
    id: "conv-2",
    isPinned: false,
    unreadCount: 1,
    contact: {
      id: "u2",
      name: "Courtney Henry",
      role: "Peer",
      avatar: "https://loremfaces.net/96/id/16.jpg",
      isOnline: true,
      lastSeen: new Date(),
    },
    messages: [
      {
        id: "msg-1",
        conversationId: "conv-2",
        senderId: "u2",
        text: "Hey! Are you coming to the study group today?",
        timestamp: new Date("2024-11-16T14:00:00"),
        status: "delivered",
        isRead: true,
      },
      {
        id: "msg-2",
        conversationId: "conv-2",
        senderId: currentUser.id,
        text: "Yes! I'll be there at 4pm.",
        timestamp: new Date("2024-11-16T14:05:00"),
        status: "read",
        isRead: true,
      },
      {
        id: "msg-3",
        conversationId: "conv-2",
        senderId: "u2",
        text: "What time do you close?",
        timestamp: new Date("2024-11-16T18:20:00"),
        status: "delivered",
        isRead: false,
      },
    ],
  },
  {
    id: "conv-3",
    isPinned: false,
    unreadCount: 1,
    contact: {
      id: "u3",
      name: "Kristin Watson",
      role: "Peer",
      avatar: "https://loremfaces.net/96/id/30.jpg",
      isOnline: false,
      lastSeen: new Date("2024-11-16T16:45:00"),
    },
    messages: [
      {
        id: "msg-1",
        conversationId: "conv-3",
        senderId: "u3",
        text: "thank you for the reminder!",
        timestamp: new Date("2024-11-16T16:55:00"),
        status: "delivered",
        isRead: false,
      },
    ],
  },
  {
    id: "conv-4",
    isPinned: false,
    unreadCount: 1,
    contact: {
      id: "u4",
      name: "Ronald Richards",
      role: "Tutor",
      avatar: "https://loremfaces.net/96/id/40.jpg",
      isOnline: true,
      lastSeen: new Date(),
    },
    messages: [
      {
        id: "msg-1",
        conversationId: "conv-4",
        senderId: "u4",
        text: "Can we reschedule Thursday's session to Friday?",
        timestamp: new Date("2024-11-16T15:30:00"),
        status: "delivered",
        isRead: false,
      },
    ],
  },
  {
    id: "conv-5",
    isPinned: false,
    unreadCount: 0,
    contact: {
      id: "u5",
      name: "Robert Fox",
      role: "Peer",
      avatar: "https://loremfaces.net/96/id/52.jpg",
      isOnline: false,
      lastSeen: new Date("2024-11-15T20:00:00"),
    },
    messages: [
      {
        id: "msg-1",
        conversationId: "conv-5",
        senderId: currentUser.id,
        text: "I wanted to let you know that I finished the assignment.",
        timestamp: new Date("2024-11-15T18:00:00"),
        status: "read",
        isRead: true,
      },
    ],
  },
];
