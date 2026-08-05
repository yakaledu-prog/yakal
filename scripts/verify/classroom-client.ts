// The slim Classroom client reaches Google.
//
// googleapis is 204 MB unpacked and took the whole api/google function past
// Vercel's 250 MB limit, so it failed to invoke and took the token exchange
// down with it. @googleapis/classroom is 1.8 MB. This proves the smaller one
// authenticates and reads, which is the only thing that matters about the swap.
//
// Run: npx tsx scripts/verify/classroom-client.ts <classroomCourseId>
import { config } from "dotenv";
import { classroom_v1, auth as googleAuth } from "@googleapis/classroom";

config({ path: new URL("../../.env", import.meta.url).pathname });

/**
 * A course id, from whatever somebody pasted.
 *
 * The id in a Classroom URL is base64: /c/ODE5OTE1NjYyMzIx is course
 * 819915662321. Passing the encoded form to the API answers "Requested entity
 * was not found", which is the same thing it says when the class belongs to
 * another Google account, so an encoding mistake reads as a credentials
 * problem and sends you to rebuild your OAuth client for nothing.
 *
 * Same rule as courseIdFromUrl in src/services/classroomService.ts, which is
 * what the admin course modal uses, so pasting a URL works in both places.
 */
function courseIdFrom(input: string): string {
  const fromUrl = input.match(/\/c\/([a-zA-Z0-9_-]+)/);
  const candidate = fromUrl ? fromUrl[1] : input;
  if (/^\d+$/.test(candidate)) return candidate;
  try {
    const decoded = Buffer.from(candidate, "base64").toString("utf8");
    if (/^\d+$/.test(decoded)) return decoded;
  } catch {
    // Not base64. Some links carry the raw id already.
  }
  return candidate;
}

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error("Usage: npx tsx scripts/verify/classroom-client.ts <course id or Classroom URL>");
    process.exit(1);
  }
  const courseId = courseIdFrom(arg);
  if (courseId !== arg) console.log(`      read course id ${courseId} from ${arg}`);

  const oauth = new googleAuth.OAuth2(
    process.env.VITE_GCP_CLIENT_ID,
    process.env.GCP_CLIENT_SECRET
  );
  oauth.setCredentials({ refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN });

  const classroom = new classroom_v1.Classroom({ auth: oauth as never });
  const res = await classroom.courses.courseWork.list({ courseId });
  const work = res.data.courseWork ?? [];

  console.log(`ok    the slim client authenticated and read class ${courseId}`);
  console.log(`ok    ${work.length} assignment${work.length === 1 ? "" : "s"} returned`);
  for (const w of work) console.log(`        ${w.title}`);
}

main().catch((err) => {
  console.error("FAIL ", err?.message ?? err);
  process.exit(1);
});
