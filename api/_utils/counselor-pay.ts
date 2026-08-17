// ============================================================
// What a counsellor is owed, per payment received.
//
// A tier is bought either outright or over a fixed number of monthly
// instalments. Only the outright case produces a single invoice; instalments
// do not create an invoice row per month, they increment payments_made on the
// plan. So there is no monthly invoice to carry a monthly payout, which is why
// this does not use invoices.payout_cents the way a tutor's session money does.
//
// One row per payment received, written as that payment arrives. A counsellor
// is paid alongside the platform being paid, rather than a year ahead of it.
// ============================================================

/**
 * The share of one payment, in whole cents.
 *
 * Split evenly across instalments, with the rounding remainder on the first,
 * so the parts add up to the whole. Splitting after rounding each month loses
 * up to a cent a month, which over a ten month plan is somebody's money.
 *
 * Exported and pure so the arithmetic can be checked without a database: the
 * failure mode here is silent and only shows up in a total nobody reconciles.
 */
export function shareForInstalment(
  tierPriceCents: number,
  sharePercent: number | null | undefined,
  instalmentMonths: number,
  instalmentNumber: number
): number {
  if (sharePercent == null || sharePercent <= 0) return 0;
  if (tierPriceCents <= 0) return 0;

  const months = Math.max(1, Math.floor(instalmentMonths));
  const total = Math.round((tierPriceCents * sharePercent) / 100);
  const per = Math.floor(total / months);
  const remainder = total - per * months;

  return instalmentNumber === 1 ? per + remainder : per;
}

/**
 * One instalment of the parent's payment, in whole cents.
 *
 * The same even split with the remainder on the first, so the months add up to
 * the price. Recorded rather than derived: a tier can be repriced, and working
 * an old month out from today's price would restate history.
 */
export function paidForInstalment(
  tierPriceCents: number,
  instalmentMonths: number,
  instalmentNumber: number
): number {
  if (tierPriceCents <= 0) return 0;
  const months = Math.max(1, Math.floor(instalmentMonths));
  const per = Math.floor(tierPriceCents / months);
  const remainder = tierPriceCents - per * months;
  return instalmentNumber === 1 ? per + remainder : per;
}

/**
 * Record one payment's share, once.
 *
 * The unique index on (plan_id, instalment_number) is what makes this safe to
 * call twice: Stripe redelivers webhooks, and paying somebody twice for one
 * month is the kind of error that is only found by the person who was not paid
 * the following month.
 *
 * Never throws. The money has already moved by the time this runs, and a
 * bookkeeping row failing to write must not fail a purchase. It is logged
 * loudly instead, and the admin's payouts page is where a missing row shows.
 */
export async function recordCounselorShare(
  db: any,
  opts: {
    planId: string;
    counselorId: string;
    tierPriceCents: number;
    sharePercent: number | null | undefined;
    instalmentMonths: number;
    instalmentNumber: number;
  }
): Promise<void> {
  const amount = shareForInstalment(
    opts.tierPriceCents,
    opts.sharePercent,
    opts.instalmentMonths,
    opts.instalmentNumber
  );

  // A tier with no percentage set yet still gets a row, at zero. It records
  // that a payment happened and nobody had decided the share, which an admin
  // can correct; writing nothing would leave no trace that anything was owed.
  const { error } = await db.from("counselor_payouts").insert({
    plan_id: opts.planId,
    counselor_id: opts.counselorId,
    instalment_number: opts.instalmentNumber,
    amount_cents: amount,
    // What came in to owe it from, so the two halves of one payment can be
    // read together later.
    paid_cents: paidForInstalment(
      opts.tierPriceCents,
      opts.instalmentMonths,
      opts.instalmentNumber
    ),
    share_percent: opts.sharePercent ?? null,
    note: opts.sharePercent == null ? "No share percent was set on this tier when it was bought." : null,
  });

  // 23505 is the unique index doing its job on a redelivered webhook.
  if (error && error.code !== "23505") {
    console.error("counselor payout could not be recorded:", error.message);
  }
}
