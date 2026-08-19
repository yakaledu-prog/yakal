// ============================================================
// Server-side error reporting.
//
// Every production failure this month was server-side: a Google token minted
// against the wrong OAuth client, an invite link built from an unset variable,
// Stripe refusing an account type. All three were visible only in the host's
// log, which nobody read, and each was diagnosed by guessing from a screenshot.
//
// A no-op unless SENTRY_DSN is set, so local runs and tests report nothing.
//
// Server errors are the more dangerous ones to send: this process holds the
// service-role key, Stripe's secret and a Google refresh token, and any of them
// can end up in an error message. Nothing is sent that has not been through
// scrub().
// ============================================================

type SentryModule = typeof import('@sentry/node');

let sentry: SentryModule | null = null;
let started = false;

const SENSITIVE =
  /(^|[_-])(token|secret|key|password|authorization|cookie|email|phone|content|message|body)($|[_-])/i;

/** Anything that looks like a credential, wherever it appears in a string. */
function redact(text: string): string {
  return text
    // Stripe keys, Google refresh tokens, JWTs, and bearer headers.
    .replace(/sk_(live|test)_[A-Za-z0-9]+/g, 'sk_[redacted]')
    .replace(/1\/\/[A-Za-z0-9_-]{20,}/g, '[refresh-token]')
    .replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[jwt]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [redacted]');
}

function scrub(event: any): any {
  if (event?.request) {
    delete event.request.cookies;
    delete event.request.data;
    delete event.request.headers;
    if (typeof event.request.query_string === 'string') delete event.request.query_string;
  }
  if (event?.user) event.user = event.user.id ? { id: event.user.id } : undefined;

  const prune = (obj: Record<string, unknown> | undefined) => {
    if (!obj) return;
    for (const k of Object.keys(obj)) if (SENSITIVE.test(k)) delete obj[k];
  };
  prune(event?.extra);
  prune(event?.tags);
  prune(event?.contexts);

  // The message itself, because a credential in an exception string is exactly
  // how one leaves a system that was otherwise careful.
  for (const entry of event?.exception?.values ?? []) {
    if (typeof entry.value === 'string') entry.value = redact(entry.value);
  }
  if (typeof event?.message === 'string') event.message = redact(event.message);

  return event;
}

// Exported for scripts/verify/error-scrubbing.ts. What leaves this process is
// worth testing directly rather than through the SDK.
export const scrubForTest = scrub;
export const redactForTest = redact;

/** Start reporting, if this deployment is configured for it. */
export async function startServerReporting(): Promise<void> {
  if (started || !process.env.SENTRY_DSN) return;
  started = true;

  try {
    sentry = await import('@sentry/node');
    sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV ?? 'development',
      tracesSampleRate: 0,
      sendDefaultPii: false,
      beforeSend: (event) => scrub(event),
    });
  } catch {
    started = false;
  }
}

/**
 * Report a caught error, alongside logging it.
 *
 * Takes the label the handler already uses, so a report can be found by the
 * same words that appear in the log.
 */
export function reportServerError(label: string, error: unknown): void {
  console.error(`${label}:`, error);
  if (!sentry) return;
  sentry.captureException(error, { tags: { handler: label } });
}
