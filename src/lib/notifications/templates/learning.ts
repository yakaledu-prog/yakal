import type { NotificationTemplate } from "../types";

/**
 * A course was paid for and the student is on it.
 *
 * Three people are told, and they are told different things: the student that
 * their dashboard has a new course, the parent that a payment went through,
 * the tutor that somebody has joined. The audience is a variable rather than
 * three templates because it is one event, and because the facts are the same
 * facts however they are worded. Splitting it was how fulfil ended up writing
 * five notifications by hand with no template between them.
 */
export const enrolment: NotificationTemplate<{
  audience: "student" | "parent" | "tutor";
  studentName: string;
  courseTitle: string;
  courseId?: string;
  tutorName: string | null;
  sessionCount: number;
}> = {
  type: "enrolment",
  label: "Course enrolment",
  notification: (v) => {
    const sessions = `${v.sessionCount} ${v.sessionCount === 1 ? "session" : "sessions"} booked`;
    const noTimes = "Times to be arranged";
    const line = v.sessionCount > 0 ? sessions : noTimes;

    if (v.audience === "parent") {
      return {
        title: "Payment received",
        message: `${v.studentName} is on ${v.courseTitle}. ${line}.`,
        link: "/parent/courses",
      };
    }
    if (v.audience === "tutor") {
      return {
        title: "A new student",
        message: `${v.studentName} joined ${v.courseTitle}. ${line}.`,
        link: v.courseId ? `/tutor/courses/${v.courseId}` : "/tutor/courses",
      };
    }
    return {
      title: "You are on a new course",
      message: v.tutorName
        ? `${v.courseTitle} with ${v.tutorName}. ${line}.`
        : `${v.courseTitle}. ${line}.`,
      link: "/student/my-learning",
    };
  },
  email: (v) => {
    const facts = [
      { label: "Course", value: v.courseTitle },
      { label: "Student", value: v.studentName },
      ...(v.tutorName ? [{ label: "Tutor", value: v.tutorName }] : []),
      {
        label: "Sessions booked",
        value: v.sessionCount > 0 ? String(v.sessionCount) : "To be arranged",
      },
    ];

    if (v.audience === "parent") {
      return {
        subject: `${v.studentName} is enrolled on ${v.courseTitle}`,
        heading: "The payment went through",
        intro:
          `${v.studentName} is enrolled on ${v.courseTitle}` +
          (v.tutorName ? ` with ${v.tutorName}` : "") +
          `. ` +
          (v.sessionCount > 0
            ? `${v.sessionCount === 1 ? "One session is" : `${v.sessionCount} sessions are`} in ` +
              `the calendar. `
            : `No times are booked yet. `) +
          `The receipt is on your billing page, and you can follow attendance and any work ` +
          `set on this course from your own account without asking them how it went.`,
        facts,
        cta: { label: "See the receipt", url: "/parent/billing" },
        footer:
          "Cancelling an hour more than twenty four hours ahead is free. Inside that window it is charged.",
      };
    }

    if (v.audience === "tutor") {
      return {
        subject: `${v.studentName} joined ${v.courseTitle}`,
        heading: "You have a new student",
        intro:
          `${v.studentName} has joined ${v.courseTitle}. ` +
          (v.sessionCount > 0
            ? `${v.sessionCount === 1 ? "One hour is" : `${v.sessionCount} hours are`} already ` +
              `in your calendar, each with a meeting link that appears on the session shortly ` +
              `before it starts.`
            : `No hours are booked yet, which usually means the times you have published do ` +
              `not suit them. Opening more is the quickest fix.`),
        facts,
        cta: {
          label: "Open the course",
          url: v.courseId ? `/tutor/courses/${v.courseId}` : "/tutor/courses",
        },
        footer: "You are paid after a session is delivered, not when it is booked.",
      };
    }

    return {
      subject: `You are enrolled on ${v.courseTitle}`,
      heading: "Enrolment confirmed",
      intro:
        `You are on ${v.courseTitle}${v.tutorName ? ` with ${v.tutorName}` : ""}, ` +
        `${v.studentName}. ` +
        (v.sessionCount > 0
          ? `${v.sessionCount === 1 ? "One session is" : `${v.sessionCount} sessions are`} in ` +
            `the calendar, each with a meeting link that appears on the session a few minutes ` +
            `before it starts. `
          : `No times are booked yet. Pick them from the course and they land in your calendar. `) +
        `Any work set on this course arrives in My Learning.`,
      facts,
      cta: { label: "See the sessions", url: "/student/my-learning" },
      footer:
        "To move an hour, open the session and reschedule. Doing it in the app tells the tutor.",
    };
  },
  sample: {
    audience: "student",
    studentName: "Amen Worku",
    courseTitle: "Advanced Mathematics, University Entrance Prep",
    tutorName: "Bethlehem Alemu",
    sessionCount: 2,
  },
};

/** A session was booked, moved or is about to happen. */
export const booking: NotificationTemplate<{
  studentName: string;
  subject: string;
  withName: string;
  when: string;
}> = {
  type: "booking",
  label: "Session booked",
  notification: (v) => ({
    title: "Session booked",
    message: `${v.subject} with ${v.withName}, ${v.when}.`,
    link: "/student/sessions",
  }),
  email: (v) => ({
    subject: `${v.subject} with ${v.withName}, ${v.when}`,
    heading: "A session is in the calendar",
    intro:
      `${v.subject} with ${v.withName} is booked for ${v.when}. The meeting link appears on ` +
      `the session itself shortly before it starts, so there is nothing to keep hold of now. ` +
      `If ${v.studentName} cannot make it, moving the hour in the app tells the other side; ` +
      `an unattended session still counts against the hours that were paid for.`,
    facts: [
      { label: "Subject", value: v.subject },
      { label: "With", value: v.withName },
      { label: "When", value: v.when },
    ],
    cta: { label: "Open the session", url: "/student/sessions" },
    footer: null,
  }),
  sample: {
    studentName: "Amen Worku",
    subject: "Mathematics",
    withName: "Bethlehem Alemu",
    when: "Tuesday 12 August, 4pm",
  },
};

/** Work was set on a course the student is on. */
export const assignment: NotificationTemplate<{
  courseTitle: string;
  title: string;
  dueLabel: string | null;
}> = {
  type: "assignment",
  label: "Assignment set",
  notification: (v) => ({
    title: "New assignment",
    message: v.dueLabel
      ? `${v.title} on ${v.courseTitle}, due ${v.dueLabel}.`
      : `${v.title} on ${v.courseTitle}.`,
    link: "/student/my-learning",
  }),
  email: (v) => ({
    subject: `New work on ${v.courseTitle}: ${v.title}`,
    heading: "Something has been set",
    intro:
      `${v.title} has been set on ${v.courseTitle}` +
      (v.dueLabel ? `, due ${v.dueLabel}` : "") +
      `. The task, any attachments and the place to turn it in are all in Google Classroom; ` +
      `the link on the assignment takes you straight there.`,
    facts: [
      { label: "Course", value: v.courseTitle },
      { label: "Assignment", value: v.title },
      ...(v.dueLabel ? [{ label: "Due", value: v.dueLabel }] : []),
    ],
    cta: { label: "Open the assignment", url: "/student/my-learning" },
    footer: null,
  }),
  sample: {
    courseTitle: "Advanced Mathematics, University Entrance Prep",
    title: "Chapter 4 problems, questions 1 to 12",
    dueLabel: "Friday 15 August",
  },
};

/** A new message in a conversation. */
export const message: NotificationTemplate<{
  fromName: string;
  preview: string;
}> = {
  type: "message",
  label: "New message",
  notification: (v) => ({
    title: `Message from ${v.fromName}`,
    message: v.preview,
    link: "/student/messages",
  }),
  email: (v) => ({
    subject: `${v.fromName} sent you a message`,
    heading: "You have a message",
    intro:
      `${v.fromName} has written to you on Yakal. Replies stay in the app so the whole ` +
      `conversation is in one place and a parent can see that it is happening without ` +
      `reading it.`,
    facts: [{ label: "From", value: v.fromName }],
    cta: { label: "Read and reply", url: "/student/messages" },
    footer:
      "Nobody at Yakal will ever ask you to move a conversation to a personal number or to pay outside the app.",
  }),
  sample: {
    fromName: "Bethlehem Alemu",
    preview: "Nice work on the last set. Have a look at question 7 before Tuesday.",
  },
};

/**
 * A booked hour moved.
 *
 * Goes to the other side, never the person who did it. The reason is only
 * present when a tutor moved it, which is the case where it matters: the
 * student arranged a day around this and did not ask for the change.
 */
export const sessionMoved: NotificationTemplate<{
  subject: string;
  movedBy: string;
  from: string;
  to: string;
  reason?: string | null;
}> = {
  type: "session_moved",
  label: "Session moved",
  notification: (v) => ({
    title: "Session moved",
    message: `${v.subject} is now ${v.to}${v.reason ? `. ${v.reason}` : ""}`,
    link: "/student/sessions",
  }),
  email: (v) => ({
    subject: `${v.subject} moved to ${v.to}`,
    heading: "A session has been moved",
    intro:
      `${v.movedBy} moved ${v.subject} from ${v.from} to ${v.to}.` +
      (v.reason ? ` They said: "${v.reason}".` : "") +
      ` Nothing else about the session has changed, and the meeting link still ` +
      `appears on the session itself shortly before it starts.`,
    facts: [
      { label: "Subject", value: v.subject },
      { label: "Was", value: v.from },
      { label: "Now", value: v.to },
      ...(v.reason ? [{ label: "Reason", value: v.reason }] : []),
    ],
    cta: { label: "Open the session", url: "/student/sessions" },
    footer: null,
  }),
  sample: {
    subject: "Mathematics",
    movedBy: "Bethlehem Alemu",
    from: "Tuesday 12 August, 4pm",
    to: "Thursday 14 August, 4pm",
    reason: "Clashing appointment, sorry",
  },
};

/**
 * A lesson called off.
 *
 * The other half of sessionMoved. What the reader needs is the money, because
 * that is the part they cannot work out for themselves: a family wants to know
 * what is coming back, and a tutor whether they are still paid for an hour they
 * held. Both are said plainly rather than left to the policy page.
 */
export const sessionCancelled: NotificationTemplate<{
  /**
   * Whoever did not press the button. The link differs, and a tutor sent to
   * /student/sessions lands on a page they have no route to.
   */
  audience: "student" | "tutor";
  subject: string;
  when: string;
  cancelledBy: string;
  /** Empty when nothing is coming back, which is itself worth saying. */
  refund?: string | null;
  reason?: string | null;
}> = {
  type: "session_cancelled",
  label: "Session cancelled",
  notification: (v) => ({
    title: "A lesson was cancelled",
    message:
      `${v.subject} on ${v.when} is off` +
      (v.reason ? `: ${v.reason}` : "") +
      (v.refund ? `. ${v.refund} refunded` : ""),
    link: v.audience === "tutor" ? "/tutor/sessions" : "/student/sessions",
  }),
  email: (v) => ({
    subject: `${v.subject} on ${v.when} is cancelled`,
    heading: "A lesson has been cancelled",
    intro:
      `${v.cancelledBy} cancelled ${v.subject} on ${v.when}.` +
      (v.reason ? ` They said: "${v.reason}".` : "") +
      (v.refund
        ? ` ${v.refund} is on its way back to the card it was paid with, and takes a few days to appear.`
        : " Nothing has been charged or refunded for it.") +
      " Nothing else in the timetable has changed.",
    facts: [
      { label: "Subject", value: v.subject },
      { label: "Was", value: v.when },
      { label: "Cancelled by", value: v.cancelledBy },
      ...(v.refund ? [{ label: "Refunded", value: v.refund }] : []),
      ...(v.reason ? [{ label: "Reason", value: v.reason }] : []),
    ],
    cta: {
      label: "See your sessions",
      url: v.audience === "tutor" ? "/tutor/sessions" : "/student/sessions",
    },
    footer:
      v.audience === "tutor"
        ? "The hour is free again as soon as this lands, so somebody else can take it."
        : null,
  }),
  sample: {
    audience: "student",
    subject: "Mathematics",
    when: "Thursday 14 August, 4pm",
    cancelledBy: "Bethlehem Alemu",
    refund: "$45.00",
    reason: "Unwell, sorry",
  },
};
