// ============================================================
// The last of the mock data, in one place.
//
// Everything here is still hardcoded because the real thing has not been built
// yet. Keeping it in a single module rather than scattered through the service
// layer means the remaining work is countable: when this file is empty, the app
// runs entirely on the database.
//
// What is left, and what each needs:
//
//   MOCK_DASHBOARD_SUMMARY
//     Drives the student and parent home screens. Needs a query joining
//     sessions, assignments and submissions for the signed-in student.
//
//   Diagnostics (src/services/diagnosticService.ts)
//     Not here because it is not hardcoded, but it stores results in
//     localStorage rather than Postgres, so results do not follow a user
//     between devices and a tutor cannot see them. Needs a
//     diagnostic_results table and a migration.
//
// Tracked in docs/PRODUCTION_UNMOCK_CHECKLIST.md.
// ============================================================

/** Stands in for network latency so loading states are visible while developing. */
export const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const MOCK_DASHBOARD_SUMMARY = {
  nextSession: {
    id: "s1",
    subject: "AP Calculus AB",
    tutor: "Dr. Alex",
    date: "Today, 4:00 PM",
    link: "https://zoom.us/j/mock",
    image: "/course_math_1782503062614.png",
  },
  homeworkDue: [
    { id: "h1", title: "Derivatives Practice", subject: "Calculus", due: "Tomorrow" },
    { id: "h2", title: "Kinematics Lab Report", subject: "Physics", due: "Friday" },
  ],
  progress: {
    completedSessions: 12,
    currentStreak: 4,
    overallGrade: "A-",
  },
  announcements: [{ id: "a1", title: "Upcoming SAT Prep Seminar", date: "Oct 15" }],
};
