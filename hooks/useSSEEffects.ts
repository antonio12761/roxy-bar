import { useEffect, useRef } from 'react';
import type { Ordinazione } from '@/app/prepara/types';

interface UseSSEEffectsProps {
  sseContext: any;
  eventQueue: any[];
  handleNewOrder: (data: any) => void;
  handleItemUpdate: (data: any) => void;
  handleOrderCancelled: (data: any) => void;
  handleReminder: (data: any) => void;
  clearEventQueue: () => void;
  selectedOrder: Ordinazione | null;
  loadMergeRequests: (orderId?: string, showLoader?: boolean) => Promise<void>;
  loadOrders: () => Promise<void>;
}

export function useSSEEffects({
  sseContext,
  eventQueue,
  handleNewOrder,
  handleItemUpdate,
  handleOrderCancelled,
  handleReminder,
  clearEventQueue,
  selectedOrder,
  loadMergeRequests,
  loadOrders
}: UseSSEEffectsProps) {
  const lastRefreshRef = useRef<number>(Date.now());
  const wasConnectedRef = useRef(false);

  // Subscribe to SSE events
  useEffect(() => {
    if (!sseContext || !sseContext.addEventListener) {
      console.warn('[Prepara] SSE context not ready');
      return;
    }

    const unsubscribers: (() => void)[] = [];

    const subscribe = (event: string, handler: (e: any) => void) => {
      console.log(`[Prepara] Subscribing to SSE event: ${event}`);
      const unsubscribe = sseContext.addEventListener(event, handler);
      unsubscribers.push(unsubscribe);
    };

    // Subscribe to events
    subscribe('order:new', (e: any) => {
      console.log('[Prepara] Received order:new event:', e);
      eventQueue.push({ event: 'order:new', data: e.data, timestamp: Date.now() });
    });

    subscribe('order:item:update', (e: any) => {
      console.log('[Prepara] Received order:item:update event:', e);
      eventQueue.push({ event: 'order:item:update', data: e.data, timestamp: Date.now() });
    });

    subscribe('order:cancelled', (e: any) => {
      console.log('[Prepara] Received order:cancelled event:', e);
      eventQueue.push({ event: 'order:cancelled', data: e.data, timestamp: Date.now() });
    });

    subscribe('order:merged', (e: any) => {
      console.log('[Prepara] Received order:merged event:', e);
      eventQueue.push({ event: 'order:merged', data: e.data, timestamp: Date.now() });
    });

    subscribe('notification:reminder', (e: any) => {
      console.log('[Prepara] Received notification:reminder event:', e);
      eventQueue.push({ event: 'notification:reminder', data: e.data, timestamp: Date.now() });
    });

    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, [sseContext, eventQueue]);

  // Process SSE events
  useEffect(() => {
    if (eventQueue.length === 0) return;
    
    const rafId = requestAnimationFrame(() => {
      eventQueue.forEach(({ event, data }) => {
        console.log(`[Prepara] Processing event: ${event}`, data);
        
        switch (event) {
          case 'order:new':
            if (data.items?.some((item: any) => 
              item.destination === 'PREPARA' || item.destination === 'BANCO'
            )) {
              handleNewOrder(data);
              setTimeout(() => {
                console.log('[Prepara] Refreshing orders after new order event');
                loadOrders();
              }, 500);
            }
            break;
            
          case 'order:item:update':
            if (data.destination === 'PREPARA') {
              handleItemUpdate(data);
            }
            break;
            
          case 'order:cancelled':
            handleOrderCancelled(data);
            break;
            
          case 'notification:reminder':
            handleReminder(data);
            break;
            
          case 'order:merged':
            if (selectedOrder?.id === data.orderId) {
              if (selectedOrder) {
                loadMergeRequests(selectedOrder.id);
              }
            }
            break;
        }
      });
      
      clearEventQueue();
    });
    
    return () => cancelAnimationFrame(rafId);
  }, [eventQueue, handleNewOrder, handleItemUpdate, handleOrderCancelled, handleReminder, 
      clearEventQueue, selectedOrder, loadMergeRequests, loadOrders]);

  // Periodic refresh
  useEffect(() => {
    const interval = setInterval(() => {
      const refreshInterval = sseContext.connected ? 10000 : 3000;
      
      if (!lastRefreshRef.current || Date.now() - lastRefreshRef.current > refreshInterval - 100) {
        console.log(`[Prepara] Periodic refresh (SSE ${sseContext.connected ? 'connected' : 'disconnected'})`);
        loadOrders();
        lastRefreshRef.current = Date.now();
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [sseContext.connected, loadOrders]);

  // Connection health monitor
  useEffect(() => {
    if (!sseContext.connected && !sseContext.connecting && sseContext.error) {
      console.log('[Prepara] SSE disconnected with error, attempting manual reconnect');
      sseContext.connect();
    }
  }, [sseContext]);

  // Refresh on reconnection
  useEffect(() => {
    if (sseContext.connected && !wasConnectedRef.current) {
      console.log('[Prepara] SSE reconnected, refreshing orders');
      setTimeout(() => loadOrders(), 1000);
    }
    wasConnectedRef.current = sseContext.connected;
  }, [sseContext.connected, loadOrders]);
}