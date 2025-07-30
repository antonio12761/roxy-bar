"use server";

import { prisma } from "@/lib/db";

export interface ConsolidatedNotification {
  id: string;
  type: 'table_status' | 'station_status' | 'payment_request' | 'ready_items';
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  tableNumber?: string;
  orderId?: string;
  stationStatus?: {
    prepara: 'idle' | 'working' | 'ready';
    cucina: 'idle' | 'working' | 'ready';
  };
  itemsReady?: {
    station: 'prepara' | 'cucina';
    count: number;
    items: string[];
  };
  timestamp: Date;
  acknowledged: boolean;
  targetRole: string[];
}

// Consolida notifiche per tavolo
export async function consolidateTableNotifications(tableNumber: string): Promise<ConsolidatedNotification[]> {
  try {
    // Recupera tutti gli ordini attivi del tavolo
    const ordinazioni = await prisma.ordinazione.findMany({
      where: {
        tavolo: { numero: tableNumber },
        stato: { in: ['IN_PREPARAZIONE', 'PRONTO', 'CONSEGNATO'] }
      },
      include: {
        righe: {
          include: {
            prodotto: {
              select: { nome: true }
            }
          }
        },
        cameriere: {
          select: { nome: true }
        }
      }
    });

    const consolidatedNotifications: ConsolidatedNotification[] = [];

    // Analizza stato delle postazioni per il tavolo
    const preparaItems = [];
    const cucinaItems = [];
    let preparaStatus: 'idle' | 'working' | 'ready' = 'idle';
    let cucinaStatus: 'idle' | 'working' | 'ready' = 'idle';

    for (const ord of ordinazioni) {
      for (const riga of ord.righe) {
        if (riga.postazione === 'PREPARA') {
          if (riga.stato === 'IN_LAVORAZIONE') preparaStatus = 'working';
          if (riga.stato === 'PRONTO') {
            preparaStatus = 'ready';
            preparaItems.push(riga.prodotto.nome);
          }
        } else if (riga.postazione === 'CUCINA') {
          if (riga.stato === 'IN_LAVORAZIONE') cucinaStatus = 'working';
          if (riga.stato === 'PRONTO') {
            cucinaStatus = 'ready';
            cucinaItems.push(riga.prodotto.nome);
          }
        }
      }
    }

    // Crea notifica consolidata per stato tavolo
    if (preparaItems.length > 0 || cucinaItems.length > 0) {
      let message = `Tavolo ${tableNumber}: `;
      const details = [];

      if (preparaItems.length > 0) {
        details.push(`${preparaItems.length} prodotti bar pronti`);
      }
      if (cucinaItems.length > 0) {
        details.push(`${cucinaItems.length} prodotti cucina pronti`);
      }
      if (preparaStatus === 'working' && cucinaStatus === 'working') {
        details.push('entrambe postazioni in preparazione');
      } else if (preparaStatus === 'working') {
        details.push('bar in preparazione');
      } else if (cucinaStatus === 'working') {
        details.push('cucina in preparazione');
      }

      message += details.join(', ');

      consolidatedNotifications.push({
        id: `table-${tableNumber}-${Date.now()}`,
        type: 'table_status',
        title: `Aggiornamento Tavolo ${tableNumber}`,
        message,
        priority: (preparaItems.length > 0 || cucinaItems.length > 0) ? 'high' : 'medium',
        tableNumber,
        stationStatus: {
          prepara: preparaStatus,
          cucina: cucinaStatus
        },
        timestamp: new Date(),
        acknowledged: false,
        targetRole: ['CAMERIERE']
      });
    }

    return consolidatedNotifications;

  } catch (error) {
    console.error('Errore consolidamento notifiche tavolo:', error);
    return [];
  }
}

// Consolida notifiche per stazione
export async function consolidateStationNotifications(station: 'PREPARA' | 'CUCINA'): Promise<ConsolidatedNotification[]> {
  try {
    // Recupera tutti gli ordini che richiedono attenzione per la stazione
    const righeInAttesa = await prisma.rigaOrdinazione.findMany({
      where: {
        postazione: station,
        stato: { in: ['INSERITO', 'IN_LAVORAZIONE'] }
      },
      include: {
        prodotto: {
          select: { nome: true }
        },
        ordinazione: {
          include: {
            tavolo: {
              select: { numero: true }
            }
          }
        }
      },
      orderBy: {
        timestampOrdine: 'asc'
      }
    });

    const consolidatedNotifications: ConsolidatedNotification[] = [];

    if (righeInAttesa.length > 0) {
      // Raggruppa per priorità (ordini più vecchi)
      const now = new Date();
      const oldOrders = righeInAttesa.filter(riga => {
        const orderAge = now.getTime() - riga.timestampOrdine.getTime();
        return orderAge > 10 * 60 * 1000; // Più di 10 minuti
      });

      const urgentOrders = righeInAttesa.filter(riga => {
        const orderAge = now.getTime() - riga.timestampOrdine.getTime();
        return orderAge > 20 * 60 * 1000; // Più di 20 minuti
      });

      let priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium';
      let title = `${station}: ${righeInAttesa.length} ordini in coda`;
      let message = `${righeInAttesa.length} prodotti da preparare`;

      if (urgentOrders.length > 0) {
        priority = 'urgent';
        title += ` (${urgentOrders.length} urgenti!)`;
        message += `, ${urgentOrders.length} in ritardo oltre 20 minuti`;
      } else if (oldOrders.length > 0) {
        priority = 'high';
        title += ` (${oldOrders.length} prioritari)`;
        message += `, ${oldOrders.length} oltre 10 minuti`;
      }

      // Aggiungi dettagli tavoli
      const tavoli = [...new Set(righeInAttesa.map(r => r.ordinazione.tavolo?.numero).filter(Boolean))];
      if (tavoli.length > 0) {
        message += ` per tavoli: ${tavoli.join(', ')}`;
      }

      consolidatedNotifications.push({
        id: `station-${station}-${Date.now()}`,
        type: 'station_status',
        title,
        message,
        priority,
        stationStatus: {
          prepara: station === 'PREPARA' ? 'working' : 'idle',
          cucina: station === 'CUCINA' ? 'working' : 'idle'
        },
        timestamp: new Date(),
        acknowledged: false,
        targetRole: [station, 'SUPERVISORE']
      });
    }

    return consolidatedNotifications;

  } catch (error) {
    console.error('Errore consolidamento notifiche stazione:', error);
    return [];
  }
}

// Genera notifiche per cameriere
export async function generateWaiterNotifications(waiterId: string): Promise<ConsolidatedNotification[]> {
  try {
    const notifications: ConsolidatedNotification[] = [];

    // Recupera tutti i tavoli del cameriere con prodotti pronti
    const ordiniPronti = await prisma.ordinazione.findMany({
      where: {
        cameriereId: waiterId,
        stato: { in: ['PRONTO', 'CONSEGNATO'] },
        righe: {
          some: {
            stato: 'PRONTO'
          }
        }
      },
      include: {
        righe: {
          where: {
            stato: 'PRONTO'
          },
          include: {
            prodotto: {
              select: { nome: true }
            }
          }
        },
        tavolo: {
          select: { numero: true }
        }
      }
    });

    // Raggruppa per tavolo
    const tavoliConProdottiPronti = new Map();
    
    for (const ordine of ordiniPronti) {
      const tavoloKey = ordine.tavolo?.numero || 'Asporto';
      
      if (!tavoliConProdottiPronti.has(tavoloKey)) {
        tavoliConProdottiPronti.set(tavoloKey, {
          preparaItems: [],
          cucinaItems: [],
          totalItems: 0
        });
      }

      const tavoloData = tavoliConProdottiPronti.get(tavoloKey);
      
      for (const riga of ordine.righe) {
        tavoloData.totalItems++;
        if (riga.postazione === 'PREPARA') {
          tavoloData.preparaItems.push(riga.prodotto.nome);
        } else if (riga.postazione === 'CUCINA') {
          tavoloData.cucinaItems.push(riga.prodotto.nome);
        }
      }
    }

    // Crea notifiche consolidate per ogni tavolo
    for (const [tavoloNumero, data] of tavoliConProdottiPronti) {
      let message = `Tavolo ${tavoloNumero}: `;
      const details = [];

      if (data.preparaItems.length > 0) {
        details.push(`${data.preparaItems.length} prodotti bar pronti`);
      }
      if (data.cucinaItems.length > 0) {
        details.push(`${data.cucinaItems.length} prodotti cucina pronti`);
      }

      message += details.join(', ');

      notifications.push({
        id: `waiter-${waiterId}-${tavoloNumero}-${Date.now()}`,
        type: 'ready_items',
        title: `Prodotti Pronti - Tavolo ${tavoloNumero}`,
        message,
        priority: 'high',
        tableNumber: tavoloNumero,
        itemsReady: {
          station: data.preparaItems.length >= data.cucinaItems.length ? 'prepara' : 'cucina',
          count: data.totalItems,
          items: [...data.preparaItems, ...data.cucinaItems]
        },
        timestamp: new Date(),
        acknowledged: false,
        targetRole: ['CAMERIERE']
      });
    }

    return notifications;

  } catch (error) {
    console.error('Errore generazione notifiche cameriere:', error);
    return [];
  }
}

// Funzione principale per ottenere tutte le notifiche consolidate
export async function getAllConsolidatedNotifications(
  userRole: string, 
  userId?: string
): Promise<ConsolidatedNotification[]> {
  try {
    const allNotifications: ConsolidatedNotification[] = [];

    // Notifiche per camerieri
    if (userRole === 'CAMERIERE' && userId) {
      const waiterNotifications = await generateWaiterNotifications(userId);
      allNotifications.push(...waiterNotifications);
    }

    // Notifiche per postazioni
    if (userRole === 'PREPARA') {
      const preparaNotifications = await consolidateStationNotifications('PREPARA');
      allNotifications.push(...preparaNotifications);
    }

    if (userRole === 'CUCINA') {
      const cucinaNotifications = await consolidateStationNotifications('CUCINA');
      allNotifications.push(...cucinaNotifications);
    }

    // Notifiche per supervisori (tutte)
    if (['SUPERVISORE', 'MANAGER', 'ADMIN'].includes(userRole)) {
      const preparaNotifications = await consolidateStationNotifications('PREPARA');
      const cucinaNotifications = await consolidateStationNotifications('CUCINA');
      allNotifications.push(...preparaNotifications, ...cucinaNotifications);
    }

    // Ordina per priorità e timestamp
    const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
    allNotifications.sort((a, b) => {
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.timestamp.getTime() - a.timestamp.getTime();
    });

    return allNotifications;

  } catch (error) {
    console.error('Errore recupero notifiche consolidate:', error);
    return [];
  }
}