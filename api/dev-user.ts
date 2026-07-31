import { createClient } from "@supabase/supabase-js";

// ============================================================
// Developer-only account actions, for the /dev console.
//
// Deleting an auth user needs the service role key, which must never reach the
// browser, so it happens here instead.
//
// Two guards, both of which must pass:
//   1. DEV_TOOLS_ENABLED must be exactly "true". Absent by default, so a
//      deployment that simply does not set it is safe.
//   2. A production deployment is refused outright regardless of the flag.
//
// Tracked in docs/PRODUCTION_UNMOCK_CHECKLIST.md.
// ============================================================

function devToolsAllowed(): { ok: boolean; reason?: string } {
  if (process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production") {
    return { ok: false, reason: "Developer tools are disabled in production." };
  }
  if (process.env.DEV_TOOLS_ENABLED !== "true") {
    return { ok: false, reason: "Set DEV_TOOLS_ENABLED=true to use developer tools." };
  }
  return { ok: true };
}

export default async function handler(req: any, res: any) {
  const allowed = devToolsAllowed();
  if (!allowed.ok) return res.status(403).json({ error: allowed.reason });

  if (req.method !== "POST") return res.status(405).json({ error: "Use POST." });

  const { action, userId } = req.body ?? {};
  if (action !== "delete") return res.status(400).json({ error: `Unknown action: ${action}` });
  if (!userId) return res.status(400).json({ error: "userId is required." });

  // Local by default. Deleting from the hosted project needs its URL set
  // explicitly, so a stray call cannot reach it.
  const url = process.env.DEV_TOOLS_SUPABASE_URL ?? "http://127.0.0.1:54321";
  const key =
    process.env.DEV_TOOLS_SERVICE_ROLE_KEY ??
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

  try {
    const db = createClient(url, key, { auth: { persistSession: false } });
    // profiles.id references auth.users on delete cascade, so the profile and
    // everything hanging off it goes with the account.
    const { error } = await db.auth.admin.deleteUser(userId);
    if (error) throw error;
    return res.status(200).json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message ?? "Could not delete that account." });
  }
}
