// ─── Message Status ─────────────────────────────────────────────────────────
export type MessageStatus = "sending" | "sent" | "delivered" | "read";

// ─── Single Message ──────────────────────────────────────────────────────────
export type Attachment = {
  type: "image" | "video" | "audio" | "file";
  url: string;
  name?: string;
  size?: number;
  duration?: number; // for audio/video in seconds
};

export type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  timestamp: Date;
  status: MessageStatus;
  isRead: boolean;
  attachment?: Attachment;
};

// ─── Contact ─────────────────────────────────────────────────────────────────
export type Contact = {
  id: string;
  name: string;
  role: "Tutor" | "Peer" | "Admin" | "AI";
  avatar: string;
  isOnline: boolean;
  lastSeen: Date;
};

// ─── Conversation ─────────────────────────────────────────────────────────────
export type Conversation = {
  id: string;
  contact: Contact;
  messages: Message[];
  unreadCount: number;
  isPinned: boolean;
};

// ─── Current User ─────────────────────────────────────────────────────────────
export const currentUser = {
  id: "current-user",
  name: "Brooklyn",
  avatar: "https://i.pravatar.cc/96?img=5",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
export function countUnread(messages: Message[]): number {
  return messages.filter((m) => m.senderId !== currentUser.id && !m.isRead).length;
}

export function lastMessage(messages: Message[]): Message | undefined {
  return messages[messages.length - 1];
}

// ─── Mock Conversations (tutoring context) ────────────────────────────────────
export const mockConversations: Conversation[] = [
  {
    id: "conv-ai",
    isPinned: true,
    unreadCount: 0,
    contact: {
      id: "ai-assistant",
      name: "Yakal AI Assistant",
      role: "AI",
      avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=yakal",
      isOnline: true,
      lastSeen: new Date(),
    },
    messages: [
      {
        id: "msg-ai-1",
        conversationId: "conv-ai",
        senderId: "ai-assistant",
        text: "Hi Brooklyn! I'm the Yakal AI Assistant. I can help you summarize courses, find resources, or answer any questions you have. How can I help you today?",
        timestamp: new Date(new Date().getTime() - 60000),
        status: "read",
        isRead: true,
      }
    ],
  },
  {
    id: "conv-1",
    isPinned: false,
    unreadCount: 0,
    contact: {
      id: "u1",
      name: "Alex Thompson",
      role: "Tutor",
      avatar: "https://i.pravatar.cc/96?img=11",
      isOnline: true,
      lastSeen: new Date("2024-11-16T17:30:00"),
    },
    messages: [
      {
        id: "msg-1",
        conversationId: "conv-1",
        senderId: "current-user",
        text: "Hi Alex, do you have any openings for a Calc II session this week? I'm struggling with integration by parts.",
        timestamp: new Date("2024-11-16T14:00:00"),
        status: "read",
        isRead: true,
      },
      {
        id: "msg-2",
        conversationId: "conv-1",
        senderId: "u1",
        text: "Hey Brooklyn! I have Thursday at 3 PM or Friday at 10 AM. Do either of those work for you?",
        timestamp: new Date("2024-11-16T14:05:00"),
        status: "read",
        isRead: true,
      },
      {
        id: "msg-3",
        conversationId: "conv-1",
        senderId: "current-user",
        text: "Thursday at 3 works great. Should I bring my problem sets?",
        timestamp: new Date("2024-11-16T14:08:00"),
        status: "read",
        isRead: true,
      },
      {
        id: "msg-4",
        conversationId: "conv-1",
        senderId: "u1",
        text: "Yes, bring everything! Also review the lecture notes on u-substitution beforehand. See you then! 📚",
        timestamp: new Date("2024-11-16T14:10:00"),
        status: "read",
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
      name: "Maya Patel",
      role: "Peer",
      avatar: "https://i.pravatar.cc/96?img=16",
      isOnline: true,
      lastSeen: new Date(),
    },
    messages: [
      {
        id: "msg-1",
        conversationId: "conv-2",
        senderId: "u2",
        text: "Hey! Did you catch what the prof said about the Psych 101 essay rubric? I zoned out during that part 😅",
        timestamp: new Date("2024-11-16T10:00:00"),
        status: "read",
        isRead: true,
      },
      {
        id: "msg-2",
        conversationId: "conv-2",
        senderId: "current-user",
        text: "Yeah, he said we can go up to 1500 words, but 1200 is the sweet spot. And we MUST cite at least 3 peer-reviewed sources.",
        timestamp: new Date("2024-11-16T10:12:00"),
        status: "read",
        isRead: true,
      },
      {
        id: "msg-3",
        conversationId: "conv-2",
        senderId: "u2",
        text: "Perfect, thanks! Also do you have the shared notes doc? Mine didn't save properly.",
        timestamp: new Date("2024-11-16T18:45:00"),
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
      name: "Jordan Lee",
      role: "Tutor",
      avatar: "https://i.pravatar.cc/96?img=33",
      isOnline: false,
      lastSeen: new Date("2024-11-16T16:00:00"),
    },
    messages: [
      {
        id: "msg-1",
        conversationId: "conv-3",
        senderId: "current-user",
        text: "Hi Jordan, I'm stuck on problem 4 in the Physics lab report. The numbers aren't adding up.",
        timestamp: new Date("2024-11-15T19:00:00"),
        status: "read",
        isRead: true,
      },
      {
        id: "msg-2",
        conversationId: "conv-3",
        senderId: "u3",
        text: "Sure! Send me a photo of your work so far and I'll take a look.",
        timestamp: new Date("2024-11-15T19:15:00"),
        status: "read",
        isRead: true,
      },
      {
        id: "msg-3",
        conversationId: "conv-3",
        senderId: "current-user",
        text: "Sending a photo now... [Lab report section 4]",
        timestamp: new Date("2024-11-15T19:18:00"),
        status: "read",
        isRead: true,
      },
      {
        id: "msg-4",
        conversationId: "conv-3",
        senderId: "u3",
        text: "Ah, I see it! You used the wrong friction coefficient. Re-calculate using μ = 0.35, not 0.25. That should fix it.",
        timestamp: new Date("2024-11-16T17:00:00"),
        status: "delivered",
        isRead: false,
      },
    ],
  },
  {
    id: "conv-4",
    isPinned: false,
    unreadCount: 0,
    contact: {
      id: "u4",
      name: "Sarah Kim",
      role: "Peer",
      avatar: "https://i.pravatar.cc/96?img=47",
      isOnline: true,
      lastSeen: new Date(),
    },
    messages: [
      {
        id: "msg-1",
        conversationId: "conv-4",
        senderId: "u4",
        text: "Study group for History 202 at the library tomorrow? We have the midterm next week!",
        timestamp: new Date("2024-11-15T20:00:00"),
        status: "read",
        isRead: true,
      },
      {
        id: "msg-2",
        conversationId: "conv-4",
        senderId: "current-user",
        text: "I'm in! What time are you thinking?",
        timestamp: new Date("2024-11-15T20:10:00"),
        status: "read",
        isRead: true,
      },
      {
        id: "msg-3",
        conversationId: "conv-4",
        senderId: "u4",
        text: "Around 2 PM? I'll grab a table in the quiet zone on the 3rd floor.",
        timestamp: new Date("2024-11-15T20:12:00"),
        status: "read",
        isRead: true,
      },
      {
        id: "msg-4",
        conversationId: "conv-4",
        senderId: "current-user",
        text: "Sounds good. I'll bring the chapter summaries and flashcards I made.",
        timestamp: new Date("2024-11-15T20:15:00"),
        status: "read",
        isRead: true,
      },
    ],
  },
  {
    id: "conv-5",
    isPinned: false,
    unreadCount: 0,
    contact: {
      id: "u5",
      name: "Liam Nakamura",
      role: "Tutor",
      avatar: "https://i.pravatar.cc/96?img=53",
      isOnline: false,
      lastSeen: new Date("2024-11-15T20:00:00"),
    },
    messages: [
      {
        id: "msg-1",
        conversationId: "conv-5",
        senderId: "u5",
        text: "Hi Brooklyn, I've uploaded the CS Data Structures review sheet to the student portal. Check the announcements tab.",
        timestamp: new Date("2024-11-15T10:00:00"),
        status: "read",
        isRead: true,
      },
      {
        id: "msg-2",
        conversationId: "conv-5",
        senderId: "current-user",
        text: "Awesome, thanks Liam! Quick question — do you think we should focus more on linked lists or trees for the final?",
        timestamp: new Date("2024-11-15T10:30:00"),
        status: "read",
        isRead: true,
      },
      {
        id: "msg-3",
        conversationId: "conv-5",
        senderId: "u5",
        text: "Definitely prioritize trees and traversal algorithms (BFS, DFS). The prof loves those in exams. Linked lists are worth 20 min of review max.",
        timestamp: new Date("2024-11-15T11:00:00"),
        status: "read",
        isRead: true,
      },
      {
        id: "msg-4",
        conversationId: "conv-5",
        senderId: "current-user",
        text: "Got it. I'll focus on trees. Thanks a lot, this is really helpful!",
        timestamp: new Date("2024-11-15T11:05:00"),
        status: "read",
        isRead: true,
      },
    ],
  },
];
