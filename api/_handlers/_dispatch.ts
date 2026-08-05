import type { VercelRequest, VercelResponse } from '@vercel/node';

type Handler = (req: VercelRequest, res: VercelResponse) => unknown;

/** A handler, or a function that imports the module holding one. */
type Route = Handler | (() => Promise<{ default: Handler }>);

/** Loaders take no arguments; handlers take a request and a response. */
function isLoader(route: Route): route is () => Promise<{ default: Handler }> {
  return route.length === 0;
}

/**
 * Turns a set of handlers into one serverless function, chosen by ?action=.
 *
 * Every handler keeps the signature it had as its own endpoint, so nothing in
 * them changed when they were grouped. An unknown action is a 404 naming what
 * was valid, because the alternative is a silent 200 with an empty body.
 *
 * A route may be given as `() => import('./thing')` instead of the handler
 * itself, and then that module is only loaded when its action is asked for.
 * This matters because the actions grouped here do not need the same things:
 * the Google token exchange needs no SDK at all, but sat behind top-level
 * imports of the Drive and Classroom clients, so anything that stopped those
 * from loading stopped the token exchange too. Lazy routes fail alone.
 *
 * Whatever goes wrong answers as JSON. A handler that threw where its own
 * try could not catch it got Vercel's HTML error page instead, which the
 * browser could not parse, so the real reason never reached the client and
 * every failure looked the same from the outside.
 */
export function dispatch(routes: Record<string, Route>) {
  return async function handler(req: VercelRequest, res: VercelResponse) {
    const action = String(req.query.action ?? '');
    const route = routes[action];
    if (!route) {
      return res.status(404).json({
        error: action ? `Unknown action: ${action}` : 'Missing ?action=',
        expected: Object.keys(routes),
      });
    }

    try {
      const fn = isLoader(route) ? (await route()).default : route;
      return await fn(req, res);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Action ${action} failed:`, error);
      if (res.headersSent) return;
      return res.status(500).json({ error: `Action ${action} failed: ${message}` });
    }
  };
}
