import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUser } from './_utils/supabase.js';
import { selectSupportKnowledge, type SupportRole } from './_utils/support-knowledge.js';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';
const MAX_MESSAGES = 12;
const MAX_MESSAGE_LENGTH = 1_200;
const MAX_TOTAL_LENGTH = 6_000;
const ROLES = new Set(['parent', 'student', 'tutor', 'counselor']);

type ChatMessage = { role: 'user' | 'assistant'; content: string };

export function buildGroqMessages(role: SupportRole, messages: ChatMessage[]) {
  const lastQuestion = messages.at(-1)?.content ?? '';
  const knowledge = selectSupportKnowledge(role, lastQuestion);
  return [
    { role: 'system' as const, content: systemPrompt(role) },
    {
      role: 'system' as const,
      content: `Use this curated Yakal product knowledge when it is relevant. It is general documentation, not live user data. Do not claim that it describes this user's actual account state.\n\n${knowledge.text}`,
    },
    ...messages,
  ];
}

function parseRequest(body: unknown): { role: string; messages: ChatMessage[] } | null {
  if (!body || typeof body !== 'object') return null;
  const candidate = body as { role?: unknown; messages?: unknown };
  if (typeof candidate.role !== 'string' || !ROLES.has(candidate.role)) return null;
  if (!Array.isArray(candidate.messages) || candidate.messages.length < 1 || candidate.messages.length > MAX_MESSAGES) {
    return null;
  }

  let total = 0;
  const messages: ChatMessage[] = [];
  for (const item of candidate.messages) {
    if (!item || typeof item !== 'object') return null;
    const message = item as { role?: unknown; content?: unknown };
    if ((message.role !== 'user' && message.role !== 'assistant') || typeof message.content !== 'string') {
      return null;
    }
    const content = message.content.trim();
    if (!content || content.length > MAX_MESSAGE_LENGTH) return null;
    total += content.length;
    if (total > MAX_TOTAL_LENGTH) return null;
    messages.push({ role: message.role, content });
  }

  if (messages.at(-1)?.role !== 'user') return null;
  return { role: candidate.role, messages };
}

function systemPrompt(role: string): string {
  return `You are Yakal's friendly in-app support assistant. The user is signed in as a ${role}.

Help only with navigating the Yakal platform, tutoring workflows, college-admissions support, and non-urgent platform questions. Tailor directions to a ${role}'s likely dashboard and responsibilities. Be warm, concise, practical, and honest about uncertainty.

You cannot see private account data, messages, grades, documents, bookings, payment details, or live platform state. Never imply that you inspected or changed them. You cannot book or cancel sessions, change payments, alter an account, or promise an action was completed. For account-specific access, billing, refunds, or changes you cannot solve, encourage the user to contact Yakal support.

Do not provide medical, legal, financial, crisis, or emergency advice, and do not act as an emergency service. If someone appears to be in immediate danger, tell them to contact local emergency services or a trusted person nearby. Do not request passwords, payment card details, government IDs, or other sensitive information.`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: 'AI support is not configured yet. Please contact Yakal for help.',
      code: 'support_unavailable',
    });
  }

  const parsed = parseRequest(req.body);
  if (!parsed) {
    return res.status(400).json({ error: 'Invalid chat request.' });
  }

  try {
    await requireUser(req);
  } catch {
    return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
  }

  try {
    const upstream = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.4,
        max_completion_tokens: 500,
        messages: buildGroqMessages(parsed.role as SupportRole, parsed.messages),
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!upstream.ok) {
      console.error('Groq support request failed:', upstream.status, await upstream.text());
      return res.status(502).json({ error: 'AI support is temporarily unavailable. Please try again.' });
    }

    const data = await upstream.json() as {
      choices?: Array<{ message?: { content?: unknown } }>;
    };
    const reply = data.choices?.[0]?.message?.content;
    if (typeof reply !== 'string' || !reply.trim()) {
      return res.status(502).json({ error: 'AI support returned an empty response. Please try again.' });
    }

    return res.status(200).json({ reply: reply.trim() });
  } catch (error: unknown) {
    console.error('Groq support request failed:', error);
    return res.status(502).json({ error: 'AI support is temporarily unavailable. Please try again.' });
  }
}
