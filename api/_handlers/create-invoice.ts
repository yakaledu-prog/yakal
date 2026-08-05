import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getServiceClient, requireUser } from '../_utils/supabase';

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
    // What this invoice is for. The webhook cannot ask the browser once the
    // payer has been redirected away, and a client-supplied answer at that
    // point is worth nothing, so the intent is recorded up front.
    const courseId: string | null = req.body?.courseId || null;
    const booking = Array.isArray(req.body?.booking)
      ? req.body.booking
          .filter((s: any) => s?.date && s?.startTime)
          .slice(0, 40)
          .map((s: any) => ({
            date: String(s.date).slice(0, 10),
            startTime: String(s.startTime).slice(0, 5),
            durationMinutes: Number(s.durationMinutes) || 60,
          }))
      : null;

    // Buying an admissions tier. The price and the wording come from the tier
    // row, never from the request: an amount the browser supplies is an amount
    // the payer can choose, and a tier has a list price that is not per-family.
    const admissionsTierId: string | null = req.body?.admissionsTierId || null;
    let finalDescription = description;
    let finalAmountCents = amountCents;
    let finalKind = kind;

    if (admissionsTierId) {
      const { data: tier, error: tierErr } = await db
        .from('admissions_tiers')
        .select('id, name, price_cents, is_active')
        .eq('id', admissionsTierId)
        .maybeSingle();

      if (tierErr) throw new Error(tierErr.message);
      if (!tier || !tier.is_active) {
        return res.status(400).json({ error: 'That plan is no longer available' });
      }

      finalDescription = `${tier.name} admissions counselling`;
      finalAmountCents = tier.price_cents;
      finalKind = 'admissions';
    }

    if (!finalDescription) return res.status(400).json({ error: 'Missing description' });
    if (!Number.isFinite(finalAmountCents) || finalAmountCents <= 0 || finalAmountCents > 5_000_000) {
      // Naming which one is wrong, because "invalid amount" on a request that
      // deliberately sent no amount sends you looking in the wrong place.
      return res.status(400).json({
        error: admissionsTierId
          ? 'That plan has no price set'
          : 'Invalid amount',
      });
    }

    // The tutor's cut of this booking (Stripe Connect deferred, so we just
    // record what is owed). Placeholder split: tutor gets 70%, platform keeps
    // 30% as the margin. Real deployments should use the tutor's fixed rate.
    const payoutCents = tutorId ? Math.round(finalAmountCents * 0.7) : null;

    const { data, error } = await db
      .from('invoices')
      .insert([{
        parent_id: user.id,
        student_id: studentId,
        tutor_id: tutorId,
        description: finalDescription,
        amount_cents: finalAmountCents,
        payout_cents: payoutCents,
        kind: finalKind,
        course_id: courseId,
        admissions_tier_id: admissionsTierId,
        booking: booking && booking.length > 0 ? booking : null,
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
