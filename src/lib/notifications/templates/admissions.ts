import type { NotificationTemplate } from "../types";

/** A family bought a counselling tier. */
export const admissionsPlan: NotificationTemplate<{
  studentName: string;
  tierName: string;
  counselorName: string | null;
  sessionsPerMonth: number | null;
}> = {
  type: "admissions_plan",
  label: "Counselling plan started",
  notification: (v) => ({
    title: "College counselling is open",
    message: v.counselorName
      ? `${v.tierName} for ${v.studentName}, with ${v.counselorName}.`
      : `${v.tierName} for ${v.studentName}.`,
    link: "/student/college",
  }),
  email: (v) => ({
    subject: `College counselling is open for ${v.studentName}`,
    heading: "Counselling has started",
    intro:
      `${v.studentName} is on ${v.tierName}` +
      (v.counselorName ? `, working with ${v.counselorName}` : "") +
      `. The college tools are open: a list to build, essays to draft and a tracker for ` +
      `every deadline. ` +
      (v.sessionsPerMonth
        ? `The plan includes ${v.sessionsPerMonth} advising ` +
          `${v.sessionsPerMonth === 1 ? "hour" : "hours"} a month, booked from the plan itself, ` +
          `and unused hours do not carry over.`
        : ""),
    facts: [
      { label: "Student", value: v.studentName },
      { label: "Plan", value: v.tierName },
      ...(v.counselorName ? [{ label: "Counsellor", value: v.counselorName }] : []),
      ...(v.sessionsPerMonth
        ? [{ label: "Advising hours", value: `${v.sessionsPerMonth} a month` }]
        : []),
    ],
    cta: { label: "Start the college list", url: "/student/college" },
    footer:
      "The earliest deadlines are usually in the first week of November, so the list is worth starting now.",
  }),
  sample: {
    studentName: "Amen Worku",
    tierName: "Essential college counselling",
    counselorName: "Daniel Haile",
    sessionsPerMonth: 2,
  },
};

/** A counsellor returned an essay. */
export const essayReview: NotificationTemplate<{
  studentName: string;
  essayTitle: string;
  counselorName: string;
  roundsUsed: number;
  roundsLimit: number | null;
}> = {
  type: "essay_review",
  label: "Essay reviewed",
  notification: (v) => ({
    title: "Your essay came back",
    message: `${v.counselorName} reviewed ${v.essayTitle}.`,
    link: "/student/college/essays",
  }),
  email: (v) => ({
    subject: `${v.essayTitle} has been reviewed`,
    heading: "Your essay came back",
    intro:
      `${v.counselorName} has been through ${v.essayTitle} and left comments on it, ` +
      `${v.studentName}. The comments sit against the lines they refer to rather than in a ` +
      `separate document, so the next draft can be written straight over the top.` +
      (v.roundsLimit
        ? ` This was round ${v.roundsUsed} of ${v.roundsLimit} on your plan.`
        : ""),
    facts: [
      { label: "Essay", value: v.essayTitle },
      { label: "Reviewed by", value: v.counselorName },
      ...(v.roundsLimit
        ? [{ label: "Rounds used", value: `${v.roundsUsed} of ${v.roundsLimit}` }]
        : []),
    ],
    cta: { label: "Read the comments", url: "/student/college/essays" },
    footer: null,
  }),
  sample: {
    studentName: "Amen Worku",
    essayTitle: "Personal statement, draft 2",
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
    link: "/student/college/tracker",
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
    cta: { label: "Open the tracker", url: "/student/college/tracker" },
    footer: null,
  }),
  sample: {
    studentName: "Amen Worku",
    schoolName: "University of Illinois Urbana-Champaign",
    stage: "Submitted",
  },
};
