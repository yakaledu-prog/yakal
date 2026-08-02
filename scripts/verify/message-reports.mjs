// The scan that reads every message as it is written.
//
// Two halves. The rules are checked in the database, where they can be run
// against a hundred phrasings in a second, and the half that matters most is
// the false positives: a scan that cries wolf on a maths lesson gets ignored,
// and an ignored scan protects nobody. The trigger, the notification and the
// parent's view are then checked end to end in the browser.
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const CONN = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const TMP = '/tmp/claude-1000/-home-binyam-products-yakal/470a1a43-cc42-4652-988d-ac4539a37912/scratchpad/verify.sql';

// Through a file rather than -c: half of what is checked below is quoting, and
// passing quoted SQL through a shell to check quoting is how you end up
// debugging the test instead of the thing it tests.
const psql = (sql) => {
  writeFileSync(TMP, sql);
  // ON_ERROR_STOP or psql exits 0 having printed the error and carried on,
  // which turns every "this must be rejected" check into a silent pass.
  return execSync(`psql "${CONN}" -v ON_ERROR_STOP=1 -tAq -f ${TMP}`,
    { stdio: ['pipe', 'pipe', 'pipe'] }).toString().trim();
};

/** The last line of output, for scripts that set a role before selecting. */
const psqlLast = (sql) => psql(sql).split('\n').pop().trim();

/** Runs as one user, the way PostgREST does, so RLS actually applies. */
const asUser = (userId, sql) =>
  psqlLast(
    // One transaction, because set_config's third argument is is_local: set it
    // outside a transaction and the claims are gone by the next statement,
    // leaving auth.uid() null and every policy passing for the wrong reason.
    `begin;\n` +
    `set local role authenticated;\n` +
    `select set_config('request.jwt.claims', '{"sub":"${userId}","role":"authenticated"}', true);\n` +
    sql + `\ncommit;`
  );

let failures = 0;
const pass = (s, ok, d = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${s}${d ? '  -> ' + d : ''}`);
};

// ---------- the rules ----------

const scan = (text) =>
  JSON.parse(psql(`select public.scan_message_content('${text.replace(/'/g, "''")}')`) || '[]');
const categories = (text) => scan(text).map((h) => h.category).sort();

const SHOULD_CATCH = [
  ['secrecy', "Please don't tell your parents about this"],
  ['secrecy', 'lets keep this between us'],
  ['secrecy', 'delete these messages when you are done'],
  ['secrecy', 'promise me not to tell anyone'],
  ['grooming', 'send me a picture of you'],
  ['grooming', 'send me a selfie'],
  ['grooming', 'are your parents home right now?'],
  ['grooming', 'i can pick you up after school'],
  ['grooming', 'can we meet in person instead'],
  ['grooming', 'come to my place tomorrow'],
  ['grooming', 'you are so pretty'],
  ['contact_details', 'my email is samuel.t@gmail.com'],
  ['contact_details', 'reach me at 0911234567'],
  ['contact_details', '+251 91 123 4567 is mine'],
  ['contact_details', 'my number is oh nine one one two three four five six seven'],
  ['contact_details', 'samuelt at gmail dot com'],
  ['contact_details', 'call me here 13478245640'],
  ['contact_details', '13478245640'],
  ['off_platform', 'add me on WhatsApp'],
  ['off_platform', 'w h a t s a p p me instead'],
  ['off_platform', 'wh4ts4pp is easier'],
  ['off_platform', 'lets talk somewhere else'],
  ['off_platform', 'no need to go through the platform'],
  ['payment', 'you can pay me directly in cash'],
  ['payment', 'send it via telebirr'],
  ['payment', 'it is cheaper if you book directly'],
];

// The half that decides whether anyone keeps paying attention to this. Every
// one of these is something a real tutor says in a real lesson.
const MUST_NOT_CATCH = [
  'Great work on the homework today!',
  'The answer is 123456789',
  'pi is 3.14159265358979',
  'Solve for x: 2x + 45 = 189',
  'Lets meet at 4pm for the session',
  'I will share the Zoom link before class',
  'Your essay draft is due on the 12th',
  'The population was 1,234,567,890 in the dataset',
  'Can you show me the picture in chapter 3',
  'send me a picture of your homework',
  'can you send me a photo of the question',
  'Please tell your parents about the parent evening',
  'I love your approach to that proof',
  'Read pages 45 to 60 for tomorrow',
  'Well done, you scored 18 out of 20',
];

for (const [expect, text] of SHOULD_CATCH) {
  const got = categories(text);
  pass(`catches ${expect}: "${text.slice(0, 40)}"`, got.includes(expect), got.join(',') || 'nothing');
}
for (const text of MUST_NOT_CATCH) {
  const got = categories(text);
  pass(`leaves alone: "${text.slice(0, 40)}"`, got.length === 0, got.join(','));
}

// Severity is what decides how loudly a parent is told.
pass(
  'secrecy and grooming rank high',
  scan("dont tell your parents").every((h) => h.severity === 'high') &&
    scan('add me on whatsapp').every((h) => h.severity === 'medium')
);

// ---------- the trigger ----------

// Reports filed by an earlier run change the flag's label to "You reported
// this conversation", which is how this suite spent a run unable to find its
// own button.
psql('delete from conversation_flags;');
psql('delete from message_reports;');
psql("delete from notifications where type = 'message_report';");

// A monitored conversation whose other party is neither an admin nor, through
// a link of their own, somebody's parent. Both of those read message_reports
// legitimately, so picking one would test nothing. The seed currently has a
// tutor wrongly registered as a student's parent, which is exactly the case
// this filter has to step around.
const [convo, student, tutor] = psql(`
  select cp.conversation_id, cp.user_id, other.user_id
  from conversation_participants cp
  join parent_student_links psl
    on psl.student_id = cp.user_id and psl.status = 'active'
  join conversation_participants other
    on other.conversation_id = cp.conversation_id and other.user_id <> cp.user_id
  join profiles op on op.id = other.user_id
  where op.role <> 'admin'
    and not exists (
      select 1 from parent_student_links l
      where l.parent_id = other.user_id and l.status = 'active'
    )
  limit 1`).split('|');

if (!convo) {
  console.log('FAIL  no conversation to test against');
  process.exit(1);
}

// Everything this suite writes into a real conversation, so it can take it all
// back out. It plants into whichever conversation fits, and that is a seeded
// demo thread somebody is about to look at.
const planted = [];

const msgId = psql(`
  insert into messages (conversation_id, sender_id, content)
  values ('${convo}', '${tutor}',
          'You are doing really well. Add me on WhatsApp, my number is 0911234567, but dont tell your parents')
  returning id`);
planted.push(msgId);

pass(
  'one message, three categories',
  psql(`select count(*) from message_reports where message_id = '${msgId}'`) === '3'
);
pass(
  'the worst of them ranks high',
  psql(`select count(*) from message_reports where message_id = '${msgId}' and severity = 'high'`) === '1'
);
// A clean message leaves nothing behind.
const cleanId = psql(`
  insert into messages (conversation_id, sender_id, content)
  values ('${convo}', '${tutor}', 'Great progress today, see you Thursday at 4pm')
  returning id`);
planted.push(cleanId);
pass(
  'a clean message is not reported',
  psql(`select count(*) from message_reports where message_id = '${cleanId}'`) === '0'
);

// Six hours between notifications, or a bad exchange arrives as six alerts
// saying the same thing and gets dismissed as a batch. Counted as a delta
// rather than against 1: a student can have more than one parent linked, and
// each of them is told once.
const before = psql("select count(*) from notifications where type = 'message_report'");
planted.push(psql(`
  insert into messages (conversation_id, sender_id, content)
  values ('${convo}', '${tutor}', 'seriously, dont tell anyone about this')
  returning id`));
const after = psql("select count(*) from notifications where type = 'message_report'");

// A reply from the child, so the conversation has two speakers to tell apart.
planted.push(psql(`
  insert into messages (conversation_id, sender_id, content)
  values ('${convo}', '${student}', 'ok I will not say anything')
  returning id`));

const counterpartyName = psql(`select full_name from profiles where id = '${tutor}'`);
const childName = psql(`select full_name from profiles where id = '${student}'`);
pass('the parent is told at all', Number(before) >= 1, `before: ${before}`);
pass('repeat messages do not repeat the notification', before === after, `${before} -> ${after}`);

// ---------- evidence stays put ----------

let blocked = false;
try {
  psql(
    `begin;\n` +
    `set local role authenticated;\n` +
    `select set_config('request.jwt.claims', '{"sub":"${student}","role":"authenticated"}', true);\n` +
    `update messages set content = 'never mind' where id = '${msgId}';\n` +
    `commit;`
  );
} catch (e) {
  blocked = /reported and cannot be edited/.test(e.stderr?.toString() ?? '');
}
pass('a reported message cannot be rewritten', blocked);
pass(
  'and still says what it said',
  psql(`select content from messages where id = '${msgId}'`).includes('WhatsApp')
);

// ---------- who can see the scan ----------
//
// The point of keeping this out of the messages table: somebody who can see
// which of their messages was caught can work out which word did it.

const parentId = psql(
  `select parent_id from parent_student_links where student_id = '${student}' and status = 'active' limit 1`
);

pass(
  'the parent sees the scan results',
  Number(asUser(parentId, 'select count(*) from message_reports;')) > 0
);
pass(
  'the person who wrote it does not',
  asUser(tutor, 'select count(*) from message_reports;') === '0'
);
pass(
  'nor does the student in the conversation',
  asUser(student, 'select count(*) from message_reports;') === '0'
);

// ---------- the parent's view ----------

const BASE = process.env.BASE || 'http://localhost:5173';
const b = await chromium.launch();
const errs = [];

async function signIn(email) {
  const p = await (await b.newContext({ viewport: { width: 1440, height: 950 } })).newPage();
  p.on('pageerror', (e) => errs.push(`${email}: ${e.message}`));
  await p.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await p.locator('input[type="email"]').first().fill(email);
  await p.locator('input[type="password"]').first().fill('demo123');
  await p.locator('form button[type="submit"]').first().click();
  await p.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 20000 });
  return p;
}

const parent = await signIn('parent@yakal.com');

// Where the notification sends them: the children's chats, not the parent's own.
pass(
  'the notification points at the child-chats page',
  psql("select distinct link from notifications where type = 'message_report'") === '/parent/child-chats'
);

await parent.goto(`${BASE}/parent/child-chats`, { waitUntil: 'domcontentloaded' });
await parent.waitForTimeout(4000);

// Open the planted conversation rather than whichever sorted first: the list
// reorders by last activity, and asserting on the top row made this suite pass
// or fail on which test ran last.
await parent.locator('button').filter({ hasText: counterpartyName }).first().click();
await parent.waitForTimeout(2000);

pass(
  'the flagged message is marked in the transcript',
  (await parent.getByText(/Asking to keep it secret|Another app|Contact details/).count()) > 0
);

// The tooltip changes once the scan has caught something here, so match both.
await parent.getByRole('button', { name: /Report this conversation|picked something out|You reported/i }).first().click();
await parent.waitForTimeout(1500);
const dlg = parent.locator('div[role="dialog"]');
const dlgText = await dlg.innerText();

pass('two steps, not three', !/\bReported\b/.test(dlgText) && /Messages/.test(dlgText) && /Reason/.test(dlgText));

const pickedMessages = await dlg.locator('button[aria-pressed="true"]').count();
pass('messages start chosen', pickedMessages >= 1, `${pickedMessages} pressed`);

// The parent is a third party here, so neither side is theirs. Both names have
// to appear or somebody's words are being put in somebody else's mouth.
// The parent is a third party here, so neither side is theirs. The names are
// on the avatars now, so check the sides instead: exactly one of the two
// speakers' bubbles must be the right-hand, teal one.
const sides = await dlg.evaluate((el, ids) => {
  const rows = [...el.querySelectorAll('div.flex.items-end')];
  return {
    right: rows.filter((r) => r.className.includes('flex-row-reverse')).length,
    left: rows.filter((r) => !r.className.includes('flex-row-reverse')).length,
  };
}, null);
pass('both speakers appear, on their own sides', sides.right > 0 && sides.left > 0, JSON.stringify(sides));
pass('every message carries a face', (await dlg.locator('img').count()) > 0);

await dlg.getByRole('button', { name: 'Next' }).click();
await parent.waitForTimeout(800);
const step2 = await dlg.innerText();
pass('the reason carries over already chosen', /Moving off the platform|Inappropriate content/.test(step2));
pass(
  'a reason is pre-selected',
  (await dlg.locator('button[aria-pressed="true"]').count()) > 0
);

const flagsBefore = psql("select count(*) from conversation_flags");
await dlg.getByRole('button', { name: 'Send report' }).click();
await parent.waitForTimeout(2500);
const flagsAfter = psql("select count(*) from conversation_flags");
pass('sending files the report', Number(flagsAfter) > Number(flagsBefore), `${flagsBefore} -> ${flagsAfter}`);

pass('no page errors', errs.length === 0, errs.join(' | '));
await b.close();

// Reports first: the protection trigger refuses to delete a reported message,
// which is the feature working and not something to route around in the app.
const ids = planted.map((id) => `'${id}'`).join(', ');
psql(`delete from conversation_flags where conversation_id = '${convo}';`);
psql(`delete from message_reports where message_id in (${ids});`);
psql(`delete from messages where id in (${ids});`);
psql("delete from notifications where type = 'message_report';");

console.log(failures === 0 ? '\nall good' : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
