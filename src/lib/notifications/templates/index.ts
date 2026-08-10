import type { NotificationTemplate, NotificationType } from "../types";
import { parentLink, accountApproved, unlockRequest } from "./people";
import { enrolment, booking, assignment, message, sessionMoved } from "./learning";
import { courseApplication, courseApplicationDecided, payout } from "./teaching";
import { admissionsPlan, essayReview, application } from "./admissions";
import { messageReport, system } from "./safety";

/**
 * Every template, keyed by the name a caller uses.
 *
 * The key is not the notification type: two templates can share a type, and
 * one of them already does. A key names the event, which is what a caller
 * knows; the type is a column value.
 */
export const TEMPLATES = {
  parentLink,
  accountApproved,
  unlockRequest,
  enrolment,
  booking,
  sessionMoved,
  assignment,
  message,
  courseApplication,
  courseApplicationDecided,
  payout,
  admissionsPlan,
  essayReview,
  application,
  messageReport,
  system,
} as const;

export type TemplateKey = keyof typeof TEMPLATES;

export const TEMPLATE_KEYS = Object.keys(TEMPLATES) as TemplateKey[];

/** The variables a given template takes. */
export type TemplateVars<K extends TemplateKey> =
  (typeof TEMPLATES)[K] extends NotificationTemplate<infer V> ? V : never;

/** Every type a template can produce, for a quick check against the schema. */
export function typesInUse(): NotificationType[] {
  return [...new Set(TEMPLATE_KEYS.map((k) => TEMPLATES[k].type))];
}
