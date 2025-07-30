/**
 * Optimized SSE hook for work stations
 * Replaces useEnhancedSSE with station-specific optimizations
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { StationType, shouldReceiveEvent } from '@/lib/sse/station-filters';
import { getStationCache, StationCache } from '@/lib/cache/station-cache';
import { SSEEventName, SSEEventData } from '@/lib/sse/sse-events';
import { useAuthToken } from './useAuthToken';

export interface ConnectionHealth {
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
  quality: 'excellent' | 'good' | 'fair' | 'poor';
  latency: number;
  reconnectAttempts: number;
  lastEventTime?: number;
}

export interface StationSSEConfig {
  stationType: StationType;
  userId: string;
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
  enableOptimisticUpdates?: boolean;
  enableCache?: boolean;
}

export interface OptimisticUpdate {
  id: string;
  entityType: string;
  entityId: string;
  changes: Record<string, any>;
  rollbackData: Record<string, any>;
  timestamp: number;
}

export function useStationSSE(config: StationSSEConfig) {
  const { token, isLoading: tokenLoading } = useAuthToken();
  
  const [connectionHealth, setConnectionHealth] = useState<ConnectionHealth>({
    status: 'disconnected',
    quality: 'poor',
    latency: 0,
    reconnectAttempts: 0
  });

  const [optimisticUpdates, setOptimisticUpdates] = useState<Map<string, OptimisticUpdate>>(new Map());
  const [eventQueue, setEventQueue] = useState<Array<{ event: SSEEventName; data: any; timestamp: number }>>([]);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const latencyCheckRef = useRef<{ start: number; id: string } | null>(null);
  
  // Station-specific cache
  const cache = useMemo(() => 
    config.enableCache ? getStationCache(config.stationType) : null, 
    [config.stationType, config.enableCache]
  );

  /**
   * Connect to SSE with station-specific parameters
   */
  const connect = useCallback(() => {
    if (eventSourceRef.current?.readyState === EventSource.OPEN) {
      return;
    }

    // Don't connect if token is not available yet
    if (tokenLoading || !token) {
      console.log(`[${config.stationType}] Waiting for token...`);
      return;
    }

    setConnectionHealth(prev => ({ ...prev, status: 'connecting' }));

    const params = new URLSearchParams({
      station: config.stationType,
      userId: config.userId,
      clientId: `${config.stationType}-${config.userId}-${Date.now()}`,
      token: token
    });

    const eventSource = new EventSource(`/api/sse?${params}`);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log(`[${config.stationType}] SSE Connected`);
      setConnectionHealth(prev => ({
        ...prev,
        status: 'connected',
        quality: 'excellent',
        reconnectAttempts: 0,
        lastEventTime: Date.now()
      }));
      
      // Start heartbeat monitoring
      startHeartbeatMonitoring();
    };

    eventSource.onerror = () => {
      console.error(`[${config.stationType}] SSE Error`);
      setConnectionHealth(prev => ({
        ...prev,
        status: 'error',
        quality: 'poor'
      }));
      
      if (config.autoReconnect !== false) {
        scheduleReconnect();
      }
    };

    // Listen for all events but filter on client side as backup
    eventSource.onmessage = (event) => {
      try {
        const { type: eventName, data } = JSON.parse(event.data);
        handleSSEEvent(eventName, data);
      } catch (error) {
        console.error(`[${config.stationType}] Failed to parse SSE event:`, error);
      }
    };

    // Specific event listeners for better performance
    eventSource.addEventListener('heartbeat', handleHeartbeat);
    eventSource.addEventListener('order:new', (e) => handleSSEEvent('order:new', JSON.parse(e.data)));
    eventSource.addEventListener('order:update', (e) => handleSSEEvent('order:update', JSON.parse(e.data)));
    eventSource.addEventListener('order:ready', (e) => handleSSEEvent('order:ready', JSON.parse(e.data)));
    
  }, [config.stationType, config.userId, tokenLoading, token]);

  /**
   * Handle incoming SSE events with filtering and caching
   */
  const handleSSEEvent = useCallback((eventName: SSEEventName, data: any) => {
    const now = Date.now();
    
    // Update connection health
    setConnectionHealth(prev => ({
      ...prev,
      lastEventTime: now,
      quality: calculateConnectionQuality(prev.latency)
    }));

    // Check if this station should receive this event
    if (!shouldReceiveEvent(config.stationType, eventName, data, config.userId)) {
      return;
    }

    // Cache the event data if caching is enabled
    if (cache && eventName.startsWith('order:')) {
      const cacheKey = `order:${data.orderId || data.id}`;
      cache.updateIfNewer(cacheKey, data, data.version || now);
    }

    // Add to event queue for processing
    setEventQueue(prev => {
      const newQueue = [...prev, { event: eventName, data, timestamp: now }];
      // Keep only recent events (last 100)
      return newQueue.slice(-100);
    });

    console.log(`[${config.stationType}] Received event:`, eventName, data);
  }, [config.stationType, config.userId, cache]);

  /**
   * Handle heartbeat events for latency calculation
   */
  const handleHeartbeat = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      
      if (latencyCheckRef.current && data.id === latencyCheckRef.current.id) {
        const latency = Date.now() - latencyCheckRef.current.start;
        setConnectionHealth(prev => ({
          ...prev,
          latency,
          quality: calculateConnectionQuality(latency)
        }));
        latencyCheckRef.current = null;
      }
    } catch (error) {
      console.error('Heartbeat parsing error:', error);
    }
  }, []);

  /**
   * Start heartbeat monitoring
   */
  const startHeartbeatMonitoring = useCallback(() => {
    const interval = config.heartbeatInterval || 30000;
    
    heartbeatTimeoutRef.current = setInterval(() => {
      if (eventSourceRef.current?.readyState === EventSource.OPEN) {
        const id = `${config.stationType}-${Date.now()}`;
        latencyCheckRef.current = { start: Date.now(), id };
        
        // Send ping via SSE (this would need server support)
        // For now, we just monitor incoming events
      }
    }, interval);
  }, [config.stationType, config.heartbeatInterval]);

  /**
   * Calculate connection quality based on latency
   */
  const calculateConnectionQuality = (latency: number): ConnectionHealth['quality'] => {
    if (latency < 100) return 'excellent';
    if (latency < 300) return 'good';
    if (latency < 1000) return 'fair';
    return 'poor';
  };

  /**
   * Schedule reconnection with exponential backoff
   */
  const scheduleReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    setConnectionHealth(prev => {
      const attempts = prev.reconnectAttempts + 1;
      const maxAttempts = config.maxReconnectAttempts || 10;
      
      if (attempts > maxAttempts) {
        return { ...prev, status: 'error' };
      }

      const delay = Math.min(1000 * Math.pow(2, attempts), 30000);
      
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, delay);

      return { ...prev, reconnectAttempts: attempts };
    });
  }, [connect, config.maxReconnectAttempts]);

  /**
   * Apply optimistic update
   */
  const applyOptimisticUpdate = useCallback((
    entityType: string,
    entityId: string,
    changes: Record<string, any>,
    rollbackData: Record<string, any>
  ) => {
    if (!config.enableOptimisticUpdates) {
      return null;
    }

    const updateId = `${entityType}-${entityId}-${Date.now()}`;
    const update: OptimisticUpdate = {
      id: updateId,
      entityType,
      entityId,
      changes,
      rollbackData,
      timestamp: Date.now()
    };

    setOptimisticUpdates(prev => new Map(prev).set(updateId, update));
    
    // Auto-remove after timeout
    setTimeout(() => {
      setOptimisticUpdates(prev => {
        const newMap = new Map(prev);
        newMap.delete(updateId);
        return newMap;
      });
    }, 10000);

    return updateId;
  }, [config.enableOptimisticUpdates]);

  /**
   * Rollback optimistic update
   */
  const rollbackOptimisticUpdate = useCallback((updateId: string) => {
    setOptimisticUpdates(prev => {
      const newMap = new Map(prev);
      newMap.delete(updateId);
      return newMap;
    });
  }, []);

  /**
   * Get cached data
   */
  const getCachedData = useCallback(<T>(key: string): T | null => {
    return cache?.get<T>(key) || null;
  }, [cache]);

  /**
   * Disconnect and cleanup
   */
  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    if (heartbeatTimeoutRef.current) {
      clearInterval(heartbeatTimeoutRef.current);
    }
    
    setConnectionHealth(prev => ({ ...prev, status: 'disconnected' }));
  }, []);

  // Auto-connect on mount and when token becomes available
  useEffect(() => {
    if (!tokenLoading && token) {
      connect();
    }
    return disconnect;
  }, [connect, disconnect, tokenLoading, token]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
      cache?.destroy();
    };
  }, [disconnect, cache]);

  return {
    connectionHealth,
    eventQueue,
    optimisticUpdates,
    connect,
    disconnect,
    applyOptimisticUpdate,
    rollbackOptimisticUpdate,
    getCachedData,
    clearEventQueue: useCallback(() => setEventQueue([]), [])
  };
}