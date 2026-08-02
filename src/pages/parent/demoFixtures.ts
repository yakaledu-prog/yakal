import type { LinkedChild } from "@/services/parentService";
import type { BillingData, CoursePackage, PackageSession } from "@/services/packageService";
import type { SavedCard } from "@/services/billingService";
import type { TutorAvailability } from "@/services/availability";
import type { CourseWithTutor } from "@/services/courseApplicationService";

// ============================================================
// Fixed data for the alternative screens.
//
// Those screens exist to show somebody a design, and a design shown against
// whatever happens to be in the database is a design shown badly: a week with
// no lessons in it, a plan with no tutor, an empty payment history. Reseeding
// or a migration should not change what a client sees.
//
// So they read from here instead. Nothing in this file is used by the real
// product, and nothing in the product reads it.
//
// Dates are worked out from today rather than written down. A fixed date is
// stale within a week, and a calendar showing last month is the exact thing
// this is meant to avoid. The content, the people, the prices and the pattern
// of bookings are all fixed.
// ============================================================

const TUTOR_ID = "demo-tutor-bethlehem";
const CHILD_AMEN = "demo-child-amen";
const CHILD_SELAM = "demo-child-selam";

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** `days` from today, as an ISO date. Negative for the past. */
function dayOffset(days: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return iso(d);
}

function session(id: string, days: number, startTime: string, status: string): PackageSession {
  return { id, date: dayOffset(days), startTime, durationMinutes: 60, status };
}

export const DEMO_CHILDREN: LinkedChild[] = [
  {
    id: CHILD_AMEN,
    full_name: "Amen Worku",
    avatar_url: null,
    grade_level: "Grade 11",
  },
  {
    id: CHILD_SELAM,
    full_name: "Selam Girma",
    avatar_url: null,
    grade_level: "Grade 9",
  },
];

const PACKAGES: CoursePackage[] = [
  {
    courseId: "demo-course-chemistry",
    courseTitle: "Chemistry, Grade 11 Foundations",
    subject: "Chemistry",
    thumbnailUrl: null,
    studentId: CHILD_AMEN,
    studentName: "Amen Worku",
    studentAvatarUrl: null,
    tutorId: TUTOR_ID,
    tutorName: "Bethlehem Alemu",
    tutorAvatarUrl: null,
    slotsPurchased: 8,
    slotsCompleted: 3,
    slotsUpcoming: 5,
    slotsUnscheduled: 0,
    totalPaidCents: 44000,
    pricePerSlotCents: 5500,
    lastPaidAt: new Date(Date.now() - 12 * 86_400_000).toISOString(),
    recurring: false,
    sessions: [
      session("s1", -14, "16:00", "completed"),
      session("s2", -11, "16:00", "completed"),
      session("s3", -7, "16:00", "completed"),
      session("s4", 1, "16:00", "upcoming"),
      session("s5", 4, "16:00", "upcoming"),
      session("s6", 8, "16:00", "upcoming"),
      session("s7", 11, "16:00", "upcoming"),
      session("s8", 15, "16:00", "upcoming"),
    ],
  },
  {
    courseId: "demo-course-maths",
    courseTitle: "Advanced Mathematics, University Entrance Prep",
    subject: "Mathematics",
    thumbnailUrl: null,
    studentId: CHILD_AMEN,
    studentName: "Amen Worku",
    studentAvatarUrl: null,
    tutorId: "demo-tutor-yared",
    tutorName: "Yared Mekonnen",
    tutorAvatarUrl: null,
    slotsPurchased: 4,
    slotsCompleted: 1,
    slotsUpcoming: 3,
    slotsUnscheduled: 0,
    totalPaidCents: 24000,
    pricePerSlotCents: 6000,
    lastPaidAt: new Date(Date.now() - 5 * 86_400_000).toISOString(),
    recurring: false,
    sessions: [
      session("s9", -6, "10:00", "completed"),
      session("s10", 2, "10:00", "upcoming"),
      session("s11", 9, "10:00", "upcoming"),
      session("s12", 16, "10:00", "upcoming"),
    ],
  },
  {
    courseId: "demo-course-english",
    courseTitle: "English Comprehension and Grammar",
    subject: "English",
    thumbnailUrl: null,
    studentId: CHILD_SELAM,
    studentName: "Selam Girma",
    studentAvatarUrl: null,
    tutorId: "demo-tutor-edom",
    tutorName: "Edom Tesfaye",
    tutorAvatarUrl: null,
    slotsPurchased: 6,
    slotsCompleted: 4,
    slotsUpcoming: 2,
    slotsUnscheduled: 0,
    totalPaidCents: 30000,
    pricePerSlotCents: 5000,
    lastPaidAt: new Date(Date.now() - 20 * 86_400_000).toISOString(),
    recurring: false,
    sessions: [
      session("s13", -21, "14:00", "completed"),
      session("s14", -14, "14:00", "completed"),
      session("s15", -9, "14:00", "completed"),
      session("s16", -2, "14:00", "completed"),
      session("s17", 3, "14:00", "upcoming"),
      session("s18", 10, "14:00", "upcoming"),
    ],
  },
];

export const DEMO_BILLING: BillingData = {
  packages: PACKAGES,
  invoices: [
    {
      id: "demo-inv-1",
      description: "Chemistry, Grade 11 Foundations with Bethlehem Alemu (4 sessions)",
      amountCents: 22000,
      status: "paid",
      createdAt: new Date(Date.now() - 12 * 86_400_000).toISOString(),
      paidAt: new Date(Date.now() - 12 * 86_400_000).toISOString(),
      studentId: CHILD_AMEN,
      studentName: "Amen Worku",
      courseId: "demo-course-chemistry",
    },
    {
      id: "demo-inv-2",
      description: "Advanced Mathematics, University Entrance Prep (4 sessions)",
      amountCents: 24000,
      status: "paid",
      createdAt: new Date(Date.now() - 5 * 86_400_000).toISOString(),
      paidAt: new Date(Date.now() - 5 * 86_400_000).toISOString(),
      studentId: CHILD_AMEN,
      studentName: "Amen Worku",
      courseId: "demo-course-maths",
    },
    {
      id: "demo-inv-3",
      description: "English Comprehension and Grammar with Edom Tesfaye (6 sessions)",
      amountCents: 30000,
      status: "paid",
      createdAt: new Date(Date.now() - 20 * 86_400_000).toISOString(),
      paidAt: new Date(Date.now() - 20 * 86_400_000).toISOString(),
      studentId: CHILD_SELAM,
      studentName: "Selam Girma",
      courseId: "demo-course-english",
    },
    {
      id: "demo-inv-4",
      description: "Chemistry, Grade 11 Foundations with Bethlehem Alemu (4 sessions)",
      amountCents: 22000,
      status: "paid",
      createdAt: new Date(Date.now() - 40 * 86_400_000).toISOString(),
      paidAt: new Date(Date.now() - 40 * 86_400_000).toISOString(),
      studentId: CHILD_AMEN,
      studentName: "Amen Worku",
      courseId: "demo-course-chemistry",
    },
    {
      id: "demo-inv-5",
      description: "Registration",
      amountCents: 5000,
      status: "open",
      createdAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
      paidAt: null,
      studentId: CHILD_SELAM,
      studentName: "Selam Girma",
      courseId: null,
    },
  ],
};

export const DEMO_CARDS: SavedCard[] = [
  { id: "demo-card-1", brand: "visa", last4: "4242", exp_month: 11, exp_year: 2027, isDefault: true },
  { id: "demo-card-2", brand: "mastercard", last4: "8210", exp_month: 3, exp_year: 2028, isDefault: false },
];

export const DEMO_COURSE: CourseWithTutor = {
  id: "demo-course-chemistry",
  title: "Chemistry, Grade 11 Foundations",
  subject: "Chemistry",
  description:
    "Bonding, stoichiometry and organic basics, worked through past national exam papers.",
  thumbnailUrl: null,
  priceCents: 5500,
  tutorPayoutCents: 3500,
  tutorId: TUTOR_ID,
  createdAt: new Date(),
  tutor: {
    id: TUTOR_ID,
    name: "Bethlehem Alemu",
    avatarUrl: null,
    bio: "Senior Chemistry and Physics tutor with 8 years of experience.",
    subjects: ["Chemistry", "Physics"],
    hourlyRate: 55,
    education: [
      {
        from: "2014",
        to: "2018",
        qualification: "B.Sc. in Chemistry",
        institution: "Addis Ababa University",
      },
    ],
    work_experience: [
      {
        from: "2018",
        role: "Chemistry Tutor",
        organisation: "Yakal Education Services",
        summary: "Eight years of one to one chemistry and physics, mostly exam preparation.",
      },
    ],
    certifications: [],
    languages: [
      { name: "Amharic", level: "Native" },
      { name: "English", level: "Fluent" },
    ],
  },
};

/**
 * A week with enough in it to look like a real tutor's, and enough gaps that
 * choosing means something. 13 rows, 8 AM to 8 PM, seven columns Sunday first.
 * Sunday is off.
 */
export const DEMO_AVAILABILITY: TutorAvailability = {
  tutor_id: TUTOR_ID,
  disabled_days: [0],
  time_grid: [
    // Sun Mon Tue Wed Thu Fri Sat
    [0, 1, 0, 1, 0, 1, 1], //  8 AM
    [0, 1, 1, 1, 1, 1, 1], //  9 AM
    [0, 1, 1, 0, 1, 1, 1], // 10 AM
    [0, 0, 1, 1, 1, 0, 1], // 11 AM
    [0, 1, 1, 1, 1, 1, 0], // 12 PM
    [0, 1, 0, 1, 0, 1, 0], //  1 PM
    [0, 1, 1, 1, 1, 1, 1], //  2 PM
    [0, 0, 1, 0, 1, 0, 1], //  3 PM
    [0, 1, 1, 1, 1, 1, 1], //  4 PM
    [0, 1, 1, 1, 1, 0, 0], //  5 PM
    [0, 0, 1, 0, 1, 0, 0], //  6 PM
    [0, 1, 0, 1, 0, 1, 0], //  7 PM
    [0, 0, 0, 0, 0, 0, 0], //  8 PM
  ],
};
