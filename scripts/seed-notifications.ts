/**
 * Fill one account's notifications with one of every template.
 *
 * Run: npm run db:seed:notifications -- someone@example.com
 *      npm run db:seed:notifications -- someone@example.com --target=remote
 *      npm run db:seed:notifications -- someone@example.com --clear
 *
 * Every row is rendered from the template's own sample values, so what lands
 * in the database is exactly what the app will send in production. If a
 * template reads badly here it reads badly there, which is the point of
 * seeding them rather than writing lorem ipsum.
 *
 * Timestamps are spread backwards over the last fortnight, in a shuffled
 * order, because a list where every row says "just now" tells you nothing
 * about how the screen behaves once it has some history in it.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

import { TEMPLATE_KEYS, TEMPLATES, renderSample } from "../src/lib/notifications/index.ts";

config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../.env") });

const args = process.argv.slice(2);
const email = args.find((a) => !a.startsWith("--"));
const remote = args.includes("--target=remote");
const clear = args.includes("--clear");

if (!email) {
  console.error("Usage: npm run db:seed:notifications -- <email> [--target=remote] [--clear]");
  process.exit(1);
}

const url = remote
  ? process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  : process.env.VITE_SUPABASE_LOCAL_URL || "http://127.0.0.1:54321";

const key = remote
  ? process.env.SUPABASE_SERVICE_ROLE_KEY
  : // The CLI's fixed local service key. It grants nothing off this machine.
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

if (!url || !key) {
  console.error("Missing Supabase credentials. Check .env.");
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });

/** Deterministic shuffle, so a rerun produces the same spread. */
function shuffled<T>(list: T[], seed: number): T[] {
  const out = [...list];
  let s = seed;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) % 2147483648;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

async function main() {
  const { data: profile, error: findErr } = await db
    .from("profiles")
    .select("id, full_name, email")
    .ilike("email", email!)
    .maybeSingle();

  if (findErr) {
    console.error("Could not look that account up:", findErr.message);
    process.exit(1);
  }
  if (!profile) {
    console.error(`No account uses ${email}.`);
    process.exit(1);
  }

  console.log(`\n${profile.full_name} <${profile.email}>`);
  console.log(remote ? "against the hosted project" : "against the local stack");

  if (clear) {
    const { error } = await db.from("notifications").delete().eq("user_id", profile.id);
    if (error) {
      console.error("Could not clear the existing rows:", error.message);
      process.exit(1);
    }
    console.log("cleared what was there");
  }

  const keys = shuffled([...TEMPLATE_KEYS], 20260804);
  const now = Date.now();
  const rows = keys.map((key, i) => {
    const { notification, vars } = renderSample(key);
    return {
      user_id: profile.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      link: notification.link,
      // The facts, not the words. Everything a reader sees on opening this is
      // rendered from the template each time, so fixing a sentence fixes rows
      // that were written months ago.
      template: key,
      vars,
      // Spread back over a fortnight, newest first, with the first three left
      // unread so the tabs have something to separate.
      created_at: new Date(now - i * 26 * 60 * 60 * 1000).toISOString(),
      is_read: i >= 3,
      archived: i >= keys.length - 2,
    };
  });

  const { error } = await db.from("notifications").insert(rows);
  if (error) {
    console.error("Insert failed:", error.message);
    process.exit(1);
  }

  for (const key of keys) {
    console.log(`  ${TEMPLATES[key].type.padEnd(28)} ${TEMPLATES[key].label}`);
  }
  console.log(
    `\n${rows.length} notifications written. ${rows.filter((r) => !r.is_read).length} unread, ` +
      `${rows.filter((r) => r.archived).length} archived.`
  );
}

main();
