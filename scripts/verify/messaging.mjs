// Drives the messaging screens in a real browser for each role: sign in, open
// the page, click a conversation, confirm the history renders, send a message,
// and confirm it lands.
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://localhost:5174';
const SHOTS = '/tmp/claude-1000/-home-binyam-products-yakal/470a1a43-cc42-4652-988d-ac4539a37912/scratchpad/shots';

const ROLES = [
  { role: 'tutor', email: 'tutor@yakal.com', path: '/tutor/messages' },
  { role: 'student', email: 'student@yakal.com', path: '/student/messages' },
  { role: 'parent', email: 'parent@yakal.com', path: '/parent/messages' },
  { role: 'counselor', email: 'counselor@yakal.com', path: '/counselor/messages' },
];

const results = [];

function record(role, step, ok, detail = '') {
  results.push({ role, step, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${role.padEnd(10)} ${step}${detail ? '  -> ' + detail : ''}`);
}

const browser = await chromium.launch();

for (const { role, email, path } of ROLES) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const errors = [];
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error' && !t.includes('favicon') && !t.includes('Download the React DevTools')) {
      errors.push(t);
    }
  });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

  try {
    // --- sign in ---
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    await page.locator('input[type="email"]').first().fill(email);
    await page.locator('input[type="password"]').first().fill('demo123');
    await page.locator('form button[type="submit"]').first().click();
    await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 20000 });
    record(role, 'sign in', true);

    // --- messages page ---
    await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3500);

    const rows = page.locator('button[aria-current], main button, button').filter({ hasText: /.+/ });
    const listRows = page.locator('button').filter({ has: page.locator('img') });
    const rowCount = await listRows.count();
    record(role, 'conversation list renders', rowCount > 0, `${rowCount} rows`);

    await page.screenshot({ path: `${SHOTS}/${role}-1-list.png` });

    // --- the reported bug: clicking a row must open the body ---
    // Pick a row that already has history so the assertion is meaningful.
    // Prefer a thread that already has history, so the check is meaningful,
    // but a conversation with no messages yet is still legitimately "open":
    // it shows the empty-chat state and a working composer.
    let opened = false;
    let openedName = '';
    let openedDetail = '';
    for (const wantHistory of [true, false]) {
      if (opened) break;
      for (let i = 0; i < Math.min(rowCount, 8); i++) {
        const row = listRows.nth(i);
        const text = (await row.innerText()).replace(/\s+/g, ' ').trim();
        const looksEmpty = /start the conversation/i.test(text);
        if (wantHistory && looksEmpty) continue;
        openedName = text.split('\n')[0].split(/\s{2,}/)[0].trim().slice(0, 28);
        await row.click();
        await page.waitForTimeout(1800);

        const hasComposer = await page.getByPlaceholder('Type a message').isVisible().catch(() => false);
        const hasHistory = await page
          .getByText(/^(Today|Yesterday|[A-Z][a-z]+day, )/)
          .first()
          .isVisible()
          .catch(() => false);
        const hasEmptyState = await page
          .getByText('No messages here yet')
          .isVisible()
          .catch(() => false);

        if (hasComposer && (hasHistory || hasEmptyState)) {
          opened = true;
          openedDetail = `${openedName}${hasHistory ? ', with history' : ', empty thread'}`;
          break;
        }
      }
    }
    record(role, 'clicking a row opens the conversation', opened, openedDetail);
    await page.screenshot({ path: `${SHOTS}/${role}-2-open.png` });

    // --- header hides once a conversation is open ---
    if (opened) {
      const bannerVisible = await page
        .getByRole('heading', { level: 1, name: /^Messages$/ })
        .isVisible()
        .catch(() => false);
      record(role, 'page banner hidden while a chat is open', !bannerVisible);
    }

    // --- send ---
    if (opened) {
      const stamp = `pw ${role} ${Date.now().toString().slice(-6)}`;
      const box = page.getByPlaceholder('Type a message');
      await box.fill(stamp);
      await box.press('Enter');
      await page.waitForTimeout(2500);
      const landed = await page.getByText(stamp, { exact: false }).first().isVisible().catch(() => false);
      record(role, 'sending a message', landed, stamp);

      // Reload to prove it persisted rather than just appearing optimistically.
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(4000);
      const persisted = await page.getByText(stamp, { exact: false }).first().isVisible().catch(() => false);
      record(role, 'message survives a reload', persisted);
      await page.screenshot({ path: `${SHOTS}/${role}-3-sent.png` });
    }

    record(role, 'no console errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  } catch (err) {
    record(role, 'run', false, String(err).split('\n')[0].slice(0, 160));
    await page.screenshot({ path: `${SHOTS}/${role}-error.png` }).catch(() => {});
  }

  await context.close();
}

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log('\nFAILURES:');
  for (const f of failed) console.log(`  ${f.role} / ${f.step}  ${f.detail}`);
}
process.exit(failed.length ? 1 : 0);
