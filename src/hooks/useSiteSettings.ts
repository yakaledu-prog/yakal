import { useQuery } from "@tanstack/react-query";
import { getSettings } from "@/services/settingsService";
import { CALENDLY_URL, CONTACT } from "@/config/links";

/**
 * The business's own values, with the build-time ones behind them.
 *
 * The environment variables stay as a fallback rather than being deleted: an
 * install that has not filled the settings page in yet keeps whatever was
 * baked in, so this change cannot blank a working footer.
 *
 * Cached for the session. These change a few times a year, and refetching them
 * on every mount would put a query in front of the landing page's first paint.
 */
export function useSiteSettings() {
  const { data } = useQuery({
    queryKey: ["site-settings"],
    queryFn: getSettings,
    staleTime: Infinity,
  });

  return {
    bookingUrl: data?.booking_url?.trim() || CALENDLY_URL,
    contact: {
      email: data?.contact_email?.trim() || CONTACT.email,
      phone: data?.contact_phone?.trim() || CONTACT.phone,
      address: data?.contact_address?.trim() || CONTACT.address,
    },
    /** Blank ones are dropped: an icon linking nowhere is worse than no icon. */
    social: {
      instagram: data?.social_instagram?.trim() ?? "",
      x: data?.social_x?.trim() ?? "",
      linkedin: data?.social_linkedin?.trim() ?? "",
    },
  };
}

/** Opens a booking page without handing it a window it can navigate. */
export function openBookingUrl(url: string) {
  if (!url) {
    console.warn("No booking link is set. An admin can add one on the admin profile page.");
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
