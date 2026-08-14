import { supabase } from "@/lib/supabase";

// ============================================================
// Calling our own API as the signed-in user.
//
// getSession() hands back whatever is in storage, expired token included. The
// client refreshes on a timer, but that timer is suspended while a tab is in
// the background and does not always have run by the time somebody clicks. A
// tab left open over lunch would therefore send a dead token, the API would
// answer "Invalid or expired session", and the only cure was a reload -
// which is why restarting the dev server appeared to fix it. It was not the
// server; the reload was minting a fresh token.
//
// So: refresh before sending if the token is close to expiry, and if the
// server rejects it anyway, force one refresh and try again. Twice at most,
// because a second 401 means the session is genuinely gone and retrying is
// just a slower way to say so.
// ============================================================

/** Refresh with this much of the token's life left, in seconds. */
const REFRESH_MARGIN = 60;

/**
 * Exported for the streaming callers, which cannot use authedPost: that reads
 * the whole body before returning, so a token would not surface until the
 * model had finished writing. They repeat the same one-retry dance instead.
 */
export async function accessToken(forceRefresh = false): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session) return null;

  const expiresIn = (session.expires_at ?? 0) - Math.floor(Date.now() / 1000);
  if (!forceRefresh && expiresIn > REFRESH_MARGIN) return session.access_token;

  const { data: refreshed, error } = await supabase.auth.refreshSession();
  if (error || !refreshed.session) {
    // Expired and unrefreshable is a real signed-out state. Anything else and
    // the old token is still the best we have.
    return expiresIn > 0 ? session.access_token : null;
  }
  return refreshed.session.access_token;
}

/**
 * POST to one of our API routes as the signed-in user.
 *
 * Returns the parsed body, or `{ error }` for anything that went wrong, so
 * callers can keep treating the result as data rather than catching.
 */
export async function authedPost<T = any>(
  path: string,
  body: unknown
): Promise<T & { error?: string }> {
  const send = async (token: string) =>
    fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

  let token = await accessToken();
  if (!token) return { error: "You must be signed in." } as T & { error: string };

  let res = await send(token);

  // One retry on a rejected token, in case it went stale between the check
  // above and the request landing.
  if (res.status === 401) {
    const fresh = await accessToken(true);
    if (fresh && fresh !== token) {
      token = fresh;
      res = await send(token);
    }
  }

  let payload: any = {};
  try {
    payload = await res.json();
  } catch {
    /* non-JSON error body */
  }

  if (!res.ok) {
    return {
      ...payload,
      error:
        payload.error ||
        (res.status === 401
          ? "Your session has expired. Please sign in again."
          : `Request failed (${res.status})`),
    };
  }
  return payload;
}
