import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { checkRateLimit } from "@/lib/security/rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests up to the limit within the window", () => {
    const key = `test-${Math.random()}`;
    const options = { limit: 3, windowMs: 60_000 };

    expect(checkRateLimit(key, options).allowed).toBe(true);
    expect(checkRateLimit(key, options).allowed).toBe(true);
    expect(checkRateLimit(key, options).allowed).toBe(true);
  });

  it("blocks requests once the limit is exceeded within the window", () => {
    const key = `test-${Math.random()}`;
    const options = { limit: 2, windowMs: 60_000 };

    expect(checkRateLimit(key, options).allowed).toBe(true);
    expect(checkRateLimit(key, options).allowed).toBe(true);
    const third = checkRateLimit(key, options);
    expect(third.allowed).toBe(false);
    expect(third.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("refills tokens gradually over time rather than resetting all at once", () => {
    const key = `test-${Math.random()}`;
    const options = { limit: 2, windowMs: 60_000 };

    checkRateLimit(key, options);
    checkRateLimit(key, options);
    expect(checkRateLimit(key, options).allowed).toBe(false);

    // Half the window has passed — enough for roughly 1 token to refill.
    vi.advanceTimersByTime(30_000);
    expect(checkRateLimit(key, options).allowed).toBe(true);
  });

  it("tracks separate buckets independently by key", () => {
    const options = { limit: 1, windowMs: 60_000 };
    const keyA = `test-a-${Math.random()}`;
    const keyB = `test-b-${Math.random()}`;

    expect(checkRateLimit(keyA, options).allowed).toBe(true);
    expect(checkRateLimit(keyA, options).allowed).toBe(false);
    // A different key (e.g. a different client IP) is unaffected by keyA's usage.
    expect(checkRateLimit(keyB, options).allowed).toBe(true);
  });
});
