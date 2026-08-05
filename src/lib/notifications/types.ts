// ============================================================
// One definition per thing we tell somebody about.
//
// The same event reaches a family twice, as a row in their notifications and
// as an email, and those two were written in different files by different
// people at different times. So the in-app line said one thing and the email
// said another about the same booking, and changing the wording meant finding
// both.
//
// A template owns an event's words in both places. Everything that sends is
// data: no markup, no database, no client. That is what lets a serverless
// function and the browser and a seed script all read the same file.
// ============================================================

/** Every type the notifications table's check constraint allows. */
export type NotificationType =
  | "booking"
  | "assignment"
  | "approval"
  | "message"
  | "system"
  | "parent_link"
  | "application"
  | "unlock_request"
  | "course_application"
  | "course_application_decided"
  | "enrolment"
  | "admissions_plan"
  | "essay_review"
  | "payout"
  | "message_report";

/** The row written to public.notifications. */
export interface RenderedNotification {
  type: NotificationType;
  title: string;
  /** One sentence. It is read in a list, next to a timestamp. */
  message: string;
  /** Where the notification takes you, relative to the app. */
  link: string | null;
}

/**
 * A notification opened, rather than glanced at.
 *
 * The same substance as the email and none of its chrome: no greeting, no
 * heading, no signature. Somebody reading this is already inside the app and
 * knows who is talking to them.
 *
 * Derived from the template's email rather than written again. Two versions of
 * the same paragraph is how they come to disagree.
 */
export interface NotificationDetail {
  title: string;
  /** The paragraph. What the list row summarised in one line. */
  body: string;
  facts: EmailFact[];
  action: { label: string; url: string } | null;
  /** Anything worth knowing that is not the news. */
  footnote: string | null;
}

/** A labelled pair under the opening line of an email. */
export interface EmailFact {
  label: string;
  value: string;
}

/** The parts of an email. The layout turns these into markup. */
export interface RenderedEmail {
  subject: string;
  heading: string;
  /**
   * The opening. Longer than the notification's message on purpose: an inbox
   * is read once and away from the app, so it has to carry its own context.
   */
  intro: string;
  facts: EmailFact[];
  cta: { label: string; url: string } | null;
  /** Anything the reader should know that is not the news itself. */
  footer: string | null;
}

export interface NotificationTemplate<V> {
  type: NotificationType;
  /** Shown in the admin and in the seed output. Not sent to anyone. */
  label: string;
  notification: (vars: V) => Omit<RenderedNotification, "type">;
  email: (vars: V) => RenderedEmail;
  /**
   * Realistic values, for seeding and for reading a template without inventing
   * them at the call site. Kept beside the template so the two cannot drift.
   */
  sample: V;
}
