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

export type Role = "student" | "tutor" | "parent" | "counselor" | "admin";

export interface SeedUser {
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

export const USERS: SeedUser[] = [
  {
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

/** Active parent to child links. Both sides are emails from USERS. */
export const PARENT_LINKS: { parent: string; student: string }[] = [
  { parent: "parent@yakal.com", student: "student@yakal.com" },
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
