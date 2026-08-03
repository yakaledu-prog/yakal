// The ?action= dispatcher, checked without a server.
//
// Grouping the endpoints was forced by Vercel's twelve function limit on the
// Hobby plan. The risk it introduces is a routing table, so this asserts the
// table does what the old one-file-per-endpoint layout did for free.
import { dispatch } from '../../api/_handlers/_dispatch.ts';

function mockRes() {
  const out: { code: number; body: any } = { code: 0, body: null };
  const res: any = {
    status(c: number) { out.code = c; return res; },
    json(b: any) { out.body = b; return res; },
  };
  return { res, out };
}

let failures = 0;
function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
  if (!ok) failures++;
}

async function main() {
  const handler = dispatch({
    'checkout': (_req: any, res: any) => res.status(200).json({ hit: 'checkout' }),
    'payment-methods': (_req: any, res: any) => res.status(200).json({ hit: 'payment-methods' }),
  } as any);

  {
    const { res, out } = mockRes();
    await handler({ query: { action: 'checkout' } } as any, res);
    check('known action routes', out.code === 200 && out.body.hit === 'checkout');
  }
  {
    // The one that a naive string split would have broken.
    const { res, out } = mockRes();
    await handler({ query: { action: 'payment-methods' } } as any, res);
    check('hyphenated action routes', out.code === 200 && out.body.hit === 'payment-methods');
  }
  {
    const { res, out } = mockRes();
    await handler({ query: { action: 'nope' } } as any, res);
    check('unknown action 404s and lists what is valid',
      out.code === 404 && Array.isArray(out.body.expected));
  }
  {
    // A silent 200 with an empty body would be the worst outcome here.
    const { res, out } = mockRes();
    await handler({ query: {} } as any, res);
    check('missing action 404s', out.code === 404);
  }
  {
    // zoom-meetings reads req.query.meetingId, so action must not crowd it out.
    const seen: { id?: string } = {};
    const { res } = mockRes();
    const h = dispatch({
      meetings: (req: any, r: any) => { seen.id = req.query.meetingId; return r.status(200).json({}); },
    } as any);
    await h({ query: { action: 'meetings', meetingId: '8891' } } as any, res);
    check('sibling query params survive', seen.id === '8891', `meetingId=${seen.id}`);
  }

  console.log(failures === 0 ? '\nall passed' : `\n${failures} failed`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
