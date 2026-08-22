"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A small, purpose-built data-fetching cache — the fix for the previously-
 * documented gap where every data component independently fetched on mount
 * with zero deduplication (see docs/ARCHITECTURE.md's State Management
 * section and docs/PERFORMANCE.md).
 *
 * Deliberately not TanStack Query: this app's actual need is narrow
 * (dedupe concurrent identical requests, cache briefly so navigating back to
 * an already-visited page doesn't re-fetch, and let mutations invalidate
 * specific cache entries) — a ~100-line hook covers that fully without
 * adding a new dependency whose surface area (infinite queries, mutations
 * API, devtools, SSR hydration helpers) FinMate doesn't use. If the caching
 * needs grow beyond this — background refetching, offline support, complex
 * dependent queries — TanStack Query remains the documented upgrade path
 * (see docs/ROADMAP.md item 5).
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();

const DEFAULT_TTL_MS = 30_000; // 30s — long enough to skip a refetch on a quick back-navigation, short enough that stale data isn't shown for long.

/** Removes every cache entry whose key starts with `prefix`. Call after a mutation that invalidates related reads. */
export function invalidateApiQuery(prefix: string) {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
  for (const key of inFlight.keys()) {
    if (key.startsWith(prefix)) inFlight.delete(key);
  }
}

/** Clears the entire cache — useful on logout so the next user's session never sees a previous user's cached data. */
export function clearApiQueryCache() {
  cache.clear();
  inFlight.clear();
}

/**
 * Warms the cache for `url` without any component needing to mount first —
 * used for hover-prefetching (see Sidebar) so that by the time a user
 * actually clicks a nav item, its data often already arrived while they
 * were still hovering. Safe to call repeatedly — respects the same
 * in-flight deduplication and TTL as useApiQuery itself, so hovering
 * multiple times doesn't fire duplicate requests.
 */
export function prefetchApiQuery(url: string, ttlMs: number = DEFAULT_TTL_MS): void {
  const cached = cache.get(url);
  if (cached && Date.now() - cached.timestamp < ttlMs) return; // already warm
  if (inFlight.has(url)) return; // already in flight

  const promise = fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error(`Prefetch of ${url} failed with status ${res.status}`);
      return res.json();
    })
    .then((data) => {
      cache.set(url, { data, timestamp: Date.now() });
      return data;
    })
    .catch(() => {
      // Prefetch failures are silent by design — the component will just
      // do a normal fetch on mount instead. A failed speculative request
      // should never surface as a user-facing error.
    })
    .finally(() => {
      inFlight.delete(url);
    });

  inFlight.set(url, promise);
}

interface UseApiQueryOptions {
  ttlMs?: number;
  /** If false, the query does not run (e.g., waiting on a dependency). Defaults to true. */
  enabled?: boolean;
}

interface UseApiQueryResult<T> {
  data: T | undefined;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Fetches `url` (a GET endpoint) with caching + in-flight deduplication.
 * Multiple components mounting simultaneously and requesting the same URL
 * share one network request instead of firing one each.
 */
export function useApiQuery<T = unknown>(
  url: string | null,
  options: UseApiQueryOptions = {},
): UseApiQueryResult<T> {
  const { ttlMs = DEFAULT_TTL_MS, enabled = true } = options;
  const [data, setData] = useState<T | undefined>(() => {
    if (!url) return undefined;
    const cached = cache.get(url) as CacheEntry<T> | undefined;
    if (cached && Date.now() - cached.timestamp < ttlMs) return cached.data;
    return undefined;
  });
  const [loading, setLoading] = useState(!data);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);
  // Tracks which URL the most recently *started* fetch was for. If `url`
  // changes again before an in-flight request resolves (e.g. a chart's
  // range selector clicked 7d → 30d → 3m in quick succession), the older
  // request's response is discarded on arrival instead of overwriting the
  // newer selection's data — mountedRef alone does not catch this, since
  // the component is still mounted the whole time; only the url changed.
  const latestUrlRef = useRef(url);

  const fetchData = useCallback(
    async (force = false) => {
      if (!url || !enabled) return;
      const requestUrl = url;
      latestUrlRef.current = url;

      const cached = cache.get(requestUrl) as CacheEntry<T> | undefined;
      if (!force && cached && Date.now() - cached.timestamp < ttlMs) {
        if (latestUrlRef.current === requestUrl) {
          setData(cached.data);
          setLoading(false);
        }
        return;
      }

      let promise = inFlight.get(requestUrl) as Promise<T> | undefined;
      if (!promise || force) {
        promise = fetch(requestUrl)
          .then((res) => {
            if (!res.ok) throw new Error(`Request to ${requestUrl} failed with status ${res.status}`);
            return res.json() as Promise<T>;
          })
          .finally(() => {
            inFlight.delete(requestUrl);
          });
        inFlight.set(requestUrl, promise);
      }

      if (latestUrlRef.current === requestUrl) {
        setLoading(true);
        setError(null);
      }
      try {
        const result = await promise;
        cache.set(requestUrl, { data: result, timestamp: Date.now() });
        // Only apply this response if both (a) the component is still
        // mounted, and (b) `url` hasn't changed to something else since
        // this specific request started.
        if (mountedRef.current && latestUrlRef.current === requestUrl) {
          setData(result);
        }
      } catch (err) {
        if (mountedRef.current && latestUrlRef.current === requestUrl) {
          setError(err instanceof Error ? err : new Error("Unknown error"));
        }
      } finally {
        if (mountedRef.current && latestUrlRef.current === requestUrl) {
          setLoading(false);
        }
      }
    },
    [url, enabled, ttlMs],
  );

  useEffect(() => {
    mountedRef.current = true;
    fetchData();
    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, enabled]);

  const refetch = useCallback(() => fetchData(true), [fetchData]);

  return { data, loading, error, refetch };
}
