import { supabase } from "@/lib/supabase";

/**
 * Profiles with their private columns, for the people allowed them.
 *
 * phone, stripe_account_id, stripe_payouts_enabled, resume_url and
 * rejection_reason are not selectable from the profiles table by other users.
 * The full_profiles function returns the caller's own row, or every row for an
 * admin, and this reads it for a list of ids. Somebody else asking gets back
 * only their own row, if it is in the list, so a mistaken call degrades to
 * "not connected" or "no CV" rather than leaking.
 *
 * A helper because the generated client types full_profiles as returning one
 * row, and every caller wants a list.
 */
export async function fullProfilesById<T extends { id: string }>(
  columns: string,
  ids: string[]
): Promise<T[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.rpc("full_profiles").select(columns).in("id", ids);
  if (error) {
    console.error("full_profiles failed:", error.message);
    return [];
  }
  return (data ?? []) as unknown as T[];
}
