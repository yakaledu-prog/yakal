import type { VercelRequest, VercelResponse } from '@vercel/node';

/** The code, from a body that may be an object, a JSON string, or missing. */
function readCode(body: unknown): string | null {
  if (!body) return null;
  if (typeof body === 'string') {
    try {
      return (JSON.parse(body) as { code?: string }).code ?? null;
    } catch {
      return null;
    }
  }
  if (typeof body === 'object') {
    return ((body as { code?: unknown }).code as string) ?? null;
  }
  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS setup
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Read rather than destructured, and every shape a body arrives in.
  //
  // Destructuring req.body threw when it was undefined, and because that
  // happened outside the try below, the platform answered with an HTML error
  // page. The browser could not read that as JSON, so it fell back to its own
  // wording and the real reason never left the server. That is the 500 behind
  // "Failed to exchange token".
  //
  // Vercel hands this over parsed, as a raw string, or not at all depending on
  // the headers it saw. Locally express always parses. All three are handled
  // here so the difference stops mattering.
  const code = readCode(req.body);
  if (!code) {
    return res.status(400).json({
      error:
        'No authorization code reached the server. The sign-in popup was closed before it finished, or the request arrived without one.',
    });
  }

  const clientId = process.env.VITE_GCP_CLIENT_ID;
  const clientSecret = process.env.GCP_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: 'Missing Google Client ID or Secret in environment variables.' });
  }

  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: 'postmessage', // standard for React popup flow
      }),
    });

    const data = (await response.json()) as {
      error?: string;
      error_description?: string;
      [key: string]: unknown;
    };

    if (!response.ok) {
      console.error('Google token exchange failed:', data);
      // Google's own words, and its code, because the two most common answers
      // here need different fixes: invalid_client is the wrong secret for this
      // client id, redirect_uri_mismatch is the origin.
      const detail = data.error_description || data.error || 'no reason given';
      return res.status(response.status).json({
        error: `Google refused the code: ${detail}${data.error ? ` (${data.error})` : ''}`,
      });
    }

    // Returns: access_token, refresh_token, expires_in, scope, token_type, id_token
    return res.status(200).json(data);
  } catch (error: any) {
    console.error('Error exchanging Google token:', error);
    return res.status(500).json({ error: error.message });
  }
}
