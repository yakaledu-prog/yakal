// ============================================================
// One-shot codemod: brand hex literals to theme tokens.
//
// Run with `node scripts/codemod/brand-tokens.mjs --write`. Without --write it
// reports what it would change and touches nothing.
//
// Kept in the tree rather than run and deleted so the next person can see
// exactly what was mechanical and what was not. It only rewrites Tailwind
// arbitrary-value utilities, which are the 96% that are unambiguous:
//
//     bg-[#1099A1]        ->  bg-primary
//     text-[#1099A1]/60   ->  text-primary/60
//     dark:border-[#CAA25F] -> dark:border-secondary
//
// Everything else is left for a human, and `--report` lists it. See the
// SKIP list below for why.
// ============================================================

import { readFileSync, writeFileSync } from 'node:fs';
import { readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const WRITE = process.argv.includes('--write');

/** hex (lowercased) -> token name Tailwind knows from @theme. */
const TOKENS = new Map([
  ['#1099a1', 'primary'],
  ['#0d7f86', 'primary-hover'],
  // The second deep teal in use. Folded onto the same token deliberately:
  // eight lightness points apart is not a decision anybody made.
  ['#0d848b', 'primary-hover'],
  ['#caa25f', 'secondary'],
  ['#97ce9d', 'tertiary'],
]);

/**
 * Files where a hex is a value rather than a style, and a var() would break it.
 *
 * confetti draws to a canvas, which cannot resolve a CSS variable.
 * supabase.ts formats a console.log with %c, same problem.
 * admissionsService exports TIER_SHADES, which callers parse as hex with
 *   parseInt(hex.slice(1), 16) to derive a tint. A var() would parse to NaN.
 */
const SKIP = [
  'src/utils/confetti.ts',
  'src/lib/supabase.ts',
  'src/services/admissionsService.ts',
];

const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (['.ts', '.tsx'].includes(extname(path))) files.push(path);
  }
})('src');

// A Tailwind utility ending in the arbitrary hex, with an optional opacity
// modifier after it. The leading (^|[\s"'`]) keeps it from matching inside a
// longer token, and the prefix group carries any variant such as dark: or
// hover: through untouched.
const UTILITY = /(^|[\s"'`{])((?:[a-z-]+:)*)([a-z-]+)-\[(#[0-9a-fA-F]{6})\](\/\d{1,3})?/g;

let changed = 0;
const leftovers = [];

for (const file of files) {
  if (SKIP.includes(file)) continue;

  const before = readFileSync(file, 'utf8');
  const after = before.replace(UTILITY, (match, lead, variants, prop, hex, alpha) => {
    const token = TOKENS.get(hex.toLowerCase());
    if (!token) return match;
    return `${lead}${variants}${prop}-${token}${alpha ?? ''}`;
  });

  if (after !== before) {
    changed++;
    if (WRITE) writeFileSync(file, after);
  }

  // Anything still holding a brand hex after the pass needs a person.
  for (const [hex] of TOKENS) {
    const re = new RegExp(hex, 'gi');
    const hits = (after.match(re) ?? []).length;
    if (hits > 0) leftovers.push(`${file}: ${hits} x ${hex}`);
  }
}

console.log(`${WRITE ? 'Rewrote' : 'Would rewrite'} ${changed} files.`);
if (leftovers.length) {
  console.log(`\nStill holding a literal, by design or for review:`);
  for (const l of leftovers) console.log(`  ${l}`);
}
