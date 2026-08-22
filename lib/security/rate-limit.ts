/**
 * In-memory token-bucket rate limiter.
 *
 * Scope note: this is correct and sufficient for a single-instance deployment
 * (which is what FinMate's zero-cost hosting path — one Vercel/Node instance
 * + local or free-tier Postgres — actually is). It does NOT share state across
 * multiple app instances; if FinMate is ever horizontally scaled to more than
 * one instance, this must be swapped for a shared store (Redis) keyed the
 * same way. That migration path is intentionally isolated to this one file —
 * callers only interact with `checkRateLimit()`, never the storage directly.
 */

interface Bucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, Bucket>();

const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
let lastCleanup = Date.now();

function cleanupIfNeeded(now: number) {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, bucket] of buckets.entries()) {
    if (now - bucket.lastRefill > CLEANUP_INTERVAL_MS) {
      buckets.delete(key);
    }
  }
}

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function checkRateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  cleanupIfNeeded(now);

  const refillRatePerMs = options.limit / options.windowMs;
  const existing = buckets.get(key);

  if (!existing) {
    buckets.set(key, { tokens: options.limit - 1, lastRefill: now });
    return { allowed: true, remaining: options.limit - 1, retryAfterSeconds: 0 };
  }

  const elapsed = now - existing.lastRefill;
  const refilled = Math.min(options.limit, existing.tokens + elapsed * refillRatePerMs);

  if (refilled < 1) {
    const msUntilNextToken = (1 - refilled) / refillRatePerMs;
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil(msUntilNextToken / 1000),
    };
  }

  buckets.set(key, { tokens: refilled - 1, lastRefill: now });
  return { allowed: true, remaining: Math.floor(refilled - 1), retryAfterSeconds: 0 };
}

export function getClientKey(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]!.trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}
