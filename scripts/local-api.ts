import express from 'express';
import cors from 'cors';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

// The same entry points Vercel deploys, imported the same way, so a
// route that works here works there. The grouped ones dispatch on ?action=;
// see api/_handlers/README.md for why they are grouped at all.
import stripeHandler from '../api/stripe.ts';
import connectHandler from '../api/connect.ts';
import zoomHandler from '../api/zoom.ts';
import googleHandler from '../api/google.ts';
import contactHandler from '../api/contact.ts';
import newsletterHandler from '../api/newsletter.ts';
import notifyHandler from '../api/notify.ts';
import devUserHandler from '../api/dev-user.ts';
import invitesHandler from '../api/invites.ts';
import { handleHealth } from '../api/_utils/health.ts';
import stripeWebhookHandler from '../api/stripe-webhook.ts';
import aiHandler from '../api/ai.ts';
import supportChatHandler from '../api/support-chat.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env
config({ path: resolve(__dirname, '../.env') });

const app = express();
app.use(cors());

// Helper to mock VercelRequest/VercelResponse
const createVercelHandler =
  (handler: (req: any, res: any) => unknown) =>
  async (req: any, res: any) => {
  // express req/res are mostly compatible with VercelReq/Res
  // VercelResponse adds .status() and .json() which Express already has
  return handler(req, res);
};

// Stripe webhook needs the RAW body for signature verification - register it
// with express.raw BEFORE the global JSON parser.
app.post('/api/stripe-webhook', express.raw({ type: '*/*' }), createVercelHandler(stripeWebhookHandler));

// JSON body parser for every other route.
// Uploads arrive base64 encoded, which inflates them by a third, so this has to
// clear the file limit in driveService with room to spare.
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

// Not a deployed function, so it is not wrapped: see api/_utils/health.ts.
app.get('/api/healthz', (req, res) => handleHealth(req, res));

app.all('/api/stripe', createVercelHandler(stripeHandler));
app.all('/api/connect', createVercelHandler(connectHandler));
app.all('/api/zoom', createVercelHandler(zoomHandler));
app.all('/api/google', createVercelHandler(googleHandler));
app.all('/api/contact', createVercelHandler(contactHandler));
app.all('/api/invites', createVercelHandler(invitesHandler));
app.all('/api/newsletter', createVercelHandler(newsletterHandler));
app.all('/api/notify', createVercelHandler(notifyHandler));
app.all('/api/ai', createVercelHandler(aiHandler));
// Developer console only. Refuses unless DEV_TOOLS_ENABLED=true.
app.all('/api/dev-user', createVercelHandler(devUserHandler));
app.all('/api/support-chat', createVercelHandler(supportChatHandler));

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Local API server running on http://localhost:${PORT}`);
});
