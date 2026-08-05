import type { NotificationTemplate } from "../types";

/**
 * A message was flagged by the scan.
 *
 * Deliberately vague about what was said. The parent is told there is
 * something to read and where, not given the sentence out of context, and the
 * sender is never told which words tripped it.
 */
export const messageReport: NotificationTemplate<{
  studentName: string;
  otherName: string;
  severity: "high" | "medium";
}> = {
  type: "message_report",
  label: "Message flagged",
  notification: (v) => ({
    title: "A message needs your attention",
    message: `Something in ${v.studentName}'s conversation with ${v.otherName} is worth reading.`,
    link: "/parent/child-chats",
  }),
  email: (v) => ({
    subject: `A message in ${v.studentName}'s conversation needs a look`,
    heading: "Something is worth reading",
    intro:
      `A message in ${v.studentName}'s conversation with ${v.otherName} has been flagged for ` +
      `you to read. This is automatic and it is often nothing: the checks look for contact ` +
      `details, payment talk and anything that moves a conversation off Yakal, and ordinary ` +
      `messages trip them. Nobody has been accused of anything and ${v.otherName} has not ` +
      `been told.`,
    facts: [
      { label: "Student", value: v.studentName },
      { label: "Conversation with", value: v.otherName },
      { label: "Priority", value: v.severity === "high" ? "Read soon" : "When you can" },
    ],
    cta: { label: "Read the conversation", url: "/parent/child-chats" },
    footer:
      "If something is wrong, report it from the conversation and an administrator will see it with the messages around it.",
  }),
  sample: {
    studentName: "Amen Worku",
    otherName: "Bethlehem Alemu",
    severity: "medium",
  },
};

/**
 * Anything with no better home. Kept plain on purpose.
 *
 * Takes a summary and a body rather than one string for both. Sending the same
 * paragraph to each put a wall of text in a list row that has one line and a
 * timestamp, and gave the email nothing the notification had not already said.
 */
export const system: NotificationTemplate<{
  title: string;
  /** One line, for the list. */
  summary: string;
  /** The whole thing, for an inbox with no context around it. */
  body: string;
  link?: string | null;
}> = {
  type: "system",
  label: "System notice",
  notification: (v) => ({
    title: v.title,
    message: v.summary,
    link: v.link ?? null,
  }),
  email: (v) => ({
    subject: v.title,
    heading: v.title,
    intro: v.body,
    facts: [],
    cta: v.link ? { label: "Open Yakal", url: v.link } : null,
    footer: null,
  }),
  sample: {
    title: "Scheduled maintenance on Sunday",
    summary: "Yakal will be offline for about twenty minutes early on Sunday morning.",
    body:
      "Yakal will be unavailable for about twenty minutes early on Sunday morning while we " +
      "move the database to its new home. Nothing you have saved is affected and no session " +
      "is scheduled inside the window. If you are midway through an essay when it happens, " +
      "your last save is safe.",
    link: null,
  },
};
