// Turning a Google Classroom courseWork payload into what AssignmentList draws.
//
// Google's shape is awkward in three specific ways and each has burned
// somebody: the due date arrives as separate year/month/day fields and is
// absent entirely when there is none, every material is wrapped in a
// differently named object with only one of them present, and maxPoints is
// missing rather than zero on an ungraded task. This pins all three.
import { getCourseAssignments } from "../../src/services/classroomService.ts";

const payload = {
  courseWork: [
    {
      id: "301",
      state: "PUBLISHED",
      title: "Chapter 4 problems",
      description: "Questions 1 to 12.",
      dueDate: { year: 2026, month: 9, day: 5 },
      maxPoints: 20,
      alternateLink: "https://classroom.google.com/c/abc/a/301/details",
      materials: [
        { driveFile: { driveFile: { title: "worksheet.pdf", alternateLink: "https://drive.example/1" } } },
        { youtubeVideo: { title: "Worked example", alternateLink: "https://youtu.be/xyz" } },
        { link: { url: "https://example.com/notes" } },
      ],
    },
    {
      id: "302",
      state: "PUBLISHED",
      title: "Reading, no deadline",
      // No dueDate, no maxPoints, no materials: all optional in the API.
      alternateLink: "https://classroom.google.com/c/abc/a/302/details",
    },
    {
      id: "303",
      state: "PUBLISHED",
      title: "Earlier deadline",
      dueDate: { year: 2026, month: 8, day: 20 },
      alternateLink: "https://classroom.google.com/c/abc/a/303/details",
    },
    {
      id: "304",
      state: "DRAFT",
      title: "Not published yet",
      alternateLink: "https://classroom.google.com/c/abc/a/304/details",
    },
  ],
};

let failures = 0;
function check(name: string, ok: boolean, got?: unknown) {
  console.log(`${ok ? "ok  " : "FAIL"}  ${name}${ok ? "" : `  got ${JSON.stringify(got)}`}`);
  if (!ok) failures++;
}

(globalThis as any).fetch = async () => ({ ok: true, json: async () => payload });

const items = await getCourseAssignments("token", "123");

check("every published assignment is mapped", items.length === 3, items.length);
check("a draft is not shown, it is the tutor's business",
  !items.some((i) => i.title === "Not published yet"),
  items.map((i) => i.title));

const dated = items.find((i) => i.title === "Chapter 4 problems")!;
check("due date becomes an ISO day", dated.dueDate === "2026-09-05", dated.dueDate);
check("maxPoints survives", dated.maxPoints === 20, dated.maxPoints);
check("the Classroom page is the link", dated.link?.endsWith("/301/details") === true, dated.link);

check("a drive file keeps its title", dated.materials[0].title === "worksheet.pdf", dated.materials[0]);
check("a youtube video keeps its title", dated.materials[1].title === "Worked example", dated.materials[1]);
check("a bare link falls back to its url", dated.materials[2].title === "https://example.com/notes", dated.materials[2]);

const undated = items.find((i) => i.title === "Reading, no deadline")!;
check("a missing due date is null, not a wrong date", undated.dueDate === null, undated.dueDate);
check("missing maxPoints is null, not zero", undated.maxPoints === null, undated.maxPoints);
check("missing materials is an empty list", undated.materials.length === 0, undated.materials);

check("index is 1 based and in order",
  items.map((i) => i.index).join(",") === "1,2,3",
  items.map((i) => i.index));

console.log(failures === 0 ? "\nall passed" : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
