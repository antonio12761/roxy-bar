"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { 
  getUnreadEvents, 
  getRealTimeOrdersState, 
  getRealTimeCounts,
  getRealTimeNotifications,
  getConnectionStatus,
  RealTimeEvent
} from "@/lib/actions/real-time";
import { usePathname } from "next/navigation";
import { toast } from "@/lib/toast";

interface UseRealtimeAdvancedOptions {
  // Tipo di stazione per filtrare ordini
  stationType?: "CAMERIERE" | "PREPARA" | "CASSA";
  
  // Intervallo polling base in ms
  basePollingInterval?: number;
  
  // Intervallo polling quando disconnesso in ms
  disconnectedPollingInterval?: number;
  
  // Abilita/disabilita polling
  enabled?: boolean;
  
  // Callbacks per eventi
  onNewOrder?: (order: any) => void;
  onOrderUpdate?: (order: any) => void;
  onOrderReady?: (order: any) => void;
  onOrderDelivered?: (order: any) => void;
  onNotification?: (notification: any) => void;
  
  // Debug mode
  debug?: boolean;
}

export function useRealtimeAdvanced(options: UseRealtimeAdvancedOptions = {}) {
  const {
    stationType,
    basePollingInterval = 5000, // 5 secondi quando "connesso"
    disconnectedPollingInterval = 2000, // 2 secondi quando "disconnesso"
    enabled = true,
    onNewOrder,
    onOrderUpdate,
    onOrderReady,
    onOrderDelivered,
    onNotification,
    debug = false
  } = options;

  const pathname = usePathname();
  
  // Stati
  const [events, setEvents] = useState<RealTimeEvent[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [counts, setCounts] = useState({
    ordersToProcess: 0,
    ordersReady: 0,
    ordersToPay: 0,
    activeTables: 0
  });
  const [notifications, setNotifications] = useState<any[]>([]);
  const [connectionStatus, setConnectionStatus] = useState({
    connected: true,
    quality: "excellent" as "excellent" | "good" | "fair" | "poor" | "unknown",
    latency: 0,
    lastSync: new Date()
  });
  const [isPolling, setIsPolling] = useState(false);
  const [isLoadingOrders, setIsLoadingOrders] = useState(true);
  
  // Refs
  const lastEventIdRef = useRef<string | undefined>(undefined);
  const lastOrdersFetchRef = useRef<number>(0);
  const lastCountsFetchRef = useRef<number>(0);
  const pollingTimeoutsRef = useRef<{
    events?: NodeJS.Timeout;
    orders?: NodeJS.Timeout;
    counts?: NodeJS.Timeout;
    connection?: NodeJS.Timeout;
  }>({});
  
  // Determina intervallo polling basato su connessione
  const currentPollingInterval = useMemo(() => {
    return connectionStatus.connected ? basePollingInterval : disconnectedPollingInterval;
  }, [connectionStatus.connected, basePollingInterval, disconnectedPollingInterval]);

  // Log helper
  const log = useCallback((message: string, data?: any) => {
    if (debug) {
      console.log(`[useRealtimeAdvanced] ${message}`, data || '');
    }
  }, [debug]);

  // Polling eventi
  const pollEvents = useCallback(async () => {
    if (!enabled || isPolling) return;
    
    setIsPolling(true);
    log('Polling events...');
    
    try {
      const result = await getUnreadEvents();
      
      if (result.success && result.events && result.events.length > 0) {
        log(`Received ${result.events.length} new events`);
        
        const newEvents = result.events;
        setEvents(prev => [...prev, ...newEvents]);
        
        // Aggiorna ultimo ID
        if (newEvents && newEvents.length > 0) {
          const lastEvent = newEvents[newEvents.length - 1];
          if (lastEvent) {
            lastEventIdRef.current = lastEvent.id;
          }
        }
        
        // Processa eventi
        newEvents?.forEach(event => {
          log(`Processing event: ${event.type}`, event.data);
          
          switch (event.type) {
            case "order:new":
              onNewOrder?.(event.data);
              // Forza refresh ordini
              fetchOrders();
              break;
              
            case "order:update":
              onOrderUpdate?.(event.data);
              fetchOrders();
              break;
              
            case "order:ready":
              onOrderReady?.(event.data);
              fetchOrders();
              fetchCounts();
              break;
              
            case "order:delivered":
              onOrderDelivered?.(event.data);
              fetchOrders();
              fetchCounts();
              break;
              
            case "data:update":
              // Handle data update events
              fetchOrders();
              fetchCounts();
              break;
              
            case "notification":
              onNotification?.(event.data);
              setNotifications(prev => [event.data, ...prev].slice(0, 10));
              break;
          }
        });
      }
    } catch (error) {
      log('Error polling events:', error);
      // In caso di errore, considera disconnesso
      setConnectionStatus(prev => ({
        ...prev,
        connected: false,
        quality: "poor"
      }));
    } finally {
      setIsPolling(false);
    }
  }, [enabled, isPolling, onNewOrder, onOrderUpdate, onOrderReady, onOrderDelivered, onNotification, log]);

  // Fetch ordini
  const fetchOrders = useCallback(async () => {
    if (!stationType || !enabled) return;
    
    const now = Date.now();
    // Evita fetch troppo frequenti
    if (now - lastOrdersFetchRef.current < 500) return;
    lastOrdersFetchRef.current = now;
    
    log('Fetching orders...');
    
    try {
      const result = await getRealTimeOrdersState(stationType);
      
      if (result.success && result.orders) {
        setOrders(result.orders);
        setIsLoadingOrders(false);
        log(`Fetched ${result.orders.length} orders`);
      }
    } catch (error) {
      log('Error fetching orders:', error);
      setIsLoadingOrders(false);
    }
  }, [stationType, enabled, log]);

  // Fetch conteggi
  const fetchCounts = useCallback(async () => {
    if (!enabled) return;
    
    const now = Date.now();
    // Evita fetch troppo frequenti
    if (now - lastCountsFetchRef.current < 1000) return;
    lastCountsFetchRef.current = now;
    
    try {
      const result = await getRealTimeCounts();
      
      if (result.success && result.counts) {
        setCounts(result.counts);
      }
    } catch (error) {
      log('Error fetching counts:', error);
    }
  }, [enabled, log]);

  // Check connessione
  const checkConnection = useCallback(async () => {
    try {
      const result = await getConnectionStatus();
      
      if (result.success) {
        setConnectionStatus(prev => {
          const wasDisconnected = !prev.connected;
          const isNowConnected = result.status?.connected ?? false;
          
          // Se riconnesso, forza refresh
          if (wasDisconnected && isNowConnected) {
            log('Reconnected! Forcing refresh...');
            pollEvents();
            fetchOrders();
            fetchCounts();
          }
          
          return result.status || prev;
        });
      }
    } catch (error) {
      setConnectionStatus(prev => ({
        ...prev,
        connected: false,
        quality: "poor"
      }));
    }
  }, [pollEvents, fetchOrders, fetchCounts, log]);

  // Setup polling loop
  useEffect(() => {
    if (!enabled) return;

    log('Setting up polling loops...');
    
    // Initial fetch
    pollEvents();
    fetchOrders();
    fetchCounts();
    checkConnection();
    
    // Setup polling intervals
    const setupPolling = () => {
      // Eventi - polling più frequente
      pollingTimeoutsRef.current.events = setInterval(() => {
        pollEvents();
      }, currentPollingInterval * 0.4); // 40% dell'intervallo base
      
      // Ordini - polling normale
      if (stationType) {
        pollingTimeoutsRef.current.orders = setInterval(() => {
          fetchOrders();
        }, currentPollingInterval);
      }
      
      // Conteggi - polling meno frequente
      pollingTimeoutsRef.current.counts = setInterval(() => {
        fetchCounts();
      }, currentPollingInterval * 2);
      
      // Connessione - check ogni 10 secondi
      pollingTimeoutsRef.current.connection = setInterval(() => {
        checkConnection();
      }, 10000);
    };
    
    setupPolling();
    
    // Cleanup
    return () => {
      log('Cleaning up polling loops...');
      Object.values(pollingTimeoutsRef.current).forEach(timeout => {
        if (timeout) clearInterval(timeout);
      });
      pollingTimeoutsRef.current = {};
    };
  }, [enabled, currentPollingInterval, stationType, pollEvents, fetchOrders, fetchCounts, checkConnection, log]);

  // Refresh forzato quando cambia pagina
  useEffect(() => {
    if (enabled) {
      log('Page changed, forcing refresh...');
      pollEvents();
      fetchOrders();
      fetchCounts();
    }
  }, [pathname, enabled, pollEvents, fetchOrders, fetchCounts, log]);

  // Funzioni pubbliche
  const refresh = useCallback(() => {
    log('Manual refresh triggered');
    pollEvents();
    fetchOrders();
    fetchCounts();
    checkConnection();
  }, [pollEvents, fetchOrders, fetchCounts, checkConnection, log]);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  // Return value
  return {
    // Stati
    events,
    orders,
    counts,
    notifications,
    connectionStatus,
    isLoadingOrders,
    isPolling,
    
    // Funzioni
    refresh,
    clearNotifications,
    
    // Helpers
    hasNewOrders: counts.ordersToProcess > 0,
    hasReadyOrders: counts.ordersReady > 0,
    hasOrdersToPay: counts.ordersToPay > 0,
    isConnected: connectionStatus.connected,
    connectionQuality: connectionStatus.quality,
    latency: connectionStatus.latency
  };
}