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

  {
    // A lazy route must not be loaded until its action is asked for. This is
    // what keeps the Google token exchange independent of the Drive and
    // Classroom clients it is grouped with.
    let loaded = '';
    const h = dispatch({
      cheap: (_req: any, r: any) => r.status(200).json({ hit: 'cheap' }),
      heavy: async () => { loaded = 'heavy'; return { default: (_req: any, r: any) => r.status(200).json({}) }; },
    } as any);
    const { res, out } = mockRes();
    await h({ query: { action: 'cheap' } } as any, res);
    check('a lazy route stays unloaded until asked for',
      out.code === 200 && loaded === '', loaded ? `loaded ${loaded}` : 'nothing loaded');

    const second = mockRes();
    await h({ query: { action: 'heavy' } } as any, second.res);
    check('a lazy route loads when asked for', second.out.code === 200 && loaded === 'heavy');
  }
  {
    // A handler that throws where its own try cannot catch it used to get
    // Vercel's HTML error page, which the browser could not read as JSON, so
    // the reason never reached the client.
    const h = dispatch({
      boom: () => { throw new Error('the credential is missing'); },
    } as any);
    const { res, out } = mockRes();
    await h({ query: { action: 'boom' } } as any, res);
    check('a throwing handler answers as JSON, with the reason',
      out.code === 500 && typeof out.body?.error === 'string'
        && out.body.error.includes('the credential is missing'),
      out.body?.error);
  }
  {
    // Same for a module that fails to load at all.
    const h = dispatch({
      broken: async () => { throw new Error('cannot find module'); },
    } as any);
    const { res, out } = mockRes();
    await h({ query: { action: 'broken' } } as any, res);
    check('a route that fails to load answers as JSON',
      out.code === 500 && String(out.body?.error).includes('cannot find module'));
  }

  console.log(failures === 0 ? '\nall passed' : `\n${failures} failed`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
