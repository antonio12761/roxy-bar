"use server";

import { prisma } from "@/lib/db";

export interface OrderPriority {
  orderId: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  ageMinutes: number;
  station: 'PREPARA' | 'CUCINA';
  highlightClass: string;
  warningMessage?: string;
}

export interface PriorityThresholds {
  normal: number;     // 0-10 minuti
  high: number;       // 10-20 minuti  
  urgent: number;     // oltre 20 minuti
}

// Soglie di priorità configurabili per stazione
const PRIORITY_THRESHOLDS: Record<string, PriorityThresholds> = {
  PREPARA: {
    normal: 10,   // Bar: più veloce
    high: 15,
    urgent: 25
  },
  CUCINA: {
    normal: 15,   // Cucina: tempi più lunghi
    high: 25,
    urgent: 35
  }
};

// Calcola la priorità di un ordine basandosi sull'età
export function calculateOrderPriority(
  orderAge: number, 
  station: 'PREPARA' | 'CUCINA'
): OrderPriority['priority'] {
  const thresholds = PRIORITY_THRESHOLDS[station];
  
  if (orderAge >= thresholds.urgent) return 'urgent';
  if (orderAge >= thresholds.high) return 'high';
  if (orderAge >= thresholds.normal) return 'normal';
  return 'low';
}

// Ottieni classi CSS per evidenziazione
export function getPriorityHighlightClass(priority: OrderPriority['priority']): string {
  switch (priority) {
    case 'urgent': 
      return 'border-red-500 bg-red-50 shadow-lg ring-2 ring-red-200 animate-pulse';
    case 'high': 
      return 'border-orange-500 bg-orange-50 shadow-md ring-1 ring-orange-200';
    case 'normal': 
      return 'border-yellow-500 bg-yellow-50';
    default: 
      return 'border-gray-300 bg-white';
  }
}

// Genera messaggio di warning
export function getPriorityWarningMessage(
  priority: OrderPriority['priority'], 
  ageMinutes: number,
  station: string
): string | undefined {
  switch (priority) {
    case 'urgent':
      return `⚠️ URGENTE: In attesa da ${ageMinutes} minuti in ${station}`;
    case 'high':
      return `⚡ PRIORITARIO: In attesa da ${ageMinutes} minuti`;
    case 'normal':
      return ageMinutes >= 15 ? `⏰ Attenzione: ${ageMinutes} minuti` : undefined;
    default:
      return undefined;
  }
}

// Analizza priorità di tutti gli ordini per una stazione
export async function analyzePrioritiesForStation(station: 'PREPARA' | 'CUCINA'): Promise<OrderPriority[]> {
  try {
    const ordiniInPreparazione = await prisma.rigaOrdinazione.findMany({
      where: {
        postazione: station,
        stato: { in: ['INSERITO', 'IN_LAVORAZIONE'] }
      },
      include: {
        Ordinazione: {
          include: {
            Tavolo: {
              select: { numero: true }
            }
          }
        },
        Prodotto: {
          select: { nome: true }
        }
      },
      orderBy: {
        timestampOrdine: 'asc' // Più vecchi prima
      }
    });

    const now = new Date();
    const priorities: OrderPriority[] = [];

    for (const riga of ordiniInPreparazione) {
      const ageMilliseconds = now.getTime() - riga.timestampOrdine.getTime();
      const ageMinutes = Math.floor(ageMilliseconds / (1000 * 60));
      
      const priority = calculateOrderPriority(ageMinutes, station);
      const highlightClass = getPriorityHighlightClass(priority);
      const warningMessage = getPriorityWarningMessage(priority, ageMinutes, station);

      priorities.push({
        orderId: riga.ordinazioneId,
        priority,
        ageMinutes,
        station,
        highlightClass,
        warningMessage
      });
    }

    return priorities;

  } catch (error) {
    console.error('Errore analisi priorità stazione:', error);
    return [];
  }
}

// Ottieni statistiche priorità per dashboard
export async function getPriorityStats(station?: 'PREPARA' | 'CUCINA') {
  try {
    const whereClause = station ? { postazione: station } : {};
    
    const righeInPreparazione = await prisma.rigaOrdinazione.findMany({
      where: {
        ...whereClause,
        stato: { in: ['INSERITO', 'IN_LAVORAZIONE'] }
      },
      select: {
        timestampOrdine: true,
        postazione: true,
        ordinazioneId: true
      }
    });

    const now = new Date();
    const stats = {
      total: righeInPreparazione.length,
      urgent: 0,
      high: 0,
      normal: 0,
      low: 0,
      avgWaitTime: 0,
      maxWaitTime: 0,
      stationBreakdown: {} as Record<string, number>
    };

    let totalWaitTime = 0;

    for (const riga of righeInPreparazione) {
      const ageMinutes = Math.floor((now.getTime() - riga.timestampOrdine.getTime()) / (1000 * 60));
      // Mappa BANCO a PREPARA per il calcolo priorità
      const station = riga.postazione === 'BANCO' ? 'PREPARA' : riga.postazione;
      const priority = calculateOrderPriority(ageMinutes, station as 'PREPARA' | 'CUCINA');
      
      stats[priority]++;
      totalWaitTime += ageMinutes;
      
      if (ageMinutes > stats.maxWaitTime) {
        stats.maxWaitTime = ageMinutes;
      }

      // Breakdown per stazione
      if (!stats.stationBreakdown[riga.postazione]) {
        stats.stationBreakdown[riga.postazione] = 0;
      }
      stats.stationBreakdown[riga.postazione]++;
    }

    stats.avgWaitTime = stats.total > 0 ? Math.round(totalWaitTime / stats.total) : 0;

    return {
      success: true,
      stats
    };

  } catch (error) {
    console.error('Errore statistiche priorità:', error);
    return {
      success: false,
      error: 'Errore recupero statistiche'
    };
  }
}

// Ottieni ordini con priorità alta/urgente per notifiche
export async function getHighPriorityOrders(): Promise<{
  urgent: Array<{ orderId: string; tableNumber: string; ageMinutes: number; station: string }>;
  high: Array<{ orderId: string; tableNumber: string; ageMinutes: number; station: string }>;
}> {
  try {
    const righeInPreparazione = await prisma.rigaOrdinazione.findMany({
      where: {
        stato: { in: ['INSERITO', 'IN_LAVORAZIONE'] }
      },
      include: {
        Ordinazione: {
          include: {
            Tavolo: {
              select: { numero: true }
            }
          }
        }
      }
    });

    const now = new Date();
    const urgent = [];
    const high = [];

    for (const riga of righeInPreparazione) {
      const ageMinutes = Math.floor((now.getTime() - riga.timestampOrdine.getTime()) / (1000 * 60));
      // Mappa BANCO a PREPARA per il calcolo priorità
      const station = riga.postazione === 'BANCO' ? 'PREPARA' : riga.postazione;
      const priority = calculateOrderPriority(ageMinutes, station as 'PREPARA' | 'CUCINA');
      
      const orderInfo = {
        orderId: riga.ordinazioneId,
        tableNumber: riga.Ordinazione.Tavolo?.numero || 'Asporto',
        ageMinutes,
        station: riga.postazione
      };

      if (priority === 'urgent') {
        urgent.push(orderInfo);
      } else if (priority === 'high') {
        high.push(orderInfo);
      }
    }

    return { urgent, high };

  } catch (error) {
    console.error('Errore recupero ordini prioritari:', error);
    return { urgent: [], high: [] };
  }
}

// Aggiorna soglie di priorità (per configurazione dinamica)
export async function updatePriorityThresholds(
  station: 'PREPARA' | 'CUCINA',
  thresholds: PriorityThresholds
) {
  try {
    // In un sistema reale, queste soglie potrebbero essere salvate nel database
    PRIORITY_THRESHOLDS[station] = thresholds;
    
    console.log(`Soglie priorità aggiornate per ${station}:`, thresholds);
    
    return {
      success: true,
      message: `Soglie priorità ${station} aggiornate`
    };

  } catch (error) {
    console.error('Errore aggiornamento soglie:', error);
    return {
      success: false,
      error: 'Errore aggiornamento configurazione'
    };
  }
}