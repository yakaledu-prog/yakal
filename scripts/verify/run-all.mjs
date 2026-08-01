// Runs every verification suite and reports which passed.
//
// These are end-to-end checks against the local stack: a real browser, the
// real database, the real API routes. They need `npm run dev` and the Supabase
// containers up, and they write to the local database, so never point BASE at
// anything but a development stack.
//
//   npm run verify              every suite
//   npm run verify -- messaging only the ones matching "messaging"
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const filter = process.argv[2];

const suites = readdirSync(here)
  .filter((f) => f.endsWith('.mjs') && f !== 'run-all.mjs')
  .filter((f) => !filter || f.includes(filter))
  .sort();

if (suites.length === 0) {
  console.error(filter ? `No suite matches "${filter}".` : 'No suites found.');
  process.exit(1);
}

const results = [];
for (const suite of suites) {
  process.stdout.write(`\n${'='.repeat(60)}\n${suite}\n${'='.repeat(60)}\n`);
  // tsx rather than node: a couple of suites import the TypeScript API code
  // directly, which is the point of them.
  const run = spawnSync('npx', ['tsx', join(here, suite)], { stdio: 'inherit' });
  results.push({ suite, ok: run.status === 0 });
}

console.log(`\n${'='.repeat(60)}`);
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.suite}`);
const failed = results.filter((r) => !r.ok).length;
console.log(failed === 0 ? `\nall ${results.length} suites passed` : `\n${failed} of ${results.length} suites failed`);
process.exit(failed === 0 ? 0 : 1);
