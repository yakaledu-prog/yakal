import { EarningsScreen } from "@/components/shared/EarningsScreen";

/**
 * A counsellor's earnings, which is the same screen a tutor gets.
 *
 * This page used to be its own thing: a banner reading This month and Last
 * month, a bar chart that said "No earnings to chart yet" for anybody new, and
 * a payout list underneath repeating what the table's Method and Status
 * columns already carry. It also predated the ledger, multiplying completed
 * sessions by the hourly_rate on the counsellor's own profile and labelling
 * the result ETB, which was wrong three times over: a counsellor is paid a
 * percentage of the tier rather than an hour, the rate is the admin's to set
 * and was being read from a field the counsellor could edit, and every other
 * figure on the platform is in USD.
 *
 * A counselling earning is a plan month, so it has no length and the column
 * would be a row of "0 min".
 */
export function CounselorEarnings() {
  return (
    <EarningsScreen
      countLabel={(n) => `${n} ${n === 1 ? "month" : "months"} earned`}
      searchPlaceholder="Search by student or reference"
      emptyText="Nothing yet. A month appears here once it has been paid for."
      showLength={false}
    />
  );
}
