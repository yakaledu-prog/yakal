// ============================================================
// Telling somebody when the app breaks.
//
// A crash in the browser reached componentDidCatch, which called console.error
// into a console nobody was watching. A failure on the server went to the host's
// log, which nobody read. Three production bugs this month were each found by a
// person reporting a screenshot, and each took several rounds to place.
//
// Loaded only when a DSN is configured, and dynamically, so a developer running
// locally pays nothing for it and the SDK lands in its own chunk rather than the
// first paint.
//
// What is deliberately NOT sent: this is user data leaving our servers for
// somebody else's, on a platform used by children. No request bodies, no
// message contents, and identity limited to the account id. See scrub() below.
// ============================================================

type SentryModule = typeof import("@sentry/browser");

let sentry: SentryModule | null = null;
let started = false;

const DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;

/** Anything that could carry a token, an address or somebody's words. */
const SENSITIVE = /(^|[_-])(token|secret|key|password|authorization|cookie|email|phone|content|message|body)($|[_-])/i;

/**
 * Strip what should never leave.
 *
 * An allow-list would be safer still, but the shape of an event is Sentry's,
 * not ours, so this removes by name and accepts that it is the weaker of the
 * two. Anything genuinely secret should not be in an error message to begin
 * with; this is the second line, not the first.
 */
function scrub(event: any): any {
  if (event?.request) {
    delete event.request.cookies;
    delete event.request.data;
    if (event.request.headers) delete event.request.headers;
    // A query string is where tokens end up when somebody is in a hurry.
    if (typeof event.request.query_string === "string") delete event.request.query_string;
  }

  // The signed-in account, and nothing else about them. Knowing which user hit
  // a bug is most of the value; knowing their address is none of it.
  if (event?.user) {
    event.user = event.user.id ? { id: event.user.id } : undefined;
  }

  const prune = (obj: Record<string, unknown> | undefined) => {
    if (!obj) return;
    for (const k of Object.keys(obj)) if (SENSITIVE.test(k)) delete obj[k];
  };
  prune(event?.extra);
  prune(event?.tags);
  prune(event?.contexts);

  return event;
}

/** Start reporting, if this deployment is configured for it. */
export async function startErrorReporting(): Promise<void> {
  if (started || !DSN) return;
  started = true;

  try {
    sentry = await import("@sentry/browser");
    sentry.init({
      dsn: DSN,
      environment: import.meta.env.MODE,
      // Named rather than defaulted. The default set includes tracing and
      // browser-performance integrations that this does not use, and naming
      // them is what lets the bundler drop the rest.
      integrations: (defaults) =>
        defaults.filter((i) =>
          ["InboundFilters", "FunctionToString", "BrowserApiErrors", "GlobalHandlers", "LinkedErrors", "Dedupe", "HttpContext"].includes(i.name)
        ),
      // Errors only. Performance tracing multiplies the event count and the
      // free tier is 5k a month; the question being answered here is "what
      // broke", not "what was slow".
      tracesSampleRate: 0,
      // Off, permanently, and not a cost decision. Replay records the screen,
      // and the people on the other side of it are children.
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,
      sendDefaultPii: false,
      beforeSend: (event) => scrub(event),
    });
  } catch {
    // Reporting failing must never be the thing the user sees. If the SDK
    // cannot load, the app carries on without it.
    started = false;
  }
}

/** Who is signed in, so a report can be tied to an account. Id only. */
export function identify(userId: string | null): void {
  sentry?.setUser(userId ? { id: userId } : null);
}

/** Report a crash the error boundary caught. */
export function reportError(error: unknown, context?: Record<string, string>): void {
  if (!sentry) return;
  sentry.captureException(error, context ? { tags: context } : undefined);
}
