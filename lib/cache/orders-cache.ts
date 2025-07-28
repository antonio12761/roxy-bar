/**
 * In-memory cache per ordini attivi
 * Riduce chiamate database e migliora performance terminali
 */

interface CachedOrder {
  data: any;
  lastUpdated: number;
  version: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  updates: number;
  evictions: number;
}

class OrdersCache {
  private static instance: OrdersCache;
  private cache = new Map<string, CachedOrder>();
  private ordersByState = new Map<string, Set<string>>(); // stato -> Set di order IDs
  private lastFullSync: number = 0;
  private readonly TTL = 30000; // 30 secondi
  private readonly MAX_SIZE = 1000;
  private stats: CacheStats = { hits: 0, misses: 0, updates: 0, evictions: 0 };

  private constructor() {
    // Cleanup automatico ogni minuto
    setInterval(() => this.cleanup(), 60000);
  }

  static getInstance(): OrdersCache {
    if (!OrdersCache.instance) {
      OrdersCache.instance = new OrdersCache();
    }
    return OrdersCache.instance;
  }

  /**
   * Recupera ordine dalla cache
   */
  get(orderId: string): any | null {
    const cached = this.cache.get(orderId);
    
    if (!cached) {
      this.stats.misses++;
      return null;
    }

    // Verifica TTL
    if (Date.now() - cached.lastUpdated > this.TTL) {
      this.cache.delete(orderId);
      this.removeFromStateIndex(orderId, cached.data.stato);
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return cached.data;
  }

  /**
   * Inserisce/aggiorna ordine in cache
   */
  set(orderId: string, orderData: any): void {
    const now = Date.now();
    const existing = this.cache.get(orderId);
    
    // Rimuovi dal vecchio stato se esiste
    if (existing) {
      this.removeFromStateIndex(orderId, existing.data.stato);
    }

    // Evict se cache troppo grande
    if (this.cache.size >= this.MAX_SIZE && !existing) {
      this.evictOldest();
    }

    const cached: CachedOrder = {
      data: orderData,
      lastUpdated: now,
      version: existing ? existing.version + 1 : 1
    };

    this.cache.set(orderId, cached);
    this.addToStateIndex(orderId, orderData.stato);
    this.stats.updates++;
  }

  /**
   * Aggiorna specifici campi di un ordine
   */
  updateFields(orderId: string, fields: Partial<any>): boolean {
    const cached = this.cache.get(orderId);
    if (!cached) {
      return false;
    }

    // Rimuovi dal vecchio stato se cambia
    if (fields.stato && fields.stato !== cached.data.stato) {
      this.removeFromStateIndex(orderId, cached.data.stato);
      this.addToStateIndex(orderId, fields.stato);
    }

    cached.data = { ...cached.data, ...fields };
    cached.lastUpdated = Date.now();
    cached.version++;
    
    this.stats.updates++;
    return true;
  }

  /**
   * Aggiorna stato di un item nell'ordine
   */
  updateItemStatus(orderId: string, itemId: string, newStatus: string): boolean {
    const cached = this.cache.get(orderId);
    if (!cached || !cached.data.righe) {
      return false;
    }

    const itemIndex = cached.data.righe.findIndex((item: any) => item.id === itemId);
    if (itemIndex === -1) {
      return false;
    }

    cached.data.righe[itemIndex] = {
      ...cached.data.righe[itemIndex],
      stato: newStatus,
      [`timestamp${this.getTimestampField(newStatus)}`]: new Date().toISOString()
    };

    cached.lastUpdated = Date.now();
    cached.version++;
    this.stats.updates++;
    
    return true;
  }

  /**
   * Recupera ordini per stato
   */
  getByState(stato: string): any[] {
    const orderIds = this.ordersByState.get(stato) || new Set();
    const orders: any[] = [];

    for (const orderId of orderIds) {
      const order = this.get(orderId); // Usa get() per controllo TTL
      if (order) {
        orders.push(order);
      }
    }

    return orders.sort((a, b) => new Date(a.dataApertura).getTime() - new Date(b.dataApertura).getTime());
  }

  /**
   * Recupera tutti gli ordini attivi dalla cache
   */
  getActiveOrders(): any[] {
    const activeStates = ['APERTA', 'INVIATA', 'IN_PREPARAZIONE', 'PRONTA'];
    const orders: any[] = [];

    for (const stato of activeStates) {
      orders.push(...this.getByState(stato));
    }

    return orders;
  }

  /**
   * Rimuove ordine dalla cache
   */
  remove(orderId: string): void {
    const cached = this.cache.get(orderId);
    if (cached) {
      this.removeFromStateIndex(orderId, cached.data.stato);
      this.cache.delete(orderId);
    }
  }

  /**
   * Invalida cache per full refresh
   */
  invalidate(): void {
    this.cache.clear();
    this.ordersByState.clear();
    this.lastFullSync = 0;
  }

  /**
   * Verifica se è necessario un full refresh
   */
  needsFullRefresh(): boolean {
    return Date.now() - this.lastFullSync > 300000; // 5 minuti
  }

  /**
   * Marca full refresh completato
   */
  markFullRefresh(): void {
    this.lastFullSync = Date.now();
  }

  /**
   * Statistiche cache
   */
  getStats(): CacheStats & { size: number; hitRate: number } {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      size: this.cache.size,
      hitRate: total > 0 ? this.stats.hits / total : 0
    };
  }

  private addToStateIndex(orderId: string, stato: string): void {
    if (!this.ordersByState.has(stato)) {
      this.ordersByState.set(stato, new Set());
    }
    this.ordersByState.get(stato)!.add(orderId);
  }

  private removeFromStateIndex(orderId: string, stato: string): void {
    const stateSet = this.ordersByState.get(stato);
    if (stateSet) {
      stateSet.delete(orderId);
      if (stateSet.size === 0) {
        this.ordersByState.delete(stato);
      }
    }
  }

  private evictOldest(): void {
    let oldestTime = Date.now();
    let oldestId = '';

    for (const [id, cached] of this.cache.entries()) {
      if (cached.lastUpdated < oldestTime) {
        oldestTime = cached.lastUpdated;
        oldestId = id;
      }
    }

    if (oldestId) {
      this.remove(oldestId);
      this.stats.evictions++;
    }
  }

  private cleanup(): void {
    const now = Date.now();
    const toRemove: string[] = [];

    for (const [id, cached] of this.cache.entries()) {
      if (now - cached.lastUpdated > this.TTL) {
        toRemove.push(id);
      }
    }

    for (const id of toRemove) {
      this.remove(id);
    }

    console.log(`[OrdersCache] Cleanup: removed ${toRemove.length} expired entries`);
  }

  private getTimestampField(status: string): string {
    switch (status) {
      case 'IN_LAVORAZIONE': return 'Inizio';
      case 'PRONTO': return 'Pronto';
      case 'CONSEGNATO': return 'Consegna';
      default: return '';
    }
  }
}

// Export singleton
export const ordersCache = OrdersCache.getInstance();

// Hook per React
export function useOrdersCache() {
  return {
    getOrder: (id: string) => ordersCache.get(id),
    getActiveOrders: () => ordersCache.getActiveOrders(),
    getByState: (state: string) => ordersCache.getByState(state),
    updateOrder: (id: string, data: any) => ordersCache.set(id, data),
    updateItemStatus: (orderId: string, itemId: string, status: string) => 
      ordersCache.updateItemStatus(orderId, itemId, status),
    getStats: () => ordersCache.getStats(),
    invalidate: () => ordersCache.invalidate()
  };
}