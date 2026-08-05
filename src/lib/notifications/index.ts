import { TEMPLATES, TEMPLATE_KEYS, type TemplateKey, type TemplateVars } from "./templates";
import type { NotificationDetail, RenderedEmail, RenderedNotification } from "./types";

export * from "./types";
export { TEMPLATES, TEMPLATE_KEYS, typesInUse } from "./templates";
export type { TemplateKey, TemplateVars } from "./templates";

/**
 * The row to write to public.notifications.
 *
 * Returns data rather than writing it. The browser writes through supabase-js
 * under row level security and a serverless function writes with the service
 * role, so a template that inserted for itself would have to know which, and
 * would be untestable without one of them.
 */
export function renderNotification<K extends TemplateKey>(
  key: K,
  vars: TemplateVars<K>
): RenderedNotification {
  const template = TEMPLATES[key] as { type: RenderedNotification["type"]; notification: (v: unknown) => Omit<RenderedNotification, "type"> };
  return { type: template.type, ...template.notification(vars) };
}

/**
 * The same event, for an inbox.
 *
 * Longer than the notification on purpose. A notification is read inside the
 * app, one line beside a timestamp, with everything around it for context. An
 * email is read once, days later, by somebody who may not remember signing up,
 * so it has to carry its own.
 */
export function renderEmail<K extends TemplateKey>(
  key: K,
  vars: TemplateVars<K>
): RenderedEmail {
  const template = TEMPLATES[key] as { email: (v: unknown) => RenderedEmail };
  return template.email(vars);
}

/** Both at once, for the usual case of telling somebody the same thing twice. */
export function render<K extends TemplateKey>(
  key: K,
  vars: TemplateVars<K>
): { notification: RenderedNotification; email: RenderedEmail } {
  return { notification: renderNotification(key, vars), email: renderEmail(key, vars) };
}

/**
 * What a reader gets on opening a notification.
 *
 * Taken from the email and stripped of its chrome, because the substance is
 * the same and writing it twice is how the two come to disagree. The greeting,
 * the heading and the signature are an inbox's furniture and stop here.
 */
export function renderDetail<K extends TemplateKey>(
  key: K,
  vars: TemplateVars<K>
): NotificationDetail {
  const email = renderEmail(key, vars);
  const notification = renderNotification(key, vars);
  return {
    title: notification.title,
    body: email.intro,
    facts: email.facts,
    // The email's call to action, worded for somebody already inside the app.
    action: email.cta,
    footnote: email.footer,
  };
}

/**
 * A notification read back from the database.
 *
 * Rendered from the template every time rather than from stored prose, so a
 * wording fix reaches notifications that were sent months ago. A row with no
 * template, which is every row written before this existed, falls back to the
 * title and message it was stored with.
 */
export function detailFor(row: {
  template?: string | null;
  vars?: unknown;
  title: string;
  message: string;
  link?: string | null;
}): NotificationDetail {
  const key = row.template as TemplateKey | undefined;
  if (key && key in TEMPLATES && row.vars) {
    try {
      return renderDetail(key, row.vars as never);
    } catch {
      // A template whose shape has moved on since the row was written. The
      // stored line is stale but it is not wrong, so it is better than an
      // error in somebody's inbox.
    }
  }
  return {
    title: row.title,
    body: row.message,
    facts: [],
    action: row.link ? { label: "Open", url: row.link } : null,
    footnote: null,
  };
}

/** A template rendered from its own sample values, for seeding and previews. */
export function renderSample(key: TemplateKey) {
  const template = TEMPLATES[key] as { sample: unknown };
  return {
    ...render(key, template.sample as never),
    detail: renderDetail(key, template.sample as never),
    vars: template.sample,
  };
}

export { TEMPLATE_KEYS as keys };
