// What a crawler and a link preview get.
//
// The app is one HTML shell for every route, so a shared blog post used to
// arrive as "Yakal Education Services" with the app icon, whatever the post
// was about, and there was no sitemap or robots.txt at all.
//
// The string work is checked directly. The routes are checked against a real
// server, started here against the built app, if there is a build and a local
// Supabase; otherwise that half says it skipped rather than passing quietly.
//
//   npx tsx scripts/verify/seo.ts
import 'dotenv/config';
import { readFileSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { buildSitemap, injectMeta, summarise, PUBLIC_PAGES } from '../../api/_utils/seo.js';

let failures = 0;
const pass = (s: string, ok: boolean, d = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${s}${d ? '  -> ' + d : ''}`);
};

// ---- robots.txt ----
const robots = existsSync('public/robots.txt') ? readFileSync('public/robots.txt', 'utf8') : '';
pass('robots.txt exists', robots.length > 0);
pass('it points at the sitemap', /Sitemap:\s*https:\/\/yakal\.me\/sitemap\.xml/.test(robots));
for (const priv of ['/admin', '/parent', '/student', '/tutor', '/counselor', '/dev']) {
  pass(`${priv} is not for crawling`, robots.includes(`Disallow: ${priv}`));
}

// ---- the shell, filled in ----
const shell = `<!DOCTYPE html><html><head>
  <title>Yakal Education Services</title>
  <meta name="description" content="the default one" />
</head><body></body></html>`;

const filled = injectMeta(shell, {
  title: 'A "quoted" & <hostile> title',
  description: 'What the post says.',
  image: 'https://example.test/cover.jpg',
  url: 'https://yakal.me/post/abc',
  type: 'article',
});

pass('the title is replaced, not added to', (filled.match(/<title>/g) ?? []).length === 1);
pass('and it is the page\'s own', /<title>A &quot;quoted&quot; &amp; &lt;hostile&gt; title<\/title>/.test(filled));
pass('the default description is gone', !filled.includes('the default one'));
pass('a link preview has a picture', filled.includes('<meta property="og:image" content="https://example.test/cover.jpg" />'));
pass('and a canonical url', filled.includes('<link rel="canonical" href="https://yakal.me/post/abc" />'));
pass('nothing hostile survives into an attribute', !/content="[^"]*<script/i.test(filled));

// Serving the same page twice must not stack tags.
const twice = injectMeta(filled, {
  title: 'Second pass',
  description: 'Again.',
  url: 'https://yakal.me/post/abc',
});
pass('re-filling replaces rather than repeats', (twice.match(/og:title/g) ?? []).length === 1);
pass('a post with no picture asks for the small card', twice.includes('content="summary"'));

// ---- summaries ----
pass(
  'a summary is text, not markup',
  summarise('<p>Hello <b>there</b>,&nbsp;reader.</p>') === 'Hello there, reader.',
  summarise('<p>Hello <b>there</b>,&nbsp;reader.</p>')
);
pass('a long one is cut', summarise('word '.repeat(60), 10).endsWith('...'));

// ---- sitemap ----
const xml = buildSitemap('https://yakal.me/', [
  ...PUBLIC_PAGES,
  { path: '/post/abc', lastModified: '2026-09-15T10:00:00Z' },
]);
pass('the sitemap is xml', xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
pass('with the right namespace', xml.includes('http://www.sitemaps.org/schemas/sitemap/0.9'));
pass('the landing page is in it', xml.includes('<loc>https://yakal.me/</loc>'));
pass('so are posts, with a date', xml.includes('<loc>https://yakal.me/post/abc</loc>') && xml.includes('<lastmod>2026-09-15</lastmod>'));
pass('no trailing double slash', !xml.includes('yakal.me//'));
for (const priv of ['/admin', '/login', '/parent']) {
  pass(`${priv} is not listed`, !xml.includes(`<loc>https://yakal.me${priv}`));
}

// ---- the routes, against the real server ----
const built = existsSync('dist/index.html');
const supabase = await fetch('http://127.0.0.1:54321/rest/v1/', { method: 'HEAD' })
  .then(() => true)
  .catch(() => false);

if (!built || !supabase) {
  console.log(`skip  the server half: ${!built ? 'no dist, run npm run build' : 'local Supabase is not up'}`);
} else {
  const port = 3999;
  const server = spawn('npx', ['tsx', 'scripts/server.ts'], {
    env: {
      ...process.env,
      PORT: String(port),
      PUBLIC_APP_URL: 'https://yakal.me',
      VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
      SUPABASE_SERVICE_ROLE_KEY:
        process.env.SUPABASE_LOCAL_SERVICE_ROLE_KEY ||
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU',
    },
    stdio: 'ignore',
  });

  const base = `http://127.0.0.1:${port}`;
  const up = async () => {
    for (let i = 0; i < 40; i++) {
      try {
        await fetch(base + '/robots.txt');
        return true;
      } catch {
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    return false;
  };

  try {
    if (!(await up())) {
      pass('the server starts', false, 'it never answered');
    } else {
      const r = await fetch(base + '/robots.txt');
      pass('robots.txt is served', r.ok && (await r.text()).includes('Sitemap:'));

      const sm = await fetch(base + '/sitemap.xml');
      const smText = await sm.text();
      pass('sitemap.xml is served as xml', sm.ok && (sm.headers.get('content-type') ?? '').includes('xml'));
      pass('it lists the published posts', (smText.match(/<loc>[^<]*\/post\//g) ?? []).length > 0, `${(smText.match(/<loc>/g) ?? []).length} urls`);

      // A real post, and one that does not exist.
      const id = smText.match(/\/post\/([0-9a-f-]{36})/)?.[1];
      if (id) {
        const page = await fetch(`${base}/post/${id}`);
        const html = await page.text();
        pass('a post carries its own title', /<title>(?!Yakal Education Services<)/.test(html), html.match(/<title>[^<]*/)?.[0]);
        pass('and its own og:title', html.includes('og:title'));
        pass('and a canonical url on the live origin', html.includes(`<link rel="canonical" href="https://yakal.me/post/${id}" />`));
      } else {
        console.log('skip  no published post to check the tags on');
      }

      const missing = await fetch(`${base}/post/00000000-0000-0000-0000-000000000000`);
      const missingHtml = await missing.text();
      pass('an unknown post falls back to the app shell', missing.ok && missingHtml.includes('<title>Yakal Education Services</title>'));
    }
  } finally {
    server.kill();
  }
}

console.log(failures === 0 ? '\nall passed' : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
