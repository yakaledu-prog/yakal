/**
 * Money states for testing, from the command line.
 *
 *   npm run scenarios build         every state at once
 *   npm run scenarios fast-forward  make booked lessons have happened
 *   npm run scenarios release       expire every hold and pay what is payable
 *   npm run scenarios status        what exists now
 *   npm run scenarios clear         remove everything this made
 *
 * The work itself is in api/_utils/scenarios.ts, because the /dev console runs
 * the same actions from buttons and api/ cannot import from scripts/.
 */
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env') });

const scenarios = await import('../api/_utils/scenarios.js');

const commands: Record<string, (log?: (line: string) => void) => Promise<unknown>> = {
  build: scenarios.build,
  'fast-forward': scenarios.fastForward,
  release: scenarios.release,
  status: scenarios.status,
  clear: scenarios.clear,
};

const command = process.argv[2];

if (!command || !commands[command]) {
  console.log(`
Money states for testing, against the local stack only.

  npm run scenarios build         every state at once
  npm run scenarios fast-forward  make booked lessons have happened, and run the job
  npm run scenarios release       expire every hold, and pay what is payable
  npm run scenarios status        what exists now
  npm run scenarios clear         remove everything this made

The same actions are buttons on /dev, if a browser is easier.

Typical run:

  npm run db:reset
  npm run scenarios build
  ... look at /tutor/earnings, /admin/billing, /parent/billing ...
  npm run scenarios release
`);
  process.exit(command ? 1 : 0);
}

commands[command]().catch((err: any) => {
  console.error(`\n${err?.message ?? err}\n`);
  process.exit(1);
});
