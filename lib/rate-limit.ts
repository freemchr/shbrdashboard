/**
 * Simple in-memory rate limiter.
 * Per-instance on Vercel serverless — provides meaningful protection
 * against repeated attempts within the same function warm window.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Check rate limit for a given key.
 * @param key      Identifier (e.g. IP address)
 * @param limit    Max requests allowed per window
 * @param windowMs Window duration in milliseconds
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  let entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs };
    store.set(key, entry);
  }

  entry.count++;
  const allowed = entry.count <= limit;
  const remaining = Math.max(0, limit - entry.count);

  // Prune old entries every ~1000 checks to prevent unbounded memory growth
  if (store.size > 1000) {
    store.forEach((v, k) => {
      if (now > v.resetAt) store.delete(k);
    });
  }

  return { allowed, remaining, resetAt: entry.resetAt };
}
