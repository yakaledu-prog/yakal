import type { NotificationTemplate } from "../types";

/** A parent asks to be linked to a student's account. */
export const parentLink: NotificationTemplate<{
  parentName: string;
  studentName: string;
}> = {
  type: "parent_link",
  label: "Parent link request",
  notification: (v) => ({
    title: "Parent link request",
    message: `${v.parentName} has asked to link to your account as your parent.`,
    link: "/student/notifications",
  }),
  email: (v) => ({
    subject: `${v.parentName} has asked to link to your Yakal account`,
    heading: "A parent wants to be linked to you",
    intro:
      `${v.parentName} has asked to be linked to your Yakal account as your parent. ` +
      `Linked, they can see the courses you are enrolled on, the sessions you have booked ` +
      `and how your college list is coming along. They cannot read your messages with a ` +
      `tutor or a counsellor, and they cannot write anything on your behalf.`,
    facts: [
      { label: "Requested by", value: v.parentName },
      { label: "Account", value: v.studentName },
    ],
    cta: { label: "Review the request", url: "/student/notifications" },
    footer:
      "Nothing happens until you accept. If you do not recognise this name, decline it and tell us.",
  }),
  sample: { parentName: "Tigist Worku", studentName: "Amen Worku" },
};

/** An admin has decided on a tutor or counsellor application. */
export const accountApproved: NotificationTemplate<{
  fullName: string;
  role: string;
  approved: boolean;
  reason?: string | null;
}> = {
  type: "approval",
  label: "Account decision",
  notification: (v) => ({
    title: v.approved ? "Your account is approved" : "Your application was not accepted",
    message: v.approved
      ? `Welcome to Yakal. Your ${v.role} account is open and you can start straight away.`
      : v.reason
        ? `An administrator reviewed your application. ${v.reason}`
        : "An administrator reviewed your application and it was not accepted this time.",
    link: v.approved ? `/${v.role}` : "/pending-approval",
  }),
  email: (v) => ({
    subject: v.approved
      ? "Your Yakal account is approved"
      : "About your Yakal application",
    heading: v.approved ? "You are in" : "Your application",
    intro: v.approved
      ? `Your ${v.role} account has been approved, ${v.fullName}. You can sign in now. ` +
        `Your profile, including the resume you uploaded, is what families see when they are ` +
        `choosing, so it is worth a few minutes before you take your first booking.`
      : `Thank you for applying to Yakal, ${v.fullName}. After reviewing your application ` +
        `we are not able to take it further at the moment.` +
        (v.reason ? ` ${v.reason}` : ""),
    facts: [
      { label: "Role", value: v.role },
      { label: "Decision", value: v.approved ? "Approved" : "Not accepted" },
    ],
    cta: v.approved ? { label: "Open your dashboard", url: `/${v.role}` } : null,
    footer: v.approved
      ? "Set your availability first. Nobody can book an hour you have not opened."
      : "You are welcome to apply again once anything above has changed.",
  }),
  sample: { fullName: "Bethlehem Alemu", role: "tutor", approved: true, reason: null },
};

/**
 * A student asks a parent to switch a service on.
 *
 * This template used to be written for an administrator, and nothing ever sent
 * it: the only writer is the locked-nav request in DashboardLayout, which
 * inserted its own row and so produced a notification with no facts and a bare
 * "Open" button. The reader is the parent, who is the person who can act, so
 * the words and the link are theirs.
 */
export const unlockRequest: NotificationTemplate<{
  studentName: string;
  studentId: string;
  /** "College counselling", "Tutoring". Already in words a parent reads. */
  service: string;
  /** The key the parent's screen needs to offer a one-click grant. */
  serviceKey: string;
  /** What they were trying to open. "Essays", "My list". */
  featureName: string;
}> = {
  type: "unlock_request",
  label: "Service request from a student",
  notification: (v) => ({
    title: `${v.studentName} asked for ${v.service}`,
    message: `They tried to open ${v.featureName}, which ${v.service} covers.`,
    link: `/parent/children?student=${v.studentId}&service=${v.serviceKey}`,
  }),
  email: (v) => ({
    subject: `${v.studentName} has asked for ${v.service}`,
    heading: "Your child has asked for something",
    intro:
      `${v.studentName} tried to open ${v.featureName} and found it locked, so they have ` +
      `asked you for ${v.service}. Nothing has been bought and nothing has changed. If you ` +
      `have another parent on the account, they were asked too, and either of you can set ` +
      `it up.`,
    facts: [
      { label: "Asked by", value: v.studentName },
      { label: "Wanted to open", value: v.featureName },
      { label: "Needs", value: v.service },
    ],
    cta: {
      label: "Set it up",
      url: `/parent/children?student=${v.studentId}&service=${v.serviceKey}`,
    },
    footer:
      "Access follows the payment. Once it is bought it opens on its own, with nothing else to switch on.",
  }),
  sample: {
    studentName: "Amen Worku",
    studentId: "9ef3ccc6-977b-44b2-8694-45c27d1e5a09",
    service: "College counselling",
    serviceKey: "admissions",
    featureName: "Essays",
  },
};

/** The parent turns that request down. */
export const unlockRequestDeclined: NotificationTemplate<{
  parentName: string;
  service: string;
  featureName: string;
}> = {
  type: "unlock_request",
  label: "Service request declined",
  notification: (v) => ({
    title: `${v.service} was not approved`,
    message: `${v.parentName} decided against it for now.`,
    link: "/student/notifications",
  }),
  email: (v) => ({
    subject: `About your request for ${v.service}`,
    heading: "Your request was not approved",
    intro:
      `${v.parentName} has decided against ${v.service} for now, so ${v.featureName} stays ` +
      `locked. This is not a permanent answer and it is worth asking them why rather than ` +
      `asking again through the app.`,
    facts: [
      { label: "Decided by", value: v.parentName },
      { label: "Service", value: v.service },
    ],
    cta: null,
    footer: "Everything you already have access to is unaffected.",
  }),
  sample: {
    parentName: "Tigist Worku",
    service: "College counselling",
    featureName: "Essays",
  },
};

/** The student answers a parent's link request. */
export const parentLinkDecided: NotificationTemplate<{
  studentName: string;
  accepted: boolean;
}> = {
  type: "parent_link",
  label: "Parent link decision",
  notification: (v) => ({
    title: v.accepted ? "You are linked" : "Link request declined",
    message: v.accepted
      ? `${v.studentName} accepted. Their courses, sessions and college list are on your account now.`
      : `${v.studentName} declined the request.`,
    link: v.accepted ? "/parent/children" : "/parent/notifications",
  }),
  email: (v) => ({
    subject: v.accepted
      ? `${v.studentName} accepted your link request`
      : `${v.studentName} declined your link request`,
    heading: v.accepted ? "You are linked" : "Your link request",
    intro: v.accepted
      ? `${v.studentName} has accepted, so their account is on yours. You can see the ` +
        `courses they are enrolled on, the sessions they have booked and how their college ` +
        `list is coming along, and you can buy either service for them. What you cannot ` +
        `see is their messages with a tutor or a counsellor.`
      : `${v.studentName} has declined the request to link your accounts. Nothing has ` +
        `changed and they have not been told anything beyond that you asked.`,
    facts: [
      { label: "Student", value: v.studentName },
      { label: "Decision", value: v.accepted ? "Accepted" : "Declined" },
    ],
    cta: v.accepted ? { label: "Open their account", url: "/parent/children" } : null,
    footer: v.accepted
      ? null
      : "If this was a mistake on their part, they can accept a fresh request.",
  }),
  sample: { studentName: "Amen Worku", accepted: true },
};
