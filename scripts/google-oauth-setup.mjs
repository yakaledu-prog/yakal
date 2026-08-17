/**
 * One-time: mint a Drive refresh token for the Yakal operations account.
 *
 * This is the path that works without Google Workspace. You sign in once as the
 * account that should own student documents, and the server keeps a refresh
 * token so it can act as that account forever without anyone signing in again.
 *
 *   node scripts/google-oauth-setup.mjs
 *
 * Needs VITE_GCP_CLIENT_ID and GCP_CLIENT_SECRET in the environment or .env,
 * and http://localhost:5599/callback registered as an authorised redirect URI
 * on that OAuth client.
 */

import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { auth as googleAuth } from '@googleapis/drive';

// Override with --port if 5599 is taken, or to match a URI already registered
// on the client: node scripts/google-oauth-setup.mjs --port 5173
const portArg = process.argv.indexOf('--port');
const PORT = portArg !== -1 ? Number(process.argv[portArg + 1]) : 5599;
const REDIRECT = `http://localhost:${PORT}/callback`;

/**
 * drive.file, not drive.
 *
 * It grants access only to files this app created, which is all Yakal ever
 * touches. It is also a non-sensitive scope, so the consent screen can be
 * published without a Google verification review. That matters: while an app
 * is in Testing, refresh tokens expire after seven days.
 */
const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  // Classroom, so the server can read a class and write the coursework a
  // course ships with. The account signing in has to be a teacher on the
  // class; Google refuses coursework.students to anyone else.
  'https://www.googleapis.com/auth/classroom.courses',
  'https://www.googleapis.com/auth/classroom.coursework.students',
  'https://www.googleapis.com/auth/classroom.rosters.readonly',
  'https://www.googleapis.com/auth/classroom.student-submissions.students.readonly',
  // Topics are their own scope, and classroom.courses does not cover them.
  // Without this, courses.topics.list answers "Request had insufficient
  // authentication scopes" and nothing else breaks: the read-through treats a
  // topics failure as a class that groups nothing, so the work still lists,
  // flat. That is the right way to fail and a terrible way to find out, since
  // grouping simply never appears and the code looks correct. A token minted
  // before this line was added has to be minted again.
  'https://www.googleapis.com/auth/classroom.topics.readonly',
];

// Minimal .env reader so this runs without pulling in a dependency.
if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}

const clientId = process.env.VITE_GCP_CLIENT_ID;
const clientSecret = process.env.GCP_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error('\nMissing VITE_GCP_CLIENT_ID or GCP_CLIENT_SECRET.');
  console.error('Find them at console.cloud.google.com > APIs & Services > Credentials.\n');
  process.exit(1);
}

const oauth = new googleAuth.OAuth2(clientId, clientSecret, REDIRECT);

const url = oauth.generateAuthUrl({
  access_type: 'offline',
  scope: SCOPES,
  // Without this Google returns no refresh token on a repeat authorisation,
  // which is the single most common reason this flow appears to silently fail.
  prompt: 'consent',
});

// Printed up front because redirect_uri_mismatch is the failure everyone hits
// first, and Google's error page does not say which URI it expected.
const projectNumber = clientId.split('-')[0];
console.log('Before you continue, this exact URI must be registered on the client:\n');
console.log(`  Redirect URI  ${REDIRECT}`);
console.log(`  OAuth client  ${clientId}`);
console.log(
  `  Register at   https://console.cloud.google.com/apis/credentials?project=${projectNumber}`
);
console.log('                (open the client, Authorised redirect URIs, Add URI, Save)\n');
console.log('Then open this URL, signed in as the account that should own the files:\n');
console.log(url + '\n');

const server = http.createServer(async (req, res) => {
  if (!req.url?.startsWith('/callback')) return res.end();

  const code = new URL(req.url, REDIRECT).searchParams.get('code');
  if (!code) {
    res.end('No code returned.');
    return;
  }

  try {
    const { tokens } = await oauth.getToken(code);
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h2>Done. Return to your terminal.</h2>');

    if (!tokens.refresh_token) {
      console.error('\nGoogle returned no refresh token.');
      console.error('Revoke access at myaccount.google.com/permissions and retry.\n');
      process.exit(1);
    }

    console.log('\nSet this in Vercel and in .env:\n');
    console.log(`GOOGLE_OAUTH_REFRESH_TOKEN=${tokens.refresh_token}\n`);
    console.log('Then: node scripts/verify-drive.mjs\n');
  } catch (e) {
    console.error('\nToken exchange failed:', e.message);
    console.error(`Check that ${REDIRECT} is an authorised redirect URI.\n`);
  } finally {
    server.close();
    setTimeout(() => process.exit(0), 200);
  }
});

server.listen(PORT, () => console.log(`Waiting for the redirect on ${REDIRECT} ...\n`));
