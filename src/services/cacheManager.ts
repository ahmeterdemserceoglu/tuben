interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export class CacheManager {
  private static store = new Map<string, CacheEntry<any>>();
  private static maxEntries = 150;

  /**
   * Sets value in cache with specified TTL in milliseconds
   */
  static set<T>(key: string, data: T, ttlMs: number = 300000): void {
    if (this.store.size >= this.maxEntries) {
      // Evict oldest entry (LRU)
      const firstKey = this.store.keys().next().value;
      if (firstKey) {
        this.store.delete(firstKey);
      }
    }

    this.store.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
    });
  }

  /**
   * Gets cached value if present and not expired
   */
  static get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Clears single key
   */
  static remove(key: string): void {
    this.store.delete(key);
  }

  /**
   * Clears all in-memory caches
   */
  static clear(): void {
    this.store.clear();
  }
}
