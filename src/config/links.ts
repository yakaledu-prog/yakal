/**
 * Outbound links that appear in more than one place.
 *
 * The booking URL was pasted into three components. Changing it meant finding
 * all three, and a landing page with two different booking links is worse than
 * one with none.
 */
export const CALENDLY_URL =
  "https://calendly.com/binyammamo01/parent-counseling-session";

/** Opens a booking page without handing it a window it can navigate. */
export function openBooking() {
  window.open(CALENDLY_URL, "_blank", "noopener,noreferrer");
}
