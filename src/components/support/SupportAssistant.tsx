import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import { ChevronDown, MessageCircle, Minus, Send, X } from 'lucide-react';
import {
  sendSupportMessage,
  type SupportChatMessage,
  type SupportChatRole,
} from '@/services/supportChatService';

const STORAGE_KEY = 'yakal-support-chat';
const MAX_INPUT_LENGTH = 1_200;

const SUGGESTIONS: Record<SupportChatRole, string[]> = {
  parent: ['How do I find my child\'s sessions?', 'Where can I review billing?', 'How do I message a tutor?'],
  student: ['Where are my upcoming sessions?', 'How do I find my assignments?', 'Help me use my college roadmap'],
  tutor: ['Where do I see my sessions?', 'How do I message a student?', 'How do I update my availability?'],
  counselor: ['Where are my assigned students?', 'How do I review an essay?', 'How do I find my sessions?'],
};

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function loadHistory(userId: string): SupportChatMessage[] {
  try {
    const stored = sessionStorage.getItem(`${STORAGE_KEY}:${userId}`);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((message): message is SupportChatMessage =>
      typeof message?.id === 'string' &&
      (message?.role === 'user' || message?.role === 'assistant') &&
      typeof message?.content === 'string'
    ).slice(-12);
  } catch {
    return [];
  }
}

function FriendlyAvatar({ small = false }: { small?: boolean }) {
  return (
    <div
      className={`${small ? 'h-8 w-8' : 'h-11 w-11'} shrink-0 overflow-hidden rounded-full bg-[#97CE9D] shadow-sm`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 48 48" role="img">
        <circle cx="24" cy="24" r="24" fill="#97CE9D" />
        <path d="M11 23c0-8 5.7-14 13-14s13 6 13 14v14H11V23Z" fill="#1099A1" />
        <path d="M15 24c0-6.1 3.9-10 9-10s9 3.9 9 10v7c-2.6 3.3-5.6 5-9 5s-6.4-1.7-9-5v-7Z" fill="#fff" />
        <circle cx="20" cy="24" r="1.5" fill="#0d7f86" />
        <circle cx="28" cy="24" r="1.5" fill="#0d7f86" />
        <path d="M20 29c2.5 2 5.5 2 8 0" fill="none" stroke="#CAA25F" strokeLinecap="round" strokeWidth="2" />
        <path d="M16 16c4.5-4 11.5-4 16 0" fill="none" stroke="#CAA25F" strokeLinecap="round" strokeWidth="3" />
      </svg>
    </div>
  );
}

export function SupportAssistant({ role, userId }: { role: SupportChatRole; userId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<SupportChatMessage[]>(() => loadHistory(userId));
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    sessionStorage.setItem(`${STORAGE_KEY}:${userId}`, JSON.stringify(messages.slice(-12)));
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, userId]);

  useEffect(() => {
    if (isOpen && !isMinimized) inputRef.current?.focus();
  }, [isOpen, isMinimized]);

  useEffect(() => {
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) setIsOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isOpen]);

  async function submitMessage(text: string) {
    const content = text.trim();
    if (!content || isLoading) return;

    const userMessage: SupportChatMessage = { id: makeId(), role: 'user', content };
    const nextMessages = [...messages, userMessage].slice(-12);
    setMessages(nextMessages);
    setInput('');
    setError('');
    setIsLoading(true);

    const result = await sendSupportMessage(role, nextMessages);
    if (result.error || !result.reply) {
      setError(result.error || 'I could not answer that just now. Please try again.');
    } else {
      setMessages((current) => [...current, {
        id: makeId(),
        role: 'assistant' as const,
        content: result.reply as string,
      }].slice(-12));
    }
    setIsLoading(false);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void submitMessage(input);
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void submitMessage(input);
    }
  }

  return (
    <aside className="fixed bottom-5 right-4 z-50 sm:bottom-6 sm:right-6" aria-label="Yakal support assistant">
      {isOpen && (
        <section
          className={`mb-3 flex w-[calc(100vw-2rem)] max-w-[380px] flex-col overflow-hidden rounded-3xl border border-[#1099A1]/20 bg-background shadow-2xl transition-all ${isMinimized ? 'h-[72px]' : 'h-[min(620px,calc(100vh-7rem))]'}`}
          role="dialog"
          aria-label="Chat with Yakal support"
        >
          <header className="flex min-h-[72px] items-center gap-3 bg-[#1099A1] px-4 text-white">
            <FriendlyAvatar small />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Ask Yakal</p>
              <p className="truncate text-xs text-white/80">Friendly platform guidance</p>
            </div>
            <button
              type="button"
              onClick={() => setIsMinimized((value) => !value)}
              className="rounded-full p-2 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              aria-label={isMinimized ? 'Expand support chat' : 'Minimize support chat'}
            >
              {isMinimized ? <ChevronDown size={18} /> : <Minus size={18} />}
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-full p-2 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              aria-label="Close support chat"
            >
              <X size={18} />
            </button>
          </header>

          {!isMinimized && (
            <>
              <div className="flex-1 space-y-4 overflow-y-auto bg-muted/20 p-4" aria-live="polite">
                {messages.length === 0 && (
                  <div className="space-y-5 pt-3 text-center">
                    <div className="mx-auto w-fit"><FriendlyAvatar /></div>
                    <div>
                      <h2 className="text-lg font-semibold text-foreground">Hi, I’m Yali.</h2>
                      <p className="mx-auto mt-1 max-w-[290px] text-sm text-muted-foreground">
                        I can help you find your way around Yakal and answer tutoring or admissions questions.
                      </p>
                    </div>
                    <div className="space-y-2 text-left">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#0d7f86]">Try asking</p>
                      {SUGGESTIONS[role].map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => void submitMessage(suggestion)}
                          className="block w-full rounded-2xl border border-[#97CE9D] bg-background px-4 py-3 text-left text-sm text-foreground transition hover:border-[#1099A1] hover:bg-[#97CE9D]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1099A1]"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((message) => (
                  <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${message.role === 'user' ? 'rounded-br-md bg-[#1099A1] text-white' : 'rounded-bl-md border border-border bg-background text-foreground'}`}>
                      {message.content}
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex items-center gap-1.5" aria-label="Yali is typing">
                    {[0, 1, 2].map((dot) => <span key={dot} className="h-2 w-2 animate-pulse rounded-full bg-[#1099A1]" style={{ animationDelay: `${dot * 150}ms` }} />)}
                  </div>
                )}

                {error && (
                  <div role="alert" className="rounded-2xl border border-[#CAA25F] bg-background px-4 py-3 text-sm text-foreground">
                    {error}
                  </div>
                )}
                <div ref={endRef} />
              </div>

              <form onSubmit={handleSubmit} className="border-t border-border bg-background p-3">
                <div className="flex items-end gap-2 rounded-2xl border border-border bg-muted/20 p-2 focus-within:border-[#1099A1] focus-within:ring-1 focus-within:ring-[#1099A1]">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={handleInputKeyDown}
                    maxLength={MAX_INPUT_LENGTH}
                    rows={1}
                    placeholder="Ask about Yakal..."
                    aria-label="Message Yakal support"
                    className="max-h-24 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground"
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || isLoading}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1099A1] text-white transition hover:bg-[#0d7f86] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1099A1] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Send message"
                  >
                    <Send size={17} />
                  </button>
                </div>
                <p className="mt-2 text-center text-[11px] text-muted-foreground">AI can make mistakes. Don’t share sensitive information.</p>
              </form>
            </>
          )}
        </section>
      )}

      <button
        type="button"
        onClick={() => { setIsOpen((value) => !value); setIsMinimized(false); }}
        className="ml-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#1099A1] text-white shadow-xl transition hover:bg-[#0d7f86] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1099A1] focus-visible:ring-offset-2"
        aria-label={isOpen ? 'Close Yakal support' : 'Open Yakal support'}
        aria-expanded={isOpen}
      >
        {isOpen ? <X size={24} /> : <MessageCircle size={25} />}
      </button>
    </aside>
  );
}
