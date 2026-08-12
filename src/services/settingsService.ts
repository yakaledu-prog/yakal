import { supabase } from "@/lib/supabase";

// ============================================================
// Settings the business owns, rather than the build.
//
// The booking link and the contact details used to be VITE_ variables, which
// Vite inlines at build time: changing the Calendly link meant editing an
// environment variable and waiting for a redeploy. These live in a row now, so
// an admin edits them on a page and the site is right on the next load.
//
// Nothing secret belongs here. The table is readable by anon, because the
// landing page and the footer need it while signed out. Keys stay in the
// environment, where the browser cannot reach them.
// ============================================================

export interface SettingField {
  key: string;
  label: string;
  /** A few words beside the label. The placeholder carries the example. */
  hint: string;
  placeholder: string;
  type?: "url" | "email" | "tel" | "text";
  /** Grouped under this in the form. */
  group: "Public site" | "Contact" | "Email" | "Social";
}

/**
 * The editable set, in the order the form shows them.
 *
 * Adding one is a row and a line here, not a migration: the table is key and
 * value precisely so a settings page can grow without schema work.
 */
export const SETTING_FIELDS: SettingField[] = [
  {
    key: "booking_url",
    label: "Booking link",
    hint: "every Book a session button",
    placeholder: "https://calendly.com/yakal/intro-call",
    type: "url",
    group: "Public site",
  },
  {
    key: "contact_email",
    label: "Contact email",
    hint: "footer, and the mailto link",
    placeholder: "hello@yakal.me",
    type: "email",
    group: "Contact",
  },
  {
    key: "contact_phone",
    label: "Contact phone",
    hint: "footer",
    placeholder: "+251 91 100 0000",
    type: "tel",
    group: "Contact",
  },
  {
    key: "contact_address",
    label: "Address",
    hint: "footer",
    placeholder: "Bole, Addis Ababa, Ethiopia",
    group: "Contact",
  },
  {
    key: "contact_form_email",
    label: "Contact form inbox",
    hint: "where the website form is delivered",
    placeholder: "hello@yakal.me",
    type: "email",
    group: "Email",
  },
  {
    key: "email_from",
    label: "Sender address",
    hint: "must be a verified domain",
    placeholder: "Yakal Education Services <noreply@yakal.me>",
    group: "Email",
  },
  {
    key: "social_instagram",
    label: "Instagram",
    hint: "footer icon, hidden when blank",
    placeholder: "https://www.instagram.com/yakaledu/",
    type: "url",
    group: "Social",
  },
  {
    key: "social_x",
    label: "X",
    hint: "footer icon, hidden when blank",
    placeholder: "https://x.com/yakaleducation",
    type: "url",
    group: "Social",
  },
  {
    key: "social_linkedin",
    label: "LinkedIn",
    hint: "footer icon, hidden when blank",
    placeholder: "https://www.linkedin.com/company/yakal/",
    type: "url",
    group: "Social",
  },
];

/**
 * Which column each group sits in, and in what order.
 *
 * Declared rather than balanced by field count: the pairing is editorial. How
 * the business is reached and how it writes back go first, on the left, since
 * those are the five somebody comes here to change; the booking link and the
 * social accounts follow.
 */
export const SETTING_COLUMNS: readonly (readonly string[])[] = [
  ["Contact", "Email"],
  ["Public site", "Social"],
] as const;

export type SiteSettings = Record<string, string>;

export async function getSettings(): Promise<SiteSettings> {
  const { data, error } = await supabase.from("site_settings").select("key, value");

  if (error) {
    // A failed read falls back to the build-time values rather than blanking
    // the footer, which is what the callers do with an empty result.
    console.error("getSettings:", error.message);
    return {};
  }
  return Object.fromEntries((data ?? []).map((r) => [r.key, r.value ?? ""]));
}

/** Admin only, enforced by RLS rather than by this function. */
export async function saveSettings(
  values: SiteSettings,
  adminId: string
): Promise<{ success: boolean; error?: string }> {
  const rows = Object.entries(values).map(([key, value]) => ({
    key,
    value: value.trim(),
    updated_at: new Date().toISOString(),
    updated_by: adminId,
  }));

  const { error } = await supabase.from("site_settings").upsert(rows, { onConflict: "key" });
  if (error) return { success: false, error: error.message };
  return { success: true };
}
