import type { VercelRequest, VercelResponse } from '@vercel/node';

type Handler = (req: VercelRequest, res: VercelResponse) => unknown;

/**
 * Turns a set of handlers into one serverless function, chosen by ?action=.
 *
 * Every handler keeps the signature it had as its own endpoint, so nothing in
 * them changed when they were grouped. An unknown action is a 404 naming what
 * was valid, because the alternative is a silent 200 with an empty body.
 */
export function dispatch(routes: Record<string, Handler>) {
  return async function handler(req: VercelRequest, res: VercelResponse) {
    const action = String(req.query.action ?? '');
    const route = routes[action];
    if (!route) {
      return res.status(404).json({
        error: action ? `Unknown action: ${action}` : 'Missing ?action=',
        expected: Object.keys(routes),
      });
    }
    return route(req, res);
  };
}
