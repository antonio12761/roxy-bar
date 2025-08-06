"use client";

import React, { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react';
import { SSEEventName, SSEEventData } from '@/lib/sse/sse-events';

interface SSEState {
  connected: boolean;
  connecting: boolean;
  error: Error | null;
  reconnectAttempts: number;
  quality: 'excellent' | 'good' | 'fair' | 'poor' | null;
  latency: number | null;
}

interface SSEContextValue extends SSEState {
  isConnected: boolean;  // Explicitly expose connection state
  subscribe: <T extends SSEEventName>(
    eventName: T,
    handler: (data: SSEEventData<T>) => void
  ) => () => void;
  connect: () => void;
  disconnect: () => void;
  isSubscribed: (eventName: SSEEventName) => boolean;
}

const SSEContext = createContext<SSEContextValue | null>(null);

// Exponential backoff helper
function getReconnectDelay(attempt: number): number {
  const baseDelay = 100; // 100ms for fast reconnection
  const maxDelay = 2000; // 2 seconds max delay
  const delay = Math.min(baseDelay * Math.pow(1.3, attempt), maxDelay); // Very gentle exponential
  // Add small jitter to prevent thundering herd
  const jitter = delay * 0.1 * (Math.random() - 0.5);
  return delay + jitter;
}

export function SSEProvider({ 
  children,
  token,
  station 
}: { 
  children: React.ReactNode;
  token?: string;
  station?: string;
}) {
  
  const [state, setState] = useState<SSEState>({
    connected: false,
    connecting: false,
    error: null,
    reconnectAttempts: 0,
    quality: null,
    latency: null
  });
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const handlersRef = useRef<Map<SSEEventName, Set<Function>>>(new Map());
  const tokenRef = useRef(token);
  const stationRef = useRef(station);
  const keepAliveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastEventTimeRef = useRef<number>(Date.now());
  const connectingRef = useRef(false);
  
  // Update refs when props change
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);
  
  useEffect(() => {
    stationRef.current = station;
  }, [station]);
  
  // Process incoming SSE message
  const processMessage = useCallback((event: MessageEvent) => {
    try {
      // Update last event time for ANY event (including heartbeats)
      lastEventTimeRef.current = Date.now();
      
      // Handle heartbeat messages (comments)
      if (event.data === '' || event.data.startsWith(':')) {
        return; // Heartbeat received, time updated
      }
      
      const data = JSON.parse(event.data);
      const eventName = event.type || data.event;
      
      // Debug log for esaurito events
      if (eventName === 'order:esaurito:alert') {
        console.log('[SSE Context] Received order:esaurito:alert event:', data);
      }
      
      // Process event immediately without logging
      
      // Handle connection status events
      if (eventName === 'connection:status') {
        setState(prev => ({
          ...prev,
          quality: data.quality || prev.quality,
          latency: data.latency || prev.latency
        }));
      }
      
      // Call registered handlers
      const handlers = handlersRef.current.get(eventName);
      if (handlers) {
        // Debug log for esaurito events
        if (eventName === 'order:esaurito:alert') {
          console.log(`[SSE Context] Found ${handlers.size} handlers for order:esaurito:alert`);
        }
        handlers.forEach(handler => {
          try {
            handler(data);
          } catch (error) {
            // Silently handle errors in production
            if (process.env.NODE_ENV === 'development') {
              console.error(`[SSEContext] Handler error for ${eventName}:`, error);
            }
          }
        });
      } else if (eventName === 'order:esaurito:alert') {
        console.log('[SSE Context] No handlers registered for order:esaurito:alert');
      }
    } catch (error) {
      // Not a JSON message, could be a heartbeat or comment
      // Silently ignore
    }
  }, []);
  
  // Connect to SSE
  const connect = useCallback(() => {
    // Don't connect if already connected or connecting
    if (eventSourceRef.current || connectingRef.current) {
      return;
    }
    
    // Token is optional - httpOnly cookie will be used for auth
    connectingRef.current = true;
    setState(prev => ({ 
      ...prev, 
      connecting: true, 
      error: null 
    }));
    
    // Build URL without token (httpOnly cookie will be sent automatically)
    const params = new URLSearchParams();
    if (stationRef.current) {
      params.append('station', stationRef.current);
    }
    // Add token only if available (for backward compatibility)
    if (tokenRef.current) {
      params.append('token', tokenRef.current);
    }
    
    const url = `/api/sse${params.toString() ? '?' + params.toString() : ''}`;
    // Connect to SSE endpoint
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;
    
    eventSource.onopen = () => {
      // Successfully connected
      // Connection successful
      connectingRef.current = false;
      setState({
        connected: true,
        connecting: false,
        error: null,
        reconnectAttempts: 0,
        quality: 'excellent',
        latency: 0
      });
      
      // Clear any pending reconnect
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      // Store connection time
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem('sse-last-connected', new Date().toISOString());
      }
      
      // Setup keepalive check
      if (keepAliveIntervalRef.current) {
        clearInterval(keepAliveIntervalRef.current);
      }
      
      keepAliveIntervalRef.current = setInterval(() => {
        const timeSinceLastEvent = Date.now() - lastEventTimeRef.current;
        // Only reconnect if no events for 6 seconds (server sends heartbeat every 2s)
        if (timeSinceLastEvent > 6000) { 
          // No events for 6s, connection might be dead, force reconnection
          if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
            setState(prev => ({ ...prev, connected: false }));
            // Immediate reconnect
            setTimeout(() => connect(), 100);
          }
        }
      }, 2000); // Check every 2 seconds
    };
    
    eventSource.onmessage = processMessage;
    
    // Special handler for heartbeat comments
    eventSource.addEventListener('message', (event) => {
      // Update last event time for ANY message, including heartbeats
      lastEventTimeRef.current = Date.now();
    });
    
    // Add specific event listeners for typed events
    const events: SSEEventName[] = [
      'order:new',
      'order:update',
      'order:status-change',
      'order:ready',
      'order:delivered',
      'order:esaurito:alert',    // CRITICAL - for out of stock alerts
      'order:esaurito:taken',    // When someone takes charge
      'order:esaurito:released', // When released
      'order:out-of-stock',      // General out of stock
      'notification:new',
      'notification:reminder',
      'connection:status',
      'connection:error',
      'user:presence',
      'product:availability',
      'product:unavailable-in-order',
      'product:unavailable-urgent',
      'product:out-of-stock',
      'system:heartbeat'
    ];
    
    events.forEach(eventName => {
      eventSource.addEventListener(eventName, (event) => {
        // Event triggered
        processMessage(event as MessageEvent);
      });
    });
    
    eventSource.onerror = (error) => {
      // Don't log error if connection is being established (normal browser behavior)
      if (eventSource.readyState === EventSource.CONNECTING) {
        return;
      }
      
      // Connection error occurred
      // Connection error
      
      // Only close if not already closed
      if (eventSource.readyState !== EventSource.CLOSED) {
        eventSource.close();
      }
      eventSourceRef.current = null;
      
      connectingRef.current = false;
      setState(prev => ({
        ...prev,
        connected: false,
        connecting: false,
        error: new Error('Connection lost')
      }));
      
      // Token is optional - httpOnly cookie will be used for auth
      // Continue reconnecting even without token
      
      // Don't reconnect if we hit error 503 (service disabled)
      if ((error as any)?.status === 503) {
        setState(prev => ({
          ...prev,
          error: new Error('SSE service is disabled')
        }));
        return;
      }
      
      // Clear any existing reconnect timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      // Reconnect with exponential backoff - UNLIMITED attempts
      const attempts = state.reconnectAttempts + 1;
      const delay = getReconnectDelay(attempts);
      // Schedule reconnection with backoff
      
      setState(prev => ({ 
        ...prev, 
        reconnectAttempts: attempts 
      }));
      
      reconnectTimeoutRef.current = setTimeout(() => {
        reconnectTimeoutRef.current = null;
        if (!eventSourceRef.current) {
          connect();
        }
      }, delay);
    };
  }, []); // Remove dependencies to prevent infinite loop
  
  // Disconnect from SSE
  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (keepAliveIntervalRef.current) {
      clearInterval(keepAliveIntervalRef.current);
      keepAliveIntervalRef.current = null;
    }
    
    connectingRef.current = false;
    setState({
      connected: false,
      connecting: false,
      error: null,
      reconnectAttempts: 0,
      quality: null,
      latency: null
    });
  }, []);
  
  // Subscribe to events
  const subscribe = useCallback(<T extends SSEEventName>(
    eventName: T,
    handler: (data: SSEEventData<T>) => void
  ): (() => void) => {
    if (!handlersRef.current.has(eventName)) {
      handlersRef.current.set(eventName, new Set());
    }
    
    handlersRef.current.get(eventName)!.add(handler);
    
    // Return unsubscribe function
    return () => {
      const handlers = handlersRef.current.get(eventName);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          handlersRef.current.delete(eventName);
        }
      }
    };
  }, []);
  
  // Check if subscribed to event
  const isSubscribed = useCallback((eventName: SSEEventName): boolean => {
    const handlers = handlersRef.current.get(eventName);
    return handlers ? handlers.size > 0 : false;
  }, []);
  
  // Auto-connect immediately on mount
  useEffect(() => {
    // Auto-connect on mount
    connect();
    
    return () => {
      // Keep connection alive - don't disconnect on unmount
      // This ensures continuity when navigating between pages
    };
  }, []); // Connect once on mount
  
  // Separate effect to handle reconnection based on state
  useEffect(() => {
    // Use a small delay to avoid rapid reconnection attempts
    const timeoutId = setTimeout(() => {
      if (!eventSourceRef.current && !connectingRef.current) {
        connect();
      }
    }, 500); // Increased delay to avoid rapid attempts
    
    return () => clearTimeout(timeoutId);
  }, []); // Remove connect from dependencies to avoid infinite loop
  
  // Handle page visibility - Keep connection alive even when tab is not active
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page hidden - DO NOT disconnect, keep receiving events
      } else {
        // Page visible, reconnect if not connected
        if (!eventSourceRef.current && !connectingRef.current) {
          connect();
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []); // Remove all dependencies to avoid re-subscription
  
  const value: SSEContextValue = {
    ...state,
    isConnected: state.connected,  // Explicitly add isConnected for clarity
    subscribe,
    connect,
    disconnect,
    isSubscribed
  };
  
  return (
    <SSEContext.Provider value={value}>
      {children}
    </SSEContext.Provider>
  );
}

// Hook to use SSE context
export function useSSE() {
  const context = useContext(SSEContext);
  if (!context) {
    throw new Error('useSSE must be used within SSEProvider');
  }
  return context;
}

// Specialized hooks for common use cases
export function useSSEEvent<T extends SSEEventName>(
  eventName: T,
  handler: (data: SSEEventData<T>) => void,
  deps: React.DependencyList = []
) {
  const { subscribe } = useSSE();
  
  useEffect(() => {
    const unsubscribe = subscribe(eventName, handler);
    return unsubscribe;
  }, deps);
}

// Hook for order updates
export function useOrderUpdates(handlers: {
  onNewOrder?: (data: SSEEventData<'order:new'>) => void;
  onOrderUpdate?: (data: SSEEventData<'order:update'>) => void;
  onOrderReady?: (data: SSEEventData<'order:ready'>) => void;
  onOrderDelivered?: (data: SSEEventData<'order:delivered'>) => void;
}) {
  const { subscribe } = useSSE();
  
  useEffect(() => {
    const unsubscribers: Array<() => void> = [];
    
    if (handlers.onNewOrder) {
      unsubscribers.push(subscribe('order:new', handlers.onNewOrder));
    }
    if (handlers.onOrderUpdate) {
      unsubscribers.push(subscribe('order:update', handlers.onOrderUpdate));
    }
    if (handlers.onOrderReady) {
      unsubscribers.push(subscribe('order:ready', handlers.onOrderReady));
    }
    if (handlers.onOrderDelivered) {
      unsubscribers.push(subscribe('order:delivered', handlers.onOrderDelivered));
    }
    
    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, [subscribe]);
}

// Hook for notifications
export function useNotifications(
  onNotification: (notification: SSEEventData<'notification:new'>) => void
) {
  useSSEEvent('notification:new', onNotification);
}