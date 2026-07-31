/**
 * Seeds a Yakal database with the demo dataset in scripts/seed/data.ts.
 *
 *   npm run db:seed                    the local Docker stack
 *   npm run db:seed:remote -- --yes    the hosted project
 *   npm run db:seed -- --fresh         wipe the demo rows first, then reseed
 *
 * Safe to run repeatedly. Accounts are matched by email and updated rather
 * than duplicated; courses by title; conversations by the pair of people in
 * them. Messages are only written into a conversation that has none, so a real
 * exchange during testing is never overwritten. Use --fresh to start over.
 *
 * The same script serves both targets on purpose. Two seed paths drift, and
 * then a bug only reproduces in one place.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import {
  AVAILABILITY,
  BLOG_POSTS,
  CONVERSATIONS,
  COURSES,
  DEMO_PASSWORD,
  PARENT_LINKS,
  USERS,
  type SeedBlogPost,
} from "./seed/data.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env") });

// ---------- target ----------

type Target = "local" | "remote";

const args = process.argv.slice(2);
const target: Target = args.includes("--target=remote") || args.includes("remote") ? "remote" : "local";
const fresh = args.includes("--fresh");
const confirmed = args.includes("--yes") || process.env.SEED_CONFIRM === "yes";

function env(...names: string[]): string | undefined {
  for (const n of names) if (process.env[n]) return process.env[n];
  return undefined;
}

const LOCAL_URL = env("VITE_SUPABASE_LOCAL_URL") ?? "http://127.0.0.1:54321";
// The service key the CLI issues for every local stack. Local only, no secret.
const LOCAL_SERVICE_KEY =
  env("SUPABASE_LOCAL_SERVICE_ROLE_KEY") ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const url = target === "local" ? LOCAL_URL : env("SUPABASE_URL", "VITE_SUPABASE_URL");
const serviceKey = target === "local" ? LOCAL_SERVICE_KEY : env("SUPABASE_SERVICE_ROLE_KEY");

if (!url || !serviceKey) {
  console.error(
    target === "local"
      ? "Local stack credentials missing. Start it with `npm run db:start`."
      : "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for the hosted project."
  );
  process.exit(1);
}

// Writing demo accounts with a published password into the hosted project is
// not something to do by accident.
if (target === "remote" && !confirmed) {
  console.error(
    [
      "",
      "  Refusing to seed the hosted project without confirmation.",
      `  Target: ${url}`,
      "",
      "  Seeding rewrites profiles and can add conversations, so make sure",
      "  this is the database you meant. Re-run with --yes to go ahead.",
      "",
    ].join("\n")
  );
  process.exit(1);
}

const db: SupabaseClient = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---------- helpers ----------

let stepNo = 0;
const step = (label: string) => console.log(`\n[${++stepNo}] ${label}`);
const ok = (msg: string) => console.log(`    ${msg}`);

function fail(context: string, error: unknown): never {
  console.error(`\nFailed while ${context}:`);
  console.error(error);
  process.exit(1);
}

/** A timestamp `daysAgo` days back at wall-clock time `at` ("14:05"). */
function timestamp(daysAgo: number, at: string): string {
  const [h, m] = at.split(":").map(Number);
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

function blogHtml(post: SeedBlogPost): string {
  return post.sections
    .map((s) => (s.heading ? `<h2>${s.heading}</h2>` : "") + `<p>${s.body}</p>`)
    .join("");
}

// ---------- 1. accounts ----------

/** email -> user id, for everything downstream. */
const idByEmail = new Map<string, string>();

async function loadExistingUsers() {
  // The admin API has no lookup by email, so page through once and index.
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) fail("listing existing accounts", error);
    for (const u of data.users) if (u.email) idByEmail.set(u.email.toLowerCase(), u.id);
    if (data.users.length < 200) break;
  }
}

async function seedUsers() {
  step("Accounts");
  await loadExistingUsers();

  for (const u of USERS) {
    const key = u.email.toLowerCase();
    const existing = idByEmail.get(key);

    if (existing) {
      // Reset the password so a demo account is always usable, and keep the
      // metadata the profile trigger reads in step with the dataset.
      const { error } = await db.auth.admin.updateUserById(existing, {
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: u.fullName, role: u.role, avatar_url: u.avatarUrl },
      });
      if (error) fail(`updating ${u.email}`, error);
      ok(`kept    ${u.email}`);
    } else {
      const { data, error } = await db.auth.admin.createUser({
        email: u.email,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: u.fullName, role: u.role, avatar_url: u.avatarUrl },
      });
      if (error) fail(`creating ${u.email}`, error);
      idByEmail.set(key, data.user.id);
      ok(`created ${u.email}`);
    }
  }
}

function idFor(email: string): string {
  const id = idByEmail.get(email.toLowerCase());
  if (!id) fail("resolving accounts", new Error(`${email} is not in the dataset`));
  return id;
}

// ---------- 2. profiles ----------

async function seedProfiles() {
  step("Profiles");
  // public.handle_new_user() creates the row on signup; this fills in the rest
  // and is what makes a re-run converge on the dataset.
  const rows = USERS.map((u) => ({
    id: idFor(u.email),
    email: u.email,
    full_name: u.fullName,
    role: u.role,
    status: u.status ?? "active",
    avatar_url: u.avatarUrl ?? null,
    bio: u.bio ?? null,
    phone: u.phone ?? null,
    subjects: u.subjects ?? null,
    hourly_rate: u.hourlyRate ?? null,
    rate_currency: u.rateCurrency ?? "ETB",
    grade_level: u.gradeLevel ?? null,
    accepting_students: u.acceptingStudents ?? true,
    is_onboarded: u.isOnboarded ?? true,
  }));

  const { error } = await db.from("profiles").upsert(rows, { onConflict: "id" });
  if (error) fail("upserting profiles", error);
  ok(`${rows.length} profiles`);
}

// ---------- 3. parent links ----------

async function seedParentLinks() {
  step("Parent and child links");
  for (const link of PARENT_LINKS) {
    const parent_id = idFor(link.parent);
    const student_id = idFor(link.student);

    const { data: existing, error: findErr } = await db
      .from("parent_student_links")
      .select("id")
      .eq("parent_id", parent_id)
      .eq("student_id", student_id)
      .maybeSingle();
    if (findErr) fail("reading parent links", findErr);

    if (existing) {
      const { error } = await db
        .from("parent_student_links")
        .update({ status: "active" })
        .eq("id", existing.id);
      if (error) fail("updating a parent link", error);
    } else {
      const { error } = await db
        .from("parent_student_links")
        .insert({ parent_id, student_id, status: "active" });
      if (error) fail("inserting a parent link", error);
    }
    ok(`${link.parent} -> ${link.student}`);
  }
}

// ---------- 4. availability ----------

async function seedAvailability() {
  step("Tutor availability");
  for (const a of AVAILABILITY) {
    const { error } = await db.from("tutor_availability").upsert(
      {
        tutor_id: idFor(a.tutor),
        time_grid: a.timeGrid,
        disabled_days: a.disabledDays,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tutor_id" }
    );
    if (error) fail("upserting availability", error);
    ok(a.tutor);
  }
}

// ---------- 5. courses ----------

async function seedCourses() {
  step("Courses");
  for (const c of COURSES) {
    const row = {
      title: c.title,
      subject: c.subject,
      description: c.description,
      tutor_id: c.tutor ? idFor(c.tutor) : null,
      thumbnail_url: c.thumbnailUrl ?? null,
      price_cents: c.priceCents ?? null,
      tutor_payout_cents: c.tutorPayoutCents ?? null,
      is_active: c.isActive ?? true,
    };

    const { data: existing, error: findErr } = await db
      .from("courses")
      .select("id")
      .eq("title", c.title)
      .maybeSingle();
    if (findErr) fail("reading courses", findErr);

    const { error } = existing
      ? await db.from("courses").update(row).eq("id", existing.id)
      : await db.from("courses").insert(row);
    if (error) fail(`writing course "${c.title}"`, error);
    ok(`${existing ? "updated" : "created"} ${c.title}`);
  }
}

// ---------- 6. conversations ----------

/** The id of the two-person conversation for this pair, creating it if needed. */
async function conversationFor(aId: string, bId: string): Promise<string> {
  const { data: mine, error: mineErr } = await db
    .from("conversation_participants")
    .select("conversation_id")
    .eq("user_id", aId);
  if (mineErr) fail("reading conversations", mineErr);

  const candidates = (mine ?? []).map((r) => r.conversation_id);
  if (candidates.length) {
    const { data: shared, error: sharedErr } = await db
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", bId)
      .in("conversation_id", candidates);
    if (sharedErr) fail("matching a conversation", sharedErr);
    if (shared?.length) return shared[0].conversation_id;
  }

  const { data: created, error: createErr } = await db
    .from("conversations")
    .insert({})
    .select("id")
    .single();
  if (createErr) fail("creating a conversation", createErr);

  const { error: partErr } = await db.from("conversation_participants").insert([
    { conversation_id: created.id, user_id: aId },
    { conversation_id: created.id, user_id: bId },
  ]);
  if (partErr) fail("adding participants", partErr);

  return created.id;
}

async function seedConversations() {
  step("Conversations");
  for (const conv of CONVERSATIONS) {
    const [aEmail, bEmail] = conv.between;
    const conversationId = await conversationFor(idFor(aEmail), idFor(bEmail));

    const { count, error: countErr } = await db
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", conversationId);
    if (countErr) fail("counting messages", countErr);

    if (count && count > 0) {
      ok(`skipped ${aEmail} and ${bEmail}, ${count} messages already there`);
      continue;
    }

    if (conv.messages.length === 0) {
      ok(`empty   ${aEmail} and ${bEmail}`);
      continue;
    }

    const rows = conv.messages.map((m) => ({
      conversation_id: conversationId,
      sender_id: idFor(m.from),
      content: m.text,
      type: "text",
      is_read: m.read ?? false,
      created_at: timestamp(m.daysAgo, m.at),
    }));

    const { error } = await db.from("messages").insert(rows);
    if (error) fail("inserting messages", error);

    const last = rows[rows.length - 1].created_at;
    const { error: touchErr } = await db
      .from("conversations")
      .update({ updated_at: last })
      .eq("id", conversationId);
    if (touchErr) fail("updating a conversation timestamp", touchErr);

    ok(`seeded  ${aEmail} and ${bEmail}, ${rows.length} messages`);
  }
}

// ---------- 7. blog posts ----------

async function seedBlogPosts() {
  step("Blog posts");
  for (const post of BLOG_POSTS) {
    const row = {
      title: post.title,
      content: blogHtml(post),
      thumbnail_url: post.thumbnailUrl,
      read_time_minutes: post.readTimeMinutes,
      status: post.status,
    };

    const { data: existing, error: findErr } = await db
      .from("blog_posts")
      .select("id")
      .eq("title", post.title)
      .maybeSingle();
    if (findErr) fail("reading blog posts", findErr);

    const { error } = existing
      ? await db.from("blog_posts").update(row).eq("id", existing.id)
      : await db.from("blog_posts").insert(row);
    if (error) fail(`writing post "${post.title}"`, error);
    ok(`${existing ? "updated" : "created"} ${post.title}`);
  }
}

// ---------- --fresh ----------

async function wipeDemoData() {
  step("Clearing existing demo data (--fresh)");
  const ids = USERS.map((u) => idFor(u.email));

  const { data: parts } = await db
    .from("conversation_participants")
    .select("conversation_id")
    .in("user_id", ids);
  const conversationIds = [...new Set((parts ?? []).map((p) => p.conversation_id))];

  if (conversationIds.length) {
    // messages and participants cascade from conversations
    const { error } = await db.from("conversations").delete().in("id", conversationIds);
    if (error) fail("deleting conversations", error);
    ok(`${conversationIds.length} conversations`);
  }

  for (const [table, column] of [
    ["courses", "title"],
    ["blog_posts", "title"],
  ] as const) {
    const titles = table === "courses" ? COURSES.map((c) => c.title) : BLOG_POSTS.map((b) => b.title);
    const { error } = await db.from(table).delete().in(column, titles);
    if (error) fail(`clearing ${table}`, error);
    ok(`${table} entries from the dataset`);
  }
}

// ---------- run ----------

async function main() {
  console.log(`\nSeeding the ${target} database`);
  console.log(`  ${url}`);
  if (fresh) console.log("  --fresh: demo rows will be cleared first");

  await seedUsers();
  if (fresh) await wipeDemoData();
  await seedProfiles();
  await seedParentLinks();
  await seedAvailability();
  await seedCourses();
  await seedConversations();
  await seedBlogPosts();

  console.log(`\nDone. ${USERS.length} accounts, all with the password "${DEMO_PASSWORD}".\n`);
}

main().catch((err) => fail("seeding", err));
