// Every serverless function loads as ESM.
//
// package.json declares "type": "module", so the functions Vercel emits are
// ESM, and ESM relative imports must carry a file extension. Written without
// one, `import { dispatch } from './_handlers/_dispatch'` throws
// ERR_MODULE_NOT_FOUND before a single line of the handler runs, and the
// platform answers FUNCTION_INVOCATION_FAILED with nothing in the body.
//
// It stayed hidden because it is invisible everywhere except production. tsc
// resolves extensionless paths under moduleResolution "bundler", tsx resolves
// them when the local API server runs, and the two functions with no relative
// imports at all kept working, which made it look like a Stripe and Google
// problem rather than one bug in five functions.
//
// This compiles api/ the way Vercel does and imports the result, so the check
// happens where the failure lives.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { readdirSync } from 'node:fs';

const root = resolve(import.meta.dirname, '../..');
const out = mkdtempSync(join(tmpdir(), 'yakal-esm-'));

let failures = 0;
function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
  if (!ok) failures++;
}

function build(pattern: string, dir: string) {
  execFileSync(
    'npx',
    ['esbuild', pattern, '--bundle=false', '--format=esm', '--platform=node',
     `--outdir=${dir}`, '--log-level=error'],
    { cwd: root, shell: true }
  );
}

async function main() {
  build('api/*.ts', out);
  build('api/_handlers/*.ts', join(out, '_handlers'));
  build('api/_utils/*.ts', join(out, '_utils'));
  writeFileSync(join(out, 'package.json'), '{"type":"module"}');
  symlinkSync(join(root, 'node_modules'), join(out, 'node_modules'));

  const functions = readdirSync(join(root, 'api'))
    .filter((f) => f.endsWith('.ts'))
    .map((f) => f.replace(/\.ts$/, ''));

  check('every function is accounted for', functions.length >= 7, `${functions.length} found`);

  // In a plain node subprocess, never with an import from this file. This
  // script runs under tsx, and tsx installs a resolver that accepts
  // extensionless specifiers for the whole process. Importing here would
  // therefore resolve exactly the paths production cannot, and the check would
  // pass on the broken code it exists to catch. It did, until this comment.
  for (const name of functions) {
    const probe = `import(${JSON.stringify(join(out, `${name}.js`))})`
      + `.then(m => { if (typeof m.default !== 'function') { console.error('no default export'); process.exit(1); } })`
      + `.catch(e => { console.error(e.code + ': ' + e.message.split('\\n')[0]); process.exit(1); });`;
    try {
      execFileSync(process.execPath, ['--input-type=module', '-e', probe], { stdio: 'pipe' });
      check(`${name} loads and exports a handler`, true);
    } catch (e: any) {
      check(`${name} loads and exports a handler`, false, String(e.stderr ?? '').trim().split('\n')[0]);
    }
  }

  rmSync(out, { recursive: true, force: true });
  console.log(failures === 0 ? '\nall passed' : `\n${failures} failed`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
