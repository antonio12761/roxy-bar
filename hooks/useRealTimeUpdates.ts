"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useStationSSE } from './useStationSSE';
import { StationType } from '@/lib/sse/station-filters';

export interface RealTimeUpdate {
  id: string;
  type: 'order_created' | 'order_updated' | 'order_delivered' | 'payment_completed' | 'item_ready';
  data: any;
  timestamp: Date;
  processed: boolean;
}

export interface UseRealTimeUpdatesProps {
  stationType: StationType;
  userId?: string;
  dataLoader: () => Promise<any>;
  updateHandler?: (update: RealTimeUpdate, currentData: any) => any;
  autoApplyUpdates?: boolean;
  batchDelay?: number;
}

export function useRealTimeUpdates<T>({
  stationType,
  userId = '',
  dataLoader,
  updateHandler,
  autoApplyUpdates = true,
  batchDelay = 1000
}: UseRealTimeUpdatesProps) {
  const [data, setData] = useState<T | null>(null);
  const [pendingUpdates, setPendingUpdates] = useState<RealTimeUpdate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [updateStats, setUpdateStats] = useState({
    totalUpdates: 0,
    appliedUpdates: 0,
    pendingCount: 0
  });

  const batchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dataRef = useRef<T | null>(null);

  // Mantieni riferimento aggiornato ai dati
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // Hook SSE per ricevere aggiornamenti
  const {
    connectionHealth,
    eventQueue,
    getCachedData,
    applyOptimisticUpdate,
    rollbackOptimisticUpdate,
    clearEventQueue
  } = useStationSSE({
    stationType,
    userId,
    enableCache: true,
    enableOptimisticUpdates: true,
    autoReconnect: true
  });

  // Carica dati iniziali
  const loadInitialData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Prova prima dalla cache
      const cachedData = getCachedData<T>('main_data');
      if (cachedData) {
        setData(cachedData);
        setIsLoading(false);
      }

      // Carica dati freschi
      const freshData = await dataLoader();
      setData(freshData);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Errore caricamento dati:', error);
    } finally {
      setIsLoading(false);
    }
  }, [dataLoader, getCachedData]);

  // Applica aggiornamenti in batch
  const applyPendingUpdates = useCallback(() => {
    if (pendingUpdates.length === 0 || !dataRef.current) return;

    console.log(`[RealTime] Applicazione ${pendingUpdates.length} aggiornamenti batch`);

    let updatedData = dataRef.current;

    for (const update of pendingUpdates) {
      if (updateHandler) {
        updatedData = updateHandler(update, updatedData);
      } else {
        // Handler di default per aggiornamenti comuni
        updatedData = applyDefaultUpdate(update, updatedData);
      }
    }

    setData(updatedData);
    setPendingUpdates([]);
    setLastUpdate(new Date());
    
    setUpdateStats(prev => ({
      ...prev,
      appliedUpdates: prev.appliedUpdates + pendingUpdates.length,
      pendingCount: 0
    }));

  }, [pendingUpdates, updateHandler]);

  // Handler di default per aggiornamenti
  const applyDefaultUpdate = useCallback((update: RealTimeUpdate, currentData: any) => {
    switch (update.type) {
      case 'order_updated':
        if (Array.isArray(currentData)) {
          return currentData.map((item: any) => 
            item.id === update.data.orderId ? { ...item, ...update.data } : item
          );
        }
        break;
        
      case 'order_created':
        if (Array.isArray(currentData)) {
          return [update.data, ...currentData];
        }
        break;
        
      case 'order_delivered':
        if (Array.isArray(currentData)) {
          return currentData.filter((item: any) => item.id !== update.data.orderId);
        }
        break;
        
      case 'payment_completed':
        if (Array.isArray(currentData)) {
          return currentData.map((item: any) => 
            item.id === update.data.orderId 
              ? { ...item, statoPagamento: 'COMPLETAMENTE_PAGATO', totalePagato: item.totale }
              : item
          );
        }
        break;
        
      default:
        console.log(`[RealTime] Tipo aggiornamento non gestito: ${update.type}`);
    }
    
    return currentData;
  }, []);

  // Aggiungi aggiornamento alla coda
  const queueUpdate = useCallback((update: RealTimeUpdate) => {
    setPendingUpdates(prev => {
      const newUpdates = [...prev, update];
      
      setUpdateStats(prevStats => ({
        ...prevStats,
        totalUpdates: prevStats.totalUpdates + 1,
        pendingCount: newUpdates.length
      }));

      return newUpdates;
    });

    // Batch degli aggiornamenti
    if (autoApplyUpdates) {
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
      }
      
      batchTimeoutRef.current = setTimeout(() => {
        applyPendingUpdates();
      }, batchDelay);
    }
  }, [autoApplyUpdates, batchDelay, applyPendingUpdates]);

  // Processa eventi SSE
  useEffect(() => {
    if (eventQueue.length === 0) return;

    for (const { event, data } of eventQueue) {
      const update: RealTimeUpdate = {
        id: `${event}-${Date.now()}-${Math.random()}`,
        type: event as RealTimeUpdate['type'],
        data,
        timestamp: new Date(),
        processed: false
      };

      queueUpdate(update);
    }

    clearEventQueue();
  }, [eventQueue, queueUpdate, clearEventQueue]);

  // Applica aggiornamenti manualmente
  const applyUpdatesManually = useCallback(() => {
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
    }
    applyPendingUpdates();
  }, [applyPendingUpdates]);

  // Forza ricaricamento completo
  const forceReload = useCallback(async () => {
    setPendingUpdates([]);
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
    }
    await loadInitialData();
  }, [loadInitialData]);

  // Aggiorna un elemento specifico in modo ottimistico
  const updateItemOptimistically = useCallback((itemId: string, updates: any) => {
    const updateId = applyOptimisticUpdate('item', itemId, updates, {});
    
    // Rollback automatico dopo 10 secondi se non confermato
    setTimeout(() => {
      if (updateId) rollbackOptimisticUpdate(updateId);
    }, 10000);
    
    return updateId;
  }, [applyOptimisticUpdate, rollbackOptimisticUpdate]);

  // Carica dati al mount
  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
      }
    };
  }, []);

  return {
    // Dati
    data,
    isLoading,
    lastUpdate,
    
    // Aggiornamenti
    pendingUpdates,
    updateStats,
    hasPendingUpdates: pendingUpdates.length > 0,
    
    // Azioni
    applyUpdatesManually,
    forceReload,
    updateItemOptimistically,
    
    // Connessione
    connectionHealth,
    isConnected: connectionHealth.status === 'connected',
    
    // Utilities
    refresh: loadInitialData
  };
}

// Hook semplificato per liste di ordini
export function useRealTimeOrders(stationType: StationType, userId?: string) {
  return useRealTimeUpdates({
    stationType,
    userId,
    dataLoader: async () => {
      // Qui andrà la chiamata API specifica per gli ordini
      const response = await fetch('/api/orders');
      return response.json();
    },
    autoApplyUpdates: true,
    batchDelay: 500 // Più veloce per gli ordini
  });
}

// Hook per tavoli con aggiornamenti real-time
export function useRealTimeTables(userId?: string) {
  return useRealTimeUpdates({
    stationType: StationType.CAMERIERE,
    userId,
    dataLoader: async () => {
      const response = await fetch('/api/tables');
      return response.json();
    },
    updateHandler: (update, currentTables) => {
      // Handler specifico per tavoli
      if (update.type === 'order_updated') {
        return currentTables.map((table: any) => {
          if (table.numero === update.data.tableNumber) {
            return {
              ...table,
              hasUpdates: true,
              lastUpdate: update.timestamp
            };
          }
          return table;
        });
      }
      return currentTables;
    },
    autoApplyUpdates: true,
    batchDelay: 1000
  });
}