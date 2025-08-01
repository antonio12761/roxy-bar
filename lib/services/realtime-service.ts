import { prisma } from "@/lib/db";
import { Role, StatoOrdinazione, StatoRigaOrdinazione } from "@prisma/client";

// Tipi per eventi real-time
export interface RealtimeEvent {
  id: string;
  type: "order:new" | "order:update" | "order:ready" | "order:delivered" | "order:merged" | "notification";
  timestamp: Date;
  data: any;
  tenantId: string;
  targetRoles?: Role[];
  processed: Set<string>; // IDs utenti che hanno già processato l'evento
}

// Store degli eventi in memoria - In produzione usare Redis
class EventStore {
  private static instance: EventStore;
  private events = new Map<string, RealtimeEvent[]>(); // tenantId -> events
  private eventsByUser = new Map<string, Set<string>>(); // userId -> eventIds
  private readonly MAX_EVENTS_PER_TENANT = 1000;
  private readonly EVENT_TTL = 10 * 60 * 1000; // 10 minuti
  private cleanupInterval: NodeJS.Timeout;

  private constructor() {
    // Pulizia periodica eventi vecchi
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000); // Ogni minuto
  }

  static getInstance(): EventStore {
    if (!EventStore.instance) {
      EventStore.instance = new EventStore();
    }
    return EventStore.instance;
  }

  // Aggiunge un evento
  addEvent(event: Omit<RealtimeEvent, "id" | "processed">): string {
    const eventId = `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fullEvent: RealtimeEvent = {
      ...event,
      id: eventId,
      processed: new Set()
    };

    // Aggiungi all'elenco tenant
    const tenantEvents = this.events.get(event.tenantId) || [];
    tenantEvents.push(fullEvent);
    
    // Mantieni solo gli ultimi N eventi
    if (tenantEvents.length > this.MAX_EVENTS_PER_TENANT) {
      tenantEvents.shift();
    }
    
    this.events.set(event.tenantId, tenantEvents);

    return eventId;
  }

  // Ottiene eventi non processati per un utente
  getUnprocessedEvents(userId: string, tenantId: string, userRole: Role, lastEventId?: string): RealtimeEvent[] {
    const tenantEvents = this.events.get(tenantId) || [];
    const now = Date.now();
    
    return tenantEvents.filter(event => {
      // Salta eventi già processati da questo utente
      if (event.processed.has(userId)) return false;
      
      // Salta eventi vecchi
      if (now - event.timestamp.getTime() > this.EVENT_TTL) return false;
      
      // Filtra per ruolo se specificato
      if (event.targetRoles && event.targetRoles.length > 0) {
        if (!event.targetRoles.includes(userRole)) return false;
      }
      
      // Se c'è un lastEventId, ritorna solo eventi successivi
      if (lastEventId) {
        const lastIndex = tenantEvents.findIndex(e => e.id === lastEventId);
        const currentIndex = tenantEvents.findIndex(e => e.id === event.id);
        if (currentIndex <= lastIndex) return false;
      }
      
      return true;
    });
  }

  // Marca eventi come processati per un utente
  markEventsAsProcessed(userId: string, eventIds: string[]): void {
    for (const [_, events] of this.events) {
      for (const event of events) {
        if (eventIds.includes(event.id)) {
          event.processed.add(userId);
        }
      }
    }
  }

  // Pulisce eventi vecchi
  private cleanup(): void {
    const now = Date.now();
    
    for (const [tenantId, events] of this.events) {
      const activeEvents = events.filter(event => 
        now - event.timestamp.getTime() < this.EVENT_TTL
      );
      
      if (activeEvents.length === 0) {
        this.events.delete(tenantId);
      } else {
        this.events.set(tenantId, activeEvents);
      }
    }
  }

  // Ottiene statistiche
  getStats() {
    const stats: any = {
      totalTenants: this.events.size,
      eventsByTenant: {}
    };
    
    for (const [tenantId, events] of this.events) {
      stats.eventsByTenant[tenantId] = {
        count: events.length,
        unprocessed: events.filter(e => e.processed.size === 0).length
      };
    }
    
    return stats;
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// Singleton instance
export const eventStore = EventStore.getInstance();

// Servizio per gestire eventi real-time
export class RealtimeService {
  // Emette un evento per tutti gli utenti di un tenant con determinati ruoli
  static async emitEvent(
    tenantId: string,
    type: RealtimeEvent["type"],
    data: any,
    targetRoles?: Role[]
  ): Promise<void> {
    eventStore.addEvent({
      type,
      timestamp: new Date(),
      data,
      tenantId,
      targetRoles
    });
  }

  // Emette evento ordine nuovo
  static async emitOrderNew(orderId: string): Promise<void> {
    const order = await prisma.ordinazione.findUnique({
      where: { id: orderId },
      include: {
        Tavolo: true,
        RigaOrdinazione: {
          include: { Prodotto: true }
        },
        User: true
      }
    });

    if (!order) return;

    await this.emitEvent(
      order.User?.tenantId || '',
      "order:new",
      {
        orderId: order.id,
        tableNumber: order.Tavolo?.numero,
        customerName: order.nomeCliente,
        items: order.RigaOrdinazione.map(r => ({
          id: r.id,
          productName: r.Prodotto.nome,
          quantity: r.quantita,
          destination: r.postazione,
          status: r.stato
        })),
        totalAmount: order.totale,
        waiterName: order.User?.nome
      },
      [Role.PREPARA, Role.SUPERVISORE]
    );
  }

  // Emette evento ordine pronto
  static async emitOrderReady(orderId: string): Promise<void> {
    const order = await prisma.ordinazione.findUnique({
      where: { id: orderId },
      include: {
        Tavolo: true,
        RigaOrdinazione: {
          include: { Prodotto: true }
        },
        User: true
      }
    });

    if (!order) return;

    await this.emitEvent(
      order.User?.tenantId || '',
      "order:ready",
      {
        orderId: order.id,
        tableNumber: order.Tavolo?.numero,
        readyItems: order.RigaOrdinazione.filter(r => r.stato === StatoRigaOrdinazione.PRONTO)
          .map(r => r.Prodotto.nome)
      },
      [Role.CAMERIERE, Role.SUPERVISORE]
    );
  }

  // Emette evento ordine consegnato
  static async emitOrderDelivered(orderId: string, deliveredBy: string): Promise<void> {
    const order = await prisma.ordinazione.findUnique({
      where: { id: orderId },
      include: { Tavolo: true, User: true }
    });

    if (!order) return;

    await this.emitEvent(
      order.User?.tenantId || '',
      "order:delivered",
      {
        orderId: order.id,
        tableNumber: order.Tavolo?.numero,
        deliveredBy
      },
      [Role.CASSA, Role.SUPERVISORE]
    );
  }

  // Emette evento ordine aggiornato
  static async emitOrderUpdate(orderId: string, oldStatus: string, newStatus: string): Promise<void> {
    const order = await prisma.ordinazione.findUnique({
      where: { id: orderId },
      include: { Tavolo: true, User: true }
    });

    if (!order) return;

    await this.emitEvent(
      order.User?.tenantId || '',
      "order:update",
      {
        orderId: order.id,
        tableNumber: order.Tavolo?.numero,
        oldStatus,
        newStatus
      }
    );
  }

  // Emette evento ordine unificato
  static async emitOrderMerged(
    orderId: string, 
    newItems: any[], 
    totalAmount: number, 
    mergedBy: string
  ): Promise<void> {
    const order = await prisma.ordinazione.findUnique({
      where: { id: orderId },
      include: { Tavolo: true, User: true }
    });

    if (!order) return;

    await this.emitEvent(
      order.User?.tenantId || '',
      "order:merged",
      {
        orderId: order.id,
        tableNumber: order.Tavolo?.numero,
        newItems,
        totalAmount,
        mergedBy
      },
      [Role.PREPARA, Role.CAMERIERE, Role.SUPERVISORE]
    );
  }

  // Emette notifica generica
  static async emitNotification(
    tenantId: string,
    title: string,
    message: string,
    targetRoles?: Role[]
  ): Promise<void> {
    await this.emitEvent(
      tenantId,
      "notification",
      {
        title,
        message,
        timestamp: new Date()
      },
      targetRoles
    );
  }
}