const DEFAULT_WINDOW_MS = 10 * 60 * 1_000;
const DEFAULT_MAX_REQUESTS = 10;
const DEFAULT_MAX_CONCURRENT = 2;

type Entry = {
  windowStartedAt: number;
  requests: number;
  inFlight: number;
};

export type RateLimitResult =
  | { allowed: false; retryAfterSeconds: number }
  | { allowed: true; release: () => void };

/**
 * Per-process quota protection for the single Render production instance.
 * The limits bound spend; they are not billing records and may reset on a
 * deploy. Move the same interface to shared storage before scaling to more
 * than one process.
 */
export function createSupportRateLimiter(options: {
  windowMs?: number;
  maxRequests?: number;
  maxConcurrent?: number;
  now?: () => number;
} = {}) {
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const maxRequests = options.maxRequests ?? DEFAULT_MAX_REQUESTS;
  const maxConcurrent = options.maxConcurrent ?? DEFAULT_MAX_CONCURRENT;
  const now = options.now ?? Date.now;
  const entries = new Map<string, Entry>();
  let checks = 0;

  function acquire(userId: string): RateLimitResult {
    const timestamp = now();

    // Amortized cleanup keeps abandoned user IDs from accumulating forever.
    if (++checks % 100 === 0) {
      for (const [id, entry] of entries) {
        if (entry.inFlight === 0 && timestamp - entry.windowStartedAt >= windowMs) {
          entries.delete(id);
        }
      }
    }

    let entry = entries.get(userId);
    if (!entry || timestamp - entry.windowStartedAt >= windowMs) {
      entry = { windowStartedAt: timestamp, requests: 0, inFlight: 0 };
      entries.set(userId, entry);
    }

    if (entry.inFlight >= maxConcurrent) {
      return { allowed: false, retryAfterSeconds: 1 };
    }
    if (entry.requests >= maxRequests) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((entry.windowStartedAt + windowMs - timestamp) / 1_000)),
      };
    }

    entry.requests++;
    entry.inFlight++;
    let released = false;
    return {
      allowed: true,
      release() {
        if (released) return;
        released = true;
        entry!.inFlight = Math.max(0, entry!.inFlight - 1);
      },
    };
  }

  return { acquire };
}

export const supportRateLimiter = createSupportRateLimiter();
