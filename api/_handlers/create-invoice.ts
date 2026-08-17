import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getServiceClient, requireUser } from '../_utils/supabase.js';

// Creates an OPEN invoice for the authenticated parent, from a course booking
// or an admissions tier.
//
// The request names a product and, for a course, which slots. It does not name
// a price, a payee or a payout, and it cannot: all three are read from the row
// the product lives on. It used to name all of them. The browser computed
// price_cents x slots and sent the total, this accepted anything between a cent
// and fifty thousand dollars, paid the tutor a hardcoded 70% of it regardless
// of what an admin had set, and sent that payout to whichever tutor id the
// request supplied.
//
// parent_id comes from the verified token, and a student has to actually be
// this parent's child.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const user = await requireUser(req);
    const db = getServiceClient();

    const description: string = (req.body?.description || '').toString().slice(0, 200);
    const kind: string = ['tutoring', 'admissions', 'registration', 'other'].includes(req.body?.kind)
      ? req.body.kind
      : 'tutoring';
    const studentId: string | null = req.body?.studentId || null;
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
    // No initial value from the request: see below, every path derives it.
    let finalAmountCents = 0;
    let finalKind = kind;
    // Null unless a course sets it. A tier's counsellor share is its own
    // ledger, see api/_utils/counselor-pay.ts.
    let derivedPayoutCents: number | null = null;
    // Who gets paid: a course's tutor, or the counsellor a parent chose.
    let derivedTutorId: string | null = null;

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

      // The counsellor the parent picked, if they picked one.
      //
      // Checked rather than taken: this decides who a family works with and
      // who is paid for it, so an unchecked id here would let a request name
      // any profile at all. An id that does not survive the check is dropped
      // rather than refused, and fulfilment falls back to assigning the least
      // loaded counsellor, because a purchase should not fail over a stale
      // choice from a gallery that has since changed.
      const requestedCounselorId: string | null = req.body?.counselorId || null;
      if (requestedCounselorId) {
        const { data: counselor } = await db
          .from('profiles')
          .select('id, role, status')
          .eq('id', requestedCounselorId)
          .maybeSingle();
        if (counselor?.role === 'counselor' && counselor.status === 'active') {
          derivedTutorId = counselor.id;
        } else {
          console.warn(`create-invoice: ignoring counsellor ${requestedCounselorId}, not an active counsellor`);
        }
      }
    }

    // Buying a course. The same rule as a tier, and it was not being applied.
    //
    // The browser computed price_cents x slots and sent the total, and this
    // accepted it after nothing more than a range check, so any amount between
    // a cent and fifty thousand dollars was a valid price for any course. It
    // also paid the tutor a hardcoded 70% of whatever arrived, ignoring the
    // payout an admin had set on the course, and took tutor_id from the request,
    // so the payee was the caller's to name too.
    //
    // Everything now comes from the course row. The request says which course
    // and which slots; it does not get to say what either is worth.
    if (courseId) {
      const slots = booking?.length ?? 0;
      if (slots < 1) {
        return res.status(400).json({ error: 'Choose at least one session before paying.' });
      }

      const { data: course, error: courseErr } = await db
        .from('courses')
        .select('id, title, price_cents, tutor_payout_cents, tutor_id, is_active')
        .eq('id', courseId)
        .maybeSingle();

      if (courseErr) throw new Error(courseErr.message);
      if (!course || !course.is_active) {
        return res.status(400).json({ error: 'That course is no longer available' });
      }
      if (!course.price_cents || course.price_cents <= 0) {
        return res.status(400).json({ error: 'That course has no price set' });
      }

      finalAmountCents = course.price_cents * slots;
      finalKind = 'tutoring';
      // The description is what the payer reads on their statement, so it is
      // built here rather than accepted: a request could otherwise put any
      // wording it liked on a real charge.
      finalDescription =
        `${course.title} (${slots} session${slots === 1 ? '' : 's'})`;
      // The tutor teaching it, not the tutor the request named.
      derivedTutorId = course.tutor_id ?? null;
      derivedPayoutCents =
        course.tutor_payout_cents != null ? course.tutor_payout_cents * slots : null;
    }

    // A request names a product, never a price. Both real callers send either a
    // courseId or an admissionsTierId, so the free-amount path had no user and
    // was only a way to charge an arbitrary number. Refused outright rather
    // than left open for the next caller to reach for.
    if (!courseId && !admissionsTierId) {
      return res.status(400).json({ error: 'Name a course or a plan to pay for.' });
    }

    // Whose invoice this is. studentId arrives from the browser, and without
    // this a parent could book onto another family's child: they would be
    // paying, but the enrolment, the sessions and the plan would land on
    // somebody else's record.
    if (studentId && studentId !== user.id) {
      const { count: linked } = await db
        .from('parent_student_links')
        .select('id', { count: 'exact', head: true })
        .eq('parent_id', user.id)
        .eq('student_id', studentId)
        .eq('status', 'active');
      if ((linked ?? 0) === 0) {
        return res.status(403).json({ error: 'That is not one of your children.' });
      }
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

    // What the admin set on the course, times the sessions bought. Recorded
    // now so a later reprice cannot change what somebody was owed for work
    // already booked.
    const payoutCents = derivedPayoutCents;
    const payeeId = derivedTutorId;

    const { data, error } = await db
      .from('invoices')
      .insert([{
        parent_id: user.id,
        student_id: studentId,
        tutor_id: payeeId,
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
