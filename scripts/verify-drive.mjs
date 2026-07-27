/**
 * Checks that document storage is wired up, and says exactly what is wrong when
 * it is not.
 *
 * Every failure mode here is one that otherwise surfaces as an opaque 403 or
 * 404 from the Drive API at runtime, so it is worth checking deliberately once
 * rather than debugging it through the UI.
 *
 *   node scripts/verify-drive.mjs
 *
 * Reads GOOGLE_SERVICE_ACCOUNT_JSON and GOOGLE_SHARED_DRIVE_ID from the
 * environment, falling back to ./google-credentials.json for local runs.
 */

import { readFileSync, existsSync } from 'node:fs';
import { google } from 'googleapis';

// Minimal .env reader so this runs without pulling in a dependency.
if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const ok = (m) => console.log(`  PASS  ${m}`);
const bad = (m, fix) => {
  console.log(`  FAIL  ${m}`);
  if (fix) console.log(`        -> ${fix}`);
  failures++;
};
let failures = 0;

console.log('\nYakal document storage check\n');

// 1. Pick a mode ------------------------------------------------------------
const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
const serviceKeyRaw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
const driveId = process.env.GOOGLE_SHARED_DRIVE_ID || null;

let auth;
let mode;

if (refreshToken) {
  mode = 'oauth';
  ok('GOOGLE_OAUTH_REFRESH_TOKEN is set');
  const id = process.env.VITE_GCP_CLIENT_ID;
  const secret = process.env.GCP_CLIENT_SECRET;
  if (!id || !secret) {
    bad('VITE_GCP_CLIENT_ID or GCP_CLIENT_SECRET is missing',
        'Both are needed to exchange the refresh token.');
  } else {
    auth = new google.auth.OAuth2(id, secret);
    auth.setCredentials({ refresh_token: refreshToken });
  }
  console.log(driveId
    ? `  INFO  Shared drive ${driveId}`
    : '  INFO  No shared drive. Files go to "Yakal Students" in My Drive.');
} else if (serviceKeyRaw || existsSync('google-credentials.json')) {
  mode = 'service_account';
  let creds;
  try {
    creds = serviceKeyRaw
      ? JSON.parse(serviceKeyRaw)
      : JSON.parse(readFileSync('google-credentials.json', 'utf8'));
    if (!serviceKeyRaw) {
      console.log('  NOTE  Using local google-credentials.json.');
      console.log('        Vercel needs GOOGLE_SERVICE_ACCOUNT_JSON set as well.');
    }
  } catch {
    bad('Service account credentials are not valid JSON',
        'Paste the whole key file, including the outer braces.');
  }

  if (creds) {
    console.log(`  INFO  project ${creds.project_id}`);
    console.log(`  INFO  service account ${creds.client_email}`);
    if (!driveId) {
      bad('A service account needs GOOGLE_SHARED_DRIVE_ID',
          'Service accounts have no storage and cannot own files. Either create a '
          + 'shared drive (needs Workspace), or use GOOGLE_OAUTH_REFRESH_TOKEN instead: '
          + 'node scripts/google-oauth-setup.mjs');
    }
    auth = new google.auth.JWT({
      email: creds.client_email,
      key: String(creds.private_key || '').replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/drive'],
    });
  }
} else {
  bad('Nothing is configured',
      'Easiest path with no Workspace: node scripts/google-oauth-setup.mjs');
}

if (!auth) {
  console.log(`\n${failures} problem(s).\n`);
  process.exit(1);
}
console.log(`  INFO  mode: ${mode}`);

// 2. Authenticate ------------------------------------------------------------
const drive = google.drive({ version: 'v3', auth });

try {
  if (mode === 'oauth') await auth.getAccessToken();
  else await auth.authorize();
  ok('Authenticated with Google');
} catch (e) {
  bad(`Could not authenticate: ${e.message}`,
      mode === 'oauth'
        ? 'The refresh token may be revoked or expired. If the OAuth consent screen '
          + 'is still in Testing, tokens die after 7 days: publish it to Production.'
        : 'Usually the Drive API is not enabled on the project, or the key was revoked.');
  console.log(`\n${failures} problem(s).\n`);
  process.exit(1);
}

// 3. Shared drive membership, only relevant when one is configured -----------
let visible = [];
if (driveId) {
  try {
    const res = await drive.drives.list({ pageSize: 50, fields: 'drives(id,name)' });
    visible = res.data.drives ?? [];
    if (visible.length === 0) {
      bad('This account is not a member of any shared drive',
          'Open the shared drive, Manage members, add the account as Content manager.');
    } else {
      ok(`Member of ${visible.length} shared drive(s)`);
      visible.forEach((d) => console.log(`        ${d.id}  ${d.name}`));
      if (!visible.some((d) => d.id === driveId)) {
        bad('GOOGLE_SHARED_DRIVE_ID is not one of the drives above',
            'Check you copied the id of the shared drive itself, not a folder inside it.');
      }
    }
  } catch (e) {
    bad(`Could not list shared drives: ${e.message}`,
        'Enable the Drive API at console.cloud.google.com/apis/library/drive.googleapis.com');
  }
}

// 4. Can it actually store bytes? --------------------------------------------
// This uploads real content rather than creating a folder. Folders consume no
// quota, so a service account with nowhere to store anything still creates them
// happily: probing with a folder reports success and the first real upload then
// fails. The whole point of this script is to not find that out later.
const where = driveId ? 'the shared drive' : 'My Drive';
try {
  const probe = await drive.files.create({
    requestBody: {
      name: `yakal-write-check-${Date.now()}.txt`,
      parents: [driveId ?? 'root'],
    },
    media: { mimeType: 'text/plain', body: 'yakal write check' },
    fields: 'id',
    supportsAllDrives: true,
  });
  ok(`Can upload files to ${where}`);

  await drive.files.delete({ fileId: probe.data.id, supportsAllDrives: true });
  ok('Can delete files (test folder cleaned up)');
} catch (e) {
  const m = e.message || '';
  bad(`Cannot write to ${where}: ${m}`,
      /storageQuotaExceeded|do not have storage quota/i.test(m)
        ? 'Service accounts have no storage of their own and can only own files '
          + 'inside a shared drive. Use GOOGLE_OAUTH_REFRESH_TOKEN instead, or add '
          + 'Workspace and a shared drive.'
        : /notFound|404/.test(m)
          ? 'Wrong id, or this account is not a member of that drive.'
          : 'Grant at least Content manager on the target.');
}

console.log(
  failures === 0
    ? '\nAll checks passed. The Documents tab will work.\n'
    : `\n${failures} problem(s) above.\n`
);
process.exit(failures === 0 ? 0 : 1);
