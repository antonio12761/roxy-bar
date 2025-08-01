"use client";

import { useEffect, useRef, useState } from "react";
import { useAuthToken } from "@/hooks/useAuthToken";

export interface SSENotification {
  type: string;
  message: string;
  data?: any;
  timestamp: string;
  id: string;
  targetRoles?: string[];
}

interface UseSSEProps {
  clientId?: string;
  userRole?: string;
  token?: string;
  onNotification?: (notification: SSENotification) => void;
  autoReconnect?: boolean;
}

// Helper to generate user-friendly messages from event types
function getMessageForEventType(eventType: string, data: any): string {
  switch (eventType) {
    case 'order:new':
      return `Nuovo ordine ${data.tableNumber ? `Tavolo ${data.tableNumber}` : data.orderType || ''}`;
    case 'order:ready':
      return `Ordine pronto ${data.tableNumber ? `Tavolo ${data.tableNumber}` : ''}`;
    case 'order:status-change':
      return `Ordine ${data.tableNumber ? `Tavolo ${data.tableNumber}` : ''} → ${data.newStatus}`;
    case 'order:delivered':
      return `Ordine consegnato ${data.tableNumber ? `Tavolo ${data.tableNumber}` : ''}`;
    case 'order:paid':
      return `Ordine pagato ${data.tableNumber ? `Tavolo ${data.tableNumber}` : ''}`;
    case 'order:cancelled':
      return `Ordine annullato ${data.tableNumber ? `Tavolo ${data.tableNumber}` : ''}`;
    case 'notification:new':
      return data.message || data.title || 'Nuova notifica';
    default:
      return `Evento: ${eventType}`;
  }
}

export function useSSE({ 
  clientId = "default", 
  userRole,
  token,
  onNotification,
  autoReconnect = true 
}: UseSSEProps = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState<SSENotification[]>([]);
  const [lastNotification, setLastNotification] = useState<SSENotification | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Get auth token if not provided
  const { token: authToken } = useAuthToken();
  const finalToken = token || authToken;

  const connect = () => {
    // Prevent duplicate connections
    if (eventSourceRef.current && eventSourceRef.current.readyState !== EventSource.CLOSED) {
      console.log("⚠️ SSE: Connection already active, skipping");
      return;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // Check if we have a token
    if (!finalToken) {
      console.error("❌ SSE: No authentication token available");
      setIsConnected(false);
      return;
    }

    const params = new URLSearchParams({
      clientId,
      userRole: userRole || '',
      token: finalToken
    });
    const eventSource = new EventSource(`/api/sse?${params}`);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      console.log(`✅ SSE Connected: clientId=${clientId}, role=${userRole}`);
      console.log(`✅ SSE URL: /api/sse?${params}`);
      
      // Clear reconnection timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    // Handler for named events
    const handleSSEEvent = (eventType: string, event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        
        // Create notification object from SSE event
        const notification: SSENotification = {
          id: data._metadata?.id || `${eventType}_${Date.now()}`,
          type: eventType,
          message: data.message || getMessageForEventType(eventType, data),
          data: data,
          timestamp: data._metadata?.timestamp || new Date().toISOString(),
          targetRoles: data._metadata?.targetRoles
        };
        
        // Check if this notification is for the current user role
        if (notification.targetRoles && userRole && 
            !notification.targetRoles.includes(userRole)) {
          return;
        }

        setLastNotification(notification);
        setNotifications(prev => [notification, ...prev.slice(0, 99)]); // Keep only 100 notifications

        // Custom callback
        if (onNotification) {
          onNotification(notification);
        }

        // Audio notification for important events
        if (eventType === "order:new" || eventType === "order:ready" || 
            eventType === "order:update" || data._metadata?.priority === "HIGH") {
          playNotificationSound();
        }

      } catch (error) {
        console.error("Error parsing SSE event:", eventType, error);
      }
    };

    // Register handlers for all possible events
    const eventTypes = [
      'order:new', 'order:update', 'order:status-change', 'order:ready',
      'order:delivered', 'order:paid', 'order:sent', 'order:in-preparation',
      'order:cancelled', 'notification:new', 'system:announcement',
      'connection:status', 'data:update'
    ];

    eventTypes.forEach(eventType => {
      eventSource.addEventListener(eventType, (event) => handleSSEEvent(eventType, event));
    });

    // Default message handler for backwards compatibility
    eventSource.onmessage = (event) => {
      try {
        const notification: SSENotification = JSON.parse(event.data);
        
        // Old format notification
        if (notification.type && notification.message) {
          if (notification.targetRoles && userRole && 
              !notification.targetRoles.includes(userRole)) {
            return;
          }

          setLastNotification(notification);
          setNotifications(prev => [notification, ...prev.slice(0, 99)]);

          if (onNotification) {
            onNotification(notification);
          }

          if (notification.type === "new_order" || notification.type === "order_update") {
            playNotificationSound();
          }
        } else {
          // If it's not old format, treat as generic event
          handleSSEEvent('message', event);
        }
      } catch (error) {
        console.error("Error parsing SSE message:", error);
      }
    };

    eventSource.onerror = (event) => {
      console.error("❌ SSE Connection error", event);
      console.error("SSE URL:", `/api/sse?${params}`);
      console.error("Token available:", !!finalToken);
      console.error("Token preview:", finalToken ? finalToken.substring(0, 20) + "..." : "No token");
      console.error("ReadyState:", eventSource.readyState);
      console.error("Event type:", event.type);
      setIsConnected(false);
      
      // Check if this is a connection failure
      if (eventSource.readyState === EventSource.CLOSED) {
        console.error("SSE connection was closed");
        eventSource.close();
        
        // Auto-reconnect
        if (autoReconnect && !reconnectTimeoutRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log("🔄 Reconnecting SSE...");
            connect();
          }, 3000);
        }
      }
    };
  };

  const disconnect = () => {
    if (eventSourceRef.current) {
      console.log(`🔌 SSE: Disconnecting ${clientId}`);
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    setIsConnected(false);
  };

  const clearNotifications = () => {
    setNotifications([]);
    setLastNotification(null);
  };

  // Audio notification
  const playNotificationSound = () => {
    try {
      // Create audio context and play notification sound
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = "sine";
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
      console.warn("Could not play notification sound:", error);
    }
  };

  useEffect(() => {
    // Only connect when we have a token
    if (finalToken) {
      console.log(`🔌 SSE: Initializing connection for ${clientId} with role ${userRole}`);
      connect();
    } else {
      console.log("⚠️ SSE: No token available, skipping connection");
    }

    return () => {
      console.log(`🔌 SSE: Cleaning up connection for ${clientId}`);
      disconnect();
    };
  }, [clientId, userRole, finalToken]);

  return {
    isConnected,
    notifications,
    lastNotification,
    connect,
    disconnect,
    clearNotifications
  };
}