import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getServiceClient, requireUser } from '../_utils/supabase.js';

/**
 * The list, for the admin page.
 *
 * Admin only and checked here, because the table has no policies: every path
 * in and out is the service role, so the check in this handler is the whole
 * of the access control rather than a convenience on top of RLS.
 *
 * Unsubscribed rows come back too. The page greys them rather than hiding
 * them, so "why did my number drop" has an answer on the same screen.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = await requireUser(req);
  const db = getServiceClient();

  const { data: me } = await db.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (me?.role !== 'admin') return res.status(403).json({ error: 'Admins only.' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body ?? {};

  // Removing somebody by hand, for the request that arrives by reply rather
  // than through the unsubscribe link.
  if (body.remove) {
    await db
      .from('newsletter_subscribers')
      .update({ status: 'unsubscribed', unsubscribed_at: new Date().toISOString() })
      .eq('id', String(body.remove));
  }

  try {
    const { data, error } = await db
      .from('newsletter_subscribers')
      .select('id, email, status, source, created_at, unsubscribed_at')
      .order('created_at', { ascending: false });

    if (error) throw error;
    const subscribers = data ?? [];
    return res.status(200).json({
      subscribers,
      // So a caller that only wants the number does not have to count rows it
      // had no business reading.
      subscribed: subscribers.filter((s) => s.status === 'subscribed').length,
    });
  } catch (err: any) {
    console.error('newsletter list failed:', err);
    return res.status(500).json({ error: err.message });
  }
}
