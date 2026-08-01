// The admin side of reporting, and the constrained email autocomplete.
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
const psql = (sql) =>
  execSync(`PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -tAq -c "${sql}"`).toString().trim();

psql('delete from conversation_flags;');

const BASE = process.env.BASE || 'http://localhost:5173';
const S = '/tmp/claude-1000/-home-binyam-products-yakal/470a1a43-cc42-4652-988d-ac4539a37912/scratchpad/shots';
const b = await chromium.launch();
const errs = [];
let failures = 0;
const pass = (s, ok, d = '') => { if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${s}${d ? '  -> ' + d : ''}`); };

async function signIn(email) {
  const p = await (await b.newContext({ viewport: { width: 1440, height: 950 } })).newPage();
  p.on('pageerror', e => errs.push(`${email}: ${e.message}`));
  await p.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await p.locator('input[type="email"]').first().fill(email);
  await p.locator('input[type="password"]').first().fill('demo123');
  await p.locator('form button[type="submit"]').first().click();
  await p.waitForURL(u => !u.pathname.includes('/login'), { timeout: 20000 });
  return p;
}

// ---------- a parent files a report ----------
const parent = await signIn('parent@yakal.com');
await parent.goto(`${BASE}/parent/children`, { waitUntil: 'domcontentloaded' });
await parent.waitForTimeout(4000);
await parent.getByRole('button', { name: 'Messages', exact: true }).click();
await parent.waitForTimeout(2500);
await parent.locator('button').filter({ has: parent.locator('img') }).filter({ hasText: 'Bethlehem' }).first().click();
await parent.waitForTimeout(2500);
await parent.getByRole('button', { name: /Report this conversation/i }).click();
await parent.waitForTimeout(800);
const dlg = parent.locator('div[role="dialog"]');
await dlg.getByText(/how did the practice set go/i).first().click();
await parent.getByRole('button', { name: 'Next' }).click();
await parent.waitForTimeout(500);
await parent.getByText('Moving off the platform').click();
await parent.getByText('Inappropriate content').click();
await parent.getByPlaceholder(/Anything else the team/i).fill('Asked to pay by bank transfer.');
await parent.getByRole('button', { name: 'Send report' }).click();
await parent.waitForTimeout(2500);
pass('parent report reaches the database', psql("select count(*) from conversation_flags where status='open';") === '1');
pass('both reasons are stored', psql("select array_length(reasons,1) from conversation_flags limit 1;") === '2');

// ---------- email autocomplete ----------
await parent.goto(`${BASE}/parent/children`, { waitUntil: 'domcontentloaded' });
await parent.waitForTimeout(3500);
await parent.getByRole('button', { name: /Add child/i }).click();
await parent.waitForTimeout(900);
const field = parent.getByPlaceholder("Child's email address");
await field.fill('stu');
await parent.waitForTimeout(1200);
pass('no suggestions below five characters', (await parent.locator('[role="combobox"] ~ ul li').count()) === 0);
await field.fill('student2');
await parent.waitForTimeout(2000);
const sugg = parent.locator('ul li button');
pass('suggests at five or more characters', (await sugg.count()) > 0, `${await sugg.count()} shown`);
const sugText = (await sugg.count()) ? await sugg.first().innerText() : '';
pass('the address is masked', /\*/.test(sugText) && !/student2@yakal\.com/.test(sugText), sugText.replace(/\n/g, ' '));
pass('an already linked child is not suggested', !/Amen Worku/.test(sugText));
await parent.screenshot({ path: `${S}/parent-email-autocomplete.png` });

// ---------- admin works the queue ----------
const admin = await signIn('admin@yakal.com');
await admin.goto(`${BASE}/admin/reports`, { waitUntil: 'domcontentloaded' });
await admin.waitForTimeout(3500);
const listBody = await admin.locator('body').innerText();
pass('the reporter is named in the list', /Tigist Worku/.test(listBody));
pass('the subject is named in the list', /Bethlehem Alemu/.test(listBody));
pass('the reason is in the list', /Moving off the platform/.test(listBody));

// Judging a report needs the conversation, so it opens in a dialog rather
// than sitting in the table.
await admin.getByRole('button', { name: 'Review' }).first().click();
await admin.waitForTimeout(2500);
const body = await admin.getByRole('dialog').innerText();
pass('the conversation is shown', /how did the practice set go/i.test(body));
pass('both reasons are shown', /Moving off the platform/.test(body) && /Inappropriate content/.test(body));
pass("the reporter's note is shown", /bank transfer/i.test(body));
pass('the reported message is marked as such', /reported/i.test(body));
await admin.screenshot({ path: `${S}/admin-reports.png`, fullPage: true });

await admin.getByRole('button', { name: /Mark actioned/i }).click();
await admin.waitForTimeout(2500);
pass('marking actioned is recorded', psql("select status from conversation_flags limit 1;") === 'reviewed');
pass('who reviewed it is recorded', psql("select reviewed_by is not null from conversation_flags limit 1;") === 't');
pass('the open queue empties', (await admin.getByText(/Nothing waiting/i).isVisible().catch(() => false)));

await admin.getByLabel('Filter by status').selectOption('reviewed');
await admin.waitForTimeout(2000);
await admin.getByRole('button', { name: 'Review' }).first().click();
await admin.waitForTimeout(2000);
await admin.getByRole('button', { name: /Put back in the queue/i }).click();
await admin.waitForTimeout(2000);
pass('a report can be reopened', psql("select status from conversation_flags limit 1;") === 'open');

// ---------- a non-admin sees nothing ----------
const student = await signIn('student@yakal.com');
await student.goto(`${BASE}/admin/reports`, { waitUntil: 'domcontentloaded' });
await student.waitForTimeout(3000);
pass('a student cannot read the queue', !/how did the practice set go/i.test(await student.locator('body').innerText()));

pass('no page errors', errs.length === 0, errs[0]?.slice(0, 140) ?? '');
await b.close();
console.log(failures === 0 ? '\nall checks passed' : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
