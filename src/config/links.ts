/**
 * Outbound links that appear in more than one place.
 *
 * The booking URL was pasted into three components. Changing it meant finding
 * all three, and a landing page with two different booking links is worse than
 * one with none.
 */
/**
 * The booking page, from `VITE_BOOKING_URL`.
 *
 * Empty when unset, and openBooking then does nothing rather than guessing.
 * It used to fall back to the Calendly of whoever built this, which books
 * strangers into a private calendar and is not the sort of thing anybody
 * thinks to check.
 */
export const CALENDLY_URL = import.meta.env.VITE_BOOKING_URL ?? "";

/** Opens a booking page without handing it a window it can navigate. */
export function openBooking() {
  if (!CALENDLY_URL) {
    console.warn("VITE_BOOKING_URL is not set, so there is no booking page to open.");
    return;
  }
  window.open(CALENDLY_URL, "_blank", "noopener,noreferrer");
}

/**
 * What the footer prints. Placeholders until the real ones are supplied: the
 * address and phone always were, and the email said contact@yamal.com while
 * linking to a personal inbox, so both halves were wrong in different ways.
 */
export const CONTACT = {
  email: import.meta.env.VITE_CONTACT_EMAIL ?? "hello@yakal.me",
  phone: import.meta.env.VITE_CONTACT_PHONE ?? "+1 (123) 456-7890",
  address: import.meta.env.VITE_CONTACT_ADDRESS ?? "123 Design Street, New York, United States",
};
