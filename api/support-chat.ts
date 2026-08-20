import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserClient, requireUser } from './_utils/supabase.js';
import { selectSupportKnowledge, type SupportRole } from './_utils/support-knowledge.js';
import { supportRateLimiter } from './_utils/support-rate-limit.js';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
// Configurable so a Groq retirement is an env change, not an emergency deploy.
// The previous default, llama-3.3-70b-versatile, was decommissioned by Groq on
// 2026-08-16, which took the support chatbot down with a generic error. Set
// GROQ_MODEL to override; the default tracks Groq's current recommended model.
const MODEL = process.env.GROQ_MODEL ?? 'openai/gpt-oss-120b';
const MAX_MESSAGES = 12;
const MAX_MESSAGE_LENGTH = 1_200;
const MAX_TOTAL_LENGTH = 6_000;
const ROLES = new Set<SupportRole>(['parent', 'student', 'tutor', 'counselor']);

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

/**
 * The text carried by one SSE frame from Groq, or empty for anything else.
 *
 * Exported so scripts/verify can pin it. This is the same parsing that, done
 * wrong for the landing assistant, silently swallowed every answer: the frames
 * arrived with CRLF line endings, the split matched nothing, and the visitor
 * got "I did not catch that" for a reply the model had written in full. It is
 * worth a test rather than a second discovery in production.
 *
 * Frames that are keepalives, the [DONE] sentinel, role-only openers or
 * malformed JSON all yield nothing, which is not an error.
 */
export function deltaFromFrame(frame: string): string {
  const line = frame
    .replace(/\r\n/g, '\n')
    .split('\n')
    .find((l) => l.startsWith('data: '));
  if (!line) return '';

  const payload = line.slice(6).trim();
  if (!payload || payload === '[DONE]') return '';

  try {
    const parsed = JSON.parse(payload) as {
      choices?: Array<{ delta?: { content?: unknown } }>;
    };
    const text = parsed.choices?.[0]?.delta?.content;
    return typeof text === 'string' ? text : '';
  } catch {
    return '';
  }
}

export function parseRequest(body: unknown): { messages: ChatMessage[] } | null {
  if (!body || typeof body !== 'object') return null;
  const candidate = body as { messages?: unknown };
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
  return { messages };
}

export function asSupportRole(role: unknown): SupportRole | null {
  return typeof role === 'string' && ROLES.has(role as SupportRole)
    ? role as SupportRole
    : null;
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

  let user: Awaited<ReturnType<typeof requireUser>>;
  try {
    user = await requireUser(req);
  } catch {
    return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
  }

  // The browser uses the role for suggestions, but it does not get to choose
  // the server prompt. Read the authenticated profile through its own RLS
  // context so a modified request cannot impersonate another dashboard role.
  const db = getUserClient(req);
  const { data: profile, error: profileError } = await db
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if (profileError) {
    console.error('Support profile lookup failed:', profileError.message);
    return res.status(500).json({ error: 'AI support could not verify your account. Please try again.' });
  }
  const role = asSupportRole(profile?.role);
  if (!role) {
    return res.status(403).json({ error: 'AI support is not available for this account role.' });
  }

  const quota = supportRateLimiter.acquire(user.id);
  if (!quota.allowed) {
    res.setHeader('Retry-After', String(quota.retryAfterSeconds));
    return res.status(429).json({
      error: 'You have reached the support chat limit. Please wait a little before trying again.',
      code: 'support_rate_limited',
    });
  }

  // Everything above answers as JSON, because it can still fail with a status
  // code the browser will read. From here the response is a stream, so a
  // failure has to travel down it instead.
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

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
        messages: buildGroqMessages(role, parsed.messages),
        // Groq speaks the OpenAI wire format, so this is deltas in
        // choices[0].delta.content and a literal [DONE] sentinel at the end.
        stream: true,
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!upstream.ok || !upstream.body) {
      console.error('Groq support request failed:', upstream.status, await upstream.text().catch(() => ''));
      send('error', { message: 'AI support is temporarily unavailable. Please try again.' });
      return res.end();
    }

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let answered = false;

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      // Normalised, because the frame separator is CRLF CRLF on some hops and
      // splitting on a bare blank line then matches nothing at all. That
      // exact bug cost the landing assistant every one of its answers.
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
      const frames = buffer.split('\n\n');
      buffer = frames.pop() ?? '';

      for (const frame of frames) {
        const text = deltaFromFrame(frame);
        if (text) {
          answered = true;
          send('token', { text });
        }
      }
    }

    if (!answered) {
      send('error', { message: 'AI support returned an empty response. Please try again.' });
      return res.end();
    }

    send('done', {});
    return res.end();
  } catch (error: unknown) {
    console.error('Groq support request failed:', error);
    send('error', { message: 'AI support is temporarily unavailable. Please try again.' });
    return res.end();
  } finally {
    quota.release();
  }
}
