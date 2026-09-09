import type { NotificationTemplate, NotificationType } from "../types";

// Relative imports here carry a .js extension, which nothing else under src/
// does. This directory is the one piece of src/ that api/ imports rather than
// copies, so it is read by the server as well as bundled for the browser, and
// the server's rule is the stricter one. Type-only imports are exempt because
// they are erased before anything resolves them.
import {
  parentLink,
  parentLinkDecided,
  accountApproved,
  unlockRequest,
  unlockRequestDeclined,
} from "./people.js";
import {
  enrolment,
  booking,
  assignment,
  message,
  sessionMoved,
  sessionCancelled,
} from "./learning.js";
import {
  courseApplication,
  courseApplicationDecided,
  payout,
  payoutBlocked,
  sessionDisputed,
  disputeResolved,
  adminNotice,
  subscriptionPaymentFailed,
} from "./teaching.js";
import { admissionsPlan, essayReview, application } from "./admissions.js";
import { messageReport, system } from "./safety.js";

/**
 * Every template, keyed by the name a caller uses.
 *
 * The key is not the notification type: two templates can share a type, and
 * one of them already does. A key names the event, which is what a caller
 * knows; the type is a column value.
 */
export const TEMPLATES = {
  parentLink,
  parentLinkDecided,
  accountApproved,
  unlockRequest,
  unlockRequestDeclined,
  enrolment,
  booking,
  sessionMoved,
  sessionCancelled,
  assignment,
  message,
  courseApplication,
  courseApplicationDecided,
  payout,
  payoutBlocked,
  sessionDisputed,
  disputeResolved,
  adminNotice,
  subscriptionPaymentFailed,
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
