/**
 * One process serving the built app and the API, for a host that runs Node.
 *
 * The sibling of scripts/local-api.ts, which is for development: that one
 * opens CORS to everything, hardcodes port 3001 and reads .env off disk,
 * because it sits behind Vite on another port and its only caller is you.
 *
 * Here the static build and /api are the same origin, which is the point.
 * Nothing needs CORS, the browser sends no preflight, and there is one URL to
 * register with Google and Stripe instead of two.
 *
 * The handlers are the same files Vercel deploys. Express request and response
 * objects already satisfy the signature they expect, so there is no adapter
 * here and no second implementation to keep in step.
 */
import express from 'express';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

import stripeHandler from '../api/stripe.js';
import connectHandler from '../api/connect.js';
import zoomHandler from '../api/zoom.js';
import googleHandler from '../api/google.js';
import contactHandler from '../api/contact.js';
import newsletterHandler from '../api/newsletter.js';
import notifyHandler from '../api/notify.js';
import invitesHandler from '../api/invites.js';
import devUserHandler from '../api/dev-user.js';
import stripeWebhookHandler from '../api/stripe-webhook.js';
import aiHandler from '../api/ai.js';
import supportChatHandler from '../api/support-chat.js';

const here = dirname(fileURLToPath(import.meta.url));
const dist = resolve(here, '../dist');

if (!existsSync(join(dist, 'index.html'))) {
  console.error(`No build at ${dist}. Run "npm run build" before starting.`);
  process.exit(1);
}

const app = express();
app.disable('x-powered-by');

/**
 * The same header vercel.json sets.
 *
 * Google's sign-in popup posts its result back through window.opener, and a
 * bare same-origin policy severs that, so the admin's Fetch Details button
 * hangs with the popup open and no error anywhere.
 */
app.use((_req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  next();
});

// Before the JSON parser, and raw: Stripe signs the exact bytes it sent, so a
// body that has been parsed and re-serialised fails verification even when
// every field survived.
app.post('/api/stripe-webhook', express.raw({ type: '*/*' }), (req, res) =>
  stripeWebhookHandler(req as never, res as never)
);

// Zoom signs the exact bytes it sent too, and its webhook shares a route with
// the other Zoom actions, so the raw body is kept alongside the parsed one
// rather than replacing it. verify runs before parsing and cannot reject.
app.use(
  express.json({
    limit: '8mb',
    verify: (req, _res, buf) => {
      (req as never as { rawBody?: string }).rawBody = buf.toString('utf8');
    },
  })
);

const routes = {
  '/api/stripe': stripeHandler,
  '/api/connect': connectHandler,
  '/api/zoom': zoomHandler,
  '/api/google': googleHandler,
  '/api/contact': contactHandler,
  '/api/newsletter': newsletterHandler,
  '/api/notify': notifyHandler,
  '/api/ai': aiHandler,
  // Sends a child's invitation email. Vercel routes api/invites.ts on its own,
  // but this single-process host has to mount every endpoint by hand, and this
  // one was missed - so a parent's invite 404'd in production while working in
  // dev, where local-api.ts does have it.
  //
  // That has now happened twice, invites and then the assistant. A new file in
  // api/ needs mounting in BOTH scripts/local-api.ts and here, or it works
  // perfectly all the way through review and 404s the moment it ships.
  '/api/invites': invitesHandler,
  // Refuses on its own whenever VERCEL_ENV or NODE_ENV is production, so it is
  // mounted unconditionally and guarded where the guard belongs.
  '/api/dev-user': devUserHandler,
  '/api/support-chat': supportChatHandler,
} as const;

for (const [path, handler] of Object.entries(routes)) {
  app.all(path, (req, res) => handler(req as never, res as never));
}

// Anything under /api that matched nothing is a 404 as JSON. Without this it
// would fall through to the SPA below and answer a fetch with an HTML page,
// which surfaces as "Unexpected token < in JSON".
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'No such endpoint.' });
});

// Hashed filenames never change contents, so they can be cached hard. Anything
// else, index.html above all, must not be: a stale index points at bundles
// that no longer exist and the app comes up blank after a deploy.
app.use(
  express.static(dist, {
    setHeaders: (res, path) => {
      if (path.includes('/assets/')) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  })
);

// The SPA rewrite, the same one vercel.json does. Deep links are routed in the
// browser, so every path that is not a file has to be handed index.html.
//
// A middleware rather than app.get('*'). Express 5 moved to path-to-regexp 8,
// where a bare '*' is no longer a wildcard and throws at startup: "Missing
// parameter name at index 1". The named form is '/*splat'; this needs no name
// and reads as what it is, the last thing tried.
app.use((_req, res) => {
  res.sendFile(join(dist, 'index.html'));
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`Yakal listening on ${port}`);
});
