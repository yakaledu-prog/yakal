import { authedPost } from '@/lib/authedFetch';

export type SupportChatRole = 'parent' | 'student' | 'tutor' | 'counselor';
export type SupportChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

type SupportChatResponse = { reply?: string; error?: string; code?: string };

export async function sendSupportMessage(
  messages: SupportChatMessage[],
): Promise<SupportChatResponse> {
  return authedPost<SupportChatResponse>('/api/support-chat', {
    messages: messages.slice(-12).map(({ role: messageRole, content }) => ({
      role: messageRole,
      content,
    })),
  });
}
