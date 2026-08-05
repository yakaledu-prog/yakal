// Runs a verify script that imports application code.
//
// Anything under src/ may read import.meta.env, which only exists inside
// Vite's module graph - under plain tsx it is undefined and the import throws
// before the first assertion runs. Loading through Vite's SSR loader gives the
// module the same env the browser build gets, so a verify script can import a
// service directly instead of duplicating it.
//
//   node scripts/verify/_vite-run.mjs scripts/verify/realtime-refcount.ts
import { createServer } from 'vite';

const target = process.argv[2];
if (!target) {
  console.error('usage: node scripts/verify/_vite-run.mjs <script.ts>');
  process.exit(1);
}

const server = await createServer({
  configFile: 'vite.config.ts',
  server: { middlewareMode: true },
  logLevel: 'error',
});

try {
  // The script asserts on import; process.exit inside it ends the run.
  await server.ssrLoadModule('/' + target.replace(/^\.?\//, ''));
} finally {
  await server.close();
}
