import { supabase } from "@/lib/supabase";

// ============================================================
// Push notifications, from the browser's side.
//
// A notification already reaches two places: a row in the database, which
// waits until somebody opens the app, and an email, which waits in an inbox a
// fourteen year old does not read. Neither is any use for a lesson that moved
// an hour before it starts.
//
// Web Push needs three things to line up, and every one of them can be absent
// on a perfectly ordinary device: a service worker, the Push API, and the
// user's permission. So everything here reports what it found rather than
// throwing, and the caller shows the reason.
//
// The public VAPID key is public. It identifies this application to the push
// service and is sent to every browser that subscribes, exactly like the
// Supabase anon key, so it is a VITE_ variable on purpose. The private half
// signs the requests and lives only on the server.
// ============================================================

const PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

export type PushState =
  | "unsupported"
  | "unconfigured"
  | "denied"
  | "subscribed"
  | "unsubscribed";

/** Whether this browser can do it at all. */
export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/**
 * The base64url the browser hands out, as the bytes applicationServerKey wants.
 *
 * Base64url is not base64: it swaps two characters and drops the padding, and
 * atob rejects it. Every guide writes this function out and it is worth saying
 * why rather than pasting it again.
 */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Where things stand, without asking for anything. */
export async function getPushState(): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  if (!PUBLIC_KEY) return "unconfigured";
  if (Notification.permission === "denied") return "denied";

  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return "unsubscribed";

  // The browser having a subscription is only half of it. The server has to
  // hold the endpoint too, or there is nobody to push to.
  //
  // This said "subscribed" on the strength of the browser alone, so a save that
  // failed once left the toggle reading "Turn off on this browser" for ever
  // while no notification could ever arrive, and the one control that would
  // have fixed it was the one that looked like it was already on. Reproduced by
  // subscribing in the browser with no row on the server.
  //
  // A lookup rather than a count of all rows: a person may have several
  // devices, and only this endpoint says anything about this one.
  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("id")
    .eq("endpoint", sub.endpoint)
    .maybeSingle();

  // Offline, or signed out. Say what the browser says rather than claiming a
  // device is unsubscribed on the strength of a request that never arrived.
  if (error) return "subscribed";

  return data ? "subscribed" : "unsubscribed";
}

/**
 * Ask, subscribe, and record it.
 *
 * Must be called from a click. Browsers refuse a permission prompt that did
 * not come from a gesture, and Chrome holds it against the origin for a while
 * afterwards, so there is no asking again later on a page load.
 */
export async function enablePush(): Promise<{ ok: boolean; state: PushState; error?: string }> {
  if (!pushSupported()) return { ok: false, state: "unsupported" };
  if (!PUBLIC_KEY) {
    return { ok: false, state: "unconfigured", error: "Push is not configured on this deployment." };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return {
      ok: false,
      state: permission === "denied" ? "denied" : "unsubscribed",
      error:
        permission === "denied"
          ? "Notifications are blocked for this site. Turn them back on in your browser settings."
          : "Notifications were not allowed.",
    };
  }

  // ready rather than getRegistration: on a first visit the worker may still
  // be installing, and pushManager on a registration that is not active yet
  // throws rather than waiting.
  const reg = await navigator.serviceWorker.ready;

  // An existing subscription is reused. Unsubscribing and re-subscribing would
  // mint a new endpoint and leave the old row pointing at nothing.
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      // Required, and it must be true: a browser will not grant a silent
      // subscription to a web app, so every push has to show something.
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(PUBLIC_KEY),
    }));

  const saved = await saveSubscription(sub);
  if (!saved.ok) return { ok: false, state: "unsubscribed", error: saved.error };
  return { ok: true, state: "subscribed" };
}

/** Stop this browser receiving them. Other devices are untouched. */
export async function disablePush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;

  // The row goes first. If unsubscribing succeeded and the delete then failed,
  // the server would keep posting to an endpoint that no longer exists, which
  // is a 410 on every send until somebody prunes it.
  await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  await sub.unsubscribe();
}

/**
 * Write the endpoint and its keys.
 *
 * Upsert on the endpoint, because a browser hands back the same one for the
 * same registration: without it, signing in twice on one laptop leaves two
 * rows and every notification arrives twice.
 */
async function saveSubscription(sub: PushSubscription): Promise<{ ok: boolean; error?: string }> {
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user.id;
  if (!userId) return { ok: false, error: "Sign in first." };

  const json = sub.toJSON();
  if (!json.keys?.p256dh || !json.keys?.auth) {
    return { ok: false, error: "This browser gave us a subscription with no keys." };
  }

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: sub.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      // Only so somebody can tell their own devices apart. Truncated, because
      // the full string is long and none of the rest of it helps.
      user_agent: navigator.userAgent.slice(0, 200),
    },
    { onConflict: "endpoint" }
  );

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Re-register after the browser rotates a subscription behind our back.
 *
 * The service worker cannot reach the database, so it posts a message and this
 * does the write. Without it the old endpoint starts answering 410 and the
 * device stops receiving anything, silently.
 */
export function watchForSubscriptionChange(): () => void {
  if (!pushSupported()) return () => undefined;

  const onMessage = (event: MessageEvent) => {
    if (event.data?.type !== "push-subscription-changed") return;
    void enablePush();
  };

  navigator.serviceWorker.addEventListener("message", onMessage);
  return () => navigator.serviceWorker.removeEventListener("message", onMessage);
}
