/**
 * Hook React ottimizzato per gestione ordini con cache e sync incrementale
 * Riduce re-renders e migliora performance UI
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useOrdersSync } from '@/lib/services/orders-sync-service';
import { useSSE } from '@/contexts/sse-context';

interface OrdersState {
  orders: any[];
  isLoading: boolean;
  error: string | null;
  lastUpdate: Date | null;
  stats: any;
}

interface UseOptimizedOrdersOptions {
  /**
   * Filtra ordini per stato
   */
  filterByState?: string[];
  
  /**
   * Filtra ordini per destinazione (BAR, CUCINA)
   */
  filterByDestination?: string;
  
  /**
   * Auto-refresh interval (ms). 0 per disabilitare
   */
  refreshInterval?: number;
  
  /**
   * Ruolo utente per targeting SSE
   */
  userRole?: string;
  
  /**
   * Abilita ottimizzazioni aggressive
   */
  enableOptimizations?: boolean;
  
  /**
   * Callback per nuovi ordini
   */
  onNewOrder?: (order: any) => void;
  
  /**
   * Callback per aggiornamenti ordini
   */
  onOrderUpdate?: (orderId: string, changes: any) => void;
}

export function useOptimizedOrders(options: UseOptimizedOrdersOptions = {}) {
  const {
    filterByState = ['APERTA', 'INVIATA', 'IN_PREPARAZIONE', 'PRONTA'],
    filterByDestination,
    refreshInterval = 10000,
    userRole,
    enableOptimizations = true,
    onNewOrder,
    onOrderUpdate
  } = options;

  const [state, setState] = useState<OrdersState>({
    orders: [],
    isLoading: true,
    error: null,
    lastUpdate: null,
    stats: null
  });

  const ordersSync = useOrdersSync();
  const { subscribe } = useSSE();
  
  // Refs per controllo debouncing
  const lastSyncRef = useRef<number>(0);
  const syncTimeoutRef = useRef<NodeJS.Timeout>();
  const mountedRef = useRef(true);

  // Memoized filtered orders per evitare re-calcoli
  const filteredOrders = useMemo(() => {
    if (!state.orders.length) return [];

    let filtered = state.orders;

    // Filtra per stato
    if (filterByState.length > 0) {
      filtered = filtered.filter(order => filterByState.includes(order.stato));
    }

    // Filtra per destinazione
    if (filterByDestination) {
      filtered = filtered.filter(order => 
        order.righe?.some((item: any) => item.destinazione === filterByDestination)
      );
    }

    // Ordina per timestamp (più vecchi prima per preparazione)
    return filtered.sort((a, b) => 
      new Date(a.dataApertura).getTime() - new Date(b.dataApertura).getTime()
    );
  }, [state.orders, filterByState, filterByDestination]);

  // Memoized order stats
  const orderStats = useMemo(() => {
    const stats = {
      total: filteredOrders.length,
      byState: {} as Record<string, number>,
      byDestination: {} as Record<string, number>,
      urgent: 0 // Ordini con più di 15 minuti
    };

    const fifteenMinutesAgo = Date.now() - 15 * 60 * 1000;

    filteredOrders.forEach(order => {
      // Conta per stato
      stats.byState[order.stato] = (stats.byState[order.stato] || 0) + 1;
      
      // Conta per destinazione
      order.righe?.forEach((item: any) => {
        stats.byDestination[item.destinazione] = (stats.byDestination[item.destinazione] || 0) + 1;
      });

      // Conta ordini urgenti
      if (new Date(order.dataApertura).getTime() < fifteenMinutesAgo) {
        stats.urgent++;
      }
    });

    return stats;
  }, [filteredOrders]);

  // Debounced sync function
  const debouncedSync = useCallback(async (immediate = false) => {
    const now = Date.now();
    
    if (!immediate && now - lastSyncRef.current < 1000) {
      // Debounce: cancella sync precedente e programma nuovo
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      
      syncTimeoutRef.current = setTimeout(() => {
        debouncedSync(true);
      }, 500);
      
      return;
    }

    if (!mountedRef.current) return;

    lastSyncRef.current = now;

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const orders = await ordersSync.getOrders();
      const stats = await ordersSync.getStats();
      
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          orders,
          stats,
          isLoading: false,
          lastUpdate: new Date()
        }));
      }
    } catch (error) {
      console.error('[useOptimizedOrders] Sync error:', error);
      
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Errore di sincronizzazione',
          isLoading: false
        }));
      }
    }
  }, [ordersSync]);

  // Optimistic update per singolo ordine
  const updateOrderOptimistic = useCallback((orderId: string, updates: Partial<any>) => {
    setState(prev => ({
      ...prev,
      orders: prev.orders.map(order => 
        order.id === orderId ? { ...order, ...updates } : order
      ),
      lastUpdate: new Date()
    }));
  }, []);

  // Optimistic update per item status
  const updateItemStatusOptimistic = useCallback(async (
    orderId: string, 
    itemId: string, 
    newStatus: string
  ) => {
    // Update UI immediately
    setState(prev => ({
      ...prev,
      orders: prev.orders.map(order => {
        if (order.id === orderId) {
          return {
            ...order,
            righe: order.righe.map((item: any) => 
              item.id === itemId 
                ? { 
                    ...item, 
                    stato: newStatus,
                    [`timestamp${getTimestampField(newStatus)}`]: new Date().toISOString()
                  }
                : item
            )
          };
        }
        return order;
      }),
      lastUpdate: new Date()
    }));

    // Update backend
    try {
      const success = await ordersSync.updateItemStatus(orderId, itemId, newStatus);
      if (!success) {
        // Rollback su errore
        await debouncedSync(true);
      }
      return success;
    } catch (error) {
      console.error('[useOptimizedOrders] Item status update error:', error);
      // Rollback su errore
      await debouncedSync(true);
      return false;
    }
  }, [ordersSync, debouncedSync]);

  // Force refresh
  const refresh = useCallback(async () => {
    return debouncedSync(true);
  }, [debouncedSync]);

  // Setup SSE subscriptions
  useEffect(() => {
    const unsubscribers: (() => void)[] = [];

    // Nuovi ordini
    unsubscribers.push(
      subscribe('order:new', (data) => {
        console.log('[useOptimizedOrders] New order received:', data);
        onNewOrder?.(data);
        debouncedSync();
      })
    );

    // Aggiornamenti ordini
    unsubscribers.push(
      subscribe('order:update', (data) => {
        console.log('[useOptimizedOrders] Order update received:', data);
        onOrderUpdate?.(data.orderId, data);
        
        if (enableOptimizations && data.orderId) {
          // Optimistic update se abbiamo abbastanza info
          if (data.status) {
            updateOrderOptimistic(data.orderId, { stato: data.status });
          }
        } else {
          debouncedSync();
        }
      })
    );

    // Eventi SSE specifici per item updates
    unsubscribers.push(
      subscribe('order:item:status-updated', (data) => {
        console.log('[useOptimizedOrders] Item status updated:', data);
        
        if (enableOptimizations && data.orderId && data.itemId && data.status) {
          // Update UI immediately, no backend call needed (già fatto dal service)
          setState(prev => ({
            ...prev,
            orders: prev.orders.map(order => {
              if (order.id === data.orderId) {
                return {
                  ...order,
                  righe: order.righe.map((item: any) => 
                    item.id === data.itemId 
                      ? { ...item, stato: data.status }
                      : item
                  )
                };
              }
              return order;
            }),
            lastUpdate: new Date()
          }));
        }
      })
    );

    // Altri eventi di stato
    const statusEvents = [
      'order:ready', 'order:delivered', 'order:paid', 
      'order:cancelled', 'order:status-change'
    ];
    
    statusEvents.forEach(event => {
      unsubscribers.push(
        subscribe(event, () => {
          debouncedSync();
        })
      );
    });

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [subscribe, debouncedSync, enableOptimizations, onNewOrder, onOrderUpdate, updateOrderOptimistic]);

  // Auto-refresh interval
  useEffect(() => {
    if (refreshInterval > 0) {
      const interval = setInterval(() => {
        debouncedSync();
      }, refreshInterval);

      return () => clearInterval(interval);
    }
  }, [refreshInterval, debouncedSync]);

  // Initial load
  useEffect(() => {
    debouncedSync(true);
    
    return () => {
      mountedRef.current = false;
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [debouncedSync]);

  return {
    // Data
    orders: filteredOrders,
    allOrders: state.orders,
    stats: orderStats,
    syncStats: state.stats,
    
    // State
    isLoading: state.isLoading,
    error: state.error,
    lastUpdate: state.lastUpdate,
    
    // Actions
    refresh,
    updateItemStatus: updateItemStatusOptimistic,
    updateOrder: updateOrderOptimistic,
    
    // Helpers
    getOrderById: useCallback((id: string) => 
      state.orders.find(order => order.id === id), [state.orders]
    ),
    
    getOrdersByState: useCallback((state: string) => 
      filteredOrders.filter(order => order.stato === state), [filteredOrders]
    )
  };
}

// Helper function
function getTimestampField(status: string): string {
  switch (status) {
    case 'IN_LAVORAZIONE': return 'Inizio';
    case 'PRONTO': return 'Pronto';
    case 'CONSEGNATO': return 'Consegna';
    default: return '';
  }
}