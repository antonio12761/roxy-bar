/**
 * Service per sincronizzazione incrementale degli ordini
 * Riduce carico database e migliora responsiveness UI
 */

import { prisma } from "@/lib/db";
import { ordersCache } from "@/lib/cache/orders-cache";
import { sseService } from "@/lib/sse/sse-service";
import { serializeDecimalData } from "@/lib/utils/decimal-serializer";

interface SyncOptions {
  forceFullSync?: boolean;
  includeStatistics?: boolean;
  targetRoles?: string[];
}

interface SyncResult {
  newOrders: number;
  updatedOrders: number;
  deletedOrders: number;
  fromCache: boolean;
  executionTime: number;
}

class OrdersSyncService {
  private static instance: OrdersSyncService;
  private lastSyncTimestamp: Date = new Date(0);
  private syncInProgress = false;
  private syncQueue: Set<string> = new Set(); // Ordini da sincronizzare
  
  private readonly BATCH_SIZE = 50;
  private readonly SYNC_INTERVAL = 2000; // 2 seconds
  private readonly FULL_SYNC_INTERVAL = 300000; // 5 minutes

  private constructor() {
    // Auto-sync periodico
    setInterval(() => this.autoSync(), this.SYNC_INTERVAL);
    setInterval(() => this.forceFullSync(), this.FULL_SYNC_INTERVAL);
  }

  static getInstance(): OrdersSyncService {
    if (!OrdersSyncService.instance) {
      OrdersSyncService.instance = new OrdersSyncService();
    }
    return OrdersSyncService.instance;
  }

  /**
   * Sincronizzazione intelligente degli ordini
   * Usa cache quando possibile, query incrementali quando necessario
   */
  async syncOrders(options: SyncOptions = {}): Promise<SyncResult> {
    const startTime = Date.now();
    
    if (this.syncInProgress) {
      console.log('[OrdersSync] Sync already in progress, skipping');
      return {
        newOrders: 0,
        updatedOrders: 0,
        deletedOrders: 0,
        fromCache: true,
        executionTime: Date.now() - startTime
      };
    }

    this.syncInProgress = true;
    
    try {
      // Se cache è valida e non è richiesto full sync, usa cache
      if (!options.forceFullSync && !ordersCache.needsFullRefresh() && this.syncQueue.size === 0) {
        const cachedOrders = ordersCache.getActiveOrders();
        if (cachedOrders.length > 0) {
          console.log(`[OrdersSync] Using cache (${cachedOrders.length} orders)`);
          return {
            newOrders: 0,
            updatedOrders: 0,
            deletedOrders: 0,
            fromCache: true,
            executionTime: Date.now() - startTime
          };
        }
      }

      // Sync incrementale o completo
      const result = options.forceFullSync || ordersCache.needsFullRefresh()
        ? await this.performFullSync()
        : await this.performIncrementalSync();

      // Emetti eventi SSE per aggiornamenti significativi
      if (result.newOrders > 0 || result.updatedOrders > 0) {
        this.emitSyncEvents(result, options.targetRoles);
      }

      return {
        ...result,
        fromCache: false,
        executionTime: Date.now() - startTime
      };

    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Sync specifico per singolo ordine
   */
  async syncOrder(orderId: string): Promise<boolean> {
    try {
      const order = await prisma.ordinazione.findUnique({
        where: { id: orderId },
        include: {
          tavolo: true,
          cameriere: { select: { nome: true } },
          righe: {
            include: { prodotto: true }
          }
        }
      });

      if (!order) {
        // Ordine eliminato, rimuovi dalla cache
        ordersCache.remove(orderId);
        return true;
      }

      // Serializza e aggiorna cache
      const serializedOrder = serializeDecimalData(order);
      ordersCache.set(orderId, serializedOrder);

      // Emetti evento per questo ordine specifico
      sseService.emit('order:sync:single', {
        orderId: orderId,
        order: serializedOrder,
        timestamp: new Date().toISOString()
      });

      return true;
    } catch (error) {
      console.error(`[OrdersSync] Error syncing order ${orderId}:`, error);
      return false;
    }
  }

  /**
   * Aggiorna stato item con sync immediato
   */
  async updateItemStatus(orderId: string, itemId: string, newStatus: string): Promise<boolean> {
    // Optimistic update in cache
    const updated = ordersCache.updateItemStatus(orderId, itemId, newStatus);
    
    if (updated) {
      // Emetti evento immediato per UI
      sseService.emit('order:item:status-updated', {
        orderId,
        itemId,
        status: newStatus,
        timestamp: new Date().toISOString()
      });

      // Aggiungi a queue per sync database
      this.syncQueue.add(orderId);
      
      return true;
    }

    return false;
  }

  /**
   * Queue ordine per sync successivo
   */
  queueOrderSync(orderId: string): void {
    this.syncQueue.add(orderId);
  }

  /**
   * Forza full sync
   */
  async forceFullSync(): Promise<SyncResult> {
    console.log('[OrdersSync] Performing forced full sync');
    return this.syncOrders({ forceFullSync: true });
  }

  /**
   * Ottieni ordini con fallback cache
   */
  async getOrders(): Promise<any[]> {
    const syncResult = await this.syncOrders();
    
    if (syncResult.fromCache) {
      return ordersCache.getActiveOrders();
    }

    // Se sync ha aggiornato dati, ritorna dalla cache aggiornata
    return ordersCache.getActiveOrders();
  }

  /**
   * Statistiche sync service
   */
  getStats() {
    return {
      cache: ordersCache.getStats(),
      lastSync: this.lastSyncTimestamp.toISOString(),
      syncInProgress: this.syncInProgress,
      queueSize: this.syncQueue.size
    };
  }

  private async performFullSync(): Promise<Omit<SyncResult, 'fromCache' | 'executionTime'>> {
    console.log('[OrdersSync] Performing full sync');
    
    const orders = await prisma.ordinazione.findMany({
      where: {
        stato: {
          in: ["APERTA", "INVIATA", "IN_PREPARAZIONE", "PRONTA"]
        }
      },
      include: {
        tavolo: true,
        cameriere: { select: { nome: true } },
        righe: {
          include: { prodotto: true }
        }
      },
      orderBy: { dataApertura: 'desc' }
    });

    // Invalida cache e ricarica
    ordersCache.invalidate();
    
    let newOrders = 0;
    for (const order of orders) {
      const serializedOrder = serializeDecimalData(order);
      ordersCache.set(order.id, serializedOrder);
      newOrders++;
    }

    ordersCache.markFullRefresh();
    this.lastSyncTimestamp = new Date();

    return {
      newOrders,
      updatedOrders: 0,
      deletedOrders: 0
    };
  }

  private async performIncrementalSync(): Promise<Omit<SyncResult, 'fromCache' | 'executionTime'>> {
    console.log('[OrdersSync] Performing incremental sync');
    
    let newOrders = 0;
    let updatedOrders = 0;
    let deletedOrders = 0;

    // Sync ordini in coda
    if (this.syncQueue.size > 0) {
      const orderIds = Array.from(this.syncQueue).slice(0, this.BATCH_SIZE);
      
      for (const orderId of orderIds) {
        const synced = await this.syncOrder(orderId);
        if (synced) {
          updatedOrders++;
          this.syncQueue.delete(orderId);
        }
      }
    }

    // Cerca nuovi ordini dall'ultimo sync
    const newOrdersFromDb = await prisma.ordinazione.findMany({
      where: {
        stato: {
          in: ["APERTA", "INVIATA", "IN_PREPARAZIONE", "PRONTA"]
        },
        createdAt: {
          gt: this.lastSyncTimestamp
        }
      },
      include: {
        tavolo: true,
        cameriere: { select: { nome: true } },
        righe: {
          include: { prodotto: true }
        }
      }
    });

    for (const order of newOrdersFromDb) {
      const serializedOrder = serializeDecimalData(order);
      ordersCache.set(order.id, serializedOrder);
      newOrders++;
    }

    this.lastSyncTimestamp = new Date();

    return {
      newOrders,
      updatedOrders,
      deletedOrders
    };
  }

  private async autoSync(): Promise<void> {
    if (this.syncQueue.size > 0) {
      await this.syncOrders();
    }
  }

  private emitSyncEvents(result: Omit<SyncResult, 'fromCache' | 'executionTime'>, targetRoles?: string[]): void {
    if (result.newOrders > 0) {
      sseService.emit('orders:sync:new', {
        count: result.newOrders,
        timestamp: new Date().toISOString()
      }, {
        channels: targetRoles ? targetRoles.map(role => `role:${role}` as any) : undefined
      });
    }

    if (result.updatedOrders > 0) {
      sseService.emit('orders:sync:updated', {
        count: result.updatedOrders,
        timestamp: new Date().toISOString()
      }, {
        channels: targetRoles ? targetRoles.map(role => `role:${role}` as any) : undefined
      });
    }
  }
}

// Export singleton
export const ordersSyncService = OrdersSyncService.getInstance();

// Hook per React
export function useOrdersSync() {
  return {
    syncOrders: (options?: SyncOptions) => ordersSyncService.syncOrders(options),
    getOrders: () => ordersSyncService.getOrders(),
    syncOrder: (orderId: string) => ordersSyncService.syncOrder(orderId),
    updateItemStatus: (orderId: string, itemId: string, status: string) => 
      ordersSyncService.updateItemStatus(orderId, itemId, status),
    queueSync: (orderId: string) => ordersSyncService.queueOrderSync(orderId),
    getStats: () => ordersSyncService.getStats()
  };
}