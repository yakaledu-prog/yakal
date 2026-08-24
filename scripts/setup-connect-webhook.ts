// Create the Connect webhook endpoint, correctly, without clicking.
//
// Doing this by hand has one failure mode and it is silent. A Connect endpoint
// is not a normal one: it needs connect: true, and an endpoint made without it
// looks identical in the dashboard while account.updated never arrives. The
// tutor then sees "Awaiting your bank" forever on a bank they already
// connected, and nothing errors anywhere.
//
// So it is made through the API, where that flag is a parameter rather than a
// checkbox somebody has to notice.
//
//   npx tsx scripts/setup-connect-webhook.ts                 # against yakal.me
//   npx tsx scripts/setup-connect-webhook.ts https://other   # somewhere else
//
// Idempotent: an endpoint already pointing at this URL for connected accounts
// is reported rather than duplicated. Stripe will happily hold ten identical
// endpoints and deliver to all of them.
//
// The signing secret is only readable at creation, so an endpoint that already
// exists cannot have its secret reprinted. Delete it and run this again if the
// value has been lost.
import 'dotenv/config';
import Stripe from 'stripe';

// account.updated is the load-bearing one: it is what marks somebody payable
// when they finish onboarding. payout.failed is so a payout bouncing off a
// closed bank account is visible rather than money that quietly never landed.
const EVENTS: Stripe.WebhookEndpointCreateParams.EnabledEvent[] = [
  'account.updated',
  'payout.failed',
];

const DEFAULT_URL = 'https://yakal.me/api/stripe-webhook';

async function main() {
  const key = (process.env.STRIPE_SECRET_KEY ?? '').trim();
  if (!key) {
    console.error('STRIPE_SECRET_KEY is not set. Nothing to talk to.');
    process.exit(1);
  }

  const url = process.argv[2] ?? DEFAULT_URL;
  const live = key.startsWith('sk_live_');
  const stripe = new Stripe(key);

  console.log(`\n${live ? 'LIVE' : 'test'} mode, endpoint ${url}\n`);

  // Stripe does not dedupe, so this does.
  //
  // A Connect endpoint is told apart by `application`, which carries the
  // platform's own ca_ id. An ordinary account endpoint has null there, and the
  // `connect` flag you pass on creation is not returned at all, so this is the
  // only thing to read. Getting it backwards makes a second endpoint every run,
  // and Stripe will happily deliver to all of them.
  for await (const existing of stripe.webhookEndpoints.list({ limit: 100 })) {
    if (existing.url === url && existing.status !== 'disabled') {
      const isConnect = (existing as any).application != null;
      if (isConnect) {
        console.log(`Already there: ${existing.id}`);
        console.log(`Events: ${existing.enabled_events.join(', ')}`);
        const missing = EVENTS.filter((e) => !existing.enabled_events.includes(e));
        if (missing.length > 0) {
          await stripe.webhookEndpoints.update(existing.id, {
            enabled_events: [...new Set([...existing.enabled_events, ...EVENTS])] as any,
          });
          console.log(`Added the missing events: ${missing.join(', ')}`);
        }
        console.log(
          '\nThe signing secret is shown only when an endpoint is created, so it cannot be\n' +
            'reprinted. If STRIPE_CONNECT_WEBHOOK_SECRET has been lost, delete this endpoint\n' +
            'in the Stripe dashboard and run this again.\n'
        );
        return;
      }
    }
  }

  const endpoint = await stripe.webhookEndpoints.create({
    url,
    enabled_events: EVENTS,
    // The whole reason this script exists.
    connect: true,
    description: 'Yakal: events on connected accounts',
  });

  console.log(`Created ${endpoint.id}`);
  console.log(`Events:  ${endpoint.enabled_events.join(', ')}`);
  console.log('\nPut this in Render, as an environment variable on the service:\n');
  console.log(`  STRIPE_CONNECT_WEBHOOK_SECRET = ${endpoint.secret}\n`);
  console.log('Render restarts on its own once you save it.');
  if (!live) {
    console.log('\nThis was test mode. Run it again with the live key for production.');
  }
  console.log('');
}

main().catch((err) => {
  console.error(`\nFailed: ${err?.message ?? err}\n`);
  process.exit(1);
});
