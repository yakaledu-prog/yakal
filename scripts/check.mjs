// The checks worth running before every commit.
//
// Deliberately not every suite. `npm run verify` drives a real browser through
// sixteen of them and needs the dev server up, which makes it a five-minute
// job that fails for reasons unrelated to your change. A check people skip is
// worse than no check, so this is the subset that runs in seconds and only
// fails when something is actually wrong.
//
// Database-backed checks are skipped, not failed, when the local stack is not
// running. Not everybody has Docker up while editing a component, and a hook
// that refuses to let you commit for that reason gets disabled within a day.
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Nothing external. These must always pass. */
const PURE = [
  ['api-route-parity.mjs', 'development and production mount every API route'],
  ['api-dispatch.ts', 'the ?action= router'],
  ['api-esm-load.ts', 'every function loads as ESM'],
  ['classroom-mapping.ts', 'Google courseWork maps to our shape'],
  ['notification-templates.ts', 'every notification template renders'],
  ['support-knowledge.ts', 'support knowledge stays relevant and bounded'],
  ['support-chat-request.ts', 'support requests ignore client role claims'],
  ['support-rate-limit.ts', 'support quota and concurrency limits'],
];

/** Needs the local Supabase. Skipped when it is not answering. */
const NEEDS_DB = [
  ['profiles-not-public.mjs', 'profiles is not readable signed out'],
  ['testimonials.mjs', 'testimonials RLS'],
  ['service-entitlements.mjs', 'service access follows payment alone'],
];

/** Needs the local Supabase and the Vite loader, because it imports src/. */
const NEEDS_DB_AND_VITE = [['realtime-refcount.ts', 'realtime channels are ref-counted']];

const SUPABASE = process.env.VITE_SUPABASE_LOCAL_URL || 'http://127.0.0.1:54321';

async function databaseIsUp() {
  try {
    const res = await fetch(`${SUPABASE}/rest/v1/`, {
      signal: AbortSignal.timeout(2500),
    });
    return res.status < 500;
  } catch {
    return false;
  }
}

function run(command, args, label) {
  process.stdout.write(`  ${label.padEnd(46)}`);
  try {
    execFileSync(command, args, { cwd: root, stdio: 'pipe' });
    console.log('ok');
    return true;
  } catch (e) {
    console.log('FAIL');
    // The suite's own output says more than the exit code does.
    const out = `${e.stdout ?? ''}${e.stderr ?? ''}`.trim();
    if (out) console.log(out.split('\n').map((l) => `      ${l}`).join('\n'));
    return false;
  }
}

async function main() {
  let failed = 0;

  console.log('\nChecks that need nothing\n');
  for (const [file, label] of PURE) {
    const command = file.endsWith('.mjs') ? 'node' : 'npx';
    const args = file.endsWith('.mjs')
      ? [join('scripts/verify', file)]
      : ['tsx', join('scripts/verify', file)];
    if (!run(command, args, label)) failed++;
  }

  const up = await databaseIsUp();
  console.log(up ? '\nChecks that need the local database\n' : '\nSkipped, no local database\n');

  for (const [file, label] of NEEDS_DB) {
    if (!up) {
      console.log(`  ${label.padEnd(46)}skip`);
      continue;
    }
    if (!run('node', [join('scripts/verify', file)], label)) failed++;
  }
  for (const [file, label] of NEEDS_DB_AND_VITE) {
    if (!up) {
      console.log(`  ${label.padEnd(46)}skip`);
      continue;
    }
    if (!run('node', ['scripts/verify/_vite-run.mjs', join('scripts/verify', file)], label)) failed++;
  }

  if (!up) {
    console.log('\n  Start it with `npm run db:start` to include those.');
  }

  console.log(failed === 0 ? '\nAll checks passed.\n' : `\n${failed} check(s) failed.\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
