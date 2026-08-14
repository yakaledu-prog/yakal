// Every top-level api/*.ts file is a deployed endpoint on Vercel. The local
// and single-process Render servers mount those files by hand, which twice let
// an endpoint work in development and review but 404 in production. Keep both
// route tables complete whenever a new function is added.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const apiRoutes = readdirSync(join(root, 'api'))
  .filter((name) => name.endsWith('.ts') && !name.startsWith('_'))
  .map((name) => `/api/${name.slice(0, -3)}`)
  .sort();

let failures = 0;

for (const file of ['scripts/local-api.ts', 'scripts/server.ts']) {
  const source = readFileSync(join(root, file), 'utf8');
  const missing = apiRoutes.filter((route) => !source.includes(`'${route}'`));

  if (missing.length === 0) {
    console.log(`ok    ${file} mounts all ${apiRoutes.length} API routes`);
  } else {
    failures++;
    console.error(`FAIL  ${file} is missing ${missing.join(', ')}`);
  }
}

process.exit(failures === 0 ? 0 : 1);
