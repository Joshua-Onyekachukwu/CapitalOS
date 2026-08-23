/**
 * In-Memory Cache with TTL + LRU Eviction
 *
 * Production-grade caching for API routes that run expensive DB queries.
 * Designed to reduce CockroachDB load on frequently-accessed endpoints.
 *
 * Features:
 *   - TTL-based expiration (configurable per entry)
 *   - LRU eviction when max entries reached
 *   - Cache key generation from request URL + params
 *   - Selective invalidation by prefix (e.g., invalidate all "facets" caches)
 *   - Hit/miss metrics for observability
 *   - Thread-safe (single-process, no distributed locks)
 *
 * Usage:
 *   import { cache, cacheKey } from "@/lib/cache";
 *
 *   const data = await cache.getOrSet(
 *     cacheKey(request.url),
 *     () => expensiveDbQuery(),
 *     { ttlMs: 60_000 }  // 60 seconds
 *   );
 *
 * Production swap: Replace with @upstash/redis when moving to multi-server.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  lastAccessed: number;
}

interface CacheConfig {
  ttlMs: number;       // Time-to-live in milliseconds
  maxEntries: number;   // Max entries before LRU eviction
}

interface CacheMetrics {
  hits: number;
  misses: number;
  sets: number;
  evictions: number;
  invalidations: number;
}

// ── Default Configuration ──

const DEFAULT_TTL_MS = 60_000;        // 60 seconds
const DEFAULT_MAX_ENTRIES = 500;       // Reasonable for API caches
const CLEANUP_INTERVAL_MS = 30_000;    // Run cleanup every 30s

// ── Cache Class ──

class Cache {
  private store = new Map<string, CacheEntry<any>>();
  private metrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    sets: 0,
    evictions: 0,
    invalidations: 0,
  };
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Periodic cleanup of expired entries
    if (typeof setInterval !== "undefined") {
      this.cleanupTimer = setInterval(() => this.cleanup(), CLEANUP_INTERVAL_MS);
    }
  }

  /**
   * Get a value from cache, or compute it and store it.
   * Returns cached value on hit, computed value on miss.
   */
  async getOrSet<T>(
    key: string,
    compute: () => Promise<T>,
    config?: Partial<CacheConfig>
  ): Promise<T> {
    const ttlMs = config?.ttlMs ?? DEFAULT_TTL_MS;
    const maxEntries = config?.maxEntries ?? DEFAULT_MAX_ENTRIES;

    // Check cache
    const entry = this.store.get(key);
    if (entry && Date.now() < entry.expiresAt) {
      // Cache hit — update access time for LRU
      entry.lastAccessed = Date.now();
      this.metrics.hits++;
      return entry.value as T;
    }

    // Cache miss
    this.metrics.misses++;

    // Compute value
    const value = await compute();

    // Store in cache
    this.set(key, value, { ttlMs, maxEntries });

    return value;
  }

  /**
   * Store a value in cache.
   */
  set<T>(key: string, value: T, config?: Partial<CacheConfig>): void {
    const ttlMs = config?.ttlMs ?? DEFAULT_TTL_MS;
    const maxEntries = config?.maxEntries ?? DEFAULT_MAX_ENTRIES;

    // Evict if at capacity
    if (this.store.size >= maxEntries && !this.store.has(key)) {
      this.evict(maxEntries);
    }

    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
      lastAccessed: Date.now(),
    });

    this.metrics.sets++;
  }

  /**
   * Invalidate all entries whose key starts with the given prefix.
   * Useful when data changes and cached results are stale.
   */
  invalidatePrefix(prefix: string): number {
    let count = 0;
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
        count++;
      }
    }
    this.metrics.invalidations += count;
    return count;
  }

  /**
   * Invalidate a specific key.
   */
  invalidate(key: string): boolean {
    const deleted = this.store.delete(key);
    if (deleted) this.metrics.invalidations++;
    return deleted;
  }

  /**
   * Clear the entire cache.
   */
  clear(): void {
    const size = this.store.size;
    this.store.clear();
    this.metrics.invalidations += size;
  }

  /**
   * Get cache metrics for observability.
   */
  getMetrics(): CacheMetrics & { size: number; hitRate: string } {
    const total = this.metrics.hits + this.metrics.misses;
    const hitRate = total > 0
      ? `${((this.metrics.hits / total) * 100).toFixed(1)}%`
      : "0%";
    return {
      ...this.metrics,
      size: this.store.size,
      hitRate,
    };
  }

  /**
   * Remove expired entries and enforce LRU eviction.
   */
  private cleanup(): void {
    const now = Date.now();

    // Remove expired entries
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }

  /**
   * LRU eviction: remove the least recently accessed entry.
   */
  private evict(maxEntries: number): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.store) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.store.delete(oldestKey);
      this.metrics.evictions++;
    }
  }

  /**
   * Shutdown the cleanup timer (for graceful process exit).
   */
  shutdown(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}

// ── Singleton Instance ──

export const cache = new Cache();

// ── Cache Key Generators ──

/**
 * Generate a cache key from a request URL.
 * Strips the origin and normalizes query params for consistent keys.
 */
export function cacheKey(url: string, prefix?: string): string {
  try {
    const parsed = new URL(url);
    // Sort search params for consistent keys
    const params = new URLSearchParams(parsed.searchParams);
    const sorted = new URLSearchParams([...params.entries()].sort());
    const paramStr = sorted.toString();
    return prefix
      ? `${prefix}:${parsed.pathname}:${paramStr}`
      : `${parsed.pathname}:${paramStr}`;
  } catch {
    // Fallback for malformed URLs
    return prefix ? `${prefix}:${url}` : url;
  }
}

/**
 * Generate a cache key from user ID + prefix.
 * Used for user-scoped caches like cockpit.
 */
export function userCacheKey(userId: string, prefix: string): string {
  return `${prefix}:user:${userId}`;
}

// ── Cache TTL Constants ──

export const CACHE_TTL = {
  /** Facets: 60 seconds — data changes infrequently */
  facets: 60_000,
  /** Cockpit: 30 seconds — dashboard should be fairly fresh */
  cockpit: 30_000,
  /** Search results: 15 seconds — users expect near-real-time */
  search: 15_000,
  /** Static metadata: 5 minutes — sectors, stages, etc. */
  metadata: 300_000,
  /** Campaign list: 30 seconds */
  campaigns: 30_000,
} as const;

// ── Graceful Shutdown ──

if (typeof process !== "undefined") {
  process.once("SIGTERM", () => cache.shutdown());
  process.once("SIGINT", () => cache.shutdown());
}
