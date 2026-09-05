// A notification reaches a device.
//
// The push half has three ways to fail silently, and every one of them looks
// exactly like "nobody has subscribed yet":
//
//   - VAPID keys absent, so the sender never starts;
//   - a payload the service worker cannot read, so nothing is shown;
//   - a dead endpoint answering 410, which has to delete the row or every
//     later send retries the same corpse forever.
//
// None of that is visible from the app, and testing it by hand needs a real
// browser and a real vendor. So this stands up a push service of its own on
// localhost, subscribes a fake browser to it, and drives the real sender.
import { createServer } from 'node:https';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import { pushToUser } from '../../api/_utils/push.js';

const SUPABASE = process.env.VITE_SUPABASE_LOCAL_URL || 'http://127.0.0.1:54321';
const SERVICE =
  process.env.SUPABASE_SERVICE_ROLE_KEY_LOCAL ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

let failures = 0;
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'ok   ' : 'FAIL '} ${name}${detail ? '  -> ' + detail : ''}`);
  if (!ok) failures++;
};

const db = createClient(SUPABASE, SERVICE, { auth: { persistSession: false } });

// The keys this run signs with. Generated rather than read from the
// environment, so the check does not depend on a deployment being configured
// and cannot be affected by one that is.
const vapid = webpush.generateVAPIDKeys();
process.env.VAPID_PUBLIC_KEY = vapid.publicKey;
process.env.VAPID_PRIVATE_KEY = vapid.privateKey;
process.env.VAPID_SUBJECT = 'mailto:test@yakaledu.com';

// A browser's keys. The real ones come from the Push API; these are the same
// shape and the same curve, which is all the encryption cares about.
const keys = webpush.generateVAPIDKeys();
const clientKeys = {
  p256dh: keys.publicKey,
  auth: Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('base64url'),
};

// ---- a push service, on localhost ----
//
// HTTPS, because web-push refuses a plain http endpoint, and rightly: a push
// carries somebody's lesson times to a third party's server. So the fake
// service gets a self-signed certificate for the length of this run.
const certDir = mkdtempSync(join(tmpdir(), 'yakal-push-'));
execFileSync('openssl', [
  'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
  '-subj', '/CN=127.0.0.1',
  '-addext', 'subjectAltName=IP:127.0.0.1',
  '-keyout', join(certDir, 'key.pem'),
  '-out', join(certDir, 'cert.pem'),
], { stdio: 'ignore' });

// Only for this process, and only because the certificate above is one this
// script just made. Nothing here reaches a real push service.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

type Delivery = { body: Buffer; headers: Record<string, unknown> };
// Assigned inside the server's callback, which the compiler cannot see into,
// so it narrows this to never at the check below unless the type says so.
let received: Delivery | null = null;
let mode: 'accept' | 'gone' = 'accept';

const server = createServer({
  key: readFileSync(join(certDir, 'key.pem')),
  cert: readFileSync(join(certDir, 'cert.pem')),
}, (req, res) => {
  const chunks: Buffer[] = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    if (mode === 'gone') {
      // What a vendor answers for a subscription that no longer exists.
      res.writeHead(410).end();
      return;
    }
    received = { body: Buffer.concat(chunks), headers: req.headers as Record<string, unknown> };
    res.writeHead(201).end();
  });
});

await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
const port = (server.address() as { port: number }).port;
const endpoint = `https://127.0.0.1:${port}/push/fake-endpoint`;

// ---- a subscription belonging to a real seeded account ----
const { data: person } = await db
  .from('profiles')
  .select('id')
  .eq('email', 'student@yakal.com')
  .maybeSingle();

if (!person) {
  console.error('student@yakal.com is missing. Run npm run db:reset.');
  process.exit(1);
}

await db.from('push_subscriptions').delete().eq('user_id', person.id);
const { error: subErr } = await db.from('push_subscriptions').insert({
  user_id: person.id,
  endpoint,
  p256dh: clientKeys.p256dh,
  auth: clientKeys.auth,
  user_agent: 'verify/push-delivery',
});
check('a subscription can be stored', !subErr, subErr?.message ?? '');

// ---- the send ----
await pushToUser(db, person.id, {
  title: 'A lesson was moved',
  body: 'Mathematics is now Thursday at 5pm.',
  url: '/student/sessions',
  tag: 'sessionMoved:test',
});

const delivery = received as Delivery | null;
check('the push service was called', delivery !== null);
if (delivery) {
  // Encrypted end to end. The vendor moves bytes it cannot read, and this is
  // the property that makes it acceptable to send a child's lesson times
  // through somebody else's infrastructure.
  const raw = delivery.body.toString('utf8');
  check(
    'the payload is encrypted, not plain text',
    !raw.includes('Mathematics') && !raw.includes('lesson'),
    raw.slice(0, 40).replace(/[^\x20-\x7e]/g, '.')
  );
  check(
    'it is sent as an encrypted push',
    delivery.headers['content-encoding'] === 'aes128gcm',
    String(delivery.headers['content-encoding'])
  );
  // Signed with the private half of the pair, which is how a push service
  // knows the sender is the application the browser subscribed to.
  check(
    'it carries the VAPID signature',
    String(delivery.headers['authorization'] ?? '').startsWith('vapid'),
    String(delivery.headers['authorization'] ?? '').slice(0, 12)
  );
}

// ---- last_used_at is touched, so a stale device can be told from a quiet one ----
const { data: after } = await db
  .from('push_subscriptions')
  .select('last_used_at')
  .eq('endpoint', endpoint)
  .maybeSingle();
check('a delivered push is recorded', !!after?.last_used_at, String(after?.last_used_at));

// ---- a dead endpoint is dropped, not retried forever ----
mode = 'gone';
await pushToUser(db, person.id, { title: 'Anybody there', body: 'No.' });

const { count } = await db
  .from('push_subscriptions')
  .select('id', { count: 'exact', head: true })
  .eq('endpoint', endpoint);
check('a 410 deletes the subscription', (count ?? 0) === 0, `${count} left`);

// ---- and a person with no subscription is not an error ----
let threw = false;
try {
  await pushToUser(db, person.id, { title: 'Nobody', body: 'is listening.' });
} catch {
  threw = true;
}
check('sending to somebody with no device is quiet', !threw);

server.close();
rmSync(certDir, { recursive: true, force: true });
console.log(failures === 0 ? '\nall passed' : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
