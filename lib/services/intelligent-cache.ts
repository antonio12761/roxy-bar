"use client";

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
  accessCount: number;
  lastAccessed: number;
  tags: string[];
  size: number;
  priority: 'low' | 'medium' | 'high';
}

interface CacheConfig {
  defaultTTL: number;        // Time to live default (ms)
  maxSize: number;           // Dimensione massima cache (numero di entries)
  maxMemory: number;         // Memoria massima (bytes)
  cleanupInterval: number;   // Intervallo pulizia automatica (ms)
  compressionThreshold: number; // Soglia per compressione (bytes)
}

export class IntelligentCache {
  private cache = new Map<string, CacheEntry<any>>();
  private config: CacheConfig;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    evictions: 0,
    memoryUsage: 0
  };

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      defaultTTL: 60000,        // 1 minuto
      maxSize: 1000,            // 1000 entries
      maxMemory: 50 * 1024 * 1024, // 50MB
      cleanupInterval: 30000,   // 30 secondi
      compressionThreshold: 10240, // 10KB
      ...config
    };

    this.startCleanupTimer();
  }

  // Ottieni valore dalla cache
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Controlla scadenza
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    // Aggiorna statistiche accesso
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    this.stats.hits++;

    return entry.data;
  }

  // Imposta valore in cache
  set<T>(
    key: string, 
    data: T, 
    options: {
      ttl?: number;
      tags?: string[];
      priority?: 'low' | 'medium' | 'high';
    } = {}
  ): void {
    const now = Date.now();
    const ttl = options.ttl || this.config.defaultTTL;
    const size = this.calculateSize(data);

    // Controlla se è necessario fare spazio
    this.ensureSpace(size);

    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      expiresAt: now + ttl,
      accessCount: 0,
      lastAccessed: now,
      tags: options.tags || [],
      size,
      priority: options.priority || 'medium'
    };

    this.cache.set(key, entry);
    this.stats.sets++;
    this.updateMemoryUsage();
  }

  // Imposta con invalidazione intelligente
  setWithInvalidation<T>(
    key: string,
    data: T,
    dependencies: string[] = [],
    options: Parameters<typeof this.set>[2] = {}
  ): void {
    // Invalida cache correlate
    this.invalidateByTags(dependencies);
    
    // Imposta con tag per future invalidazioni
    this.set(key, data, {
      ...options,
      tags: [...(options.tags || []), ...dependencies]
    });
  }

  // Ottieni o imposta (lazy loading)
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options: Parameters<typeof this.set>[2] = {}
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const data = await factory();
    this.set(key, data, options);
    return data;
  }

  // Ottieni con fallback e refresh in background
  async getWithRefresh<T>(
    key: string,
    factory: () => Promise<T>,
    options: Parameters<typeof this.set>[2] & { refreshThreshold?: number } = {}
  ): Promise<T> {
    const entry = this.cache.get(key);
    const refreshThreshold = options.refreshThreshold || 0.8; // Refresh al 80% della scadenza
    
    if (entry) {
      const age = Date.now() - entry.timestamp;
      const ttl = entry.expiresAt - entry.timestamp;
      
      // Se i dati sono ancora validi ma vicini alla scadenza, refresh in background
      if (age > ttl * refreshThreshold) {
        // Background refresh senza attendere
        factory().then(newData => {
          this.set(key, newData, options);
        }).catch(error => {
          console.warn(`Background refresh failed for key ${key}:`, error);
        });
      }
      
      // Ritorna i dati cached se ancora validi
      if (Date.now() < entry.expiresAt) {
        entry.accessCount++;
        entry.lastAccessed = Date.now();
        this.stats.hits++;
        return entry.data;
      }
    }

    // Cache miss o dati scaduti - fetch nuovo dato
    this.stats.misses++;
    const data = await factory();
    this.set(key, data, options);
    return data;
  }

  // Preload dati predittivo
  async preload<T>(
    key: string,
    factory: () => Promise<T>,
    options: Parameters<typeof this.set>[2] = {}
  ): Promise<void> {
    // Non preload se già in cache e non scaduto
    const existing = this.get(key);
    if (existing !== null) return;

    try {
      const data = await factory();
      this.set(key, data, {
        ...options,
        priority: 'low' // Preloaded data ha priorità bassa
      });
    } catch (error) {
      console.warn(`Preload failed for key ${key}:`, error);
    }
  }

  // Invalida per tags
  invalidateByTags(tags: string[]): number {
    let invalidated = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      const hasMatchingTag = tags.some(tag => entry.tags.includes(tag));
      if (hasMatchingTag) {
        this.cache.delete(key);
        invalidated++;
      }
    }
    
    this.updateMemoryUsage();
    return invalidated;
  }

  // Invalida pattern
  invalidateByPattern(pattern: string | RegExp): number {
    let invalidated = 0;
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        invalidated++;
      }
    }
    
    this.updateMemoryUsage();
    return invalidated;
  }

  // Assicura spazio disponibile
  private ensureSpace(newEntrySize: number): void {
    // Controlla limiti
    if (this.cache.size >= this.config.maxSize || 
        this.stats.memoryUsage + newEntrySize > this.config.maxMemory) {
      this.evictEntries();
    }
  }

  // Strategia LRU con priorità
  private evictEntries(): void {
    const entries = Array.from(this.cache.entries());
    
    // Ordina per priorità e LRU
    entries.sort((a, b) => {
      const [, entryA] = a;
      const [, entryB] = b;
      
      // Prima per priorità (low viene rimosso prima)
      const priorityOrder = { low: 0, medium: 1, high: 2 };
      const priorityDiff = priorityOrder[entryA.priority] - priorityOrder[entryB.priority];
      if (priorityDiff !== 0) return priorityDiff;
      
      // Poi per ultimo accesso (LRU)
      return entryA.lastAccessed - entryB.lastAccessed;
    });

    // Rimuovi il 25% delle entries meno importanti
    const toRemove = Math.ceil(entries.length * 0.25);
    for (let i = 0; i < toRemove; i++) {
      const [key] = entries[i];
      this.cache.delete(key);
      this.stats.evictions++;
    }
    
    this.updateMemoryUsage();
  }

  // Pulizia automatica entries scadute
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`[Cache] Pulite ${cleaned} entries scadute`);
      this.updateMemoryUsage();
    }
  }

  // Timer pulizia automatica
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  // Calcola dimensione approssimativa
  private calculateSize(data: any): number {
    return JSON.stringify(data).length * 2; // Approssimazione UTF-16
  }

  // Aggiorna statistiche memoria
  private updateMemoryUsage(): void {
    this.stats.memoryUsage = Array.from(this.cache.values())
      .reduce((sum, entry) => sum + entry.size, 0);
  }

  // Ottieni statistiche
  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0 
      ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
      : '0.00';

    return {
      ...this.stats,
      hitRate: `${hitRate}%`,
      size: this.cache.size,
      memoryUsageMB: (this.stats.memoryUsage / 1024 / 1024).toFixed(2)
    };
  }

  // Pulisci tutto
  clear(): void {
    this.cache.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      evictions: 0,
      memoryUsage: 0
    };
  }

  // Distruggi cache
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.clear();
  }
}

// Istanza globale cache
export const globalCache = new IntelligentCache({
  defaultTTL: 60000,          // 1 minuto
  maxSize: 2000,              // 2000 entries
  maxMemory: 100 * 1024 * 1024, // 100MB
  cleanupInterval: 30000      // 30 secondi
});

// Cache specifica per tavoli
export const tableCache = new IntelligentCache({
  defaultTTL: 30000,          // 30 secondi (più frequente)
  maxSize: 500,
  maxMemory: 20 * 1024 * 1024, // 20MB
  cleanupInterval: 15000      // 15 secondi
});

// Cache per ordini
export const orderCache = new IntelligentCache({
  defaultTTL: 45000,          // 45 secondi
  maxSize: 1000,
  maxMemory: 30 * 1024 * 1024, // 30MB
  cleanupInterval: 20000      // 20 secondi
});

// Utility per gestione cache intelligente
export class CacheManager {
  static async getTables(cameriereId: string) {
    return tableCache.getWithRefresh(
      `tables:${cameriereId}`,
      async () => {
        const response = await fetch(`/api/cameriere/tables?id=${cameriereId}`);
        return response.json();
      },
      {
        ttl: 30000,
        tags: ['tables', `cameriere:${cameriereId}`],
        refreshThreshold: 0.7 // Refresh al 70%
      }
    );
  }

  static async getOrders(stationId: string) {
    return orderCache.getWithRefresh(
      `orders:${stationId}`,
      async () => {
        const response = await fetch(`/api/orders?station=${stationId}`);
        return response.json();
      },
      {
        ttl: 45000,
        tags: ['orders', `station:${stationId}`],
        refreshThreshold: 0.8
      }
    );
  }

  static invalidateUserData(userId: string) {
    const invalidated = globalCache.invalidateByTags([`user:${userId}`]);
    console.log(`Invalidated ${invalidated} entries for user ${userId}`);
  }

  static invalidateTableData(tableNumber: string) {
    const invalidated = tableCache.invalidateByTags([`table:${tableNumber}`]);
    console.log(`Invalidated ${invalidated} entries for table ${tableNumber}`);
  }

  static getGlobalStats() {
    return {
      global: globalCache.getStats(),
      tables: tableCache.getStats(),
      orders: orderCache.getStats()
    };
  }
}