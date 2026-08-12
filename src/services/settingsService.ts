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
  type?: "url" | "email" | "text";
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
    hint: "Every Book a session button",
    placeholder: "https://calendly.com/yakal/intro-call",
    type: "url",
  },
  {
    key: "contact_email",
    label: "Contact email",
    hint: "Footer, and the mailto link",
    placeholder: "hello@yakal.me",
    type: "email",
  },
  {
    key: "contact_phone",
    label: "Contact phone",
    hint: "Footer",
    placeholder: "+251 91 100 0000",
  },
  {
    key: "contact_address",
    label: "Address",
    hint: "Footer",
    placeholder: "Bole, Addis Ababa, Ethiopia",
  },
  {
    key: "email_from",
    label: "Sender address",
    hint: "Must be a verified domain",
    placeholder: "Yakal Education Services <noreply@yakal.me>",
  },
];

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
