import { createClient } from "@supabase/supabase-js";

// Plus-addressing off one real inbox, so every demo account is reachable
// without registering five mailboxes. Whoever runs this should use their own.
const BASE_EMAIL = process.env.DEMO_BASE_EMAIL ?? "hello@yakal.me";
import dotenv from "dotenv";

dotenv.config();

const hostedUrl = process.env.VITE_SUPABASE_URL;
const hostedKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const localUrl = process.env.VITE_SUPABASE_LOCAL_URL || "http://127.0.0.1:54321";
const localKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const ACCOUNTS = [
  { email: `${BASE_EMAIL.replace("@", "+demoadmin@")}`, role: "admin", name: "Demo Admin" },
  { email: `${BASE_EMAIL.replace("@", "+demostudent@")}`, role: "student", name: "Demo Student" },
  { email: `${BASE_EMAIL.replace("@", "+demotutor@")}`, role: "tutor", name: "Demo Tutor" },
  { email: `${BASE_EMAIL.replace("@", "+democounselor@")}`, role: "counselor", name: "Demo Counselor" },
  { email: `${BASE_EMAIL.replace("@", "+demoparent@")}`, role: "parent", name: "Demo Parent" }
];

async function updateProfiles(url: string | undefined, key: string | undefined, envName: string) {
  if (!url || !key) {
    console.log(`[${envName}] Skipped: Missing URL or Key`);
    return;
  }
  try {
    const supabase = createClient(url, key, { auth: { persistSession: false } });

    for (const acc of ACCOUNTS) {
      // Check if user exists in auth or profiles
      const { data: prof } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", acc.email)
        .maybeSingle();

      if (prof) {
        const { error } = await supabase
          .from("profiles")
          .update({
            role: acc.role,
            status: "active",
            is_onboarded: true,
            full_name: acc.name
          })
          .eq("email", acc.email);

        if (error) {
          console.error(`[${envName}] Error updating ${acc.email}:`, error.message);
        } else {
          console.log(`[${envName}] Updated ${acc.email} to role '${acc.role}'`);
        }
      } else {
        console.log(`[${envName}] Profile for ${acc.email} not in DB yet (will be created on auth signup).`);
      }
    }
  } catch (err) {
    console.error(`[${envName}] Failed:`, err);
  }
}

async function main() {
  console.log("Updating role profiles...");
  await updateProfiles(hostedUrl, hostedKey, "Hosted Supabase");
  await updateProfiles(localUrl, localKey, "Local Supabase");
}

main();
