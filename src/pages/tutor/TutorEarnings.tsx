import { EarningsScreen } from "@/components/shared/EarningsScreen";

/**
 * A tutor's earnings, which is the shared screen with a tutor's wording.
 *
 * Everything that was here is in EarningsScreen now, because the counsellor
 * was reading the same ledger through a second page built to resemble this
 * one. The layout, the banner, the connect flow and the table are one thing.
 */
export function TutorEarnings() {
  return (
    <EarningsScreen
      countLabel={(n) => `${n} ${n === 1 ? "session" : "sessions"} taught`}
      searchPlaceholder="Search by subject, student or reference"
      emptyText="Nothing yet. A session appears here once it has run."
    />
  );
}
