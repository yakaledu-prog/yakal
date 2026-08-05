import { createClient } from "../node_modules/@supabase/supabase-js/dist/main/index.js";
import fs from "fs";
import path from "path";

// Read .env manually
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || "";
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      process.env[key] = value;
    }
  }
}

const hostedUrl = process.env.VITE_SUPABASE_URL;
const hostedKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const localUrl = process.env.VITE_SUPABASE_LOCAL_URL || "http://127.0.0.1:54321";
const localKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

async function updateProfile(url, key, envName) {
  if (!url || !key) {
    console.log(`[${envName}] Skipped: Missing URL or Key`);
    return;
  }
  try {
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const email = "binyam2537+demoadmin@gmail.com";
    
    const { data: updated, error } = await supabase
      .from("profiles")
      .update({ role: "admin", status: "active", is_onboarded: true })
      .eq("email", email)
      .select();

    if (error) {
      console.error(`[${envName}] Error updating profile:`, error.message);
    } else {
      console.log(`[${envName}] Successfully updated profile for ${email}:`, updated);
    }
  } catch (err) {
    console.error(`[${envName}] Failed:`, err);
  }
}

async function main() {
  console.log("Updating admin profile...");
  await updateProfile(hostedUrl, hostedKey, "Hosted Supabase");
  await updateProfile(localUrl, localKey, "Local Supabase");
}

main();
