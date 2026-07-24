import { VercelRequest, VercelResponse } from '@vercel/node';
import { getServiceClient, requireUser } from './utils/billing';

// Creates an OPEN invoice for the authenticated parent (e.g. when they book a
// course). Server-side so the parent_id is taken from the verified token and
// the amount is validated rather than trusted blindly from the client.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const user = await requireUser(req);
    const db = getServiceClient();

    const description: string = (req.body?.description || '').toString().slice(0, 200);
    const amountCents = Math.round(Number(req.body?.amountCents));
    const kind: string = ['tutoring', 'admissions', 'registration', 'other'].includes(req.body?.kind)
      ? req.body.kind
      : 'tutoring';
    const studentId: string | null = req.body?.studentId || null;
    const tutorId: string | null = req.body?.tutorId || null;

    if (!description) return res.status(400).json({ error: 'Missing description' });
    if (!Number.isFinite(amountCents) || amountCents <= 0 || amountCents > 5_000_000) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    // The tutor's cut of this booking (Stripe Connect deferred, so we just
    // record what is owed). Placeholder split: tutor gets 70%, platform keeps
    // 30% as the margin. Real deployments should use the tutor's fixed rate.
    const payoutCents = tutorId ? Math.round(amountCents * 0.7) : null;

    const { data, error } = await db
      .from('invoices')
      .insert([{
        parent_id: user.id,
        student_id: studentId,
        tutor_id: tutorId,
        description,
        amount_cents: amountCents,
        payout_cents: payoutCents,
        kind,
        status: 'open',
        payout_status: 'none',
      }])
      .select('id')
      .single();

    if (error) throw new Error(error.message);
    return res.status(200).json({ invoiceId: data.id });
  } catch (err: any) {
    console.error('create-invoice error:', err);
    return res.status(err.message?.includes('session') ? 401 : 500).json({ error: err.message || 'Server error' });
  }
}
