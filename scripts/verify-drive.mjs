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

const ok = (m) => console.log(`  PASS  ${m}`);
const bad = (m, fix) => {
  console.log(`  FAIL  ${m}`);
  if (fix) console.log(`        -> ${fix}`);
  failures++;
};
let failures = 0;

console.log('\nYakal document storage check\n');

// 1. Credentials -------------------------------------------------------------
let creds;
const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
if (raw) {
  try {
    creds = JSON.parse(raw);
    ok('GOOGLE_SERVICE_ACCOUNT_JSON parsed');
  } catch {
    bad('GOOGLE_SERVICE_ACCOUNT_JSON is set but is not valid JSON',
        'Paste the whole key file contents, including the outer braces.');
  }
} else if (existsSync('google-credentials.json')) {
  creds = JSON.parse(readFileSync('google-credentials.json', 'utf8'));
  console.log('  NOTE  Using local google-credentials.json.');
  console.log('        Vercel needs GOOGLE_SERVICE_ACCOUNT_JSON set as well.');
} else {
  bad('No service account credentials found',
      'Set GOOGLE_SERVICE_ACCOUNT_JSON, or keep google-credentials.json locally.');
}

if (!creds) {
  console.log(`\n${failures} problem(s).\n`);
  process.exit(1);
}

console.log(`  INFO  project ${creds.project_id}`);
console.log(`  INFO  service account ${creds.client_email}`);

// A very common paste error: real newlines in the key get flattened to \n and
// the JWT then fails to sign with a misleading "invalid_grant".
const key = String(creds.private_key || '');
if (!key.includes('\n') && key.includes('\\n')) {
  console.log('  NOTE  private_key has escaped newlines. api/drive.ts unescapes them.');
}

const driveId = process.env.GOOGLE_SHARED_DRIVE_ID;
if (driveId) ok(`GOOGLE_SHARED_DRIVE_ID set (${driveId})`);
else bad('GOOGLE_SHARED_DRIVE_ID is not set',
         'Open the shared drive in Drive. The id is the last part of the URL.');

// 2. Authenticate ------------------------------------------------------------
const auth = new google.auth.JWT({
  email: creds.client_email,
  key: key.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/drive'],
});

const drive = google.drive({ version: 'v3', auth });

try {
  await auth.authorize();
  ok('Authenticated with Google');
} catch (e) {
  bad(`Could not authenticate: ${e.message}`,
      'Usually the Drive API is not enabled on the project, or the key was revoked.');
  console.log(`\n${failures} problem(s).\n`);
  process.exit(1);
}

// 3. What shared drives can this account actually see? -----------------------
let visible = [];
try {
  const res = await drive.drives.list({ pageSize: 50, fields: 'drives(id,name)' });
  visible = res.data.drives ?? [];
  if (visible.length === 0) {
    bad('The service account is not a member of any shared drive',
        `Open the shared drive, Manage members, add ${creds.client_email} as Content manager.`);
  } else {
    ok(`Member of ${visible.length} shared drive(s)`);
    visible.forEach((d) => console.log(`        ${d.id}  ${d.name}`));
  }
} catch (e) {
  bad(`Could not list shared drives: ${e.message}`,
      'Enable the Google Drive API at console.cloud.google.com/apis/library/drive.googleapis.com');
}

// 4. Can it write to the configured drive? -----------------------------------
if (driveId) {
  const match = visible.find((d) => d.id === driveId);
  if (visible.length && !match) {
    bad('GOOGLE_SHARED_DRIVE_ID is not one of the drives above',
        'Check you copied the id of the shared drive itself, not a folder inside it.');
  }

  try {
    const probe = await drive.files.create({
      requestBody: {
        name: `yakal-write-check-${Date.now()}`,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [driveId],
      },
      fields: 'id',
      supportsAllDrives: true,
    });
    ok('Can create files in the shared drive');

    await drive.files.delete({ fileId: probe.data.id, supportsAllDrives: true });
    ok('Can delete files in the shared drive (test folder cleaned up)');
  } catch (e) {
    const m = e.message || '';
    bad(`Cannot write to the shared drive: ${m}`,
        /storageQuotaExceeded/.test(m)
          ? 'The target is My Drive, not a shared drive. Service accounts have no storage of their own.'
          : /notFound|404/.test(m)
            ? 'Wrong id, or the service account is not a member of that drive.'
            : `Give ${creds.client_email} at least Content manager on the drive.`);
  }
}

console.log(
  failures === 0
    ? '\nAll checks passed. The Documents tab will work.\n'
    : `\n${failures} problem(s) above.\n`
);
process.exit(failures === 0 ? 0 : 1);
