/**
 * Push the seeded coursework into the Google Classroom a course is linked to.
 *
 *   npx tsx scripts/classroom-sync.ts              every linked course
 *   npx tsx scripts/classroom-sync.ts --dry        say what it would do
 *
 * Assignments are written on the admin side and mirrored here, so a class that
 * students already use carries the same work the platform shows. It matches on
 * title: an assignment already in Classroom is left alone rather than added a
 * second time, which makes running this twice safe.
 *
 * Needs GOOGLE_OAUTH_REFRESH_TOKEN to carry classroom.coursework.students, and
 * the account behind it has to be a teacher on the class. Mint one with
 * `node scripts/google-oauth-setup.mjs` after the scopes there were widened.
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const API = "https://classroom.googleapis.com/v1";
const dryRun = process.argv.includes("--dry");

function need(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is missing from the environment`);
  return value;
}

async function accessToken(): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: need("VITE_GCP_CLIENT_ID"),
      client_secret: need("GCP_CLIENT_SECRET"),
      refresh_token: need("GOOGLE_OAUTH_REFRESH_TOKEN"),
      grant_type: "refresh_token",
    }),
  });

  const data = await res.json();
  if (!data.access_token) throw new Error(`Google refused a token: ${JSON.stringify(data)}`);

  // Failing here beats failing per assignment with a 403 nobody can read.
  if (!String(data.scope ?? "").includes("classroom.coursework.students")) {
    throw new Error(
      "This refresh token has no Classroom scope. Run `node scripts/google-oauth-setup.mjs` " +
        "signed in as a teacher of the class, then put the new GOOGLE_OAUTH_REFRESH_TOKEN in .env."
    );
  }
  return data.access_token;
}

/** The numeric id hiding in a Classroom web URL, which base64s it. */
function courseIdFromUrl(url: string): string | null {
  const match = url.match(/\/c\/([a-zA-Z0-9_-]+)/);
  if (!match) return null;
  try {
    const decoded = Buffer.from(match[1], "base64").toString();
    if (/^\d+$/.test(decoded)) return decoded;
  } catch {
    // Some links carry the raw id already.
  }
  return match[1];
}

async function main() {
  const db = createClient(
    process.env.VITE_SUPABASE_LOCAL_URL || "http://127.0.0.1:54321",
    process.env.SUPABASE_LOCAL_SERVICE_ROLE_KEY ||
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU",
    { auth: { persistSession: false } }
  );

  const { data: courses } = await db
    .from("courses")
    .select("id, title, google_classroom_url")
    .not("google_classroom_url", "is", null)
    .neq("google_classroom_url", "");

  if (!courses?.length) {
    console.log("No course is linked to a Google Classroom yet.");
    return;
  }

  const token = dryRun ? "" : await accessToken();

  for (const course of courses) {
    const classId = courseIdFromUrl(course.google_classroom_url!);
    if (!classId) {
      console.log(`! ${course.title}: could not read a class id out of that URL`);
      continue;
    }

    const { data: assignments } = await db
      .from("assignments")
      .select("id, title, description, materials, due_date, max_points")
      .eq("course_id", course.id);

    console.log(`\n${course.title} -> class ${classId} (${assignments?.length ?? 0} assignments)`);
    if (dryRun) {
      for (const a of assignments ?? []) console.log(`    would create: ${a.title}`);
      continue;
    }

    const existing = await fetch(`${API}/courses/${classId}/courseWork?pageSize=100`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json());

    if (existing.error) {
      console.log(`  ! ${existing.error.message}`);
      continue;
    }

    const already = new Set<string>((existing.courseWork ?? []).map((w: any) => w.title));

    for (const a of assignments ?? []) {
      if (already.has(a.title)) {
        console.log(`    already there: ${a.title}`);
        continue;
      }

      const due = a.due_date ? new Date(a.due_date) : null;
      const body: Record<string, unknown> = {
        title: a.title,
        description: a.description ?? undefined,
        workType: "ASSIGNMENT",
        state: "PUBLISHED",
        maxPoints: a.max_points ?? undefined,
        // Classroom wants a link material as { link: { url } }, and refuses a
        // Drive file it cannot see, so only links go across.
        materials: (Array.isArray(a.materials) ? a.materials : [])
          .filter((m: any) => m?.link)
          .map((m: any) => ({ link: { url: m.link, title: m.title } })),
      };

      if (due) {
        body.dueDate = {
          year: due.getUTCFullYear(),
          month: due.getUTCMonth() + 1,
          day: due.getUTCDate(),
        };
        body.dueTime = { hours: 23, minutes: 59 };
      }

      const res = await fetch(`${API}/courses/${classId}/courseWork`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const created = await res.json();

      if (!res.ok) {
        console.log(`    ! ${a.title}: ${created.error?.message ?? res.status}`);
        continue;
      }

      // The Classroom page for this assignment, so the card links to the work
      // itself rather than to the class.
      await db.from("assignments").update({ template_url: created.alternateLink }).eq("id", a.id);
      console.log(`    created: ${a.title}`);
    }
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
