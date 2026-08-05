import { TEMPLATES, TEMPLATE_KEYS, type TemplateKey, type TemplateVars } from "./templates";
import type { RenderedEmail, RenderedNotification } from "./types";

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

/** A template rendered from its own sample values, for seeding and previews. */
export function renderSample(key: TemplateKey) {
  const template = TEMPLATES[key] as { sample: unknown };
  return render(key, template.sample as never);
}

export { TEMPLATE_KEYS as keys };
