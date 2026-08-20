// ============================================================
// What happens to the money when a lesson is called off.
//
// This is the policy published at /cancellation-policy, not a new one. It said
// 24 hours' notice, a 50% fee inside that, and a full charge for a no-show,
// while the code refunded nothing in any case. Publishing a term you do not
// honour is worse than having no term, so the code moved to the policy rather
// than the other way round.
//
// Pure, and separate from anything that talks to Stripe or the database, so the
// rules can be checked exhaustively without either. The failure mode here is
// quiet: an off-by-one in a notice window is not visible in an interface, only
// in somebody's bank statement a week later.
// ============================================================

/** Who called it off. The rule is asymmetric, and this is the axis it turns on. */
export type CancelledBy = 'family' | 'tutor' | 'admin';

/** The published window, in hours. */
export const NOTICE_HOURS = 24;

/** The share kept when a family cancels inside the window. */
export const LATE_FEE_PERCENT = 50;

export interface CancellationInput {
  /** What this one lesson cost the family. */
  slotPriceCents: number;
  /** What the tutor would have earned for teaching it. */
  tutorEarningCents: number;
  /** When it was due to start. */
  startsAt: Date;
  /** When it was called off. Passed in rather than read, so tests are not timing dependent. */
  now: Date;
  by: CancelledBy;
}

export interface CancellationOutcome {
  refundCents: number;
  /** What the tutor keeps. Zero unless the family cancelled late. */
  tutorEarningCents: number;
  reason: 'in_notice' | 'late' | 'tutor_cancelled' | 'admin';
  /** Said to whoever pressed the button, before they press it. */
  explanation: string;
}

/** Hours between now and the lesson. Negative once it has started. */
export function hoursOfNotice(startsAt: Date, now: Date): number {
  return (startsAt.getTime() - now.getTime()) / 3_600_000;
}

/**
 * The policy, applied.
 *
 * Three rules and one deliberate asymmetry: the 24 hours protects the tutor's
 * blocked-out time from a last-minute change by the client, so it does not
 * apply to the tutor. A tutor who cancels has not lost anything a fee should
 * compensate, and the family pays nothing.
 *
 * Rounding goes to the family. Half of an odd number of cents has to fall
 * somewhere, and giving the extra cent to the person who has just lost a lesson
 * is the safer direction to be wrong in.
 */
export function decideCancellation(input: CancellationInput): CancellationOutcome {
  const { slotPriceCents, tutorEarningCents, by } = input;
  const notice = hoursOfNotice(input.startsAt, input.now);

  // The tutor called it off, or an admin did. Neither is the family's doing, so
  // they pay nothing and the tutor earns nothing.
  if (by === 'tutor' || by === 'admin') {
    return {
      refundCents: slotPriceCents,
      tutorEarningCents: 0,
      reason: by === 'tutor' ? 'tutor_cancelled' : 'admin',
      explanation:
        by === 'tutor'
          ? 'The family is refunded in full. You are not paid for a lesson you called off.'
          : 'Refunded in full, and the tutor is not paid for it.',
    };
  }

  // In time. The hour goes back on the tutor's calendar with a day to fill it.
  if (notice >= NOTICE_HOURS) {
    return {
      refundCents: slotPriceCents,
      tutorEarningCents: 0,
      reason: 'in_notice',
      explanation: 'Cancelled in time, so this is refunded in full.',
    };
  }

  // Inside the window, including after it should have started. The tutor held
  // the hour and could not fill it, which is the whole reason for the fee.
  const refundCents = Math.ceil((slotPriceCents * (100 - LATE_FEE_PERCENT)) / 100);
  const keptByTutor = Math.floor((tutorEarningCents * LATE_FEE_PERCENT) / 100);

  return {
    refundCents,
    tutorEarningCents: keptByTutor,
    reason: 'late',
    explanation: `Less than ${NOTICE_HOURS} hours' notice, so ${LATE_FEE_PERCENT}% is kept per the cancellation policy. The rest is refunded.`,
  };
}

/**
 * The moment after which cancelling costs money.
 *
 * Shown as a date, never as a countdown. A clock ticking down to a deadline
 * reads as a nudge to use it, and it produces a support conversation every time
 * somebody misses it by a minute and disagrees about whose clock was right.
 */
export function freeUntil(startsAt: Date): Date {
  return new Date(startsAt.getTime() - NOTICE_HOURS * 3_600_000);
}
