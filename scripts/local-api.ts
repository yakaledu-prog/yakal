import express from 'express';
import cors from 'cors';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import signatureHandler from '../api/zoom-signature.ts';
import meetingsHandler from '../api/zoom-meetings.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env
config({ path: resolve(__dirname, '../.env') });

const app = express();
app.use(cors());
app.use(express.json());

// Helper to mock VercelRequest/VercelResponse
const createVercelHandler = (handler) => async (req, res) => {
  // express req/res are mostly compatible with VercelReq/Res
  // VercelResponse adds .status() and .json() which Express already has
  return handler(req, res);
};

app.all('/api/zoom-signature', createVercelHandler(signatureHandler));
app.all('/api/zoom-meetings', createVercelHandler(meetingsHandler));

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Local API server running on http://localhost:${PORT}`);
});
