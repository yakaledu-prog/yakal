// A Zoom signature is refused unless the credentials are real.
//
// Production had VITE_ZOOM_MEETING_CLIENT_ID set to
// "your-meeting-sdk-client-id", which is the value from .env.example and a
// perfectly good non-empty string. The handler only checked for absence, so it
// signed every request with the placeholder and answered 200 with a token Zoom
// rejects on join. Decoded from the live site, the appKey really was
// "your-meeting-sdk-client-id".
//
// The failure had no symptom anywhere: the browser cannot tell a bad signature
// from a good one until Zoom refuses it, and by then somebody is sitting in
// front of a meeting that will not open.
//
// The credential rules live in signFor, which the handler calls once it has
// decided who the caller is and which meeting and role they get. The handler
// itself is checked with real sessions in drive-zoom-auth.ts.
//
// Needs nothing.
export {};

const mod = await import('../../api/_handlers/zoom-signature.js');
const handler = mod.default;
const { signFor } = mod;

let failures = 0;
const pass = (s: string, ok: boolean, d = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'ok   ' : 'FAIL '} ${s}${d ? '  -> ' + d : ''}`);
};

function call(body: any) {
  const out = signFor(String(body.meetingNumber ?? ''), body.role ?? 0);
  return { code: out.status, body: out.body };
}

const realish = { key: 'abcDEF123456', secret: 'sshhhhSecret0123456789' };
const saved = {
  key: process.env.VITE_ZOOM_MEETING_CLIENT_ID,
  secret: process.env.ZOOM_MEETING_CLIENT_SECRET,
};

const withEnv = (key: string | undefined, secret: string | undefined, body: any) => {
  if (key === undefined) delete process.env.VITE_ZOOM_MEETING_CLIENT_ID;
  else process.env.VITE_ZOOM_MEETING_CLIENT_ID = key;
  if (secret === undefined) delete process.env.ZOOM_MEETING_CLIENT_SECRET;
  else process.env.ZOOM_MEETING_CLIENT_SECRET = secret;
  return call(body);
};

const good = withEnv(realish.key, realish.secret, { meetingNumber: '123', role: 0 });
pass('real credentials produce a signature', good.code === 200 && !!good.body?.signature);

const decoded = JSON.parse(
  Buffer.from(String(good.body.signature).split('.')[1], 'base64url').toString()
);
pass('and it carries the real key as appKey', decoded.appKey === realish.key, decoded.appKey);

pass(
  'the example placeholder is refused, not signed',
  withEnv('your-meeting-sdk-client-id', realish.secret, { meetingNumber: '123', role: 0 }).code === 500
);
pass(
  'so is a placeholder secret',
  withEnv(realish.key, 'your-meeting-sdk-client-secret', { meetingNumber: '123', role: 0 }).code === 500
);
pass(
  'and so are the other shapes a placeholder takes',
  withEnv('REPLACE-ME', realish.secret, { meetingNumber: '123', role: 0 }).code === 500 &&
    withEnv('changeme', realish.secret, { meetingNumber: '123', role: 0 }).code === 500
);
pass('missing credentials are still refused', withEnv(undefined, undefined, { meetingNumber: '123', role: 0 }).code === 500);
pass(
  'a refusal says what an administrator has to do',
  /not configured/i.test(withEnv(undefined, undefined, { meetingNumber: '123', role: 0 }).body?.error ?? '')
);
// The handler asks who is calling before anything else. This used to sign for
// anybody who posted a meeting number and a role.
const anon: any = {};
await handler({ method: 'POST', headers: {}, body: { meetingNumber: '123', role: 1 } } as any, {
  status(c: number) { anon.code = c; return this; },
  json(b: any) { anon.body = b; return this; },
  end() { return this; },
} as any);
pass('the handler refuses a caller with no token', anon.code === 401, String(anon.code));

withEnv(saved.key, saved.secret, { meetingNumber: '1', role: 0 });

console.log(failures === 0 ? '\nall passed' : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
