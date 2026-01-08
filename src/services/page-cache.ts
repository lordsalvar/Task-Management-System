/**
 * Page-level data cache to prevent unnecessary refetches when navigating between tabs
 */

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number // Time to live in milliseconds
}

class PageCache {
  private cache = new Map<string, CacheEntry<unknown>>()
  private defaultTTL = 5 * 60 * 1000 // 5 minutes default

  /**
   * Get cached data if it exists and is not expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined
    if (!entry) return null

    const now = Date.now()
    if (now - entry.timestamp > entry.ttl) {
      // Cache expired, remove it
      this.cache.delete(key)
      return null
    }

    return entry.data
  }

  /**
   * Set cached data with optional TTL
   */
  set<T>(key: string, data: T, ttl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
    })
  }

  /**
   * Check if data exists and is valid
   */
  has(key: string): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false

    const now = Date.now()
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return false
    }

    return true
  }

  /**
   * Clear specific cache entry
   */
  clear(key: string): void {
    this.cache.delete(key)
  }

  /**
   * Clear all cache
   */
  clearAll(): void {
    this.cache.clear()
  }

  /**
   * Clear expired entries
   */
  clearExpired(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key)
      }
    }
  }
}

// Singleton instance
export const pageCache = new PageCache()

// Cache keys
export const CACHE_KEYS = {
  DASHBOARD_STATS: 'dashboard:stats',
  TASKS_LIST: 'tasks:list',
  TASKS_CATEGORIES: 'tasks:categories',
  TASKS_STATUSES: 'tasks:statuses',
  ANALYTICS_DAY_OF_WEEK: 'analytics:dayOfWeek',
  ANALYTICS_ON_TIME: 'analytics:onTime',
  ANALYTICS_CATEGORY_TIME: 'analytics:categoryTime',
} as const
