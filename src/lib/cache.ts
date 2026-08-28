// =============================================
// In-Memory Cache with TTL
// =============================================
// Lightweight caching layer for API responses and computed data.
// Prevents repeated expensive DB queries and AI calls.

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  hits: number;
}

class MemoryCache {
  private store = new Map<string, CacheEntry<any>>();
  private defaultTTL = 60_000; // 1 minute default
  private maxEntries = 500;
  private stats = { hits: 0, misses: 0, sets: 0, evictions: 0 };

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) {
      this.stats.misses++;
      return null;
    }
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.stats.misses++;
      return null;
    }
    entry.hits++;
    this.stats.hits++;
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs?: number): void {
    // Evict oldest if at capacity
    if (this.store.size >= this.maxEntries) {
      let oldestKey = "";
      let oldestTime = Infinity;
      for (const [k, v] of this.store) {
        if (v.expiresAt < oldestTime) {
          oldestTime = v.expiresAt;
          oldestKey = k;
        }
      }
      if (oldestKey) {
        this.store.delete(oldestKey);
        this.stats.evictions++;
      }
    }

    this.store.set(key, {
      value,
      expiresAt: Date.now() + (ttlMs || this.defaultTTL),
      hits: 0,
    });
    this.stats.sets++;
  }

  invalidate(pattern: string): number {
    let count = 0;
    const regex = new RegExp("^" + pattern.replace("*", ".*") + "$");
    for (const key of this.store.keys()) {
      if (regex.test(key)) {
        this.store.delete(key);
        count++;
      }
    }
    return count;
  }

  clear(): void {
    this.store.clear();
  }

  // Get-or-set: return cached value or compute, cache, and return
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    options?: { ttlMs?: number }
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) return cached;
    const value = await fetcher();
    this.set(key, value, options?.ttlMs);
    return value;
  }

  // Invalidate by prefix
  invalidatePrefix(prefix: string): number {
    let count = 0;
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
        count++;
      }
    }
    return count;
  }

  // Get metrics for admin dashboard
  getMetrics() {
    return {
      ...this.stats,
      size: this.store.size,
      hitRate:
        this.stats.hits + this.stats.misses > 0
          ? Math.round(
              (this.stats.hits / (this.stats.hits + this.stats.misses)) * 100
            )
          : 0,
      maxEntries: this.maxEntries,
    };
  }

  getStats() {
    return {
      ...this.stats,
      size: this.store.size,
      hitRate:
        this.stats.hits + this.stats.misses > 0
          ? Math.round(
              (this.stats.hits / (this.stats.hits + this.stats.misses)) * 100
            )
          : 0,
    };
  }
}

// Singleton cache instance
export const cache = new MemoryCache();

// Helper: create a user-scoped cache key
export function userCacheKey(userId: string, scope: string): string {
  return `user:${userId}:${scope}`;
}

// Helper: generic cache key builder
export function cacheKey(...parts: (string | number)[]): string {
  return parts.join(":");
}

// Cache TTLs (in milliseconds)
export const CACHE_TTL = {
  short: 30_000,      // 30 seconds — fast-changing data
  medium: 60_000,     // 1 minute — moderate change frequency
  cockpit: 90_000,    // 90 seconds — dashboard cockpit data
  long: 300_000,      // 5 minutes — slow-changing data
  veryLong: 900_000,  // 15 minutes — rarely changes
};

// Helper: cached fetch with getOrSet pattern
export async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number = CACHE_TTL.medium
): Promise<T> {
  const cached = cache.get<T>(key);
  if (cached !== null) return cached;

  const value = await fetcher();
  cache.set(key, value, ttlMs);
  return value;
}
