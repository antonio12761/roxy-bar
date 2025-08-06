import { useRef, useCallback } from 'react';

interface EventEntry {
  timestamp: number;
  processed: boolean;
}

export function useSSEDeduplication(windowMs = 3000) {
  const eventMap = useRef<Map<string, EventEntry>>(new Map());
  const cleanupTimer = useRef<NodeJS.Timeout | undefined>(undefined);

  // Cleanup vecchi eventi ogni minuto per prevenire memory leaks
  const startCleanup = useCallback(() => {
    if (cleanupTimer.current) {
      clearTimeout(cleanupTimer.current);
    }

    cleanupTimer.current = setInterval(() => {
      const now = Date.now();
      const keysToDelete: string[] = [];

      eventMap.current.forEach((entry, key) => {
        if (now - entry.timestamp > windowMs * 2) {
          keysToDelete.push(key);
        }
      });

      keysToDelete.forEach(key => eventMap.current.delete(key));
    }, 60000); // Cleanup ogni minuto
  }, [windowMs]);

  // Stop cleanup on unmount
  const stopCleanup = useCallback(() => {
    if (cleanupTimer.current) {
      clearInterval(cleanupTimer.current);
      cleanupTimer.current = undefined;
    }
  }, []);

  // Check se evento è duplicato
  const isDuplicate = useCallback((eventKey: string): boolean => {
    const now = Date.now();
    const entry = eventMap.current.get(eventKey);

    if (entry && now - entry.timestamp < windowMs) {
      return true; // È un duplicato
    }

    // Registra nuovo evento
    eventMap.current.set(eventKey, {
      timestamp: now,
      processed: true
    });

    // Avvia cleanup se non attivo
    if (!cleanupTimer.current) {
      startCleanup();
    }

    return false;
  }, [windowMs, startCleanup]);

  // Crea chiave univoca per evento
  const createEventKey = useCallback((eventType: string, data: any): string => {
    const orderId = data.orderId || data.id || '';
    const timestamp = data.timestamp || '';
    const status = data.newStatus || data.stato || '';
    
    return `${eventType}-${orderId}-${status}-${timestamp}`;
  }, []);

  // Wrapper per gestire eventi con deduplicazione
  const handleEvent = useCallback(<T extends Function>(
    handler: T,
    eventType: string
  ): ((data: any) => void) => {
    return (data: any) => {
      const eventKey = createEventKey(eventType, data);
      
      if (!isDuplicate(eventKey)) {
        handler(data);
      }
    };
  }, [createEventKey, isDuplicate]);

  // Reset della mappa eventi
  const reset = useCallback(() => {
    eventMap.current.clear();
    stopCleanup();
  }, [stopCleanup]);

  return {
    isDuplicate,
    createEventKey,
    handleEvent,
    reset,
    stopCleanup
  };
}