"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { 
  getUnreadEvents, 
  getRealTimeOrdersState, 
  getRealTimeCounts,
  getRealTimeNotifications,
  getConnectionStatus,
  RealTimeEvent
} from "@/lib/actions/real-time";

interface UseRealTimeOptions {
  // Intervallo di polling in millisecondi
  pollingInterval?: number;
  // Se abilitare il polling automatico
  enabled?: boolean;
  // Callback per nuovi eventi
  onNewEvent?: (event: RealTimeEvent) => void;
}

// Hook principale per eventi real-time
export function useRealTimeEvents(options: UseRealTimeOptions = {}) {
  const {
    pollingInterval = 2000, // 2 secondi di default
    enabled = true,
    onNewEvent
  } = options;
  
  const [events, setEvents] = useState<RealTimeEvent[]>([]);
  const [isPolling, setIsPolling] = useState(false);
  const [lastEventId, setLastEventId] = useState<string | undefined>();
  const intervalRef = useRef<NodeJS.Timeout | undefined>(undefined);
  
  const pollEvents = useCallback(async () => {
    if (isPolling) return;
    
    setIsPolling(true);
    try {
      const result = await getUnreadEvents(lastEventId);
      
      if (result.success && result.events && result.events.length > 0) {
        const newEvents = result.events;
        setEvents(prev => [...prev, ...newEvents]);
        
        // Aggiorna l'ultimo ID evento
        const lastEvent = newEvents[newEvents.length - 1];
        if (lastEvent) {
          setLastEventId(lastEvent.id);
        }
        
        // Chiama callback per ogni nuovo evento
        if (onNewEvent) {
          newEvents.forEach(event => onNewEvent(event));
        }
      }
    } catch (error) {
      console.error("Errore polling eventi:", error);
    } finally {
      setIsPolling(false);
    }
  }, [lastEventId, isPolling, onNewEvent]);
  
  useEffect(() => {
    if (!enabled) return;
    
    // Polling iniziale
    pollEvents();
    
    // Setup intervallo
    intervalRef.current = setInterval(pollEvents, pollingInterval);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, pollingInterval, pollEvents]);
  
  return {
    events,
    isPolling,
    refresh: pollEvents
  };
}

// Hook per stato ordini real-time
export function useRealTimeOrders(stationType: "CAMERIERE" | "PREPARA" | "CASSA") {
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>();
  const intervalRef = useRef<NodeJS.Timeout | undefined>(undefined);
  
  const fetchOrders = useCallback(async () => {
    try {
      const result = await getRealTimeOrdersState(stationType);
      
      if (result.success && result.orders) {
        setOrders(result.orders);
        if (result.timestamp) {
          setLastUpdate(result.timestamp);
        }
      }
    } catch (error) {
      console.error("Errore caricamento ordini:", error);
    } finally {
      setIsLoading(false);
    }
  }, [stationType]);
  
  useEffect(() => {
    // Fetch iniziale
    fetchOrders();
    
    // Polling ogni 3 secondi
    intervalRef.current = setInterval(fetchOrders, 3000);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchOrders]);
  
  return {
    orders,
    isLoading,
    lastUpdate,
    refresh: fetchOrders
  };
}

// Hook per conteggi real-time
export function useRealTimeCounts() {
  const [counts, setCounts] = useState({
    ordersToProcess: 0,
    ordersReady: 0,
    ordersToPay: 0,
    activeTables: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | undefined>(undefined);
  
  const fetchCounts = useCallback(async () => {
    try {
      const result = await getRealTimeCounts();
      
      if (result.success && result.counts) {
        setCounts(result.counts);
      }
    } catch (error) {
      console.error("Errore caricamento conteggi:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  useEffect(() => {
    // Fetch iniziale
    fetchCounts();
    
    // Polling ogni 5 secondi
    intervalRef.current = setInterval(fetchCounts, 5000);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchCounts]);
  
  return {
    counts,
    isLoading,
    refresh: fetchCounts
  };
}

// Hook per notifiche real-time
export function useRealTimeNotifications(limit = 10) {
  const [notifications, setNotifications] = useState<RealTimeEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | undefined>(undefined);
  
  const fetchNotifications = useCallback(async () => {
    try {
      const result = await getRealTimeNotifications(limit);
      
      if (result.success && result.notifications) {
        setNotifications(result.notifications);
      }
    } catch (error) {
      console.error("Errore caricamento notifiche:", error);
    } finally {
      setIsLoading(false);
    }
  }, [limit]);
  
  useEffect(() => {
    // Fetch iniziale
    fetchNotifications();
    
    // Polling ogni 4 secondi
    intervalRef.current = setInterval(fetchNotifications, 4000);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchNotifications]);
  
  return {
    notifications,
    isLoading,
    refresh: fetchNotifications
  };
}

// Hook per stato connessione
export function useConnectionStatus() {
  const [status, setStatus] = useState({
    connected: false,
    quality: "unknown" as "excellent" | "good" | "fair" | "poor" | "unknown",
    latency: 0,
    lastSync: new Date()
  });
  const intervalRef = useRef<NodeJS.Timeout | undefined>(undefined);
  
  const checkStatus = useCallback(async () => {
    try {
      const result = await getConnectionStatus();
      
      if (result.success && result.status) {
        setStatus(result.status);
      }
    } catch (error) {
      setStatus(prev => ({
        ...prev,
        connected: false,
        quality: "poor"
      }));
    }
  }, []);
  
  useEffect(() => {
    // Check iniziale
    checkStatus();
    
    // Check ogni 10 secondi
    intervalRef.current = setInterval(checkStatus, 10000);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [checkStatus]);
  
  return status;
}

// Hook combinato per sostituire completamente SSE
export function useRealTime(options: {
  stationType?: "CAMERIERE" | "PREPARA" | "CASSA";
  onNewOrder?: (order: any) => void;
  onOrderUpdate?: (order: any) => void;
  onNotification?: (notification: any) => void;
} = {}) {
  const { stationType, onNewOrder, onOrderUpdate, onNotification } = options;
  
  // Eventi real-time
  const { events } = useRealTimeEvents({
    onNewEvent: (event) => {
      switch (event.type) {
        case "order:new":
          onNewOrder?.(event.data);
          break;
        case "order:update":
        case "order:ready":
        case "order:delivered":
          onOrderUpdate?.(event.data);
          break;
        case "notification":
          onNotification?.(event.data);
          break;
      }
    }
  });
  
  // Ordini se specificato il tipo stazione
  const ordersData = stationType ? useRealTimeOrders(stationType) : null;
  
  // Conteggi
  const { counts } = useRealTimeCounts();
  
  // Notifiche
  const { notifications } = useRealTimeNotifications();
  
  // Stato connessione
  const connectionStatus = useConnectionStatus();
  
  return {
    events,
    orders: ordersData?.orders || [],
    isLoadingOrders: ordersData?.isLoading || false,
    counts,
    notifications,
    connectionStatus,
    refresh: () => {
      ordersData?.refresh();
    }
  };
}