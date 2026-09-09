import type { NotificationTemplate } from "../types";

/** A tutor applied to teach a course. */
export const courseApplication: NotificationTemplate<{
  tutorName: string;
  courseTitle: string;
  /** Optional, so a row written before this existed still renders. */
  courseId?: string;
}> = {
  type: "course_application",
  label: "Course application",
  notification: (v) => ({
    title: "New application",
    message: `${v.tutorName} applied to teach ${v.courseTitle}.`,
    link: v.courseId ? `/admin/courses/${v.courseId}` : "/admin/courses",
  }),
  email: (v) => ({
    subject: `${v.tutorName} applied to teach ${v.courseTitle}`,
    heading: "A tutor has applied",
    intro:
      `${v.tutorName} has applied to teach ${v.courseTitle}. Their resume, subjects and rate are ` +
      `on the application. A course can carry several tutors, so accepting them adds ` +
      `${v.tutorName} to it rather than closing it to anybody else who has applied.`,
    facts: [
      { label: "Applicant", value: v.tutorName },
      { label: "Course", value: v.courseTitle },
    ],
    cta: {
      label: "Review the application",
      url: v.courseId ? `/admin/courses/${v.courseId}` : "/admin/courses",
    },
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
    title: v.accepted ? "You are on the course" : "Application not accepted",
    message: v.accepted
      ? `You can now be booked for ${v.courseTitle}.`
      : `Your application to teach ${v.courseTitle} was not accepted.`,
    // /tutor/courses. This said /tutor/my-courses, which is not a route, so
    // opening the notification landed on a not-found page.
    link: "/tutor/courses",
  }),
  email: (v) => ({
    subject: v.accepted
      ? `You are teaching ${v.courseTitle}`
      : `About your application for ${v.courseTitle}`,
    heading: v.accepted ? "The course is yours to teach" : "Your application",
    intro: v.accepted
      ? `You are now on ${v.courseTitle}, ${v.tutorName}. Families choosing this course see ` +
        `you alongside the other tutors on it and pick who they want, so the first thing ` +
        `worth doing is opening the hours you are willing to teach. Nobody can book an hour ` +
        `you have not published, and a tutor with an empty week is one a family scrolls past.`
      : `Thank you for applying to teach ${v.courseTitle}, ${v.tutorName}. It was not ` +
        `accepted this time. A course can carry several tutors, so this is a decision about ` +
        `the application rather than the course being taken, and applying again once ` +
        `anything on your profile has changed costs you nothing.`,
    facts: [
      { label: "Course", value: v.courseTitle },
      { label: "Decision", value: v.accepted ? "Accepted" : "Not accepted" },
    ],
    cta: v.accepted
      ? { label: "Set your availability", url: "/tutor/calendar" }
      : { label: "See open courses", url: "/tutor/find-courses" },
    footer: v.accepted
      ? "Your resume and subjects are what a family reads when they are choosing between tutors on this course."
      : null,
  }),
  sample: {
    tutorName: "Bethlehem Alemu",
    courseTitle: "Advanced Mathematics, University Entrance Prep",
    accepted: true,
  },
};

/** Money recorded against a tutor's completed sessions. */
/**
 * Money moved to a payee's bank.
 *
 * Two shapes of the same event. A run of the job records a period's earnings;
 * a transfer names the reference somebody checks their statement against.
 * Both are "you have been paid", and the reference is the fact that matters,
 * so it is the one thing worth keeping out of a paragraph.
 */
export const payout: NotificationTemplate<{
  /** A counsellor's earnings live under a different path to a tutor's. */
  audience?: "tutor" | "counselor";
  tutorName: string;
  amount: string;
  /** Present when this came from a transfer. Checked against a statement. */
  reference?: string | null;
  sessionCount?: number;
  period?: string;
}> = {
  type: "payout",
  label: "Payout recorded",
  notification: (v) => ({
    title: v.reference ? "You have been paid" : "Payout recorded",
    message: v.reference
      ? `${v.amount} is on its way. Reference ${v.reference}.`
      : `${v.amount} for ${v.sessionCount ?? 0} ${v.sessionCount === 1 ? "session" : "sessions"}, ${v.period ?? "this period"}.`,
    link: v.audience === "counselor" ? "/counselor/earnings" : "/tutor/earnings",
  }),
  email: (v) => ({
    subject: `Payout: ${v.amount}`,
    heading: v.reference ? "Your money is on its way" : "A payout has been recorded",
    intro: v.reference
      ? `${v.amount} has been sent to the account on file, ${v.tutorName}. Banks take a few ` +
        `days over this, so it will not appear immediately. The reference below is what to ` +
        `match it against on your statement.`
      : `${v.amount} has been recorded against ${v.sessionCount ?? 0} completed ` +
        `${v.sessionCount === 1 ? "session" : "sessions"} for ${v.period ?? "this period"}, ` +
        `${v.tutorName}. Earnings lists every session that made it up, so the figure can be ` +
        `checked rather than taken on trust.`,
    facts: [
      { label: "Amount", value: v.amount },
      ...(v.reference ? [{ label: "Reference", value: v.reference }] : []),
      ...(v.sessionCount != null ? [{ label: "Sessions", value: String(v.sessionCount) }] : []),
      ...(v.period ? [{ label: "Period", value: v.period }] : []),
    ],
    cta: {
      label: "See the breakdown",
      url: v.audience === "counselor" ? "/counselor/earnings" : "/tutor/earnings",
    },
    footer: "If a session you delivered is missing from that list, tell us before it is paid.",
  }),
  sample: {
    audience: "tutor",
    tutorName: "Bethlehem Alemu",
    amount: "$420.00",
    reference: "tr_1QxYzAbCdEfGhIjK",
    sessionCount: 6,
    period: "July",
  },
};

/**
 * Money is owed and has nowhere to go.
 *
 * The release job leaves an earning pending when the payee has no connected
 * Stripe account, which is right: the money is still theirs and moves on its
 * own the day they finish onboarding. Nobody was told, so it simply sat there
 * and the first sign was a tutor asking why they had not been paid.
 *
 * Said once per earning, latched on payout_blocked_notified_at, because the
 * job runs hourly.
 */
export const payoutBlocked: NotificationTemplate<{
  audience?: "tutor" | "counselor";
  amount: string;
}> = {
  type: "payout",
  label: "Payout waiting on your bank",
  notification: (v) => ({
    title: "Your money is waiting",
    message: `${v.amount} is ready but there is no bank account to send it to. Connect one and it goes out on the next run.`,
    link: v.audience === "counselor" ? "/counselor/earnings" : "/tutor/earnings",
  }),
  email: (v) => ({
    subject: `${v.amount} is waiting for your bank details`,
    heading: "Your money is waiting",
    intro:
      `${v.amount} has been earned and held for you, and there is nowhere to send it: the ` +
      `Stripe onboarding that collects your bank details has not been finished. Nothing is ` +
      `lost and nothing expires. The transfer goes out on the next run after you connect.`,
    facts: [{ label: "Waiting", value: v.amount }],
    cta: {
      label: "Connect your bank",
      url: v.audience === "counselor" ? "/counselor/earnings" : "/tutor/earnings",
    },
    footer: "Stripe collects those details directly, so we never see or hold them.",
  }),
  sample: { audience: "tutor", amount: "$70.00" },
};

/**
 * A family has said a lesson did not happen as booked.
 *
 * Goes to the tutor as well as to admins, deliberately. Being argued about
 * without being told is worse than the argument, and a tutor who was there can
 * usually settle it in one reply.
 */
export const sessionDisputed: NotificationTemplate<{
  subject: string;
  date: string;
  paymentHeld: boolean;
}> = {
  type: "session_disputed",
  label: "Session reported",
  notification: (v) => ({
    title: "A session has been reported",
    message: `${v.subject} on ${v.date} has been reported. ${
      v.paymentHeld ? "The payment is on hold." : "The payment had already gone out."
    }`,
    link: "/admin/billing",
  }),
  email: (v) => ({
    subject: `A session has been reported: ${v.subject}`,
    heading: "A session has been reported",
    intro:
      `A family has said ${v.subject} on ${v.date} did not happen as booked. ` +
      `${
        v.paymentHeld
          ? "Payment for it is on hold while somebody looks at it, so nothing has been decided."
          : "Payment for it had already gone out, so this needs a person rather than a reversal."
      } Nobody is in trouble; reports are how a lesson nobody attended gets caught.`,
    facts: [
      { label: "Session", value: v.subject },
      { label: "Date", value: v.date },
      { label: "Payment", value: v.paymentHeld ? "On hold" : "Already paid out" },
    ],
    cta: { label: "See the report", url: "/admin/billing" },
    footer: "If you taught this session, reply and say so. That is usually the whole of it.",
  }),
  sample: {
    subject: "Advanced Mathematics",
    date: "12 March",
    paymentHeld: true,
  },
};

/**
 * Something an administrator has to look at.
 *
 * A free-text notice like `system`, but addressed to staff and always with
 * somewhere to go. run-jobs and the Stripe webhook were writing rows of their
 * own for this, each with a title, a line and a hardcoded /admin/billing link,
 * so an admin got a notification carrying nothing they could act on.
 */
export const adminNotice: NotificationTemplate<{
  title: string;
  /** One line, for the list. */
  summary: string;
  /** The whole thing, for an inbox with no context around it. */
  detail: string;
  facts?: { label: string; value: string }[];
  link: string;
  linkLabel: string;
}> = {
  type: "system",
  label: "Administrator notice",
  notification: (v) => ({
    title: v.title,
    message: v.summary,
    link: v.link,
  }),
  email: (v) => ({
    subject: v.title,
    heading: v.title,
    intro: v.detail,
    facts: v.facts ?? [],
    cta: { label: v.linkLabel, url: v.link },
    footer: null,
  }),
  sample: {
    title: "A lesson was billed but nobody joined",
    summary: "Mathematics on 14 August has no attendance.",
    detail:
      "Mathematics on 14 August was paid for and neither side joined the meeting. Nothing " +
      "has been paid out to the tutor and the hold on the money is still running, so this " +
      "can be refunded without anything having to be reversed.",
    facts: [
      { label: "Subject", value: "Mathematics" },
      { label: "Date", value: "14 August" },
    ],
    link: "/admin/billing",
    linkLabel: "Open billing",
  },
};

/** A family's counselling subscription was declined. */
export const subscriptionPaymentFailed: NotificationTemplate<{
  audience: "parent" | "admin";
  studentName: string;
  tierName: string;
}> = {
  type: "admissions_plan",
  label: "Counselling payment failed",
  notification: (v) =>
    v.audience === "admin"
      ? {
          title: "A counselling payment failed",
          message: `${v.tierName} for ${v.studentName} could not be charged. Nothing has been switched off.`,
          link: "/admin/billing",
        }
      : {
          title: "Your counselling payment did not go through",
          message: "Your card was declined. Counselling carries on for now.",
          link: "/parent/billing",
        },
  email: (v) => {
    const facts = [
      { label: "Student", value: v.studentName },
      { label: "Plan", value: v.tierName },
    ];
    if (v.audience === "admin") {
      return {
        subject: `Counselling payment failed for ${v.studentName}`,
        heading: "A counselling payment failed",
        intro:
          `${v.tierName} for ${v.studentName} could not be charged. Nothing has been ` +
          `switched off and the family keeps their access: cutting a student off mid-essay ` +
          `over a declined card is not a decision a webhook should make. Stripe retries on ` +
          `its own schedule, so this usually resolves without anybody doing anything.`,
        facts,
        cta: { label: "Open billing", url: "/admin/billing" },
        footer: null,
      };
    }
    return {
      subject: "Your counselling payment did not go through",
      heading: "Your card was declined",
      intro:
        `The monthly payment for ${v.tierName} did not go through. Nothing has been switched ` +
        `off: ${v.studentName} keeps everything they have, and their counsellor has not been ` +
        `told. The card will be tried again automatically over the next few days, so this ` +
        `often sorts itself out. If it was a card that has expired or been replaced, updating ` +
        `it now saves the wait.`,
      facts,
      cta: { label: "Update your card", url: "/parent/billing" },
      footer: "Nothing is charged twice. A successful retry replaces this attempt.",
    };
  },
  sample: {
    audience: "parent",
    studentName: "Amen Worku",
    tierName: "Essential college counselling",
  },
};
