// ============================================================
// Is this deployment actually working?
//
// Not "is the process alive". Every production failure this month was a live
// process that was misconfigured: a Google refresh token minted against a
// different OAuth client, a mail sender left as the provider's shared address,
// an invite link pointing at localhost because a variable was unset. In each
// case the server answered requests perfectly happily and the first person to
// find out was a customer.
//
// So this checks the credentials, not the pulse. A deployment that cannot reach
// Google is degraded even though nothing has crashed.
//
// Lives in _utils rather than being its own api/*.ts file because every
// top-level file there is a deployed function and Vercel's plan allows twelve,
// which is exactly how many there are. Both servers mount it by hand instead.
// ============================================================

/** One thing that can be wrong on its own. */
export interface Component {
  name: string;
  ok: boolean;
  /** Said in words. Never contains a key, a token or an address. */
  detail: string;
}

export interface HealthReport {
  status: 'ok' | 'degraded';
  time: string;
  components: Component[];
}

/**
 * Cached, because an uptime monitor asks every few minutes and two of these
 * checks talk to somebody else's servers. Short enough that a fix shows up
 * while you are still looking at the page.
 */
let cached: { at: number; report: HealthReport } | null = null;
const TTL_MS = 60_000;

async function checkSupabase(): Promise<Component> {
  try {
    const { getServiceClient } = await import('./supabase.js');
    // A real query rather than a ping: the URL being reachable says nothing
    // about the key being accepted or the schema being there.
    const { error } = await getServiceClient()
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .limit(1);
    if (error) return { name: 'database', ok: false, detail: `query refused: ${error.message}` };
    return { name: 'database', ok: true, detail: 'reachable, key accepted' };
  } catch (err: any) {
    return { name: 'database', ok: false, detail: err?.message ?? 'unreachable' };
  }
}

function checkStripe(): Component {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return { name: 'stripe', ok: false, detail: 'no secret key configured' };

  // Which mode, named out loud. A deployment quietly running test keys takes no
  // real money, and looks identical to one that does until somebody checks
  // their bank.
  const mode = key.startsWith('sk_live') ? 'live' : key.startsWith('sk_test') ? 'test' : 'unrecognised';
  const webhook = process.env.STRIPE_WEBHOOK_SECRET ? '' : ', no webhook secret';

  return {
    name: 'stripe',
    // Test keys are a warning rather than an outage: the site works, it just
    // cannot be paid. Reported as degraded so it cannot be forgotten.
    ok: mode === 'live' && !webhook,
    detail: `${mode} mode${webhook}`,
  };
}

async function checkGoogle(): Promise<Component> {
  const token = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
  if (!token) return { name: 'google', ok: false, detail: 'no refresh token configured' };
  if (!process.env.VITE_GCP_CLIENT_ID || !process.env.GCP_CLIENT_SECRET) {
    return { name: 'google', ok: false, detail: 'no OAuth client configured' };
  }

  try {
    const { auth: googleAuth } = await import('@googleapis/classroom');
    const client = new googleAuth.OAuth2(
      process.env.VITE_GCP_CLIENT_ID,
      process.env.GCP_CLIENT_SECRET
    );
    client.setCredentials({ refresh_token: token });
    await client.getAccessToken();
    return { name: 'google', ok: true, detail: 'refresh token exchanges' };
  } catch (err: any) {
    const raw: string = err?.message ?? '';
    // The two that have actually happened, named rather than passed through.
    if (/unauthorized_client/i.test(raw)) {
      return {
        name: 'google',
        ok: false,
        detail: 'refresh token belongs to a different OAuth client',
      };
    }
    if (/invalid_grant/i.test(raw)) {
      return { name: 'google', ok: false, detail: 'refresh token expired or revoked' };
    }
    return { name: 'google', ok: false, detail: raw.slice(0, 120) || 'token exchange failed' };
  }
}

function checkEmail(): Component {
  const production =
    process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
  const chosen = (process.env.EMAIL_PROVIDER ?? '').trim().toLowerCase();
  const usingResend = chosen === 'resend' || (chosen !== 'smtp' && production);

  if (!usingResend) {
    return { name: 'email', ok: true, detail: 'local mail server' };
  }
  if (!process.env.RESEND_API_KEY) {
    return { name: 'email', ok: false, detail: 'resend selected but no API key' };
  }

  // The sender is the half that fails silently. Resend's shared address only
  // delivers to the account owner, so an invitation to anybody else is refused
  // while everything here looks configured.
  const sender = (process.env.EMAIL_FROM ?? '').trim();
  if (!sender) {
    return {
      name: 'email',
      ok: false,
      detail: 'no EMAIL_FROM; falling back to a shared sender that only reaches the account owner',
    };
  }
  return { name: 'email', ok: true, detail: 'resend, with a configured sender' };
}

function checkAppUrl(): Component {
  const configured =
    (process.env.APP_BASE_URL ?? '').trim() || (process.env.PUBLIC_APP_URL ?? '').trim();
  if (configured) return { name: 'links', ok: true, detail: 'base URL configured' };
  if (process.env.VERCEL_URL) return { name: 'links', ok: true, detail: 'using the Vercel URL' };
  return {
    name: 'links',
    ok: false,
    // Every link in every email comes from here.
    detail: 'no base URL; email links would point at localhost',
  };
}

/**
 * The two settings whose absence pays nobody.
 *
 * Both fail in complete silence, which is the exact class of failure this
 * endpoint exists for. Without JOBS_TOKEN the scheduled job refuses every
 * caller, so no lesson is ever completed and no money ever moves. Without the
 * Connect webhook secret, account.updated never arrives, so a tutor who has
 * finished connecting a bank is never marked payable and is skipped on every
 * run forever.
 *
 * Neither produces an error anywhere. A tutor simply never gets paid, and the
 * first person to notice is the tutor.
 */
function checkPayouts(): Component {
  const missing: string[] = [];
  if (!(process.env.JOBS_TOKEN ?? '').trim()) missing.push('no JOBS_TOKEN, so nothing is ever completed or paid');
  if (!(process.env.STRIPE_CONNECT_WEBHOOK_SECRET ?? '').trim()) {
    missing.push('no Connect webhook secret, so nobody who connects a bank is marked payable');
  }

  if (missing.length === 0) {
    return { name: 'payouts', ok: true, detail: 'job token and Connect webhook configured' };
  }
  return { name: 'payouts', ok: false, detail: missing.join('; ') };
}

/** The whole picture. Cached for a minute. */
export async function healthReport(): Promise<HealthReport> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.report;

  const components = [
    await checkSupabase(),
    checkStripe(),
    await checkGoogle(),
    checkEmail(),
    checkAppUrl(),
    checkPayouts(),
  ];

  const report: HealthReport = {
    status: components.every((c) => c.ok) ? 'ok' : 'degraded',
    time: new Date().toISOString(),
    components,
  };

  cached = { at: Date.now(), report };
  return report;
}

/**
 * The endpoint both servers mount.
 *
 * Public callers get the verdict and the status code, which is all an uptime
 * monitor needs. The detail says which integration is misconfigured, which is
 * a map for somebody probing, so it needs HEALTH_TOKEN. With no token set the
 * detail is simply never served rather than served to everyone.
 */
export async function handleHealth(req: any, res: any): Promise<void> {
  const report = await healthReport();

  const expected = (process.env.HEALTH_TOKEN ?? '').trim();
  const offered = (req?.query?.token ?? req?.headers?.['x-health-token'] ?? '').toString();
  const detailed = !!expected && offered === expected;

  // 503 so a monitor treats degraded as down without having to parse anything.
  res.status(report.status === 'ok' ? 200 : 503).json(
    detailed
      ? report
      : { status: report.status, time: report.time }
  );
}
