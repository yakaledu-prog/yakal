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
        `Your profile, including the CV you uploaded, is what families see when they are ` +
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

/** A parent asks for a service to be switched on for their child. */
export const unlockRequest: NotificationTemplate<{
  parentName: string;
  studentName: string;
  service: string;
}> = {
  type: "unlock_request",
  label: "Service unlock request",
  notification: (v) => ({
    title: "Service request",
    message: `${v.parentName} has asked to switch on ${v.service} for ${v.studentName}.`,
    link: "/admin/users",
  }),
  email: (v) => ({
    subject: `${v.parentName} has asked for ${v.service}`,
    heading: "A family wants a service switched on",
    intro:
      `${v.parentName} has asked for ${v.service} to be made available to ${v.studentName}. ` +
      `Nothing has changed yet; the request is waiting for somebody to act on it.`,
    facts: [
      { label: "Requested by", value: v.parentName },
      { label: "For", value: v.studentName },
      { label: "Service", value: v.service },
    ],
    cta: { label: "Open the account", url: "/admin/users" },
    footer: null,
  }),
  sample: {
    parentName: "Tigist Worku",
    studentName: "Amen Worku",
    service: "college counselling",
  },
};
