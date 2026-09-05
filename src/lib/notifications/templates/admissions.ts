import type { NotificationTemplate } from "../types";

/**
 * A family bought a counselling tier.
 *
 * Told to the student and to the parent, who need different things from it:
 * the student that the college tools are open, the parent that the payment
 * went through and what the plan includes. One event, one set of facts, two
 * readings.
 */
export const admissionsPlan: NotificationTemplate<{
  audience: "student" | "parent";
  studentName: string;
  tierName: string;
  counselorName: string | null;
  sessionsPerMonth: number | null;
}> = {
  type: "admissions_plan",
  label: "Counselling plan started",
  notification: (v) =>
    v.audience === "parent"
      ? {
          title: "Payment received",
          message: `${v.studentName} is on ${v.tierName}.`,
          link: "/parent/billing",
        }
      : {
          title: "College counselling is open",
          message: v.counselorName
            ? `${v.tierName}, with ${v.counselorName}.`
            : v.tierName,
          link: "/student/college-list",
        },
  email: (v) => {
    const facts = [
      { label: "Student", value: v.studentName },
      { label: "Plan", value: v.tierName },
      ...(v.counselorName ? [{ label: "Counsellor", value: v.counselorName }] : []),
      ...(v.sessionsPerMonth
        ? [{ label: "Advising hours", value: `${v.sessionsPerMonth} a month` }]
        : []),
    ];

    if (v.audience === "parent") {
      return {
        subject: `College counselling is open for ${v.studentName}`,
        heading: "The payment went through",
        intro:
          `${v.studentName} is on ${v.tierName}` +
          (v.counselorName ? `, working with ${v.counselorName}` : "") +
          `. ` +
          (v.sessionsPerMonth
            ? `The plan includes ${v.sessionsPerMonth} advising ` +
              `${v.sessionsPerMonth === 1 ? "hour" : "hours"} a month, which they book ` +
              `themselves, and unused hours do not carry over. `
            : "") +
          `It renews monthly until you cancel it, and cancelling leaves the month you have ` +
          `already paid for running to its end.`,
        facts,
        cta: { label: "See the receipt", url: "/parent/billing" },
        footer:
          "You can see their college list and their deadlines from your own account. Their essay drafts stay theirs.",
      };
    }

    return {
      subject: `Your college counselling is open`,
      heading: "Counselling has started",
      intro:
        `You are on ${v.tierName}` +
        (v.counselorName ? `, working with ${v.counselorName}` : "") +
        `, ${v.studentName}. The college tools are open: a list to build, essays to draft ` +
        `and a tracker for every deadline. ` +
        (v.sessionsPerMonth
          ? `Your plan includes ${v.sessionsPerMonth} advising ` +
            `${v.sessionsPerMonth === 1 ? "hour" : "hours"} a month, booked from the plan ` +
            `itself, and unused hours do not carry over.`
          : ""),
      facts,
      cta: { label: "Start the college list", url: "/student/college-list" },
      footer:
        "The earliest deadlines are usually in the first week of November, so the list is worth starting now.",
    };
  },
  sample: {
    audience: "student",
    studentName: "Amen Worku",
    tierName: "Essential college counselling",
    counselorName: "Daniel Haile",
    sessionsPerMonth: 2,
  },
};

/**
 * A counsellor has been through an essay.
 *
 * Two outcomes, not one. Approved means finished and there is nothing to do;
 * commented means there is a next draft to write. Sending the same words for
 * both told a student their finished essay had comments waiting.
 *
 * Everything except the outcome is optional, because the call site knows the
 * essay and the action and not much else. A template that demanded the
 * counsellor's name and the round count would have to be fed by a second query
 * on a path that has no other reason to run one.
 */
export const essayReview: NotificationTemplate<{
  approved: boolean;
  essayTitle: string;
  studentName?: string;
  counselorName?: string;
  roundsUsed?: number;
  roundsLimit?: number | null;
}> = {
  type: "essay_review",
  label: "Essay reviewed",
  notification: (v) => ({
    title: v.approved ? "Your essay is finished" : "Your essay came back",
    message: v.approved
      ? `${v.essayTitle} has been approved. Nothing more to do on it.`
      : v.counselorName
        ? `${v.counselorName} left comments on ${v.essayTitle}.`
        : `There are comments waiting on ${v.essayTitle}.`,
    link: "/student/my-app",
  }),
  email: (v) => ({
    subject: v.approved
      ? `${v.essayTitle} has been approved`
      : `${v.essayTitle} has been reviewed`,
    heading: v.approved ? "That one is done" : "Your essay came back",
    intro: v.approved
      ? `${v.counselorName ?? "Your counsellor"} has approved ${v.essayTitle}` +
        (v.studentName ? `, ${v.studentName}` : "") +
        `. There is nothing else to do on it. It stays in your workspace, so you can still ` +
        `read it back or lift a paragraph into a supplement.`
      : `${v.counselorName ?? "Your counsellor"} has been through ${v.essayTitle} and left ` +
        `comments on it` +
        (v.studentName ? `, ${v.studentName}` : "") +
        `. The comments sit against the lines they refer to rather than in a separate ` +
        `document, so the next draft can be written straight over the top.` +
        (v.roundsLimit
          ? ` This was round ${v.roundsUsed ?? 0} of ${v.roundsLimit} on your plan.`
          : ""),
    facts: [
      { label: "Essay", value: v.essayTitle },
      { label: "Outcome", value: v.approved ? "Approved" : "Comments to work through" },
      ...(v.counselorName ? [{ label: "Reviewed by", value: v.counselorName }] : []),
      ...(v.roundsLimit
        ? [{ label: "Rounds used", value: `${v.roundsUsed ?? 0} of ${v.roundsLimit}` }]
        : []),
    ],
    cta: {
      label: v.approved ? "Open your workspace" : "Read the comments",
      url: "/student/my-app",
    },
    footer: v.approved
      ? null
      : "A round is counted when a counsellor reviews, not when you send.",
  }),
  sample: {
    approved: false,
    essayTitle: "Personal statement, draft 2",
    studentName: "Amen Worku",
    counselorName: "Daniel Haile",
    roundsUsed: 2,
    roundsLimit: 6,
  },
};

/** A generic application update, used where nothing more specific fits. */
export const application: NotificationTemplate<{
  studentName: string;
  schoolName: string;
  stage: string;
}> = {
  type: "application",
  label: "Application update",
  notification: (v) => ({
    title: "Application update",
    message: `${v.schoolName} moved to ${v.stage}.`,
    link: "/student/my-app",
  }),
  email: (v) => ({
    subject: `${v.schoolName}: ${v.stage}`,
    heading: "An application moved",
    intro:
      `${v.studentName}'s application to ${v.schoolName} is now at ${v.stage}. The tracker ` +
      `shows what is outstanding for this school and what is due next across all of them.`,
    facts: [
      { label: "School", value: v.schoolName },
      { label: "Stage", value: v.stage },
    ],
    cta: { label: "Open the tracker", url: "/student/my-app" },
    footer: null,
  }),
  sample: {
    studentName: "Amen Worku",
    schoolName: "University of Illinois Urbana-Champaign",
    stage: "Submitted",
  },
};
