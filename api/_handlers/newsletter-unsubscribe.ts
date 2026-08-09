import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getServiceClient } from '../_utils/supabase.js';

/**
 * Leaving the list, from the link in the footer of every newsletter.
 *
 * By token, never by email address: an address is guessable and would let
 * anyone unsubscribe anyone. The row is kept and marked rather than deleted,
 * so a later signup with the same address is a deliberate resubscribe rather
 * than a silent one.
 *
 * An unknown token still answers 200. The person clicking already asked to
 * stop hearing from us, and "that link is not valid" is a worse ending than
 * a page saying they are unsubscribed, which as far as this list is concerned
 * they are.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body ?? {};
  const token = String(body.token ?? '').trim();
  if (!token) return res.status(400).json({ error: 'No token.' });

  try {
    await getServiceClient()
      .from('newsletter_subscribers')
      .update({ status: 'unsubscribed', unsubscribed_at: new Date().toISOString() })
      .eq('unsubscribe_token', token);

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('newsletter unsubscribe failed:', err);
    return res.status(500).json({ error: err.message });
  }
}
