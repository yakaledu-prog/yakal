import webpush from 'web-push';

// ============================================================
// Delivering a notification to a device.
//
// The third leg, after the database row and the email. The row waits for
// somebody to open the app and the email waits in an inbox, so neither is any
// use for a lesson that moved an hour before it starts.
//
// Web Push, so there is no vendor holding a device token and nothing to
// install. The browser mints an endpoint on its own vendor's push service and
// hands over two keys; we encrypt to those keys and post to that endpoint. The
// vendor moves ciphertext it cannot read.
//
// Never throws, for the same reason the notifier does not: telling somebody
// about a thing that already happened must not be able to undo it.
// ============================================================

type Db = { from: (table: string) => any };

let configured: boolean | null = null;

/**
 * VAPID identifies this application to the push services.
 *
 * Checked once and remembered, because this runs on every notification and the
 * answer cannot change inside a process. Absent keys are a deployment that has
 * not set them up rather than an error: everything else about a notification
 * still works.
 */
function ready(): boolean {
  if (configured !== null) return configured;

  // VITE_VAPID_PUBLIC_KEY is the same string under the name the browser needs,
  // and it has to be set for anybody to subscribe at all. Falling back to it
  // means one variable rather than two copies of one value, which is two
  // chances to paste the wrong half and a silent failure either way.
  const publicKey = process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  // A mailto or https URL a push service can use to reach us about a
  // misbehaving sender. Required by the spec; the services do use it.
  const subject = process.env.VAPID_SUBJECT || 'mailto:support@yakaledu.com';

  if (!publicKey || !privateKey) {
    console.warn('push: VAPID keys are not set, so nothing will be delivered to a device');
    configured = false;
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  /** Where clicking it goes, app-relative. */
  url?: string | null;
  /** Collapses repeats about the same thing, so the second replaces the first. */
  tag?: string;
}

/**
 * Push to every browser this person has registered.
 *
 * A subscription dies without telling anybody: clearing site data, a
 * reinstall, or the vendor deciding it is stale. The only signal is a 404 or
 * 410 on a send, so those are taken as the endpoint being gone and the row is
 * deleted. Anything else is a bad minute at the vendor and the row stays.
 */
export async function pushToUser(db: Db, userId: string, payload: PushPayload): Promise<void> {
  if (!ready()) return;

  try {
    const { data: subs } = await db
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', userId);

    if (!subs?.length) return;

    const body = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url ?? '/',
      tag: payload.tag,
    });

    const dead: string[] = [];
    const alive: string[] = [];

    await Promise.all(
      subs.map(async (s: { id: string; endpoint: string; p256dh: string; auth: string }) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            body,
            // Four weeks is the maximum most services accept. A notification
            // about a lesson is worthless long before that, but the TTL only
            // governs how long they hold it for a device that is offline, and
            // a phone in a bag overnight is the normal case.
            { TTL: 60 * 60 * 24 }
          );
          alive.push(s.id);
        } catch (err: any) {
          const status = err?.statusCode;
          if (status === 404 || status === 410) {
            dead.push(s.id);
          } else {
            console.error(`push: send to ${userId} failed with ${status ?? '?'}:`, err?.message);
          }
        }
      })
    );

    if (dead.length) {
      await db.from('push_subscriptions').delete().in('id', dead);
    }
    if (alive.length) {
      // So a subscription nothing has reached in months can be told apart from
      // one that is simply quiet.
      await db
        .from('push_subscriptions')
        .update({ last_used_at: new Date().toISOString() })
        .in('id', alive);
    }
  } catch (err: any) {
    console.error(`push: could not reach ${userId}:`, err?.message);
  }
}
