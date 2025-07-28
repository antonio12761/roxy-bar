/**
 * Server-side intelligent filtering for work stations
 * Reduces unnecessary events and improves performance
 */

import { SSEEventName, SSEEventData } from './sse-events';

export enum StationType {
  CAMERIERE = 'CAMERIERE',
  PREPARA = 'PREPARA', 
  CUCINA = 'CUCINA',
  CASSA = 'CASSA',
  SUPERVISORE = 'SUPERVISORE'
}

export interface StationFilter {
  eventTypes: Set<SSEEventName>;
  customFilter?: (eventName: SSEEventName, data: any) => boolean;
}

/**
 * Define which events each station should receive
 */
export const STATION_FILTERS: Record<StationType, StationFilter> = {
  [StationType.CAMERIERE]: {
    eventTypes: new Set([
      'order:ready',           // Ordini pronti da ritirare
      'order:delivered',       // Conferma consegna
      'order:paid',           // Conferma pagamento
      'order:update',         // Aggiornamenti generali
      'notification:new',     // Notifiche dirette
      'system:announcement'   // Annunci sistema
    ]),
    customFilter: (eventName, data) => {
      // Solo ordini dei propri tavoli o ordini generali
      if (eventName.startsWith('order:')) {
        return !data.waiterId || data.waiterId === data.currentUserId;
      }
      return true;
    }
  },

  [StationType.PREPARA]: {
    eventTypes: new Set([
      'order:new',            // Nuovi ordini per il bar
      'order:sent',           // Ordini inviati
      'order:item:update',    // Aggiornamenti singoli item
      'order:cancelled',      // Ordini annullati
      'notification:reminder' // Promemoria
    ]),
    customFilter: (eventName, data) => {
      // Solo item destinazione BAR
      if (eventName === 'order:new' || eventName === 'order:sent') {
        return data.items?.some((item: any) => item.destination === 'BAR');
      }
      if (eventName === 'order:item:update') {
        return data.destination === 'BAR';
      }
      return true;
    }
  },

  [StationType.CUCINA]: {
    eventTypes: new Set([
      'order:new',
      'order:sent', 
      'order:item:update',
      'order:cancelled',
      'notification:reminder'
    ]),
    customFilter: (eventName, data) => {
      // Solo item destinazione CUCINA
      if (eventName === 'order:new' || eventName === 'order:sent') {
        return data.items?.some((item: any) => item.destination === 'CUCINA');
      }
      if (eventName === 'order:item:update') {
        return data.destination === 'CUCINA';
      }
      return true;
    }
  },

  [StationType.CASSA]: {
    eventTypes: new Set([
      'order:delivered',      // Ordini pronti per pagamento
      'order:ready',          // Ordini completati
      'order:paid',           // Conferme pagamento
      'notification:new',     // Notifiche dirette
      'system:announcement'   // Annunci sistema  
    ]),
    customFilter: (eventName, data) => {
      // Solo ordini che possono essere pagati
      if (eventName === 'order:delivered' || eventName === 'order:ready') {
        return data.status === 'CONSEGNATA' || data.status === 'PRONTA';
      }
      return true;
    }
  },

  [StationType.SUPERVISORE]: {
    eventTypes: new Set([
      'order:new',
      'order:update',
      'order:ready', 
      'order:delivered',
      'order:paid',
      'order:cancelled',
      'notification:new',
      'system:announcement',
      'user:activity',
      'station:status'
    ]),
    // Supervisore riceve tutto ma con priorità
    customFilter: (eventName, data) => {
      // Filtra solo eventi ad alta priorità se il sistema è sotto carico
      return data.priority !== 'low' || data.systemLoad < 0.8;
    }
  }
};

/**
 * Check if a station should receive a specific event
 */
export function shouldReceiveEvent(
  stationType: StationType,
  eventName: SSEEventName,
  eventData: any,
  userId?: string
): boolean {
  const filter = STATION_FILTERS[stationType];
  
  if (!filter.eventTypes.has(eventName)) {
    return false;
  }
  
  if (filter.customFilter) {
    return filter.customFilter(eventName, { ...eventData, currentUserId: userId });
  }
  
  return true;
}

/**
 * Get priority score for event routing
 */
export function getEventPriority(
  stationType: StationType,
  eventName: SSEEventName
): number {
  const basePriority = {
    'order:new': 10,
    'order:ready': 9,
    'order:delivered': 8,
    'notification:reminder': 7,
    'order:update': 6,
    'notification:new': 5,
    'system:announcement': 4,
    'user:activity': 2,
    'system:heartbeat': 1
  }[eventName] || 3;

  // Boost priority for relevant stations
  const stationBoost = {
    [StationType.PREPARA]: eventName.includes('new') || eventName.includes('sent') ? 2 : 0,
    [StationType.CAMERIERE]: eventName.includes('ready') || eventName.includes('delivered') ? 2 : 0,
    [StationType.CASSA]: eventName.includes('delivered') || eventName.includes('paid') ? 2 : 0,
    [StationType.SUPERVISORE]: 1 // Sempre priorità alta per supervisore
  }[stationType] || 0;

  return basePriority + stationBoost;
}