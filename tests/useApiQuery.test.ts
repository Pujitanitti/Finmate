import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useApiQuery, invalidateApiQuery, clearApiQueryCache } from "@/lib/hooks/use-api-query";

describe("useApiQuery", () => {
  beforeEach(() => {
    clearApiQueryCache();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches data on mount", async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ value: 42 }),
    });

    const { result } = renderHook(() => useApiQuery<{ value: number }>("/api/test-1"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual({ value: 42 });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("deduplicates concurrent requests to the same URL", async () => {
    let resolveCount = 0;
    (global.fetch as any).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCount++;
          setTimeout(
            () => resolve({ ok: true, json: async () => ({ value: resolveCount }) }),
            10,
          );
        }),
    );

    // Two components requesting the same URL "simultaneously" should share
    // one network request, not fire two.
    const hookA = renderHook(() => useApiQuery<{ value: number }>("/api/test-dedup"));
    const hookB = renderHook(() => useApiQuery<{ value: number }>("/api/test-dedup"));

    await waitFor(() => expect(hookA.result.current.loading).toBe(false));
    await waitFor(() => expect(hookB.result.current.loading).toBe(false));

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(hookA.result.current.data).toEqual(hookB.result.current.data);
  });

  it("serves cached data on a subsequent mount without a new network request", async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ value: 1 }),
    });

    const first = renderHook(() => useApiQuery<{ value: number }>("/api/test-cache"));
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    first.unmount();

    expect(global.fetch).toHaveBeenCalledTimes(1);

    // A second component mounting for the same URL within the TTL should
    // read from cache instantly, with loading already false and no new
    // fetch call.
    const second = renderHook(() => useApiQuery<{ value: number }>("/api/test-cache"));
    expect(second.result.current.data).toEqual({ value: 1 });
    expect(second.result.current.loading).toBe(false);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("invalidateApiQuery forces the next read to re-fetch", async () => {
    let callCount = 0;
    (global.fetch as any).mockImplementation(async () => {
      callCount++;
      return { ok: true, json: async () => ({ value: callCount }) };
    });

    const first = renderHook(() => useApiQuery<{ value: number }>("/api/test-invalidate"));
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(first.result.current.data).toEqual({ value: 1 });
    first.unmount();

    invalidateApiQuery("/api/test-invalidate");

    const second = renderHook(() => useApiQuery<{ value: number }>("/api/test-invalidate"));
    await waitFor(() => expect(second.result.current.loading).toBe(false));
    expect(second.result.current.data).toEqual({ value: 2 });
    expect(callCount).toBe(2);
  });

  it("discards a stale response when the url changes before an in-flight request resolves", async () => {
    // Simulates CashFlowChart's range selector clicked quickly: 7d fetch
    // starts, then before it resolves the user clicks 30d. The 7d request
    // is deliberately slower — if it resolved after 30d's, a buggy
    // implementation would let it overwrite 30d's already-displayed data.
    (global.fetch as any).mockImplementation((url: string) => {
      const delay = url.includes("slow-url-a") ? 50 : 5;
      return new Promise((resolve) =>
        setTimeout(
          () => resolve({ ok: true, json: async () => ({ value: url }) }),
          delay,
        ),
      );
    });

    const { result, rerender } = renderHook(
      ({ url }) => useApiQuery<{ value: string }>(url),
      { initialProps: { url: "/api/slow-url-a" } },
    );

    // Switch to the second URL before the first (slower) request resolves.
    rerender({ url: "/api/fast-url-b" });

    await waitFor(() => expect(result.current.loading).toBe(false));
    // Give the slower, stale request time to resolve too, in case the bug
    // were present and it overwrote state after the fact.
    await new Promise((r) => setTimeout(r, 80));

    expect(result.current.data).toEqual({ value: "/api/fast-url-b" });
  });
});
