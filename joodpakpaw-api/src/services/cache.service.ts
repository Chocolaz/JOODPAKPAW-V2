/**
 * Cache Service (In-Memory Cache-Aside)
 * High-performance, zero-external-dependency, thread-safe cache
 * with per-key TTL and automatic background cleanup using unref() timers.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number | null;
}

export class CacheService {
  private cache = new Map<string, CacheEntry<any>>();
  private cleanupTimer: NodeJS.Timeout | null = null;
  private readonly defaultTtlSeconds: number;

  constructor(defaultTtlSeconds: number = 60, cleanupIntervalMs: number = 30000) {
    this.defaultTtlSeconds = defaultTtlSeconds;

    // Background cleanup of expired entries
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpired();
    }, cleanupIntervalMs);

    // unref() ensures the timer does not keep Node.js process alive during CLI/tests
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Retrieves a cached item by key. Returns null if expired or missing.
   */
  public async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      this.cache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  /**
   * Sets a key-value pair in cache with an optional TTL in seconds.
   */
  public async set<T>(
    key: string,
    value: T,
    ttlSeconds?: number
  ): Promise<void> {
    const ttl = ttlSeconds !== undefined ? ttlSeconds : this.defaultTtlSeconds;
    const expiresAt = ttl > 0 ? Date.now() + ttl * 1000 : null;

    this.cache.set(key, {
      value,
      expiresAt,
    });
  }

  /**
   * Deletes a specific key from the cache.
   */
  public async del(key: string): Promise<void> {
    this.cache.delete(key);
  }

  /**
   * Deletes all keys matching the specified prefix.
   * Returns the count of deleted keys.
   */
  public async delByPrefix(prefix: string): Promise<number> {
    let deletedCount = 0;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        deletedCount++;
      }
    }
    return deletedCount;
  }

  /**
   * Clears all entries from the cache.
   */
  public async flush(): Promise<void> {
    this.cache.clear();
  }

  /**
   * Periodically purges expired entries from memory.
   */
  private cleanupExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt !== null && entry.expiresAt <= now) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Destroys the cleanup timer (useful for clean shutdown or unit test cleanup).
   */
  public destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.cache.clear();
  }
}

export const cacheService = new CacheService();
