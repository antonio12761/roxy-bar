import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { serializeDecimalData } from '@/lib/utils/decimal-serializer';

interface OrderItem {
  id: string;
  prodotto: {
    nome: string;
  };
  quantita: number;
  prezzo: number;
  isPagato: boolean;
  pagatoDa?: string;
}

interface Order {
  id: string;
  numero: number;
  tavolo?: {
    numero: string;
  } | null;
  cameriere: {
    nome: string;
  };
  righe: OrderItem[];
  totale: number;
  totalePagato: number;
  rimanente: number;
  nomeCliente?: string | null;
  note?: string | null;
  stato: string;
  statoPagamento: string;
  dataApertura: string;
}

interface TableGroup {
  tavoloNumero: string;
  ordinazioni: Order[];
  totaleComplessivo: number;
  totalePagatoComplessivo: number;
  rimanenteComplessivo: number;
  numeroClienti: number;
  clientiNomi: string[];
  primaDaApertura: string;
}

interface CassaState {
  tableGroupsRitirate: TableGroup[];
  tableGroupsDaPagare: TableGroup[];
  tableGroupsPagate: TableGroup[];
  debiti: any[];
  clientiConDebiti: any[];
}

// Cache con invalidazione basata su eventi SSE
class DataCache {
  private cache = new Map<string, { data: any; timestamp: number; version: number }>();
  private version = 0;
  private TTL = 60000; // 60 secondi (aumentato perché ora abbiamo invalidazione event-based)
  private eventBasedInvalidation = true;

  set(key: string, data: any) {
    this.cache.set(key, { 
      data, 
      timestamp: Date.now(),
      version: this.version 
    });
  }

  get(key: string) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    // Se la cache è basata su eventi, usa TTL più lungo
    const ttl = this.eventBasedInvalidation ? this.TTL : 30000;
    
    if (Date.now() - entry.timestamp > ttl) {
      this.cache.delete(key);
      return null;
    }
    
    // Invalida se la versione è cambiata (evento SSE ricevuto)
    if (entry.version !== this.version) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  invalidate(key?: string) {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }
  
  // Incrementa versione per invalidare cache su eventi SSE
  invalidateOnEvent() {
    this.version++;
  }
  
  // Metodo per switchare tra TTL fisso e event-based
  setEventBasedMode(enabled: boolean) {
    this.eventBasedInvalidation = enabled;
    if (enabled) {
      this.TTL = 60000; // TTL più lungo con eventi
    } else {
      this.TTL = 30000; // TTL standard senza eventi
    }
  }
}

export function useCassaState() {
  const [state, setState] = useState<CassaState>({
    tableGroupsRitirate: [],
    tableGroupsDaPagare: [],
    tableGroupsPagate: [],
    debiti: [],
    clientiConDebiti: []
  });

  const cache = useRef(new DataCache());
  const lastStateHash = useRef<string>('');

  // Helper per creare hash dello stato per confronto
  const createStateHash = useCallback((data: any) => {
    return JSON.stringify({
      ritirate: data.ritirate?.map((o: any) => ({ id: o.id, stato: o.stato, statoPagamento: o.statoPagamento })),
      daPagare: data.daPagare?.map((o: any) => ({ id: o.id, stato: o.stato, statoPagamento: o.statoPagamento })),
      pagate: data.pagate?.map((o: any) => ({ id: o.id, stato: o.stato, statoPagamento: o.statoPagamento }))
    });
  }, []);

  // Funzione ottimizzata per raggruppare ordini per tavolo
  const groupOrdersByTable = useCallback((orders: any[]): TableGroup[] => {
    const tableGroupsMap = new Map<string, TableGroup>();
    
    orders.forEach((order: any) => {
      const tableNumber = order.tavolo?.numero || 'Asporto';
      
      if (!tableGroupsMap.has(tableNumber)) {
        tableGroupsMap.set(tableNumber, {
          tavoloNumero: tableNumber,
          ordinazioni: [],
          totaleComplessivo: 0,
          totalePagatoComplessivo: 0,
          rimanenteComplessivo: 0,
          numeroClienti: 0,
          clientiNomi: [],
          primaDaApertura: order.dataApertura
        });
      }
      
      const group = tableGroupsMap.get(tableNumber)!;
      
      group.ordinazioni.push({
        id: order.id,
        numero: order.numero,
        tavolo: order.tavolo,
        cameriere: order.cameriere,
        righe: order.righe,
        totale: order.totale,
        totalePagato: order.totalePagamenti || 0,
        rimanente: order.rimanente,
        nomeCliente: order.nomeCliente,
        note: order.note,
        stato: order.stato,
        statoPagamento: order.statoPagamento,
        dataApertura: order.dataApertura
      });
      
      group.totaleComplessivo += order.totale;
      group.totalePagatoComplessivo += order.totalePagamenti || 0;
      group.rimanenteComplessivo += order.rimanente;
      
      if (order.nomeCliente) {
        group.clientiNomi.push(order.nomeCliente);
        group.numeroClienti += 1;
      } else {
        group.numeroClienti += 1;
      }
      
      if (new Date(order.dataApertura) < new Date(group.primaDaApertura)) {
        group.primaDaApertura = order.dataApertura;
      }
    });
    
    return Array.from(tableGroupsMap.values());
  }, []);

  // Aggiornamento incrementale ottimizzato
  const updateState = useCallback((data: any, forceUpdate = false) => {
    const serializedData = serializeDecimalData(data);
    const newHash = createStateHash(serializedData);
    
    // Skip aggiornamento se i dati non sono cambiati
    if (!forceUpdate && newHash === lastStateHash.current) {
      return false;
    }
    
    lastStateHash.current = newHash;
    
    setState(prevState => {
      // Usa dati pre-aggregati dal server se disponibili
      const newRitirate = serializedData.tavoliRitirate || groupOrdersByTable(serializedData.ritirate || []);
      const newDaPagare = serializedData.tavoliDaPagare || groupOrdersByTable(serializedData.daPagare || []);
      const newPagate = serializedData.tavoliPagate || groupOrdersByTable(serializedData.pagate || []);
      
      // Confronta e aggiorna solo se cambiato
      const ritirateChanged = JSON.stringify(prevState.tableGroupsRitirate) !== JSON.stringify(newRitirate);
      const daPagareChanged = JSON.stringify(prevState.tableGroupsDaPagare) !== JSON.stringify(newDaPagare);
      const pagateChanged = JSON.stringify(prevState.tableGroupsPagate) !== JSON.stringify(newPagate);
      
      if (!ritirateChanged && !daPagareChanged && !pagateChanged && !forceUpdate) {
        return prevState;
      }
      
      return {
        tableGroupsRitirate: ritirateChanged ? newRitirate : prevState.tableGroupsRitirate,
        tableGroupsDaPagare: daPagareChanged ? newDaPagare : prevState.tableGroupsDaPagare,
        tableGroupsPagate: pagateChanged ? newPagate : prevState.tableGroupsPagate,
        debiti: serializedData.debiti || prevState.debiti,
        clientiConDebiti: prevState.clientiConDebiti
      };
    });
    
    return true;
  }, [groupOrdersByTable, createStateHash]);

  // Aggiornamento incrementale per singolo ordine
  const updateSingleOrder = useCallback((orderId: string, updates: Partial<Order>) => {
    setState(prevState => {
      const updateOrderInGroups = (groups: TableGroup[]) => {
        return groups.map(group => ({
          ...group,
          ordinazioni: group.ordinazioni.map(order =>
            order.id === orderId ? { ...order, ...updates } : order
          )
        }));
      };
      
      return {
        ...prevState,
        tableGroupsRitirate: updateOrderInGroups(prevState.tableGroupsRitirate),
        tableGroupsDaPagare: updateOrderInGroups(prevState.tableGroupsDaPagare),
        tableGroupsPagate: updateOrderInGroups(prevState.tableGroupsPagate)
      };
    });
  }, []);

  // Sposta ordine tra stati senza ricaricare tutto
  const moveOrderBetweenStates = useCallback((orderId: string, fromState: keyof CassaState, toState: keyof CassaState) => {
    setState(prevState => {
      let orderToMove: Order | null = null;
      let sourceGroup: TableGroup | null = null;
      
      // Trova l'ordine da spostare
      const findAndRemoveOrder = (groups: TableGroup[]) => {
        return groups.map(group => {
          const orderIndex = group.ordinazioni.findIndex(o => o.id === orderId);
          if (orderIndex !== -1) {
            orderToMove = group.ordinazioni[orderIndex];
            sourceGroup = group;
            const newOrdinazioni = [...group.ordinazioni];
            newOrdinazioni.splice(orderIndex, 1);
            
            // Ricalcola totali
            const totaleComplessivo = newOrdinazioni.reduce((sum, o) => sum + o.totale, 0);
            const totalePagatoComplessivo = newOrdinazioni.reduce((sum, o) => sum + o.totalePagato, 0);
            const rimanenteComplessivo = newOrdinazioni.reduce((sum, o) => sum + o.rimanente, 0);
            
            return {
              ...group,
              ordinazioni: newOrdinazioni,
              totaleComplessivo,
              totalePagatoComplessivo,
              rimanenteComplessivo,
              numeroClienti: newOrdinazioni.length
            };
          }
          return group;
        }).filter(group => group.ordinazioni.length > 0); // Rimuovi gruppi vuoti
      };
      
      // Aggiungi ordine al nuovo stato
      const addOrderToGroups = (groups: TableGroup[], order: Order) => {
        const tableNumber = order.tavolo?.numero || 'Asporto';
        const existingGroupIndex = groups.findIndex(g => g.tavoloNumero === tableNumber);
        
        if (existingGroupIndex !== -1) {
          const newGroups = [...groups];
          const group = { ...newGroups[existingGroupIndex] };
          group.ordinazioni = [...group.ordinazioni, order];
          group.totaleComplessivo += order.totale;
          group.totalePagatoComplessivo += order.totalePagato;
          group.rimanenteComplessivo += order.rimanente;
          group.numeroClienti += 1;
          newGroups[existingGroupIndex] = group;
          return newGroups;
        } else {
          // Crea nuovo gruppo
          return [...groups, {
            tavoloNumero: tableNumber,
            ordinazioni: [order],
            totaleComplessivo: order.totale,
            totalePagatoComplessivo: order.totalePagato,
            rimanenteComplessivo: order.rimanente,
            numeroClienti: 1,
            clientiNomi: order.nomeCliente ? [order.nomeCliente] : [],
            primaDaApertura: order.dataApertura
          }];
        }
      };
      
      // Esegui lo spostamento
      let newState = { ...prevState };
      
      // Rimuovi da stato origine
      if (fromState === 'tableGroupsRitirate') {
        newState.tableGroupsRitirate = findAndRemoveOrder(prevState.tableGroupsRitirate);
      } else if (fromState === 'tableGroupsDaPagare') {
        newState.tableGroupsDaPagare = findAndRemoveOrder(prevState.tableGroupsDaPagare);
      } else if (fromState === 'tableGroupsPagate') {
        newState.tableGroupsPagate = findAndRemoveOrder(prevState.tableGroupsPagate);
      }
      
      // Aggiungi a stato destinazione
      if (orderToMove) {
        if (toState === 'tableGroupsRitirate') {
          newState.tableGroupsRitirate = addOrderToGroups(newState.tableGroupsRitirate, orderToMove);
        } else if (toState === 'tableGroupsDaPagare') {
          newState.tableGroupsDaPagare = addOrderToGroups(newState.tableGroupsDaPagare, orderToMove);
        } else if (toState === 'tableGroupsPagate') {
          newState.tableGroupsPagate = addOrderToGroups(newState.tableGroupsPagate, orderToMove);
        }
      }
      
      return newState;
    });
  }, []);

  // Funzioni per gestione debiti
  const updateDebiti = useCallback((debiti: any[]) => {
    setState(prev => ({ ...prev, debiti }));
  }, []);

  const updateClientiConDebiti = useCallback((clienti: any[]) => {
    setState(prev => ({ ...prev, clientiConDebiti: clienti }));
  }, []);

  // Invalida cache
  const invalidateCache = useCallback((eventBased = false) => {
    if (eventBased) {
      // Invalidazione basata su evento SSE - incrementa versione
      cache.current.invalidateOnEvent();
    } else {
      // Invalidazione completa
      cache.current.invalidate();
      lastStateHash.current = '';
    }
  }, []);
  
  // Metodo specifico per invalidare cache su eventi SSE
  const invalidateCacheOnSSE = useCallback(() => {
    cache.current.invalidateOnEvent();
  }, []);
  
  // Abilita modalità event-based per la cache
  useEffect(() => {
    cache.current.setEventBasedMode(true);
  }, []);

  return {
    ...state,
    updateState,
    updateSingleOrder,
    moveOrderBetweenStates,
    updateDebiti,
    updateClientiConDebiti,
    invalidateCache,
    invalidateCacheOnSSE,
    cache: cache.current
  };
}