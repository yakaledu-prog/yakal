import type { NotificationTemplate } from "../types";

/** A tutor applied to teach a course. */
export const courseApplication: NotificationTemplate<{
  tutorName: string;
  courseTitle: string;
}> = {
  type: "course_application",
  label: "Course application",
  notification: (v) => ({
    title: "New application",
    message: `${v.tutorName} applied to teach ${v.courseTitle}.`,
    link: "/admin/courses",
  }),
  email: (v) => ({
    subject: `${v.tutorName} applied to teach ${v.courseTitle}`,
    heading: "A tutor has applied",
    intro:
      `${v.tutorName} has applied to teach ${v.courseTitle}. Their CV, subjects and rate are ` +
      `on the application, and the course cannot be booked by a family until somebody is ` +
      `assigned to it.`,
    facts: [
      { label: "Applicant", value: v.tutorName },
      { label: "Course", value: v.courseTitle },
    ],
    cta: { label: "Review the application", url: "/admin/courses" },
    footer: null,
  }),
  sample: {
    tutorName: "Bethlehem Alemu",
    courseTitle: "Advanced Mathematics, University Entrance Prep",
  },
};

/** The applicant hears back. */
export const courseApplicationDecided: NotificationTemplate<{
  tutorName: string;
  courseTitle: string;
  accepted: boolean;
}> = {
  type: "course_application_decided",
  label: "Course application decision",
  notification: (v) => ({
    title: v.accepted ? "You got the course" : "Course application closed",
    message: v.accepted
      ? `You are now teaching ${v.courseTitle}.`
      : `${v.courseTitle} has gone to another tutor.`,
    link: "/tutor/my-courses",
  }),
  email: (v) => ({
    subject: v.accepted
      ? `You are teaching ${v.courseTitle}`
      : `About your application for ${v.courseTitle}`,
    heading: v.accepted ? "The course is yours" : "Your application",
    intro: v.accepted
      ? `You are now the tutor on ${v.courseTitle}, ${v.tutorName}. Families can book you ` +
        `from here, which means the first thing worth doing is opening the hours you are ` +
        `willing to teach. Nobody can book an hour you have not published.`
      : `Thank you for applying to teach ${v.courseTitle}, ${v.tutorName}. It has gone to ` +
        `another tutor this time. Courses open regularly and applying again costs you nothing.`,
    facts: [
      { label: "Course", value: v.courseTitle },
      { label: "Decision", value: v.accepted ? "Accepted" : "Not this time" },
    ],
    cta: v.accepted
      ? { label: "Set your availability", url: "/tutor/calendar" }
      : { label: "See open courses", url: "/tutor/find-courses" },
    footer: null,
  }),
  sample: {
    tutorName: "Bethlehem Alemu",
    courseTitle: "Advanced Mathematics, University Entrance Prep",
    accepted: true,
  },
};

/** Money recorded against a tutor's completed sessions. */
export const payout: NotificationTemplate<{
  tutorName: string;
  amount: string;
  sessionCount: number;
  period: string;
}> = {
  type: "payout",
  label: "Payout recorded",
  notification: (v) => ({
    title: "Payout recorded",
    message: `${v.amount} for ${v.sessionCount} ${v.sessionCount === 1 ? "session" : "sessions"}, ${v.period}.`,
    link: "/tutor/earnings",
  }),
  email: (v) => ({
    subject: `Payout recorded: ${v.amount}`,
    heading: "A payout has been recorded",
    intro:
      `${v.amount} has been recorded against ${v.sessionCount} completed ` +
      `${v.sessionCount === 1 ? "session" : "sessions"} for ${v.period}, ${v.tutorName}. ` +
      `Earnings lists every session that made it up, so the figure can be checked rather ` +
      `than taken on trust.`,
    facts: [
      { label: "Amount", value: v.amount },
      { label: "Sessions", value: String(v.sessionCount) },
      { label: "Period", value: v.period },
    ],
    cta: { label: "See the breakdown", url: "/tutor/earnings" },
    footer: "If a session you taught is missing from that list, tell us before it is paid.",
  }),
  sample: {
    tutorName: "Bethlehem Alemu",
    amount: "$420.00",
    sessionCount: 6,
    period: "July",
  },
};
