/**
 * 快取管理模組
 * 支援多層快取策略：記憶體 > 本地儲存 > 網路
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // 毫秒
}

class CacheManager {
  private memoryCache = new Map<string, CacheEntry<any>>();
  private readonly STORAGE_PREFIX = 'food_cache_';
  private readonly DEFAULT_TTL = 60 * 60 * 1000; // 1 小時

  /**
   * 從快取取得資料（優先順序：記憶體 > 本地儲存）
   */
  get<T>(key: string): T | null {
    // 檢查記憶體快取
    const memoryCached = this.memoryCache.get(key);
    if (memoryCached && !this.isExpired(memoryCached)) {
      return memoryCached.data as T;
    }

    // 檢查本地儲存（瀏覽器）
    if (typeof localStorage !== 'undefined') {
      try {
        const stored = localStorage.getItem(this.STORAGE_PREFIX + key);
        if (stored) {
          const entry = JSON.parse(stored) as CacheEntry<T>;
          if (!this.isExpired(entry)) {
            // 回寫到記憶體快取
            this.memoryCache.set(key, entry);
            return entry.data;
          } else {
            // 清除過期的快取
            localStorage.removeItem(this.STORAGE_PREFIX + key);
          }
        }
      } catch (error) {
        console.warn('[Cache] Error reading from localStorage:', error);
      }
    }

    return null;
  }

  /**
   * 設定快取
   */
  set<T>(key: string, data: T, ttl: number = this.DEFAULT_TTL): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
    };

    // 儲存到記憶體
    this.memoryCache.set(key, entry);

    // 儲存到本地儲存
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(this.STORAGE_PREFIX + key, JSON.stringify(entry));
      } catch (error) {
        console.warn('[Cache] Error writing to localStorage:', error);
      }
    }
  }

  /**
   * 清除快取
   */
  remove(key: string): void {
    this.memoryCache.delete(key);

    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(this.STORAGE_PREFIX + key);
      } catch (error) {
        console.warn('[Cache] Error removing from localStorage:', error);
      }
    }
  }

  /**
   * 清除所有快取
   */
  clear(): void {
    this.memoryCache.clear();

    if (typeof localStorage !== 'undefined') {
      try {
        const keys = Object.keys(localStorage);
        keys.forEach((key) => {
          if (key.startsWith(this.STORAGE_PREFIX)) {
            localStorage.removeItem(key);
          }
        });
      } catch (error) {
        console.warn('[Cache] Error clearing localStorage:', error);
      }
    }
  }

  /**
   * 檢查快取是否過期
   */
  private isExpired(entry: CacheEntry<any>): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  /**
   * 取得快取統計
   */
  getStats() {
    return {
      memorySize: this.memoryCache.size,
      storageSize:
        typeof localStorage !== 'undefined'
          ? Object.keys(localStorage).filter((k) => k.startsWith(this.STORAGE_PREFIX)).length
          : 0,
    };
  }
}

// 單例
export const cache = new CacheManager();

/**
 * 帶快取的 fetch 包裝
 */
export async function cachedFetch<T>(
  url: string,
  options?: {
    ttl?: number;
    forceRefresh?: boolean;
  }
): Promise<T> {
  const { ttl = 60 * 60 * 1000, forceRefresh = false } = options || {};

  // 檢查快取
  if (!forceRefresh) {
    const cached = cache.get<T>(url);
    if (cached) {
      return cached;
    }
  }

  // 從網路取得
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = (await response.json()) as T;

    // 儲存到快取
    cache.set(url, data, ttl);

    return data;
  } catch (error) {
    // 如果網路失敗，嘗試使用過期的快取
    const stale = cache.get<T>(url);
    if (stale) {
      console.warn('[Cache] Using stale cache due to network error:', error);
      return stale;
    }

    throw error;
  }
}

/**
 * API 快取鑰匙生成
 */
export function generateCacheKey(...parts: string[]): string {
  return parts.join(':');
}

/**
 * 快取裝飾器
 */
export function withCache<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  getCacheKey: (...args: Parameters<T>) => string,
  ttl?: number
): T {
  return (async (...args: Parameters<T>) => {
    const key = getCacheKey(...args);
    const cached = cache.get(key);

    if (cached) {
      return cached;
    }

    const result = await fn(...args);
    cache.set(key, result, ttl);
    return result;
  }) as T;
}
