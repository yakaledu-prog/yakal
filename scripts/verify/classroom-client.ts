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

async function main() {
  const courseId = process.argv[2];
  if (!courseId) {
    console.error("Usage: npx tsx scripts/verify/classroom-client.ts <classroomCourseId>");
    process.exit(1);
  }

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
