// Every notification link points at a route that exists.
//
// Three of them did not. essayReview sent a student to /student/college/essays
// and application sent them to /student/college/tracker, neither of which is a
// route: the notification opened a not-found page, and the email's button did
// the same from an inbox. courseApplicationDecided sent a tutor to
// /tutor/my-courses, same thing.
//
// None of it showed up anywhere. A template is data, so a dead link is a
// string that type checks, renders, sends, and only fails for the person who
// clicks it. Nothing else in the suite follows a notification to its
// destination, so this reads the router and checks them against it.
import { readFileSync } from 'node:fs';
import { TEMPLATES, TEMPLATE_KEYS } from '../../src/lib/notifications/templates/index.js';
import { renderNotification, renderEmail } from '../../src/lib/notifications/index.js';

let failures = 0;
const pass = (s: string, ok: boolean, d = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'ok   ' : 'FAIL '} ${s}${d ? '  -> ' + d : ''}`);
};

// ---- what routes exist ----
//
// Read out of the router rather than listed here. A list would be a second
// copy of the routing table and would rot the first time somebody renamed a
// page, which is exactly the failure this is meant to catch.
const router = readFileSync(new URL('../../src/app/Router.tsx', import.meta.url), 'utf8');
const ROLES = ['student', 'parent', 'tutor', 'counselor', 'admin'];

const routes = new Set<string>();
for (const role of ROLES) {
  const start = router.indexOf(`path: "${role}"`);
  if (start === -1) continue;
  // Up to the role's catch-all, which closes its block.
  const end = router.indexOf('path: "*"', start);
  const block = router.slice(start, end === -1 ? undefined : end);
  routes.add(`/${role}`);
  for (const [, p] of block.matchAll(/path: "([^"*]+)"/g)) {
    if (p === role) continue;
    routes.add(`/${role}/${p}`);
  }
}
pass('the router yields routes to check against', routes.size > 20, `${routes.size} routes`);

/**
 * Does this path exist?
 *
 * The query string is dropped, and a segment of a declared route that starts
 * with a colon matches anything, so /parent/children/:id accepts a real id.
 */
function routeExists(href: string): boolean {
  const path = href.split('?')[0].replace(/\/+$/, '') || '/';
  if (routes.has(path)) return true;
  const parts = path.split('/');
  for (const candidate of routes) {
    const c = candidate.split('/');
    if (c.length !== parts.length) continue;
    if (c.every((seg, i) => seg.startsWith(':') || seg === parts[i])) return true;
  }
  return false;
}

// ---- every template, rendered from its own sample ----
for (const key of TEMPLATE_KEYS) {
  const vars = (TEMPLATES[key] as { sample: unknown }).sample;
  const n = renderNotification(key, vars as never);
  const e = renderEmail(key, vars as never);

  if (n.link) {
    pass(`${key}: the notification link is a real route`, routeExists(n.link), n.link);
  }
  if (e.cta) {
    pass(`${key}: the email button is a real route`, routeExists(e.cta.url), e.cta.url);
  }

  // A row with nothing to say beyond its title is the thin notification this
  // was all about: one line and a bare Open button. Every template owes the
  // reader either a fact or a place to go.
  //
  // Except `system`, which is the free-text catch-all. Its facts are whatever
  // the caller wrote into the body, and a maintenance notice genuinely has
  // nowhere to send anybody.
  if (key !== 'system') {
    pass(
      `${key}: it says more than its title`,
      e.facts.length > 0 || !!e.cta,
      `${e.facts.length} facts, cta=${e.cta ? 'yes' : 'no'}`
    );
  }

  // "Open" tells nobody anything. The label is what a reader decides on.
  if (e.cta) {
    pass(`${key}: the button says what it does`, !/^(open|click|go|here)$/i.test(e.cta.label), e.cta.label);
  }
}

console.log(failures === 0 ? '\nall passed' : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
