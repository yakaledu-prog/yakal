import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

import {
  ASSISTANT_MODEL,
  MAX_OUTPUT_TOKENS,
  readTurns,
  systemPrompt,
  type PublicTier,
} from '../_utils/assistant.js';

// ============================================================
// The landing page assistant.
//
// Streams, because the whole point of a lite model is that the first words
// arrive in under a second, and a spinner throws that away. The browser gets
// server-sent events and paints as they land; voice mode speaks each sentence
// as it completes rather than waiting for the paragraph.
//
// Note what this handler does not import: getServiceClient, requireUser, and
// anything that reads a session. It uses the anon key against one public
// table. That is the security model. A prompt can be argued with; a client
// that was never given credentials cannot be talked into using them.
// ============================================================

/**
 * Anon, not service role, and deliberately so.
 *
 * RLS applies exactly as it does for a visitor reading the pricing section,
 * which means the worst case for a prompt injection here is that the model
 * repeats something already printed on the marketing page.
 */
function publicClient() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Live tiers, cached for the life of the process.
 *
 * Prices change a few times a year and a warm function may serve many
 * conversations, so a read per request buys nothing. A cold start refetches,
 * which is the only staleness window and is measured in minutes.
 */
let tierCache: { at: number; tiers: PublicTier[] } | null = null;
const TIER_TTL_MS = 5 * 60 * 1000;

async function getTiers(): Promise<PublicTier[]> {
  if (tierCache && Date.now() - tierCache.at < TIER_TTL_MS) return tierCache.tiers;

  const db = publicClient();
  if (!db) return [];

  const { data, error } = await db
    .from('admissions_tiers')
    .select('name, price_cents, blurb, sessions_per_month, ps_rounds_limit, supp_essays_limit, mock_interviews_limit, is_active, sort_order')
    .eq('is_active', true)
    .order('sort_order');

  if (error) {
    // An assistant that cannot quote a price is still useful. One that fails to
    // load is not, so this degrades rather than throwing: the prompt tells it
    // to send pricing questions to the team when the block is missing.
    console.error('assistant tiers:', error.message);
    return [];
  }

  const tiers: PublicTier[] = (data ?? []).map((r: any) => ({
    name: r.name,
    priceCents: r.price_cents,
    blurb: r.blurb,
    sessionsPerMonth: r.sessions_per_month,
    psRoundsLimit: r.ps_rounds_limit,
    suppEssaysLimit: r.supp_essays_limit,
    mockInterviewsLimit: r.mock_interviews_limit,
  }));
  tierCache = { at: Date.now(), tiers };
  return tiers;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'The assistant is not configured.' });

  let turns;
  try {
    turns = readTurns((req.body as any)?.messages);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }

  const [tiers, contactEmail] = await Promise.all([getTiers(), getContactEmail()]);

  // Flush headers before the first token so the browser opens the stream
  // immediately rather than waiting on a buffer that may not fill for a second.
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${ASSISTANT_MODEL}:streamGenerateContent?alt=sse&key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt(tiers, contactEmail) }] },
          contents: turns.map((t) => ({ role: t.role, parts: [{ text: t.text }] })),
          generationConfig: {
            maxOutputTokens: MAX_OUTPUT_TOKENS,
            // Low but not zero. At 0 the same question gets a word-for-word
            // identical answer every time, which reads like a lookup table the
            // moment somebody rephrases and gets the same paragraph back.
            temperature: 0.4,
          },
          // The model is answering strangers on a public page, so the default
          // thresholds are loosened for nothing and tightened where a school
          // audience makes it worth it.
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_LOW_AND_ABOVE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          ],
        }),
      }
    );

    if (!upstream.ok || !upstream.body) {
      const detail = await upstream.text().catch(() => '');
      console.error('assistant upstream:', upstream.status, detail.slice(0, 300));
      send('error', { message: 'The assistant is unavailable right now.' });
      return res.end();
    }

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let answered = false;

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      // Normalised first. Gemini terminates every frame with CRLF CRLF, so
      // splitting on a bare blank line matched nothing, the buffer grew all the
      // way to the end of the answer and the visitor got "I did not catch that"
      // for a reply the model had written in full.
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
      // SSE frames are separated by a blank line. Anything after the last one
      // is a partial frame and has to wait for the next chunk.
      const frames = buffer.split('\n\n');
      buffer = frames.pop() ?? '';

      for (const frame of frames) {
        const line = frame.split('\n').find((l) => l.startsWith('data: '));
        if (!line) continue;

        let payload: any;
        try {
          payload = JSON.parse(line.slice(6));
        } catch {
          continue;
        }

        const candidate = payload?.candidates?.[0];
        // Thought parts are the model reasoning, not its answer. Gemma streams
        // nothing but these for several seconds; a flash-lite model emits none
        // at all. Either way they are never shown.
        const text = (candidate?.content?.parts ?? [])
          .filter((p: any) => !p.thought)
          .map((p: any) => p.text ?? '')
          .join('');

        if (text) {
          answered = true;
          send('token', { text });
        }

        // SAFETY, RECITATION and the rest all mean the same thing to a visitor:
        // no answer is coming. Saying so beats a stream that just stops.
        const finish = candidate?.finishReason;
        if (finish && finish !== 'STOP' && finish !== 'MAX_TOKENS' && !answered) {
          send('error', { message: 'I cannot answer that one. Try asking it another way.' });
          return res.end();
        }
      }
    }

    if (!answered) send('error', { message: 'I did not catch that. Could you rephrase?' });
    send('done', {});
    res.end();
  } catch (err: any) {
    console.error('assistant stream:', err?.message);
    // The stream is already open, so an error has to travel down it rather
    // than as a status code the browser will never look at again.
    send('error', { message: 'The assistant is unavailable right now.' });
    res.end();
  }
}

/**
 * The address the assistant hands out.
 *
 * Read from site_settings so it follows whatever the admin set on the settings
 * page, with the env var behind it and a literal last resort. Told to the
 * model rather than hardcoded in the prompt, so changing it does not need a
 * deploy.
 */
async function getContactEmail(): Promise<string> {
  const fallback = process.env.VITE_CONTACT_EMAIL || 'hello@yakal.me';
  const db = publicClient();
  if (!db) return fallback;

  const { data } = await db
    .from('site_settings')
    .select('value')
    .eq('key', 'contact_email')
    .maybeSingle();

  return data?.value?.trim() || fallback;
}
