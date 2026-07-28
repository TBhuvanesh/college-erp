// Minimal in-process TTL memoizer (ERP Integration Sprint, Phase 6).
//
// This deployment has no Redis and is single-instance, so a shared
// cross-instance cache isn't the problem being solved here — the problem is
// that every dashboard/analytics read hits Postgres live with zero
// memoization (confirmed absent anywhere in the backend during the audit,
// docs/erp-integration-audit.md §1.9). A plain Map with a TTL is the
// correct-sized fix: no new infrastructure dependency, trivially invalidated
// by the workflow events wired in Phase 4, and gone on restart (which is
// fine — every entry is a cache of data that already lives durably in
// Postgres).

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

/**
 * Returns the cached value for `key` if it hasn't expired; otherwise calls
 * `compute()`, caches the result for `ttlMs`, and returns it. Concurrent
 * callers during a miss each invoke `compute()` (no in-flight de-duplication)
 * — acceptable here since the wrapped queries are read-only aggregations,
 * not the kind of expensive/side-effecting call that needs single-flighting.
 */
export async function withTtlCache<T>(key: string, ttlMs: number, compute: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const existing = store.get(key);
  if (existing && existing.expiresAt > now) {
    return existing.value as T;
  }
  const value = await compute();
  store.set(key, { value, expiresAt: now + ttlMs });
  return value;
}

/** Invalidates one cache key — call after a mutation that a cached read depends on. */
export function invalidateTtlCache(key: string): void {
  store.delete(key);
}

/** Invalidates every cache key starting with `prefix` — for grouped invalidation. */
export function invalidateTtlCachePrefix(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}
