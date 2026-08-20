// Zoom's webhook only accepts Zoom.
//
// The endpoint stores attendance on a lesson, and attendance decides whether a
// lesson is held back for review. Anybody who can post to it unsigned can
// therefore mark somebody's lesson as an empty room, so the signature is the
// whole of its security and is worth pinning.
//
// No network and no Zoom: it drives the handler directly with bodies it signs
// itself. It does need the local database, because a correctly signed delivery
// goes on to look for the meeting's session, and a lookup that fails is
// deliberately a 500 so Zoom retries.
//
//   npx tsx scripts/verify/zoom-webhook.ts
import { createHmac } from 'node:crypto';

process.env.ZOOM_WEBHOOK_SECRET_TOKEN = 'fixture-secret-token';

const handler = (await import('../../api/_handlers/zoom-webhook.js')).default;

let failures = 0;
const pass = (s: string, ok: boolean, d = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${s}${d ? '  -> ' + d : ''}`);
};

const SECRET = 'fixture-secret-token';

function sign(rawBody: string, timestamp: string, secret = SECRET): string {
  return 'v0=' + createHmac('sha256', secret).update(`v0:${timestamp}:${rawBody}`).digest('hex');
}

async function post(
  body: unknown,
  opts: { signature?: string; timestamp?: string; rawBody?: string } = {}
) {
  const rawBody = opts.rawBody ?? JSON.stringify(body);
  const timestamp = opts.timestamp ?? '1750000000';

  let out: any;
  const res: any = {
    status(c: number) {
      this._c = c;
      return this;
    },
    json(b: any) {
      out = { code: this._c, body: b };
      return this;
    },
    end() {
      return this;
    },
  };

  await handler(
    {
      method: 'POST',
      headers: {
        'x-zm-signature': opts.signature ?? sign(rawBody, timestamp),
        'x-zm-request-timestamp': timestamp,
      },
      body,
      rawBody,
    } as any,
    res
  );
  return out;
}

// ---- proving Zoom owns the endpoint ----
//
// This one arrives before any signature exists to check, which is the point of
// it, so it is answered on its own terms.

const challenge = { event: 'endpoint.url_validation', payload: { plainToken: 'abc123' } };
const validated = await post(challenge, { signature: 'v0=nonsense' });
pass('the URL validation challenge is answered', validated.code === 200, JSON.stringify(validated.body));
pass('with the token echoed', validated.body?.plainToken === 'abc123');
pass(
  'and signed with the secret',
  validated.body?.encryptedToken ===
    createHmac('sha256', SECRET).update('abc123').digest('hex'),
  validated.body?.encryptedToken
);

// ---- everything else has to be signed ----

const ended = { event: 'meeting.ended', payload: { object: { id: '999-fixture-no-such-meeting' } } };

const unsigned = await post(ended, { signature: '' });
pass('an unsigned delivery is refused', unsigned.code === 401, JSON.stringify(unsigned.body));

const forged = await post(ended, { signature: 'v0=' + 'a'.repeat(64) });
pass('a forged signature is refused', forged.code === 401, JSON.stringify(forged.body));

const wrongSecret = await post(ended, {
  signature: sign(JSON.stringify(ended), '1750000000', 'somebody-elses-secret'),
});
pass("somebody else's secret is refused", wrongSecret.code === 401, JSON.stringify(wrongSecret.body));

// The signature covers the timestamp, so replaying a body under a different one
// does not verify.
const replayed = await post(ended, {
  signature: sign(JSON.stringify(ended), '1750000000'),
  timestamp: '1760000000',
});
pass('a signature from another timestamp is refused', replayed.code === 401, JSON.stringify(replayed.body));

// The body is signed byte for byte. A parsed-and-reserialised body that differs
// by so much as a space is a different message.
const tampered = await post(ended, {
  rawBody: JSON.stringify(ended) + ' ',
  signature: sign(JSON.stringify(ended), '1750000000'),
});
pass('an altered body is refused', tampered.code === 401, JSON.stringify(tampered.body));

// A correctly signed one gets through. The meeting id matches no session, which
// is the ordinary case for any Zoom meeting this platform did not create, and
// is not an error.
const good = await post(ended);
pass('a properly signed delivery is accepted', good.code === 200, JSON.stringify(good.body));

// ---- no secret, no service ----
//
// Failing closed matters here: the alternative is an endpoint anybody can post
// attendance to, and attendance decides whether a lesson is held for review.

delete process.env.ZOOM_WEBHOOK_SECRET_TOKEN;
const unconfigured = await post(ended);
pass('with no secret configured, nothing is accepted', unconfigured.code === 500, JSON.stringify(unconfigured.body));
process.env.ZOOM_WEBHOOK_SECRET_TOKEN = SECRET;

// A body that arrived already parsed, with no bytes to check, is refused rather
// than verified against a re-serialisation that only usually matches.
let noRaw: any;
const res: any = {
  status(c: number) {
    this._c = c;
    return this;
  },
  json(b: any) {
    noRaw = { code: this._c, body: b };
    return this;
  },
  end() {
    return this;
  },
};
await handler(
  { method: 'POST', headers: { 'x-zm-signature': 'v0=x', 'x-zm-request-timestamp': '1' }, body: ended } as any,
  res
);
pass('a delivery with no raw body is refused', noRaw.code === 500, JSON.stringify(noRaw.body));

const wrongMethod = await (async () => {
  let out: any;
  const r: any = {
    status(c: number) {
      this._c = c;
      return this;
    },
    json() {
      out = { code: this._c };
      return this;
    },
    end() {
      return this;
    },
  };
  await handler({ method: 'GET', headers: {} } as any, r);
  return out;
})();
pass('GET is refused', wrongMethod.code === 405);

console.log(failures === 0 ? '\nall checks passed' : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
