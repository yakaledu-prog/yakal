/**
 * The newsletter list.
 *
 * Everything goes through /api/newsletter rather than Supabase directly: the
 * subscribers table grants anon nothing, because a list of email addresses is
 * the one thing here worth scraping.
 */
const BASE = "/api/newsletter";

async function post<T>(action: string, body: unknown): Promise<T & { error?: string }> {
  try {
    const res = await fetch(`${BASE}?action=${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return await res.json();
  } catch {
    return { error: "Could not reach the server." } as T & { error?: string };
  }
}

export function subscribeToNewsletter(email: string, source = "footer") {
  return post<{ ok?: boolean }>("subscribe", { email, source });
}

export function unsubscribeFromNewsletter(token: string) {
  return post<{ ok?: boolean }>("unsubscribe", { token });
}

/**
 * Send one published post to the list.
 *
 * Admin only, checked on the server. Goes through authedPost so it carries the
 * session, and inherits the token refresh: this is a button somebody presses
 * after a long edit, which is exactly when a token has expired.
 */
export async function broadcastPost(postId: string) {
  const { authedPost } = await import("@/lib/authedFetch");
  return authedPost<{ sent?: number; failed?: number }>(`${BASE}?action=broadcast`, { postId });
}
