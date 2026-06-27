export type Message = {
  id: string;
  senderId: string;
  text: string;
  timestamp: string;
  isRead: boolean;
};

export type Contact = {
  id: string;
  name: string;
  role: string;
  avatar: string;
  lastVisit: string;
  isActive: boolean;
  messages: Message[];
};

export const currentUserId = "current-user";

export const mockContacts: Contact[] = [
  {
    id: "1",
    name: "Dr. Alex",
    role: "Tutor",
    avatar: "https://i.pravatar.cc/150?u=a042581f4e29026701",
    lastVisit: "Sep 16, 2024",
    isActive: true,
    messages: [
      {
        id: "m1",
        senderId: currentUserId,
        text: "Hi Dr. Alex, thank you for the reminder! I'll be there at 8:30am. Let me know if I need to bring anything specific.",
        timestamp: "05:00 PM",
        isRead: true,
      },
      {
        id: "m2",
        senderId: "1",
        text: "I wanted to let you know that we've received your lab results. Everything looks good, but I'd like to discuss a few preventive measures during our next appointment.",
        timestamp: "05:02 PM",
        isRead: true,
      },
      {
        id: "m3",
        senderId: currentUserId,
        text: "Thank you, Dr. Alex. I appreciate the update. Can I schedule a time to discuss it?",
        timestamp: "05:30 PM",
        isRead: true,
      }
    ],
  },
  {
    id: "2",
    name: "Courtney Henry",
    role: "Peer",
    avatar: "https://i.pravatar.cc/150?u=a042581f4e29026702",
    lastVisit: "Just now",
    isActive: true,
    messages: [
      {
        id: "m1",
        senderId: "2",
        text: "What time do you close?",
        timestamp: "Just now",
        isRead: false,
      }
    ],
  },
  {
    id: "3",
    name: "Kristin Watson",
    role: "Peer",
    avatar: "https://i.pravatar.cc/150?u=a042581f4e29026703",
    lastVisit: "1 min ago",
    isActive: true,
    messages: [
      {
        id: "m1",
        senderId: "3",
        text: "thank you for the reminder!",
        timestamp: "1 min ago",
        isRead: false,
      }
    ],
  },
  {
    id: "4",
    name: "Ronald Richards",
    role: "Tutor",
    avatar: "https://i.pravatar.cc/150?u=a042581f4e29026704",
    lastVisit: "2 min ago",
    isActive: true,
    messages: [
      {
        id: "m1",
        senderId: "4",
        text: "I wanted to let you know that..",
        timestamp: "2 min ago",
        isRead: false,
      }
    ],
  },
  {
    id: "5",
    name: "Robert Fox",
    role: "Peer",
    avatar: "https://i.pravatar.cc/150?u=a042581f4e29026705",
    lastVisit: "Yesterday",
    isActive: false,
    messages: [
      {
        id: "m1",
        senderId: "5",
        text: "I wanted to let you know that..",
        timestamp: "Yesterday",
        isRead: true,
      }
    ],
  },
];
