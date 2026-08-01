/**
 * Generate demo content with Gemini.
 *
 *   npm run seed:generate                 people and courses
 *   npm run seed:generate -- --people 12
 *   npm run seed:generate -- --dry-run    print it, write nothing
 *
 * What this is for, and what it is not for.
 *
 * The tedious part of a dataset is the prose: bios that sound like a person,
 * course descriptions that are not "Course about maths", messages that read
 * like two people talking. That is worth handing to a model.
 *
 * The structural part is not. Ids, foreign keys, timestamps and any column
 * with a CHECK constraint have exactly one correct answer, and a model will
 * cheerfully invent a subject that does not exist or an id that collides.
 * So the model is asked only for text, everything structural is computed
 * here, and every generated field is validated against the real constraint
 * before it is written. Anything that fails is dropped with a reason rather
 * than passed along to fail later inside a seed run.
 *
 * The output is committed. Generating on every seed would mean a different
 * database for every developer and a test suite that fails on the day the
 * model changes its mind, so this writes scripts/seed/generated.json and the
 * seeder reads that file. Regenerating is a deliberate act.
 */
import { config } from "dotenv";
import { createHash } from "crypto";
import { writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "../../.env") });

const args = process.argv.slice(2);
const flag = (name: string, fallback: number) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? Number(args[i + 1]) || fallback : fallback;
};
const dryRun = args.includes("--dry-run");

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error("\n  GEMINI_API_KEY is not set in .env\n");
  process.exit(1);
}

// A small model on purpose. This writes short biographies, not literature,
// and the quota is better spent elsewhere.
const MODEL = process.env.GEMINI_MODEL ?? "gemini-flash-lite-latest";

/** The only subjects the courses table will accept. */
const SUBJECTS = [
  "Mathematics", "Physics", "Chemistry", "SAT Prep",
  "College Advising", "English", "Biology", "Other",
] as const;

const GRADES = ["Grade 9", "Grade 10", "Grade 11", "Grade 12"] as const;

interface GeneratedPerson {
  fullName: string;
  role: "student" | "tutor" | "parent";
  bio?: string;
  subjects?: string[];
  gradeLevel?: string;
}

interface GeneratedCourse {
  title: string;
  subject: string;
  description: string;
}

async function ask(prompt: string, schema: object): Promise<any> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          // Structured output, so the reply is parsed rather than scraped out
          // of a paragraph of prose.
          responseMimeType: "application/json",
          responseSchema: schema,
          temperature: 1.0,
        },
      }),
    }
  );

  if (!res.ok) {
    throw new Error(`Gemini returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }

  const body = await res.json();
  const text = body?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no content");
  return JSON.parse(text);
}

/**
 * A stable id from an email.
 *
 * Deterministic so that regenerating does not orphan the rows a previous run
 * created, and so a reseed updates people rather than duplicating them.
 */
function idFor(email: string): string {
  const h = createHash("sha256").update(`yakal:${email}`).digest("hex");
  return [
    h.slice(0, 8),
    h.slice(8, 12),
    `5${h.slice(13, 16)}`,
    ((parseInt(h.slice(16, 18), 16) & 0x3f) | 0x80).toString(16) + h.slice(18, 20),
    h.slice(20, 32),
  ].join("-");
}

function emailFor(name: string, taken: Set<string>): string {
  const base = name.toLowerCase().normalize("NFD").replace(/[^a-z ]/g, "").trim().split(/\s+/).join(".");
  let email = `${base}@yakal.demo`;
  let n = 2;
  while (taken.has(email)) email = `${base}${n++}@yakal.demo`;
  taken.add(email);
  return email;
}

async function main() {
  const peopleCount = flag("people", 9);
  const courseCount = flag("courses", 5);

  console.log(`\nGenerating with ${MODEL}`);

  // ---------- people ----------
  const people: GeneratedPerson[] = await ask(
    `Invent ${peopleCount} people for an Ethiopian online tutoring platform based in Addis Ababa.
Mix of roles: about half students, a third tutors, the rest parents.
Use realistic Ethiopian names (Amharic, Oromo, Tigrinya origins). Do not reuse these names:
Amen Worku, Bethlehem Alemu, Daniel Haile, Tigist Worku, Almaz Tadesse, Selam Girma.

For tutors write a two-sentence bio in the first person about what they teach and how, and pick one to three subjects from exactly this list: ${SUBJECTS.join(", ")}.
For students give a grade level from exactly: ${GRADES.join(", ")}, and no bio.
For parents give neither a bio nor subjects.
Write plain English with no em dashes and no emoji.`,
    {
      type: "object",
      properties: {
        people: {
          type: "array",
          items: {
            type: "object",
            properties: {
              fullName: { type: "string" },
              role: { type: "string", enum: ["student", "tutor", "parent"] },
              bio: { type: "string" },
              subjects: { type: "array", items: { type: "string" } },
              gradeLevel: { type: "string" },
            },
            required: ["fullName", "role"],
          },
        },
      },
      required: ["people"],
    }
  ).then((r) => r.people ?? []);

  // ---------- courses ----------
  const courses: GeneratedCourse[] = await ask(
    `Invent ${courseCount} tutoring courses for Ethiopian secondary school students preparing for the
Ethiopian University Entrance Examination and for applications abroad.
Each needs a title, a subject taken from exactly this list: ${SUBJECTS.join(", ")},
and a one-sentence description of what it covers and who it suits.
Do not reuse these titles: K-12 Mathematics, Advanced Mathematics, Physics, Chemistry, Biology, College Essay Writing.
Write plain English with no em dashes and no emoji.`,
    {
      type: "object",
      properties: {
        courses: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              subject: { type: "string" },
              description: { type: "string" },
            },
            required: ["title", "subject", "description"],
          },
        },
      },
      required: ["courses"],
    }
  ).then((r) => r.courses ?? []);

  // ---------- validate ----------
  // Everything below is the reason this file exists. The model is asked for
  // text and given the allowed values, but it is not trusted with them.
  const rejected: string[] = [];
  const taken = new Set<string>();

  const validPeople = people
    .filter((p) => {
      if (!p.fullName?.trim() || !["student", "tutor", "parent"].includes(p.role)) {
        rejected.push(`person "${p.fullName ?? "?"}": missing name or bad role`);
        return false;
      }
      return true;
    })
    .map((p) => {
      const email = emailFor(p.fullName, taken);
      const subjects = (p.subjects ?? []).filter((s) => (SUBJECTS as readonly string[]).includes(s));
      if ((p.subjects ?? []).length !== subjects.length) {
        rejected.push(`person "${p.fullName}": dropped subjects outside the allowed list`);
      }
      const grade = (GRADES as readonly string[]).includes(p.gradeLevel ?? "")
        ? p.gradeLevel
        : p.role === "student"
          ? "Grade 11"
          : undefined;
      if (p.role === "student" && grade !== p.gradeLevel) {
        rejected.push(`person "${p.fullName}": grade "${p.gradeLevel}" is not a real grade, used Grade 11`);
      }

      return {
        id: idFor(email),
        email,
        fullName: p.fullName.trim(),
        role: p.role,
        bio: p.role === "tutor" ? (p.bio?.trim() || null) : null,
        subjects: p.role === "tutor" && subjects.length > 0 ? subjects : null,
        gradeLevel: p.role === "student" ? grade : null,
      };
    });

  const validCourses = courses
    .filter((c) => {
      if (!(SUBJECTS as readonly string[]).includes(c.subject)) {
        rejected.push(`course "${c.title}": subject "${c.subject}" would fail courses_subject_check`);
        return false;
      }
      if (!c.title?.trim() || !c.description?.trim()) {
        rejected.push(`course "${c.title ?? "?"}": missing title or description`);
        return false;
      }
      return true;
    })
    .map((c) => ({
      title: c.title.trim(),
      subject: c.subject,
      description: c.description.trim(),
      // Priced here, not by the model. Money is not a thing to invent.
      priceCents: 4000 + Math.round(Math.random() * 8) * 500,
      tutorPayoutCents: 0,
    }))
    .map((c) => ({ ...c, tutorPayoutCents: Math.round(c.priceCents * 0.7) }));

  const output = {
    generatedAt: new Date().toISOString(),
    model: MODEL,
    people: validPeople,
    courses: validCourses,
  };

  console.log(`\n  ${validPeople.length} people, ${validCourses.length} courses`);
  for (const p of validPeople) console.log(`    ${p.role.padEnd(7)} ${p.fullName}  <${p.email}>`);
  for (const c of validCourses) console.log(`    course  ${c.title} (${c.subject})`);

  if (rejected.length > 0) {
    console.log(`\n  Rejected or corrected, because the schema would not have taken it:`);
    for (const r of rejected) console.log(`    ${r}`);
  }

  if (dryRun) {
    console.log("\n  --dry-run: nothing written\n");
    return;
  }

  const path = join(__dirname, "generated.json");
  writeFileSync(path, JSON.stringify(output, null, 2) + "\n");
  console.log(`\n  Written to scripts/seed/generated.json`);
  console.log(`  Commit it: the seeder reads this file so every database matches.\n`);
}

main().catch((err) => {
  console.error(`\n  Generation failed: ${err.message}\n`);
  process.exit(1);
});
