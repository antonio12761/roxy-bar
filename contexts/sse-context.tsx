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
  const baseDelay = 1000; // 1 second
  const maxDelay = 30000; // 30 seconds
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  // Add jitter to prevent thundering herd
  const jitter = delay * 0.2 * (Math.random() - 0.5);
  return delay + jitter;
}

export function SSEProvider({ 
  children,
  token 
}: { 
  children: React.ReactNode;
  token?: string;
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
  
  // Update token ref when prop changes
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);
  
  // Process incoming SSE message
  const processMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      const eventName = event.type || data.event;
      
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
        handlers.forEach(handler => {
          try {
            handler(data);
          } catch (error) {
            console.error(`[SSE] Error in handler for ${eventName}:`, error);
          }
        });
      }
    } catch (error) {
      console.error('[SSE] Error processing message:', error);
    }
  }, []);
  
  // Connect to SSE
  const connect = useCallback(() => {
    // Don't connect if already connected or connecting
    if (eventSourceRef.current || state.connecting) {
      return;
    }
    
    // Don't connect without token
    if (!tokenRef.current) {
      console.log('[SSE] No token available, skipping connection');
      setState(prev => ({ 
        ...prev, 
        error: new Error('Authentication required') 
      }));
      return;
    }
    
    setState(prev => ({ 
      ...prev, 
      connecting: true, 
      error: null 
    }));
    
    const url = `/api/sse?token=${encodeURIComponent(tokenRef.current)}`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;
    
    eventSource.onopen = () => {
      console.log('[SSE] Connected');
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
    };
    
    eventSource.onmessage = processMessage;
    
    // Add specific event listeners for typed events
    const events: SSEEventName[] = [
      'order:new',
      'order:update',
      'order:status-change',
      'order:ready',
      'order:delivered',
      'notification:new',
      'notification:reminder',
      'connection:status',
      'connection:error',
      'user:presence'
    ];
    
    events.forEach(eventName => {
      eventSource.addEventListener(eventName, processMessage as any);
    });
    
    eventSource.onerror = (error) => {
      console.error('[SSE] Connection error:', error);
      
      // Close the connection
      eventSource.close();
      eventSourceRef.current = null;
      
      setState(prev => ({
        ...prev,
        connected: false,
        connecting: false,
        error: new Error('Connection lost')
      }));
      
      // Don't reconnect if no token
      if (!tokenRef.current) {
        console.log('[SSE] No token, stopping reconnection');
        return;
      }
      
      // Don't reconnect if we hit error 503 (service disabled)
      if ((error as any)?.status === 503) {
        console.log('[SSE] Service disabled, stopping reconnection');
        setState(prev => ({
          ...prev,
          error: new Error('SSE service is disabled')
        }));
        return;
      }
      
      // Reconnect with exponential backoff
      const attempts = state.reconnectAttempts + 1;
      if (attempts <= 10) {
        const delay = getReconnectDelay(attempts);
        console.log(`[SSE] Reconnecting in ${delay}ms (attempt ${attempts})`);
        
        setState(prev => ({ 
          ...prev, 
          reconnectAttempts: attempts 
        }));
        
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectTimeoutRef.current = null;
          if (tokenRef.current) {
            connect();
          }
        }, delay);
      } else {
        console.error('[SSE] Max reconnection attempts reached');
        setState(prev => ({
          ...prev,
          error: new Error('Unable to establish connection')
        }));
      }
    };
  }, [state.connecting, state.reconnectAttempts, processMessage]);
  
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
  
  // Auto-connect when token is available
  useEffect(() => {
    if (token && !state.connected && !state.connecting) {
      connect();
    }
    
    return () => {
      disconnect();
    };
  }, [token]); // Only reconnect when token changes
  
  // Handle page visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page hidden, disconnect to save resources
        if (state.connected) {
          console.log('[SSE] Page hidden, disconnecting');
          disconnect();
        }
      } else {
        // Page visible, reconnect if we have a token
        if (!state.connected && !state.connecting && tokenRef.current) {
          console.log('[SSE] Page visible, reconnecting');
          connect();
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [state.connected, state.connecting, connect, disconnect]);
  
  const value: SSEContextValue = {
    ...state,
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