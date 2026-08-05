/**
 * Outbound links that appear in more than one place.
 *
 * The booking URL was pasted into three components. Changing it meant finding
 * all three, and a landing page with two different booking links is worse than
 * one with none.
 */
/**
 * Set `VITE_BOOKING_URL` to the real Calendly. The fallback is the developer
 * account it was built against, which books into the wrong calendar the moment
 * anybody else deploys this, and is the kind of thing nobody notices until a
 * stranger appears in your week.
 */
export const CALENDLY_URL =
  import.meta.env.VITE_BOOKING_URL ||
  "https://calendly.com/binyammamo01/parent-counseling-session";

/** Opens a booking page without handing it a window it can navigate. */
export function openBooking() {
  window.open(CALENDLY_URL, "_blank", "noopener,noreferrer");
}
