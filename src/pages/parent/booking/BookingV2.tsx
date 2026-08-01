import { MonthlyBooking } from "./MonthlyBooking";

/** Courses v2: pick each lesson individually across the month. */
export function BookingV2() {
  return <MonthlyBooking mode="dates" />;
}
