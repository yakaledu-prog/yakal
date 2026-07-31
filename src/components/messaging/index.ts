// Shared messaging building blocks. Compose what a page needs:
//
//   MessagingLayout   list + header + body, the full screen
//   ConversationList  the people sidebar on its own
//   ChatHeader        who you are talking to
//   ChatBody          history + composer, safe to use alone where the peer is
//                     already obvious from the surrounding page
//   useMessaging      loading, selection, sending, presence

export { MessagingLayout } from "./MessagingLayout";
export { ConversationList } from "./ConversationList";
export { ChatHeader } from "./ChatHeader";
export { ContactInfoPanel } from "./ContactInfoPanel";
export { MessagesPageHeader } from "./MessagesPageHeader";
export { ChatBody, EmptyChatWelcome } from "./ChatBody";
export { MessageBubble, StatusTick, type LocalAttachment } from "./MessageBubble";
export { RoleIcon, RoleBadge, ROLE_LABEL, normalizeRole, type Role } from "./RoleIcon";
export { useMessaging } from "./useMessaging";
export { useDirectConversation } from "./useDirectConversation";
export {
  formatTime,
  formatListDate,
  formatDaySeparator,
  groupByDay,
  lastMessage,
  countUnread,
  previewText,
} from "./format";
export { FlagConversationDialog } from "./FlagConversationDialog";
