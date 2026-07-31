/**
 * Puts the database into a known state for demoing, without a full reset.
 *
 *   npm run demo                         list the commands
 *   npm run demo reset-onboarding tutor  replay the wizard for that account
 *   npm run demo pending tutor           put an applicant back in the queue
 *   npm run demo approve tutor           approve them
 *   npm run demo scratch                 wipe the throwaway signup account
 *   npm run demo status                  show where everyone stands
 *
 * Accounts are named by role (tutor, student, parent, counselor, admin) or by
 * full email. Everything runs against the local stack unless you pass
 * --target=remote, which also needs --yes.
 *
 * A full `npm run db:reset` takes about twenty seconds and signs everybody out.
 * These take about one and leave sessions alone, which is what you want between
 * two runs of the same demo in front of someone.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { USERS, DEMO_PASSWORD } from "./seed/data.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env") });

const argv = process.argv.slice(2);
const flags = argv.filter((a) => a.startsWith("--"));
const [command, target] = argv.filter((a) => !a.startsWith("--"));

const isRemote = flags.includes("--target=remote");
const confirmed = flags.includes("--yes");

const LOCAL_URL = process.env.VITE_SUPABASE_LOCAL_URL ?? "http://127.0.0.1:54321";
const LOCAL_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const url = isRemote ? process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL : LOCAL_URL;
const key = isRemote ? process.env.SUPABASE_SERVICE_ROLE_KEY : LOCAL_KEY;

if (!url || !key) {
  console.error("Missing credentials for the chosen target.");
  process.exit(1);
}
if (isRemote && !confirmed) {
  console.error(`\n  Refusing to change the hosted project without --yes.\n  Target: ${url}\n`);
  process.exit(1);
}

const db: SupabaseClient = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** The scratch account, used to demo signup without burning a real demo login. */
const SCRATCH_EMAIL = "demo.applicant@yakal.test";

function emailFor(nameOrRole: string | undefined): string | null {
  if (!nameOrRole) return null;
  if (nameOrRole.includes("@")) return nameOrRole;
  const match = USERS.find((u) => u.role === nameOrRole.toLowerCase());
  return match?.email ?? null;
}

async function profileByEmail(email: string) {
  const { data, error } = await db
    .from("profiles")
    .select("id, full_name, email, role, status, is_onboarded")
    .eq("email", email)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function setStatus(email: string, status: "pending" | "active" | "rejected") {
  const p = await profileByEmail(email);
  if (!p) return console.error(`  No account for ${email}`);
  const { error } = await db
    .from("profiles")
    .update({ status, rejection_reason: status === "rejected" ? "Demo rejection" : null })
    .eq("id", p.id);
  if (error) throw error;
  console.log(`  ${p.full_name} (${p.role}) is now ${status}`);
}

async function resetOnboarding(email: string) {
  const p = await profileByEmail(email);
  if (!p) return console.error(`  No account for ${email}`);
  const { error } = await db
    .from("profiles")
    .update({
      is_onboarded: false,
      // Cleared so the wizard genuinely starts over rather than pre-filled.
      resume_url: null,
      subjects: null,
      bio: null,
    })
    .eq("id", p.id);
  if (error) throw error;
  console.log(`  ${p.full_name} (${p.role}) will replay onboarding on next load`);
  if (p.role === "tutor" || p.role === "counselor") {
    await setStatus(email, "pending");
  }
}

/** Deletes the throwaway applicant so the signup screen can be demoed again. */
async function resetScratch() {
  const { data } = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
  const existing = data?.users.find((u) => u.email?.toLowerCase() === SCRATCH_EMAIL);
  if (existing) {
    const { error } = await db.auth.admin.deleteUser(existing.id);
    if (error) throw error;
    console.log(`  Deleted ${SCRATCH_EMAIL}`);
  } else {
    console.log(`  ${SCRATCH_EMAIL} did not exist`);
  }
  console.log(`  Sign up with that address to walk the flow from the start.`);
}

/** Removes accounts left behind by verification runs (anything @yakal.test). */
async function cleanTestAccounts() {
  const { data } = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
  const throwaway = (data?.users ?? []).filter((u) => u.email?.endsWith("@yakal.test"));
  for (const u of throwaway) {
    await db.auth.admin.deleteUser(u.id);
    console.log(`  Deleted ${u.email}`);
  }
  if (throwaway.length === 0) console.log("  Nothing to clean.");
}

async function status() {
  const { data, error } = await db
    .from("profiles")
    .select("full_name, email, role, status, is_onboarded")
    .order("role");
  if (error) throw error;

  const width = Math.max(24, ...(data ?? []).map((p) => (p.email ?? "").length)) + 2;
  console.log(`\n  ${"ACCOUNT".padEnd(width)}${"ROLE".padEnd(11)}${"STATUS".padEnd(10)}ONBOARDED`);
  for (const p of data ?? []) {
    console.log(
      `  ${(p.email ?? "").padEnd(width)}${(p.role ?? "").padEnd(11)}${(p.status ?? "").padEnd(10)}${p.is_onboarded ? "yes" : "no"}`
    );
  }
  console.log(`\n  Password for every seeded account: ${DEMO_PASSWORD}`);
}

function usage() {
  console.log(`
  Demo state helpers. Target: ${url}

    npm run demo status
        Where every account currently stands.

    npm run demo reset-onboarding <role|email>
        Replays the onboarding wizard for that account. Tutors and counselors
        go back to pending so the approval queue can be demoed again.

    npm run demo pending <role|email>
    npm run demo approve <role|email>
    npm run demo reject <role|email>
        Move an applicant through the review states.

    npm run demo scratch
        Deletes ${SCRATCH_EMAIL} so signup can be shown from the top.

    npm run demo clean
        Removes every @yakal.test account left behind by verification runs.

  Add --target=remote --yes to act on the hosted project.
`);
}

async function main() {
  switch (command) {
    case "status":
      return status();
    case "scratch":
      return resetScratch();
    case "clean":
      return cleanTestAccounts();
    case "reset-onboarding": {
      const email = emailFor(target);
      if (!email) return usage();
      return resetOnboarding(email);
    }
    case "pending":
    case "approve":
    case "reject": {
      const email = emailFor(target);
      if (!email) return usage();
      const next = command === "approve" ? "active" : command === "reject" ? "rejected" : "pending";
      return setStatus(email, next as "pending" | "active" | "rejected");
    }
    default:
      return usage();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
