/**
 * Station-specific cache system for optimal performance
 * Each work station gets its own optimized data slice
 */

import { StationType } from '../sse/station-filters';

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  version: number;
  expires?: number;
}

export interface OrderCacheData {
  id: string;
  status: string;
  tableNumber?: number;
  items: Array<{
    id: string;
    status: string;
    destination: string;
    productName: string;
    quantity: number;
  }>;
  waiterName?: string;
  timestamp: number;
}

/**
 * Station-specific cache configurations
 */
const CACHE_CONFIGS = {
  [StationType.PREPARA]: {
    maxSize: 50,        // Max 50 ordini attivi
    ttl: 30 * 60 * 1000, // 30 minuti
    keys: ['orders:active:prepara', 'orders:queue:prepara'],
    autoCleanup: true
  },
  [StationType.CUCINA]: {
    maxSize: 50,
    ttl: 30 * 60 * 1000,
    keys: ['orders:active:cucina', 'orders:queue:cucina'],
    autoCleanup: true
  },
  [StationType.BANCO]: {
    maxSize: 50,
    ttl: 30 * 60 * 1000,
    keys: ['orders:active:banco', 'orders:queue:banco'],
    autoCleanup: true
  },
  [StationType.CAMERIERE]: {
    maxSize: 100,       // Più ordini per cameriere
    ttl: 2 * 60 * 60 * 1000, // 2 ore
    keys: ['orders:my-tables', 'orders:ready', 'notifications'],
    autoCleanup: false  // Keep longer history
  },
  [StationType.CASSA]: {
    maxSize: 200,       // Storia pagamenti più lunga
    ttl: 4 * 60 * 60 * 1000, // 4 ore
    keys: ['orders:deliverable', 'payments:history'],
    autoCleanup: false
  },
  [StationType.SUPERVISORE]: {
    maxSize: 500,       // Vista completa
    ttl: 8 * 60 * 60 * 1000, // 8 ore
    keys: ['orders:all', 'stats:realtime', 'activities'],
    autoCleanup: true
  }
};

export class StationCache {
  private cache = new Map<string, CacheEntry<any>>();
  private stationType: StationType;
  private config: typeof CACHE_CONFIGS[StationType];
  private cleanupInterval?: NodeJS.Timeout;

  constructor(stationType: StationType) {
    this.stationType = stationType;
    this.config = CACHE_CONFIGS[stationType];
    
    if (this.config.autoCleanup) {
      this.startCleanupTimer();
    }
  }

  /**
   * Get data from cache with automatic expiry check
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    // Check expiry
    if (entry.expires && Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }
    
    // Check TTL
    if (Date.now() - entry.timestamp > this.config.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  /**
   * Set data in cache with version control
   */
  set<T>(key: string, data: T, version?: number, customTTL?: number): void {
    const now = Date.now();
    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      version: version || now,
      expires: customTTL ? now + customTTL : undefined
    };
    
    this.cache.set(key, entry);
    this.enforceSize();
  }

  /**
   * Update existing cache entry only if version is newer
   */
  updateIfNewer<T>(key: string, data: T, version: number): boolean {
    const existing = this.cache.get(key);
    
    if (!existing || version > existing.version) {
      this.set(key, data, version);
      return true;
    }
    
    return false;
  }

  /**
   * Merge partial updates into existing cache
   */
  mergeUpdate<T extends Record<string, any>>(
    key: string, 
    updates: Partial<T>, 
    version: number
  ): boolean {
    const existing = this.get<T>(key);
    
    if (!existing) {
      return false;
    }
    
    const merged = { ...existing, ...updates };
    return this.updateIfNewer(key, merged, version);
  }

  /**
   * Get cache statistics for monitoring
   */
  getStats() {
    const now = Date.now();
    let expired = 0;
    let fresh = 0;
    
    for (const [, entry] of this.cache) {
      if ((entry.expires && now > entry.expires) || 
          (now - entry.timestamp > this.config.ttl)) {
        expired++;
      } else {
        fresh++;
      }
    }
    
    return {
      total: this.cache.size,
      fresh,
      expired,
      maxSize: this.config.maxSize,
      hitRate: this.getHitRate()
    };
  }

  /**
   * Clear cache for specific patterns
   */
  clear(pattern?: string): void {
    if (!pattern) {
      this.cache.clear();
      return;
    }
    
    const regex = new RegExp(pattern);
    for (const [key] of this.cache) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Enforce cache size limits
   */
  private enforceSize(): void {
    if (this.cache.size <= this.config.maxSize) {
      return;
    }
    
    // Remove oldest entries first
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    const toRemove = this.cache.size - this.config.maxSize;
    for (let i = 0; i < toRemove; i++) {
      this.cache.delete(entries[i][0]);
    }
  }

  /**
   * Start automatic cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Remove expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    
    for (const [key, entry] of this.cache) {
      if ((entry.expires && now > entry.expires) || 
          (now - entry.timestamp > this.config.ttl)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Calculate cache hit rate for monitoring
   */
  private hits = 0;
  private misses = 0;
  
  private recordHit(): void { this.hits++; }
  private recordMiss(): void { this.misses++; }
  
  private getHitRate(): number {
    const total = this.hits + this.misses;
    return total > 0 ? this.hits / total : 0;
  }

  /**
   * Destroy cache and cleanup
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cache.clear();
  }
}

/**
 * Station cache factory
 */
const cacheInstances = new Map<StationType, StationCache>();

export function getStationCache(stationType: StationType): StationCache {
  if (!cacheInstances.has(stationType)) {
    cacheInstances.set(stationType, new StationCache(stationType));
  }
  return cacheInstances.get(stationType)!;
}