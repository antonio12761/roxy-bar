"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-multi-tenant";
import { Role, StatoOrdinazione, StatoRigaOrdinazione } from "@prisma/client";

// Tipi per gli eventi real-time
export interface RealTimeEvent {
  id: string;
  type: "order:new" | "order:update" | "order:ready" | "order:delivered" | "notification" | "data:update";
  timestamp: Date;
  data: any;
  read: boolean;
}

// Cache in memoria per gli eventi (in produzione useresti Redis)
const eventCache = new Map<string, RealTimeEvent[]>();
const MAX_EVENTS_PER_USER = 100;
const EVENT_TTL = 5 * 60 * 1000; // 5 minuti

// Funzione per pulire eventi vecchi
function cleanupOldEvents(userId: string) {
  const events = eventCache.get(userId) || [];
  const now = Date.now();
  const filteredEvents = events.filter(e => 
    now - e.timestamp.getTime() < EVENT_TTL
  ).slice(-MAX_EVENTS_PER_USER);
  eventCache.set(userId, filteredEvents);
}

// Aggiunge un evento per un utente
export async function addEventForUser(userId: string, event: Omit<RealTimeEvent, "id" | "read">) {
  const newEvent: RealTimeEvent = {
    ...event,
    id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    read: false
  };
  
  const events = eventCache.get(userId) || [];
  events.push(newEvent);
  eventCache.set(userId, events);
  
  cleanupOldEvents(userId);
}

// Aggiunge evento per tutti gli utenti di un tenant con un ruolo specifico
export async function broadcastEventToRole(tenantId: string, roles: Role[], event: Omit<RealTimeEvent, "id" | "read">) {
  const users = await prisma.user.findMany({
    where: {
      tenantId,
      ruolo: { in: roles },
      attivo: true
    },
    select: { id: true }
  });
  
  for (const user of users) {
    await addEventForUser(user.id, event);
  }
}

// Server action per ottenere eventi non letti
export async function getUnreadEvents(lastEventId?: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Non autenticato" };
  
  const events = eventCache.get(user.id) || [];
  
  // Se c'è un lastEventId, ritorna solo eventi successivi
  if (lastEventId) {
    const lastIndex = events.findIndex(e => e.id === lastEventId);
    if (lastIndex >= 0) {
      return {
        success: true,
        events: events.slice(lastIndex + 1),
        hasMore: false
      };
    }
  }
  
  // Altrimenti ritorna tutti gli eventi non letti
  const unreadEvents = events.filter(e => !e.read);
  
  // Marca come letti
  events.forEach(e => e.read = true);
  
  return {
    success: true,
    events: unreadEvents,
    hasMore: false
  };
}

// Server action per ottenere lo stato real-time degli ordini
export async function getRealTimeOrdersState(stationType: "CAMERIERE" | "PREPARA" | "CASSA") {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Non autenticato" };
  
  // Query ottimizzata in base al tipo di stazione
  let whereClause: any = {
    Tenant: { id: user.tenantId }
  };
  
  switch (stationType) {
    case "PREPARA":
      // Ordini da preparare
      whereClause.stato = {
        in: ["ORDINATO", "IN_PREPARAZIONE"]
      };
      break;
      
    case "CAMERIERE":
      // Ordini pronti da consegnare o ordini attivi del cameriere
      whereClause.OR = [
        { stato: "PRONTO" },
        { 
          utente: { id: user.id },
          stato: { in: ["ORDINATO", "IN_PREPARAZIONE"] }
        }
      ];
      break;
      
    case "CASSA":
      // Ordini da pagare
      whereClause.stato = {
        in: ["CONSEGNATO", "RICHIESTA_PAGAMENTO"]
      };
      break;
  }
  
  const orders = await prisma.ordinazione.findMany({
    where: whereClause,
    include: {
      RigaOrdinazione: {
        include: {
          Prodotto: true
        }
      },
      Tavolo: true,
      User: {
        select: {
          nome: true,
          cognome: true
        }
      }
    },
    orderBy: {
      createdAt: "asc"
    }
  });
  
  // Serializza i dati decimal
  const serializedOrders = orders.map(order => ({
    ...order,
    totale: order.totale.toString ? order.totale.toString() : order.totale
  }));
  
  // Aggiungi informazioni sullo stato delle righe per PREPARA
  if (stationType === "PREPARA") {
    const ordersWithProgress = serializedOrders.map(order => {
      const totalItems = order.RigaOrdinazione.length;
      const readyItems = order.RigaOrdinazione.filter(
        (r: any) => r.stato === StatoRigaOrdinazione.PRONTO
      ).length;
      
      return {
        ...order,
        progress: {
          total: totalItems,
          ready: readyItems,
          percentage: totalItems > 0 ? Math.round((readyItems / totalItems) * 100) : 0
        }
      };
    });
    
    return {
      success: true,
      orders: ordersWithProgress,
      timestamp: new Date()
    };
  }
  
  return {
    success: true,
    orders: serializedOrders,
    timestamp: new Date()
  };
}

// Server action per conteggi real-time
export async function getRealTimeCounts() {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Non autenticato" };
  
  const [
    ordersToProcess,
    ordersReady,
    ordersToPay,
    activeTables
  ] = await Promise.all([
    // Ordini da processare (per PREPARA)
    prisma.ordinazione.count({
      where: {
        stato: { in: ["ORDINATO", "IN_PREPARAZIONE"] }
      }
    }),
    
    // Ordini pronti (per CAMERIERE)
    prisma.ordinazione.count({
      where: {
        stato: "PRONTO"
      }
    }),
    
    // Ordini da pagare (per CASSA)
    prisma.ordinazione.count({
      where: {
        stato: { in: ["CONSEGNATO", "RICHIESTA_CONTO"] }
      }
    }),
    
    // Tavoli attivi
    prisma.tavolo.count({
      where: {
        stato: "OCCUPATO"
      }
    })
  ]);
  
  return {
    success: true,
    counts: {
      ordersToProcess,
      ordersReady,
      ordersToPay,
      activeTables
    },
    timestamp: new Date()
  };
}

// Server action per notifiche real-time
export async function getRealTimeNotifications(limit = 10) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Non autenticato" };
  
  // Recupera eventi di tipo notifica
  const events = eventCache.get(user.id) || [];
  const notifications = events
    .filter(e => e.type === "notification")
    .slice(-limit)
    .reverse();
  
  return {
    success: true,
    notifications,
    timestamp: new Date()
  };
}

// Helper per emettere eventi quando un ordine cambia
export async function emitOrderEvent(
  orderId: string, 
  eventType: "new" | "update" | "ready" | "delivered",
  additionalData?: any
) {
  const order = await prisma.ordinazione.findUnique({
    where: { id: orderId },
    include: {
      Tavolo: true,
      RigaOrdinazione: {
        include: { Prodotto: true }
      }
    }
  });
  
  if (!order) return;
  
  const event: Omit<RealTimeEvent, "id" | "read"> = {
    type: `order:${eventType}`,
    timestamp: new Date(),
    data: {
      orderId: order.id,
      tableNumber: order.Tavolo?.numero,
      status: order.stato,
      items: order.RigaOrdinazione.map(r => ({
        id: r.id,
        productName: r.Prodotto.nome,
        quantity: r.quantita,
        status: r.stato
      })),
      ...additionalData
    }
  };
  
  // Determina a chi inviare l'evento
  let targetRoles: Role[] = [];
  
  switch (eventType) {
    case "new":
      targetRoles = [Role.PREPARA, Role.SUPERVISORE];
      break;
    case "ready":
      targetRoles = [Role.CAMERIERE, Role.SUPERVISORE];
      break;
    case "delivered":
      targetRoles = [Role.CASSA, Role.SUPERVISORE];
      break;
    default:
      targetRoles = [Role.PREPARA, Role.CAMERIERE, Role.CASSA, Role.SUPERVISORE];
  }
  
  // Get the tenant ID from the order's cameriere relation
  const orderWithTenant = await prisma.ordinazione.findUnique({
    where: { id: orderId },
    include: { User: { select: { tenantId: true } } }
  });
  
  if (orderWithTenant?.User?.tenantId) {
    await broadcastEventToRole(orderWithTenant.User.tenantId, targetRoles, event);
  }
}

// Server action per marcare eventi come letti
export async function markEventsAsRead(eventIds: string[]) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Non autenticato" };
  
  const events = eventCache.get(user.id) || [];
  events.forEach(e => {
    if (eventIds.includes(e.id)) {
      e.read = true;
    }
  });
  
  return { success: true };
}

// Server action per stato connessione simulato
export async function getConnectionStatus() {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Non autenticato" };
  
  return {
    success: true,
    status: {
      connected: true,
      quality: "excellent" as const,
      latency: Math.floor(Math.random() * 50) + 10,
      lastSync: new Date()
    }
  };
}