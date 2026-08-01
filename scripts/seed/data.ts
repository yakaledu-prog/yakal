// ============================================================
// The demo dataset.
//
// This is the file to edit when a feature needs sample data. It is the single
// source of truth for both the local stack and the hosted project, so what you
// see locally is what a tester sees online.
//
// Nothing here uses a hardcoded UUID. Rows point at people by email and the
// seeder resolves those to real ids at run time, so the same data applies to a
// database that has never been seeded before.
// ============================================================

import generatedData from "./generated.json" with { type: "json" };

export type Role = "student" | "tutor" | "parent" | "counselor" | "admin";

export interface SeedUser {
  /**
   * Fixed on purpose, and matching the hosted project.
   *
   * Without it every reseed minted new ids, which invalidated any session
   * still in a browser: the JWT kept working but its subject no longer
   * existed, so profile lookups 406'd and anything writing a foreign key to
   * auth.users failed. It also means an account is the same person whether you
   * are pointed at the local stack or the hosted one.
   */
  id: string;
  email: string;
  fullName: string;
  role: Role;
  /** Tutors and counselors normally start 'pending' until an admin approves. */
  status?: "active" | "pending" | "suspended" | "rejected";
  bio?: string;
  phone?: string;
  subjects?: string[];
  hourlyRate?: number;
  rateCurrency?: "ETB" | "USD";
  gradeLevel?: string;
  acceptingStudents?: boolean;
  isOnboarded?: boolean;
  avatarUrl?: string;
  /**
   * Staggers profiles.last_seen_at so the headers show a spread of "last seen"
   * values straight after seeding, rather than everyone being idle forever.
   * A real session overwrites it on the next heartbeat.
   */
  lastSeenMinutesAgo?: number;
}

/** Every demo account shares this password, matching the sign-in page shortcuts. */
export const DEMO_PASSWORD = "demo123";

// Profile pictures, served from Cloudinary under yakal/avatars.
//
// Bethlehem's and Daniel's are the photos that were actually uploaded to their
// profiles in the hosted project. The other three had no photo of their own;
// these are the placeholder portraits the app was already showing for them,
// mirrored to Cloudinary so nothing depends on the hosted project's storage
// bucket or on a third party staying up.
//
// The transform crops square around the detected face and lets Cloudinary pick
// the format, so one URL serves the 34px list row and the 96px contact card.
//
// To add or replace one: upload to the same folder with a matching public_id
// and paste the URL here.
const AVATAR_URLS: Record<string, string> = {
  "Amen Worku":
    "https://res.cloudinary.com/xzveklkp/image/upload/c_fill,g_face,w_400,h_400,q_auto,f_auto/v1785498447/yakal/avatars/student-amen-worku.jpg",
  "Bethlehem Alemu":
    "https://res.cloudinary.com/xzveklkp/image/upload/c_fill,g_face,w_400,h_400,q_auto,f_auto/v1785498443/yakal/avatars/tutor-bethlehem-alemu.webp",
  "Daniel Haile":
    "https://res.cloudinary.com/xzveklkp/image/upload/c_fill,g_face,w_400,h_400,q_auto,f_auto/v1785498445/yakal/avatars/counselor-daniel-haile.webp",
  "Tigist Worku":
    "https://res.cloudinary.com/xzveklkp/image/upload/c_fill,g_face,w_400,h_400,q_auto,f_auto/v1785498449/yakal/avatars/parent-tigist-worku.jpg",
  "Almaz Tadesse":
    "https://res.cloudinary.com/xzveklkp/image/upload/c_fill,g_face,w_400,h_400,q_auto,f_auto/v1785498450/yakal/avatars/admin-almaz-tadesse.jpg",
};

const avatarFor = (name: string) => AVATAR_URLS[name];

/**
 * Extra people and courses written by Gemini, via `npm run seed:generate`.
 *
 * Committed rather than generated at seed time: a fresh call every run would
 * give every developer a different database and break any test that names a
 * person. Regenerating is deliberate, and the file is reviewed like any other
 * change.
 *
 * The hand-written accounts below stay hand-written. They carry fixed ids that
 * match the hosted project and are what the verification suites sign in as, so
 * they are not the model's to rewrite.
 */
const generated = generatedData as {
  people: {
    id: string;
    email: string;
    fullName: string;
    role: Role;
    bio: string | null;
    subjects: string[] | null;
    gradeLevel: string | null;
  }[];
  courses: {
    title: string;
    subject: string;
    description: string;
    priceCents: number;
    tutorPayoutCents: number;
  }[];
};

export const USERS: SeedUser[] = [
  {
    id: "82b1793a-db13-49ee-a81a-9e02a5cb51fd",
    email: "admin@yakal.com",
    lastSeenMinutesAgo: 2880,
    fullName: "Almaz Tadesse",
    role: "admin",
    avatarUrl: avatarFor("Almaz Tadesse"),
    status: "active",
    isOnboarded: true,
    phone: "+251911000001",
  },
  {
    id: "39b5cc44-5ce1-4822-9414-01c27a9bb940",
    email: "tutor@yakal.com",
    lastSeenMinutesAgo: 12,
    fullName: "Bethlehem Alemu",
    role: "tutor",
    avatarUrl: avatarFor("Bethlehem Alemu"),
    status: "active",
    isOnboarded: true,
    bio: "Senior Mathematics and Physics tutor with 8 years of experience. Specializes in SAT Prep and University Entrance Exams.",
    phone: "+251911000002",
    subjects: ["Mathematics", "Physics", "SAT Prep"],
    hourlyRate: 450,
    rateCurrency: "ETB",
    acceptingStudents: true,
  },
  {
    id: "861ab9d4-186c-46c9-bbcf-ed392fe34343",
    email: "counselor@yakal.com",
    lastSeenMinutesAgo: 180,
    fullName: "Daniel Haile",
    role: "counselor",
    avatarUrl: avatarFor("Daniel Haile"),
    status: "active",
    isOnboarded: true,
    bio: "College admissions counselor. Helps students build a balanced school list and write essays that sound like them.",
    phone: "+251911000003",
    subjects: ["College Advising"],
  },
  {
    id: "9ef3ccc6-977b-44b2-8694-45c27d1e5a09",
    email: "student@yakal.com",
    lastSeenMinutesAgo: 4,
    fullName: "Amen Worku",
    role: "student",
    avatarUrl: avatarFor("Amen Worku"),
    status: "active",
    isOnboarded: true,
    gradeLevel: "Grade 12",
    phone: "+251911000004",
  },
  {
    // A second student, deliberately not linked to any parent. Without one
    // there was nothing for the add-a-child search to find: the only student
    // was already linked, and the function excludes those.
    id: "5c1f0a2e-9d3b-4a17-8f6c-2e7b41d0a933",
    email: "student2@yakal.com",
    lastSeenMinutesAgo: 45,
    fullName: "Selam Girma",
    role: "student",
    // No Cloudinary portrait for this one yet, so the UI falls back to the
    // generated avatar rather than pointing at an image that does not exist.
    avatarUrl: avatarFor("Selam Girma"),
    status: "active",
    isOnboarded: true,
    gradeLevel: "Grade 11",
    phone: "+251911000006",
  },
  {
    id: "1bcda665-40a3-40e3-b613-fcaf5ca93b9f",
    email: "parent@yakal.com",
    lastSeenMinutesAgo: 1500,
    fullName: "Tigist Worku",
    role: "parent",
    avatarUrl: avatarFor("Tigist Worku"),
    status: "active",
    isOnboarded: true,
    phone: "+251911000005",
  },
];

// The generated people, given the same shape as the hand-written ones. No
// avatar: there is no real photograph for an invented person, so the UI falls
// back to its generated one rather than pointing at a stranger.
USERS.push(
  ...generated.people.map((p) => ({
    id: p.id,
    email: p.email,
    fullName: p.fullName,
    role: p.role,
    status: "active" as const,
    isOnboarded: true,
    lastSeenMinutesAgo: 60 + Math.round(Math.random() * 4000),
    bio: p.bio ?? undefined,
    subjects: p.subjects ?? undefined,
    gradeLevel: p.gradeLevel ?? undefined,
    acceptingStudents: p.role === "tutor" ? true : undefined,
  }))
);

/**
 * Active parent to child links. Both sides are emails from USERS.
 *
 * `services` is what the parent has opted the child into. Without a row the
 * child is locked out of both, which is correct but made a fresh database
 * look broken: every admissions page showed "ask your parent to unlock it"
 * and the parent's own college views had nothing to show.
 */
export const PARENT_LINKS: {
  parent: string;
  student: string;
  services: ("tutoring" | "admissions")[];
}[] = [
  {
    parent: "parent@yakal.com",
    student: "student@yakal.com",
    services: ["tutoring", "admissions"],
  },
];

// ------------------------------------------------------------
// Tutor availability
//
// time_grid is 13 rows, one per hour from 8 AM through 8 PM, each holding 7
// values for Sunday through Saturday. 1 means free.
// ------------------------------------------------------------

const WEEKDAYS_ONLY = (hours: number[]): number[][] =>
  Array.from({ length: 13 }, (_, row) =>
    hours.includes(row + 8) ? [0, 1, 1, 1, 1, 1, 0] : [0, 0, 0, 0, 0, 0, 0]
  );

export const AVAILABILITY: { tutor: string; timeGrid: number[][]; disabledDays: number[] }[] = [
  {
    tutor: "tutor@yakal.com",
    timeGrid: WEEKDAYS_ONLY([8, 9, 10, 11, 13, 14, 15, 16, 17]),
    disabledDays: [0, 6],
  },
];

// ------------------------------------------------------------
// Courses
// ------------------------------------------------------------

export interface SeedCourse {
  title: string;
  subject: string;
  description: string;
  tutor?: string;
  thumbnailUrl?: string;
  priceCents?: number;
  tutorPayoutCents?: number;
  isActive?: boolean;
}

export const COURSES: SeedCourse[] = [
  {
    title: "Advanced Mathematics, University Entrance Prep",
    subject: "Mathematics",
    description:
      "Calculus, algebra, trigonometry and statistics, shaped around the Ethiopian University Entrance Examination.",
    tutor: "tutor@yakal.com",
    thumbnailUrl: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=800&q=80",
    priceCents: 6000,
    tutorPayoutCents: 4500,
  },
  {
    title: "Physics, Mechanics and Electromagnetism",
    subject: "Physics",
    description:
      "Classical mechanics and electromagnetism, taught through problem solving rather than lecture.",
    tutor: "tutor@yakal.com",
    thumbnailUrl: "https://images.unsplash.com/photo-1636466497217-26a8cbeaf0aa?w=800&q=80",
    priceCents: 6500,
    tutorPayoutCents: 5000,
  },
  // The catalog the parent browses. These were six hardcoded cards on
  // ParentCourses with invented ratings and student counts, pointing at ids
  // that did not exist, so every one of them led to a dead booking page.
  // Seeded now, which also puts them in front of admins and tutors.
  {
    title: "K-12 Mathematics",
    subject: "Mathematics",
    description:
      "Arithmetic through pre-calculus, taught at the pace the student actually needs rather than the one the timetable assumes.",
    thumbnailUrl: "https://images.unsplash.com/photo-1509228468518-180dd4864904?w=800&q=80",
    priceCents: 4999,
    tutorPayoutCents: 3500,
  },
  {
    title: "K-12 English Language Arts",
    subject: "English",
    description:
      "Reading, writing and analysis across the school years, with the writing feedback that makes the difference.",
    thumbnailUrl: "https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=800&q=80",
    priceCents: 8900,
    tutorPayoutCents: 6200,
  },
  {
    title: "Standardized Test Preparation",
    subject: "SAT Prep",
    description:
      "SAT and ACT preparation built around a diagnostic, so the time goes where the marks are.",
    thumbnailUrl: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=800&q=80",
    priceCents: 5500,
    tutorPayoutCents: 3900,
  },
  {
    title: "AP Subject Coaching",
    subject: "Other",
    description:
      "Advanced Placement coaching across the sciences and humanities, aimed squarely at the exam.",
    thumbnailUrl: "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=800&q=80",
    priceCents: 12000,
    tutorPayoutCents: 8400,
  },
  {
    title: "College Essay Writing",
    subject: "College Advising",
    description:
      "The personal statement and supplements, from a blank page to something that sounds like the student.",
    thumbnailUrl: "https://images.unsplash.com/photo-1455390582262-044cdead277a?w=800&q=80",
    priceCents: 3500,
    tutorPayoutCents: 2400,
  },
  {
    title: "Biology, Foundations and Exam Practice",
    subject: "Biology",
    description:
      "Cells, genetics and physiology, with the past-paper practice that turns knowing it into scoring it.",
    thumbnailUrl: "https://images.unsplash.com/photo-1530026186672-2cd00ffc50fe?w=800&q=80",
    priceCents: 5000,
    tutorPayoutCents: 3500,
  },
  {
    title: "Chemistry, Grade 11 Foundations",
    subject: "Chemistry",
    description:
      "Atomic structure, bonding and stoichiometry for the national exam.",
    thumbnailUrl: "https://images.unsplash.com/photo-1603126857599-f6e157fa2fe6?w=800&q=80",
    priceCents: 5500,
    tutorPayoutCents: 4000,
  },
  {
    title: "English Comprehension and Grammar",
    subject: "English",
    description:
      "Reading comprehension, grammar and the vocabulary the national exam actually tests.",
    thumbnailUrl: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=800&q=80",
    priceCents: 5000,
    tutorPayoutCents: 3500,
  },
];

// Generated courses join the catalog with no tutor, which is the state a real
// one starts in: an admin creates it and tutors apply.
COURSES.push(
  ...generated.courses.map((c) => ({
    title: c.title,
    subject: c.subject,
    description: c.description,
    priceCents: c.priceCents,
    tutorPayoutCents: c.tutorPayoutCents,
  }))
);

// ------------------------------------------------------------
// Conversations
//
// `daysAgo` and `at` place each message on a rolling timeline, so the demo
// data always looks recent no matter when it was seeded.
// ------------------------------------------------------------

export interface SeedMessage {
  from: string;
  text: string;
  daysAgo: number;
  /** 24 hour clock, e.g. "14:05". */
  at: string;
  read?: boolean;
}

export interface SeedConversation {
  between: [string, string];
  messages: SeedMessage[];
}

export const CONVERSATIONS: SeedConversation[] = [
  {
    between: ["tutor@yakal.com", "student@yakal.com"],
    messages: [
      { from: "tutor@yakal.com", text: "Hi Amen, how did the practice set go?", daysAgo: 3, at: "09:12", read: true },
      { from: "student@yakal.com", text: "Better than last time. I got stuck on question 7 though.", daysAgo: 3, at: "09:40", read: true },
      { from: "tutor@yakal.com", text: "That one catches everyone. Bring it on Thursday and we will work through it together.", daysAgo: 3, at: "09:44", read: true },
      { from: "student@yakal.com", text: "Sounds good, thank you", daysAgo: 2, at: "18:05", read: true },
      { from: "tutor@yakal.com", text: "Reminder: our session is at 4 PM tomorrow.", daysAgo: 0, at: "11:30" },
    ],
  },
  {
    between: ["tutor@yakal.com", "parent@yakal.com"],
    messages: [
      { from: "parent@yakal.com", text: "Good morning, how is Amen progressing?", daysAgo: 4, at: "08:15", read: true },
      { from: "tutor@yakal.com", text: "Good morning. He is steady on algebra now, and his exam timing has improved a lot.", daysAgo: 4, at: "08:52", read: true },
      { from: "parent@yakal.com", text: "That is a relief to hear. Thank you for the update.", daysAgo: 4, at: "09:03", read: true },
    ],
  },
  {
    between: ["counselor@yakal.com", "student@yakal.com"],
    messages: [
      { from: "counselor@yakal.com", text: "I read your draft essay. The opening is strong.", daysAgo: 5, at: "15:20", read: true },
      { from: "student@yakal.com", text: "Thank you. Should I keep the second paragraph?", daysAgo: 5, at: "16:02", read: true },
      { from: "counselor@yakal.com", text: "Keep it, but cut it in half. The story is doing the work, not the explanation.", daysAgo: 5, at: "16:30" },
    ],
  },
  {
    between: ["counselor@yakal.com", "parent@yakal.com"],
    messages: [
      { from: "parent@yakal.com", text: "When are the application deadlines?", daysAgo: 6, at: "12:10", read: true },
      { from: "counselor@yakal.com", text: "The first is 1 November. I will share the full list with you this week.", daysAgo: 6, at: "13:45", read: true },
    ],
  },
  {
    between: ["admin@yakal.com", "tutor@yakal.com"],
    messages: [
      { from: "admin@yakal.com", text: "Your profile is approved. You can start accepting students.", daysAgo: 8, at: "10:00", read: true },
      { from: "tutor@yakal.com", text: "Thank you, I have set my hours already.", daysAgo: 8, at: "10:26", read: true },
    ],
  },
  {
    between: ["admin@yakal.com", "student@yakal.com"],
    messages: [
      { from: "admin@yakal.com", text: "Welcome to Yakal. Reach out here if anything is unclear.", daysAgo: 9, at: "09:00", read: true },
    ],
  },
  // A pair with no history, so the empty conversation state is reachable.
  {
    between: ["admin@yakal.com", "parent@yakal.com"],
    messages: [],
  },
];

// ------------------------------------------------------------
// Blog posts
// ------------------------------------------------------------

export interface SeedBlogPost {
  title: string;
  thumbnailUrl: string;
  readTimeMinutes: number;
  status: "published" | "draft";
  sections: { heading: string | null; body: string }[];
}

export const BLOG_POSTS: SeedBlogPost[] = [
  {
    title: "5 Tips to Improve Math Grades",
    thumbnailUrl: "https://images.unsplash.com/photo-1518133835878-5a93ac3f0c0f?w=800&q=80",
    readTimeMinutes: 3,
    status: "published",
    sections: [
      {
        heading: null,
        body: "Many students struggle with maths not because they lack ability, but because they lack a consistent strategy. Small, manageable habits move understanding, confidence and grades together.",
      },
      {
        heading: "1. Practice in small daily sessions",
        body: "Short, consistent practice beats occasional long sessions. Ten to twenty minutes a day is enough. Build it into a routine after school or dinner.",
      },
      {
        heading: "2. Strengthen the fundamentals",
        body: "Most difficulty traces back to shaky basics: fractions, decimals, the order of operations, and reading a word problem carefully. Advanced topics get much easier once those are solid.",
      },
      {
        heading: "3. Encourage thinking aloud",
        body: "Students learn faster when they explain their reasoning. Ask them to walk through their steps out loud. It also earns partial credit in exams where working is marked.",
      },
      {
        heading: "4. Use real situations",
        body: "Totalling the shopping, comparing discounts, scaling a recipe. Real use answers the question of why any of it matters.",
      },
      {
        heading: "5. Work with a tutor",
        body: "A tutor can find the exact gap and close it directly, which is far quicker than waiting for the topic to come round again in class.",
      },
    ],
  },
  {
    title: "How to Build a Balanced College List",
    thumbnailUrl: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&q=80",
    readTimeMinutes: 4,
    status: "published",
    sections: [
      {
        heading: null,
        body: "A good list is not a ranking of the schools you like most. It is a spread that leaves you with a real choice in April.",
      },
      {
        heading: "Start with the safeties, not the reaches",
        body: "Two or three schools where your grades sit comfortably above the average, and which you would genuinely be happy to attend. If you would not go, it is not a safety.",
      },
      {
        heading: "Be honest about the reaches",
        body: "Reaches are worth applying to, but treat them as the upside rather than the plan. Three or four is plenty.",
      },
      {
        heading: "Check the money early",
        body: "Look at what each school offers international students before you apply, not after you are admitted. It changes the list more than anything else.",
      },
    ],
  },
];

// ------------------------------------------------------------
// The college profile for the demo student
//
// getCollegeProfile used to invent three colleges whenever a student's list
// came back empty, which is why the parent's application tracking and the
// counselor's view both showed MIT to everybody. The fallback is gone, so the
// data has to exist for real.
//
// Requirements are mostly derived, not stored: whether a transcript is on
// file, whether the essays for a college are done, how far the recommenders
// got. Only a hand override is written to application_requirements. So the
// academics, essays and recommendations below are what make the requirements
// matrix show anything.
// ------------------------------------------------------------

export interface SeedSchool {
  name: string;
  /** IPEDS unit id, so the row points at the catalog instead of a name string. */
  unitid: number | null;
  tier: "dream" | "target" | "safety";
  status: "considering" | "applying" | "submitted" | "accepted" | "rejected" | "waitlisted";
  /** Days from the seed date. Negative is a deadline already past. */
  deadlineInDays: number | null;
  deadlineRound: "ed1" | "ed2" | "ea" | "rea" | "rd" | "rolling" | null;
  applicationUrl?: string | null;
  suppEssayCount?: number | null;
  whySchool?: string | null;
  /** Hand overrides only. Everything else is worked out from the data. */
  completed?: string[];
}

export interface SeedEssay {
  title: string;
  kind: "personal_statement" | "supplement";
  /** Matches SeedSchool.name. Null for the Common App personal statement. */
  school: string | null;
  status: "todo" | "drafting" | "in_review" | "done";
  wordLimit?: number | null;
}

export interface SeedRecommender {
  name: string;
  email: string | null;
  relationship: string;
  status: "requested" | "received" | "submitted";
  askedDaysAgo?: number;
  ferpaWaived?: boolean;
}

export interface SeedCollegeProfile {
  student: string;
  counselor: string | null;
  stage: "research" | "apply" | "submitted" | "decisions" | "enrolled";
  programInterest: string;
  gradYear: number;
  fafsaSubmitted: boolean;
  cssSubmitted: boolean;
  academics: {
    gpa: number;
    gpaScale: number;
    satScore: number | null;
    actScore: number | null;
    toeflScore: number | null;
    apCourses: string[];
  };
  schools: SeedSchool[];
  essays: SeedEssay[];
  recommendations: SeedRecommender[];
  tasks: { title: string; status: "todo" | "in_progress" | "done"; dueInDays: number | null }[];
}

export const COLLEGE_PROFILES: SeedCollegeProfile[] = [
  {
    student: "student@yakal.com",
    counselor: "counselor@yakal.com",
    stage: "apply",
    programInterest: "Computer Science",
    gradYear: 2026,
    fafsaSubmitted: false,
    cssSubmitted: false,
    academics: {
      gpa: 3.82,
      gpaScale: 4.0,
      satScore: 1450,
      actScore: null,
      // An Ethiopian student applying abroad needs this, and it is the kind of
      // detail the invented data never had.
      toeflScore: 104,
      apCourses: ["AP Calculus BC", "AP Physics C", "AP Computer Science A"],
    },
    schools: [
      {
        name: "Massachusetts Institute of Technology",
        unitid: 166683,
        tier: "dream",
        status: "applying",
        deadlineInDays: 21,
        deadlineRound: "rd",
        applicationUrl: "https://apply.mitadmissions.org",
        suppEssayCount: 5,
        whySchool: "Undergraduate research from first year, and the strongest robotics work anywhere.",
      },
      {
        name: "Stanford University",
        unitid: 243744,
        tier: "dream",
        status: "considering",
        deadlineInDays: 34,
        deadlineRound: "rd",
        suppEssayCount: 8,
        whySchool: "CS and entrepreneurship in the same place.",
      },
      {
        name: "University of Toronto",
        unitid: null,
        tier: "target",
        status: "applying",
        deadlineInDays: 48,
        deadlineRound: "rolling",
        applicationUrl: "https://future.utoronto.ca/apply",
        suppEssayCount: 2,
        whySchool: "Strong CS, and far more affordable than the American privates.",
        completed: ["Application", "Transcript"],
      },
      {
        name: "University of Cape Town",
        unitid: null,
        tier: "target",
        status: "submitted",
        deadlineInDays: -6,
        deadlineRound: "rd",
        suppEssayCount: 0,
        whySchool: "Best engineering faculty on the continent, and a shorter flight home.",
        completed: ["Application", "Transcript", "Test scores"],
      },
      {
        name: "Addis Ababa University",
        unitid: null,
        tier: "safety",
        status: "submitted",
        deadlineInDays: -20,
        deadlineRound: "rolling",
        suppEssayCount: 0,
        whySchool: "Home, and a course I would be glad to take.",
        completed: ["Application", "Transcript", "Test scores"],
      },
    ],
    essays: [
      {
        title: "Common App personal statement",
        kind: "personal_statement",
        school: null,
        status: "done",
        wordLimit: 650,
      },
      {
        title: "MIT, what you build for fun",
        kind: "supplement",
        school: "Massachusetts Institute of Technology",
        status: "in_review",
        wordLimit: 200,
      },
      {
        title: "MIT, a challenge you faced",
        kind: "supplement",
        school: "Massachusetts Institute of Technology",
        status: "drafting",
        wordLimit: 200,
      },
      {
        title: "Toronto, statement of interest",
        kind: "supplement",
        school: "University of Toronto",
        status: "done",
        wordLimit: 400,
      },
      {
        title: "Toronto, supplementary essay",
        kind: "supplement",
        school: "University of Toronto",
        status: "done",
        wordLimit: 250,
      },
      {
        title: "Stanford, what matters to you",
        kind: "supplement",
        school: "Stanford University",
        status: "todo",
        wordLimit: 250,
      },
    ],
    recommendations: [
      {
        name: "Bethlehem Alemu",
        email: "tutor@yakal.com",
        relationship: "Mathematics and Physics tutor",
        status: "submitted",
        askedDaysAgo: 40,
        ferpaWaived: true,
      },
      {
        name: "Meseret Gebre",
        email: "m.gebre@school.edu.et",
        relationship: "English teacher, Grade 11 and 12",
        status: "received",
        askedDaysAgo: 26,
        ferpaWaived: true,
      },
      {
        name: "Yonas Bekele",
        email: "y.bekele@school.edu.et",
        relationship: "Head of school",
        status: "requested",
        askedDaysAgo: 9,
        ferpaWaived: true,
      },
    ],
    tasks: [
      { title: "Finish the second MIT supplement", status: "in_progress", dueInDays: 5 },
      { title: "Submit the FAFSA", status: "todo", dueInDays: 12 },
      { title: "Send SAT scores to Stanford", status: "todo", dueInDays: 18 },
      { title: "Ask Yonas to confirm he has the link", status: "todo", dueInDays: 3 },
      { title: "Request the official transcript", status: "done", dueInDays: null },
    ],
  },
];
