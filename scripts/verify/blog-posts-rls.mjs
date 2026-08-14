// ============================================================
// blog_posts was writable by the entire internet.
//
// The baseline schema gave it "Enable all access" with USING (true) for anon,
// and GRANT ALL to anon on top. Postgres defaults an ALL policy's WITH CHECK
// to its USING expression, so that covered insert, update and delete, not just
// select. The anon key ships in the browser bundle by design, so anyone who
// opened devtools could publish, rewrite or delete any post.
//
// An unauthenticated POST really did return 201 before the fix. These cases
// exist so nobody reintroduces a permissive policy without noticing.
//
// Needs the local Supabase running. No browser.
// ============================================================

import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../../.env', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trimStart().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);

const URL_BASE = env.VITE_SUPABASE_LOCAL_URL || 'http://127.0.0.1:54321';
const ANON = env.VITE_SUPABASE_LOCAL_ANON_KEY;

let failures = 0;
const pass = (name, ok, detail = '') => {
  if (ok) console.log(`ok    ${name}`);
  else {
    console.error(`FAIL  ${name}${detail ? `\n        ${detail}` : ''}`);
    failures++;
  }
};

const headers = (token) => ({
  apikey: ANON,
  Authorization: `Bearer ${token ?? ANON}`,
  'Content-Type': 'application/json',
});

async function signIn(email) {
  const res = await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'demo123' }),
  });
  const body = await res.json();
  return body.access_token ?? null;
}

const post = (token) =>
  fetch(`${URL_BASE}/rest/v1/blog_posts`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({
      title: `rls check ${Date.now()}`,
      content: 'x',
      status: 'draft',
      read_time_minutes: 1,
    }),
  });

// -- anonymous ---------------------------------------------------------------
const anonWrite = await post(null);
pass('an anonymous visitor cannot create a post', !anonWrite.ok, `got ${anonWrite.status}`);

const anonDelete = await fetch(`${URL_BASE}/rest/v1/blog_posts?status=eq.published`, {
  method: 'DELETE',
  headers: headers(null),
});
pass('an anonymous visitor cannot delete posts', !anonDelete.ok, `got ${anonDelete.status}`);

const published = await fetch(
  `${URL_BASE}/rest/v1/blog_posts?select=id&status=eq.published&limit=1`,
  { headers: headers(null) }
).then((r) => r.json());
pass('published posts are still public', Array.isArray(published) && published.length > 0);

const drafts = await fetch(`${URL_BASE}/rest/v1/blog_posts?select=id&status=eq.draft`, {
  headers: headers(null),
}).then((r) => r.json());
pass('drafts are not public', Array.isArray(drafts) && drafts.length === 0);

// -- a signed-in non-admin ---------------------------------------------------
const student = await signIn('student@yakal.com');
if (student) {
  const studentWrite = await post(student);
  pass('a signed-in student cannot create a post', !studentWrite.ok, `got ${studentWrite.status}`);
}

// -- an admin, which must keep working ---------------------------------------
const admin = await signIn('admin@yakal.com');
if (admin) {
  const created = await post(admin);
  pass('an admin can create a post', created.ok, `got ${created.status}`);
  // Cleaned up whether or not the assertion passed, so a failing run does not
  // leave rows behind for the next one.
  await fetch(`${URL_BASE}/rest/v1/blog_posts?title=like.rls%20check%25`, {
    method: 'DELETE',
    headers: headers(admin),
  });
}

if (failures > 0) {
  console.error(`\n${failures} failed`);
  process.exit(1);
}
console.log('\nall passed');
