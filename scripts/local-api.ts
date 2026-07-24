import express from 'express';
import cors from 'cors';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import signatureHandler from '../api/zoom-signature.ts';
import meetingsHandler from '../api/zoom-meetings.ts';
import contactHandler from '../api/contact.ts';
import uploadResumeHandler from '../api/upload-resume.ts';
import googleTokenHandler from '../api/google-token.ts';
import stripeCheckoutHandler from '../api/stripe-checkout.ts';
import stripePortalHandler from '../api/stripe-portal.ts';
import stripeWebhookHandler from '../api/stripe-webhook.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env
config({ path: resolve(__dirname, '../.env') });

const app = express();
app.use(cors());

// Helper to mock VercelRequest/VercelResponse
const createVercelHandler = (handler) => async (req, res) => {
  // express req/res are mostly compatible with VercelReq/Res
  // VercelResponse adds .status() and .json() which Express already has
  return handler(req, res);
};

// Stripe webhook needs the RAW body for signature verification — register it
// with express.raw BEFORE the global JSON parser.
app.post('/api/stripe-webhook', express.raw({ type: '*/*' }), createVercelHandler(stripeWebhookHandler));

// JSON body parser for every other route.
app.use(express.json({ limit: '5mb' }));

app.all('/api/upload-resume', createVercelHandler(uploadResumeHandler));
app.all('/api/zoom-signature', createVercelHandler(signatureHandler));
app.all('/api/zoom-meetings', createVercelHandler(meetingsHandler));
app.all('/api/contact', createVercelHandler(contactHandler));
app.all('/api/google-token', createVercelHandler(googleTokenHandler));
app.all('/api/stripe-checkout', createVercelHandler(stripeCheckoutHandler));
app.all('/api/stripe-portal', createVercelHandler(stripePortalHandler));

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Local API server running on http://localhost:${PORT}`);
});
