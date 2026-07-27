/**
 * End-to-end check of the /api/drive endpoint against real Drive.
 *
 * verify-drive.mjs proves the credentials work. This proves the handler does,
 * which is a different question: the multipart upload path in particular fails
 * on a Buffer with "part.body.pipe is not a function", and nothing about the
 * credentials would tell you that.
 *
 *   node scripts/verify-drive-upload.mjs
 */

import { readFileSync, existsSync } from 'node:fs';

if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const { default: handler } = await import('../api/drive.ts');

const STUDENT = { id: 'verify00-0000-0000-0000-000000000000', name: 'Verify Student' };

let failures = 0;
const ok = (m) => console.log(`  PASS  ${m}`);
const bad = (m) => {
  console.log(`  FAIL  ${m}`);
  failures++;
};

/** Minimal Vercel req/res pair so the handler can run outside a server. */
async function call(body) {
  const req = { method: 'POST', body };
  let payload, status = 200;
  const res = {
    setHeader: () => res,
    status(c) { status = c; return res; },
    json(j) { payload = j; return res; },
    end() { return res; },
  };
  await handler(req, res);
  return { status, payload };
}

console.log('\nDrive endpoint check\n');

const listed = await call({
  action: 'list',
  studentId: STUDENT.id,
  studentName: STUDENT.name,
});
if (listed.status !== 200) bad(`list: ${listed.payload?.error}`);
else ok(`list works, folder ${listed.payload.folderId}`);

const upload = await call({
  action: 'upload',
  studentId: STUDENT.id,
  studentName: STUDENT.name,
  section: 'Transcripts',
  filename: `verify-${Date.now()}.txt`,
  mimeType: 'text/plain',
  dataBase64: Buffer.from('yakal upload check').toString('base64'),
});
if (upload.status !== 200) bad(`upload: ${upload.payload?.error}`);
else ok(`upload works, file ${upload.payload.file.id}`);

if (upload.payload?.file?.id) {
  const after = await call({
    action: 'list',
    studentId: STUDENT.id,
    studentName: STUDENT.name,
  });
  const inSection = after.payload?.sections
    ?.find((s) => s.name === 'Transcripts')
    ?.files?.some((f) => f.id === upload.payload.file.id);
  inSection
    ? ok('uploaded file appears under Transcripts')
    : bad('uploaded file is not listed under Transcripts');

  const del = await call({ action: 'delete', fileId: upload.payload.file.id });
  del.status === 200 ? ok('delete works (test file cleaned up)') : bad('delete failed');
}

console.log(failures === 0 ? '\nEndpoint is working.\n' : `\n${failures} problem(s).\n`);
process.exit(failures === 0 ? 0 : 1);
