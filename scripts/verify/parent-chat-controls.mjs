// The parent's Children > Messages tab: no contact header, contact info and
// the report control in the composer, and a report that actually lands.
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';

// A previous run that failed part way leaves an open report behind, and the
// flag then reads "You reported this conversation" from the start. Clear it so
// the run is independent of the last one.
execSync(`PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -q -c "delete from conversation_flags;"`, { stdio: 'ignore' });
const BASE = process.env.BASE || 'http://localhost:5173';
const S = '/tmp/claude-1000/-home-binyam-products-yakal/470a1a43-cc42-4652-988d-ac4539a37912/scratchpad/shots';
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1440, height: 950 } })).newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message));
let failures = 0;
const pass = (s, ok, d = '') => { if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${s}${d ? '  -> ' + d : ''}`); };

await p.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
await p.locator('input[type="email"]').first().fill('parent@yakal.com');
await p.locator('input[type="password"]').first().fill('demo123');
await p.locator('form button[type="submit"]').first().click();
await p.waitForURL(u => !u.pathname.includes('/login'), { timeout: 20000 });

await p.goto(`${BASE}/parent/children`, { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(4000);
await p.getByRole('button', { name: 'Messages', exact: true }).click();
await p.waitForTimeout(2500);
// The tab lists the child's threads, not the parent's own.
const sidebar = await p.locator('body').innerText();
pass("lists the child's conversations", /Bethlehem Alemu/.test(sidebar) && /Daniel Haile/.test(sidebar));
pass("not the parent's own threads", !/how is Amen progressing/i.test(sidebar));
pass('no way to start a chat while watching', (await p.getByPlaceholder(/Search or start new chat/i).count()) === 0);
pass('no redundant subtitle on a row', !/Amen Worku and Bethlehem/i.test(sidebar));
await p.locator('button').filter({ has: p.locator('img') }).filter({ hasText: 'Bethlehem' }).first().click();
await p.waitForTimeout(2500);

// The sidebar names the person; a second header would repeat it.
pass('no last-seen contact header', (await p.getByText(/last seen/i).count()) === 0);
pass('contact info button in the footer', await p.getByRole('button', { name: 'Contact info', exact: true }).isVisible());
pass('report button in the footer', await p.getByRole('button', { name: /Report this conversation/i }).isVisible());
// A monitoring view has nothing to send, so none of the composer belongs here.
pass('no message input', (await p.getByPlaceholder('Type a message').count()) === 0);
pass('no emoji button', (await p.getByRole('button', { name: 'Emoji' }).count()) === 0);
pass('no attachment button', (await p.getByRole('button', { name: 'Attach' }).count()) === 0);
pass('no voice note button', (await p.getByRole('button', { name: /Record a voice note/i }).count()) === 0);
pass('says it is view only', await p.getByText(/Viewing only/i).isVisible());
await p.getByText(/Viewing only/i).hover();
await p.waitForTimeout(400);
pass('view only explains itself on hover', await p.getByRole('tooltip').filter({ hasText: /your child's conversations/i }).isVisible());
pass('does not offer a reply route', (await p.getByText(/Reply from/i).count()) === 0);
await p.screenshot({ path: `${S}/parent-chat-no-header.png` });

await p.getByRole('button', { name: 'Contact info', exact: true }).click();
await p.waitForTimeout(900);
pass('contact panel opens from the footer', await p.getByText('Bethlehem Alemu').last().isVisible());
await p.screenshot({ path: `${S}/parent-chat-contact-panel.png` });
await p.getByRole('button', { name: 'Close contact info' }).click();
await p.waitForTimeout(700);

await p.getByRole('button', { name: /Report this conversation/i }).click();
await p.waitForTimeout(700);
pass('report dialog opens', await p.locator('div[role="dialog"]').isVisible());
await p.screenshot({ path: `${S}/parent-chat-flag-dialog.png` });

// A report must name the message: no reason list until one is picked.
pass('reasons hidden until a message is picked', (await p.getByText('Moving off the platform').count()) === 0);
pass('stepper is the header', await p.locator('div[role="dialog"]').getByRole('button', { name: /Messages/ }).isVisible());
const dialog = p.locator('div[class*="max-w-lg"]');
await dialog.getByText(/how did the practice set go/i).first().click();
await p.waitForTimeout(600);
await p.screenshot({ path: `${S}/parent-chat-flag-picker.png` });
await dialog.getByText(/catches everyone/i).first().click();
await p.waitForTimeout(400);
pass('more than one message can be picked', await dialog.getByText('2 selected').isVisible());
// Report one message, so the rest of the flow has a single known subject.
await dialog.getByText(/catches everyone/i).first().click();
await p.waitForTimeout(400);
pass('whole conversation is offered in the footer', await p.getByText('Whole conversation').isVisible());
await p.getByRole('button', { name: 'Next' }).click();
await p.waitForTimeout(600);
pass('step two asks for a reason', await p.getByText('Moving off the platform').isVisible());
await p.getByText('Moving off the platform').click();
await p.getByText('Inappropriate content').click();
await p.waitForTimeout(300);
pass('more than one reason can be picked', (await p.locator('div[role="dialog"] button[aria-pressed="true"]').count()) === 2);
await p.getByPlaceholder(/Anything else the team/i).fill('Asked to pay by bank transfer.');
await p.getByRole('button', { name: 'Send report' }).click();
await p.waitForTimeout(2500);
pass('report is accepted', await p.getByText(/Reported\. The Yakal team/i).isVisible().catch(() => false));
await p.waitForTimeout(1200);
pass('flag now reads as set', await p.getByRole('button', { name: /You reported this conversation/i }).isVisible().catch(() => false));

// Reopening: the report lives on the third step now, not mixed into the picker.
await p.getByRole('button', { name: /You reported this conversation/i }).click();
await p.waitForTimeout(800);
const dlg = p.locator('div[role="dialog"]');
pass('picked message shows as already reported', await dlg.getByText(/already reported/i).first().isVisible());
await dlg.getByRole('button', { name: /Reported/ }).click();
await p.waitForTimeout(700);
pass('the reported message is listed', await dlg.getByText(/how did the practice set go/i).first().isVisible());
await dlg.getByText(/how did the practice set go/i).first().click();
await p.waitForTimeout(700);
pass('the report names the message', await dlg.getByText('Reported', { exact: true }).isVisible());
pass('the report keeps the note', await dlg.getByText(/bank transfer/i).isVisible());
await p.screenshot({ path: `${S}/parent-chat-flag-reported.png` });
await dlg.getByRole('button', { name: 'Withdraw report' }).click();
await p.waitForTimeout(2000);
pass('report can be withdrawn', await p.getByText(/Report withdrawn/i).isVisible().catch(() => false));

pass('no page errors', errs.length === 0, errs[0]?.slice(0, 140) ?? '');
await b.close();
console.log(failures === 0 ? '\nall checks passed' : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
