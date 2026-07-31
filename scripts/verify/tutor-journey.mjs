// Walks a tutor from signup to an approved dashboard, the way a client would
// be shown it: sign up, onboard with a CV, sit in pending, get approved by an
// admin, come back in.
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';

const BASE = 'http://localhost:5174';
const SHOTS = '/tmp/claude-1000/-home-binyam-products-yakal/470a1a43-cc42-4652-988d-ac4539a37912/scratchpad/shots';
const SERVICE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const db = createClient('http://127.0.0.1:54321', SERVICE, { auth: { persistSession: false } });

const EMAIL = `applicant.${Date.now()}@yakal.test`;
const PASSWORD = 'demo123';

const results = [];
const record = (step, ok, detail = '') => {
  results.push({ step, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${step}${detail ? '  -> ' + detail : ''}`);
};

// A tiny but genuinely valid PDF, so the bucket's mime check is exercised.
const CV = '/tmp/claude-1000/-home-binyam-products-yakal/470a1a43-cc42-4652-988d-ac4539a37912/scratchpad/cv.pdf';
writeFileSync(CV, '%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  const t = m.text();
  if (m.type() === 'error' && !t.includes('favicon') && !t.includes('DevTools')) errors.push(t);
});

try {
  // ---- 1. sign up ----
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /sign ?up|create account|register/i }).first().click().catch(() => {});
  await page.waitForTimeout(800);

  const nameBox = page.getByPlaceholder('Your name');
  if (!(await nameBox.isVisible().catch(() => false))) {
    record('reach the signup form', false, 'could not switch to signup mode');
    throw new Error('signup form not reachable');
  }
  await nameBox.fill('Test Applicant');
  await page.locator('input[type="email"]').first().fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(PASSWORD);

  // pick the tutor role
  await page.getByText(/^tutor$/i).first().click().catch(() => {});
  await page.waitForTimeout(300);

  await page.locator('form button[type="submit"]').first().click();
  await page.waitForTimeout(4000);
  const afterSignup = new URL(page.url()).pathname;
  record('sign up lands somewhere sensible', !afterSignup.includes('/login'), afterSignup);
  await page.screenshot({ path: `${SHOTS}/journey-1-after-signup.png` });

  // the trigger should have made a profile, pending because tutors need approval
  const { data: prof } = await db.from('profiles').select('*').eq('email', EMAIL).maybeSingle();
  record('profile row created by the auth trigger', !!prof, prof ? `role=${prof.role} status=${prof.status}` : 'none');
  record('tutor starts pending approval', prof?.status === 'pending', prof?.status);

  // ---- 2. onboarding ----
  if (!afterSignup.includes('/onboarding')) {
    await page.goto(`${BASE}/onboarding`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
  }
  const onOnboarding = await page.getByText("CV / Resume").isVisible().catch(() => false);
  record('tutor sees the tutor wizard, not the student diagnostic', onOnboarding, new URL(page.url()).pathname);

  // step 1 (Profile) -> 2 (CV)
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.waitForTimeout(1200);

  await page.locator('input[type="file"][accept*="pdf"]').setInputFiles(CV);
  await page.waitForTimeout(3500);
  const uploaded = await page.getByText(/CV uploaded/i).isVisible().catch(() => false);
  record('CV upload succeeds', uploaded, uploaded ? 'toast shown' : 'no success toast');
  await page.screenshot({ path: `${SHOTS}/journey-2-cv.png` });

  // step 2 -> 3 (Subjects)
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.waitForTimeout(1200);

  // at least one subject is required
  for (const subject of ['Mathematics', 'Physics', 'English']) {
    const chip = page.getByText(subject, { exact: true }).first();
    if (await chip.isVisible().catch(() => false)) { await chip.click(); break; }
  }
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOTS}/journey-3-subjects.png` });

  await page.locator('form button[type="submit"]').last().click();
  await page.waitForTimeout(5000);
  const afterOnboarding = new URL(page.url()).pathname;
  await page.screenshot({ path: `${SHOTS}/journey-4-after-onboarding.png` });

  const { data: done } = await db.from('profiles')
    .select('is_onboarded, resume_url, subjects, status').eq('email', EMAIL).maybeSingle();
  record('onboarding marks the profile complete', !!done?.is_onboarded, `is_onboarded=${done?.is_onboarded}`);
  record('CV path stored on the profile', !!done?.resume_url, done?.resume_url ?? 'null');
  record('subjects saved', (done?.subjects?.length ?? 0) > 0, JSON.stringify(done?.subjects));
  record('pending tutor is held at the approval screen', afterOnboarding.includes('pending'), afterOnboarding);

  // ---- 3. admin approves ----
  const adminCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const admin = await adminCtx.newPage();
  await admin.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await admin.locator('input[type="email"]').first().fill('admin@yakal.com');
  await admin.locator('input[type="password"]').first().fill(PASSWORD);
  await admin.locator('form button[type="submit"]').first().click();
  await admin.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 20000 });
  await admin.goto(`${BASE}/admin/users`, { waitUntil: 'domcontentloaded' });
  await admin.waitForTimeout(3500);

  const applicantVisible = await admin.getByText('Test Applicant').first().isVisible().catch(() => false);
  record('applicant appears in the admin user list', applicantVisible);
  await admin.screenshot({ path: `${SHOTS}/journey-4-admin-users.png` });

  const approveBtn = admin.getByRole('button', { name: /approve/i }).first();
  const canApprove = await approveBtn.isVisible().catch(() => false);
  record('an approve control exists', canApprove);
  if (canApprove) {
    await approveBtn.click();
    await admin.waitForTimeout(2500);
  }
  const { data: approved } = await db.from('profiles').select('status').eq('email', EMAIL).maybeSingle();
  record('approval sets the account active', approved?.status === 'active', approved?.status);

  // ---- 4. tutor returns ----
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  const finalPath = new URL(page.url()).pathname;
  record('approved tutor reaches the dashboard', finalPath.startsWith('/tutor'), finalPath);
  await page.screenshot({ path: `${SHOTS}/journey-5-approved.png` });

  record('no console errors along the way', errors.length === 0, errors.slice(0, 2).join(' | '));
} catch (err) {
  record('run', false, String(err).split('\n')[0].slice(0, 150));
  await page.screenshot({ path: `${SHOTS}/journey-error.png` }).catch(() => {});
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
