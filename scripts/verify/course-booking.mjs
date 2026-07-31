// The parent's booking page: a real course, the tutor an admin approved, the
// child it is for, and what checkout is handed.
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
const psql = (sql) =>
  execSync(`PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -tAq -c "${sql}"`).toString().trim();

const BASE = process.env.BASE || 'http://localhost:5173';
const S = '/tmp/claude-1000/-home-binyam-products-yakal/470a1a43-cc42-4652-988d-ac4539a37912/scratchpad/shots';
const courseId = psql("select id from courses where title like 'Chemistry%' limit 1;");
psql(`update courses set tutor_id = (select id from profiles where email='tutor@yakal.com') where id='${courseId}';`);

const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1440, height: 950 } })).newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message));
let failures = 0;
const pass = (s, ok, d = '') => { if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${s}${d ? '  -> ' + d : ''}`); };

// Catch what the page actually sends to checkout.
let posted = null;
await p.route('**/api/create-invoice', async (route) => {
  posted = route.request().postDataJSON();
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ invoiceId: 'test' }) });
});
await p.route('**/api/stripe-checkout', (route) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ url: null }) }));

await p.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
await p.locator('input[type="email"]').first().fill('parent@yakal.com');
await p.locator('input[type="password"]').first().fill('demo123');
await p.locator('form button[type="submit"]').first().click();
await p.waitForURL(u => !u.pathname.includes('/login'), { timeout: 20000 });

await p.goto(`${BASE}/parent/courses/${courseId}`, { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(4000);
const text = await p.locator('body').innerText();
pass('the real course is shown', /Chemistry, Grade 11 Foundations/.test(text));
pass('the approved tutor is shown', /Bethlehem Alemu/.test(text));
pass('no invented tutors remain', !/Avery M\.|David K\.|Sarah L\./.test(text));
pass('it says who it is for', /Booking for/.test(text) && /Amen Worku/.test(text));
await p.screenshot({ path: `${S}/parent-course-booking.png`, fullPage: true });

// Pick a free slot, then book.
// Move to next week: the current week still shows days that have gone, and a
// booking in the past is refused.
await p.getByRole('button').nth(await p.getByRole('button').count() - 1).waitFor().catch(() => {});
const nextWeek = p.locator('button.h-8.w-8').last();
if (await nextWeek.count()) { await nextWeek.click(); await p.waitForTimeout(1200); }

const slot = p.locator('button').filter({ hasText: /^\d{1,2}:\d{2}\s(AM|PM)$/i }).first();
await slot.waitFor({ timeout: 15000 });
await slot.click();
await p.waitForTimeout(800);
pass('a slot can be picked', /1 slot/.test(await p.locator('body').innerText()));
await p.getByRole('button', { name: /^Checkout/i }).first().click();
await p.waitForTimeout(2500);

pass('checkout is given the course', posted?.courseId === courseId, posted?.courseId ?? 'none');
pass('checkout is given the child', !!posted?.studentId, posted?.studentId ?? 'none');
pass('checkout is given the tutor', !!posted?.tutorId);
pass('checkout is given the chosen slots', Array.isArray(posted?.booking) && posted.booking.length > 0,
  JSON.stringify(posted?.booking?.[0] ?? null));
// The grid starts at 07:00. An off-by-one here books every session an hour out.
pass('the slot time matches the one clicked', posted?.booking?.[0]?.startTime === '07:00',
  posted?.booking?.[0]?.startTime ?? 'none');
pass('the booked date is not in the past',
  !!posted?.booking?.[0]?.date && posted.booking[0].date >= new Date().toISOString().slice(0, 10),
  posted?.booking?.[0]?.date ?? 'none');
pass('the price comes from the course', posted?.amountCents > 0 && posted.amountCents % 5500 === 0, String(posted?.amountCents));

// A course with no tutor cannot be booked.
psql(`update courses set tutor_id = null where id='${courseId}';`);
await p.goto(`${BASE}/parent/courses/${courseId}`, { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(3000);
pass('an unassigned course says so', /No tutor assigned yet/i.test(await p.locator('body').innerText()));
psql(`update courses set tutor_id = (select id from profiles where email='tutor@yakal.com') where id='${courseId}';`);

pass('no page errors', errs.length === 0, errs[0]?.slice(0, 140) ?? '');
await b.close();
console.log(failures === 0 ? '\nall checks passed' : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
