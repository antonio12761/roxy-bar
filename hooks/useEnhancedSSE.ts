"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { 
  EnhancedSSENotification, 
  ConnectionHealth, 
  OptimisticUpdate,
  QueuedEvent,
  NotificationTypes,
  EntityType,
  OperationType,
  NotificationPriority,
  legacyToEnhanced,
  LegacySSENotification,
  EventAcknowledgment
} from "@/lib/types/notifications";

interface UseEnhancedSSEProps {
  clientId: string;
  userRole?: string;
  token?: string; // Add token prop
  onNotification?: (notification: EnhancedSSENotification) => void;
  onEntityUpdate?: (entityType: EntityType, entityId: string, changes: any) => void;
  autoReconnect?: boolean;
  enableOptimisticUpdates?: boolean;
  maxReconnectAttempts?: number;
  reconnectDelay?: number;
  enableEventReplay?: boolean;
  queueOfflineEvents?: boolean;
}

export function useEnhancedSSE({
  clientId,
  userRole,
  token,
  onNotification,
  onEntityUpdate,
  autoReconnect = true,
  enableOptimisticUpdates = true,
  maxReconnectAttempts = 10,
  reconnectDelay = 3000,
  enableEventReplay = true,
  queueOfflineEvents = true
}: UseEnhancedSSEProps) {
  // Connection state
  const [connectionHealth, setConnectionHealth] = useState<ConnectionHealth>({
    status: "disconnected",
    quality: "good",
    latency: 0,
    lastPingTime: 0,
    missedPings: 0,
    reconnectAttempts: 0
  });
  
  // Notification state
  const [notifications, setNotifications] = useState<EnhancedSSENotification[]>([]);
  const [lastNotification, setLastNotification] = useState<EnhancedSSENotification | null>(null);
  
  // Optimistic updates tracking
  const [optimisticUpdates, setOptimisticUpdates] = useState<Map<string, OptimisticUpdate>>(new Map());
  
  // Event queue for offline support
  const [eventQueue, setEventQueue] = useState<QueuedEvent[]>([]);
  
  // Refs
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastEventIdRef = useRef<string | null>(null);
  const latencyCheckMapRef = useRef<Map<string, number>>(new Map());
  const acknowledgmentQueueRef = useRef<Set<string>>(new Set());
  const reconnectAttemptsRef = useRef<number>(0);
  const processNotificationRef = useRef<((notification: EnhancedSSENotification) => void) | null>(null);
  const sendAcknowledgmentRef = useRef<((eventId: string, status: "received" | "processed" | "failed", error?: string) => Promise<void>) | null>(null);
  
  // Store props in refs to avoid stale closures
  const clientIdRef = useRef(clientId);
  const userRoleRef = useRef(userRole);
  const tokenRef = useRef(token);
  const autoReconnectRef = useRef(autoReconnect);
  const maxReconnectAttemptsRef = useRef(maxReconnectAttempts);
  const reconnectDelayRef = useRef(reconnectDelay);
  const enableEventReplayRef = useRef(enableEventReplay);

  // Send acknowledgment
  const sendAcknowledgment = useCallback(async (eventId: string, status: "received" | "processed" | "failed", error?: string) => {
    if (!eventId) return;
    
    try {
      const ack: EventAcknowledgment = {
        eventId,
        clientId,
        timestamp: new Date().toISOString(),
        status,
        error
      };
      
      await fetch("/api/sse", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(tokenRef.current ? { "Authorization": `Bearer ${tokenRef.current}` } : {})
        },
        body: JSON.stringify(ack)
      });
      
      acknowledgmentQueueRef.current.delete(eventId);
    } catch (error) {
      console.error("Failed to send acknowledgment:", error);
      // Retry later
      acknowledgmentQueueRef.current.add(eventId);
    }
  }, [clientId]);

  // Process notification with incremental updates
  const processNotification = useCallback((notification: EnhancedSSENotification) => {
    // Send acknowledgment
    if (notification.acknowledgmentRequired) {
      sendAcknowledgment(notification.id, "received");
    }
    
    // Handle entity changes
    if (notification.entityChanges) {
      notification.entityChanges.forEach(change => {
        if (onEntityUpdate) {
          onEntityUpdate(change.entityType, change.entityId, change);
        }
        
        // Handle optimistic updates
        if (enableOptimisticUpdates && change.operation === OperationType.UPDATE) {
          const optimisticKey = `${change.entityType}_${change.entityId}`;
          const existingOptimistic = optimisticUpdates.get(optimisticKey);
          
          if (existingOptimistic && !existingOptimistic.confirmed) {
            // Check if server version matches our optimistic update
            if (change.version === existingOptimistic.timestamp) {
              // Confirm optimistic update
              setOptimisticUpdates(prev => {
                const updated = new Map(prev);
                updated.set(optimisticKey, { ...existingOptimistic, confirmed: true });
                return updated;
              });
            } else if (change.previousVersion && change.previousVersion > existingOptimistic.timestamp) {
              // Conflict detected - rollback optimistic update
              console.warn("Optimistic update conflict detected, rolling back", optimisticKey);
              setOptimisticUpdates(prev => {
                const updated = new Map(prev);
                updated.delete(optimisticKey);
                return updated;
              });
              
              // Notify about rollback
              if (onNotification) {
                onNotification({
                  ...notification,
                  type: "optimistic_rollback",
                  message: `Update conflict for ${change.entityType} ${change.entityId}`,
                  priority: NotificationPriority.HIGH
                });
              }
            }
          }
        }
      });
    }
    
    // Update notification history
    setLastNotification(notification);
    setNotifications(prev => {
      const updated = [notification, ...prev];
      // Keep only recent notifications based on priority
      const maxNotifications = notification.priority === NotificationPriority.HIGH ? 200 : 100;
      return updated.slice(0, maxNotifications);
    });
    
    // Call custom handler
    if (onNotification) {
      onNotification(notification);
    }
    
    // Play sound for high priority notifications
    if (notification.priority === NotificationPriority.HIGH || 
        notification.priority === NotificationPriority.URGENT ||
        notification.type === NotificationTypes.NEW_ORDER) {
      playNotificationSound(notification.priority);
    }
  }, [clientId, onNotification, onEntityUpdate, enableOptimisticUpdates, optimisticUpdates]);

  // Update refs when props change
  useEffect(() => {
    clientIdRef.current = clientId;
    userRoleRef.current = userRole;
    tokenRef.current = token;
    autoReconnectRef.current = autoReconnect;
    maxReconnectAttemptsRef.current = maxReconnectAttempts;
    reconnectDelayRef.current = reconnectDelay;
    enableEventReplayRef.current = enableEventReplay;
  }, [clientId, userRole, token, autoReconnect, maxReconnectAttempts, reconnectDelay, enableEventReplay]);

  // Update refs
  useEffect(() => {
    processNotificationRef.current = processNotification;
  }, [processNotification]);

  useEffect(() => {
    sendAcknowledgmentRef.current = sendAcknowledgment;
  }, [sendAcknowledgment]);

  // Enhanced audio notification with priority
  const playNotificationSound = useCallback((priority: NotificationPriority) => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Different frequencies for different priorities
      const frequencies = {
        [NotificationPriority.LOW]: 600,
        [NotificationPriority.NORMAL]: 800,
        [NotificationPriority.HIGH]: 1000,
        [NotificationPriority.URGENT]: 1200
      };

      oscillator.frequency.value = frequencies[priority] || 800;
      oscillator.type = "sine";
      
      const volume = priority === NotificationPriority.URGENT ? 0.5 : 0.3;
      gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.5);
      
      // Play multiple beeps for urgent notifications
      if (priority === NotificationPriority.URGENT) {
        setTimeout(() => playNotificationSound(NotificationPriority.HIGH), 600);
        setTimeout(() => playNotificationSound(NotificationPriority.HIGH), 1200);
      }
    } catch (error) {
      console.warn("Could not play notification sound:", error);
    }
  }, []);

  // Connect to SSE stream (using ref to avoid dependency issues)
  const connectRef = useRef<(() => void) | null>(null);
  
  const connect = useCallback(() => {
    // CRITICAL: Don't connect without a token
    if (!tokenRef.current) {
      console.log("🔒 Cannot connect without authentication token");
      setConnectionHealth(prev => ({ 
        ...prev, 
        status: "disconnected",
        reconnectAttempts: 0 
      }));
      return;
    }
    
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setConnectionHealth(prev => ({ ...prev, status: "connecting" }));

    console.log("🔗 Connecting with token:", tokenRef.current ? "present" : "missing");
    
    const params = new URLSearchParams({
      clientId: clientIdRef.current,
      userRole: userRoleRef.current || "",
      token: tokenRef.current,
      ...(lastEventIdRef.current && enableEventReplayRef.current ? { lastEventId: lastEventIdRef.current } : {})
    });

    console.log("📡 SSE URL:", `/api/sse?${params}`);
    const eventSource = new EventSource(`/api/sse?${params}`);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      reconnectAttemptsRef.current = 0;
      setConnectionHealth(prev => ({
        ...prev,
        status: "connected",
        reconnectAttempts: 0,
        missedPings: 0
      }));
      
      console.log("✅ Enhanced SSE Connected");
      
      // Clear reconnection timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      // Process any queued acknowledgments
      acknowledgmentQueueRef.current.forEach(eventId => {
        sendAcknowledgmentRef.current?.(eventId, "received");
      });
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle different message types
        if (data.type === NotificationTypes.PING) {
          // Update connection health
          setConnectionHealth(prev => ({
            ...prev,
            lastPingTime: Date.now(),
            missedPings: 0,
            quality: data.metadata?.health?.quality || prev.quality
          }));
          
          // Send pong if needed
          if (data.metadata?.pendingAcks?.length > 0) {
            data.metadata.pendingAcks.forEach((eventId: string) => {
              sendAcknowledgmentRef.current?.(eventId, "received");
            });
          }
          return;
        }
        
        if (data.type === "latency_check") {
          const startTime = data.metadata?.startTime;
          if (startTime) {
            const latency = Date.now() - startTime;
            setConnectionHealth(prev => ({ ...prev, latency }));
          }
          return;
        }
        
        // Ignore connection messages
        if (data.type === NotificationTypes.CONNECTION) {
          return;
        }
        
        // Store last event ID for replay only for actual notifications
        if (event.lastEventId) {
          lastEventIdRef.current = event.lastEventId;
        }
        
        // Convert legacy format if needed
        let notification: EnhancedSSENotification;
        if (!data.priority || !data.syncVersion) {
          // Legacy format
          notification = legacyToEnhanced(data as LegacySSENotification);
        } else {
          notification = data as EnhancedSSENotification;
        }
        
        // Filter by role if specified
        if (notification.targetRoles && userRoleRef.current && 
            !notification.targetRoles.includes(userRoleRef.current)) {
          return;
        }
        
        // Process the notification
        processNotificationRef.current?.(notification);
        
      } catch (error) {
        console.error("Error parsing SSE message:", error);
      }
    };

    eventSource.onerror = (error) => {
      console.error("❌ Enhanced SSE Error:", error);
      console.log("EventSource readyState:", eventSource.readyState);
      
      // Close the connection immediately
      eventSource.close();
      eventSourceRef.current = null;
      
      setConnectionHealth(prev => ({
        ...prev,
        status: "error",
        missedPings: prev.missedPings + 1
      }));

      // CRITICAL: Stop all reconnection attempts if no token
      if (!tokenRef.current) {
        console.log("🔒 No token available, stopping all reconnection attempts");
        // Clear any pending reconnection
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
        reconnectAttemptsRef.current = 0;
        setConnectionHealth(prev => ({ 
          ...prev, 
          status: "disconnected",
          reconnectAttempts: 0
        }));
        return;
      }

      // Handle reconnection only if we have a token
      if (autoReconnectRef.current && reconnectAttemptsRef.current < maxReconnectAttemptsRef.current && tokenRef.current) {
        reconnectAttemptsRef.current += 1;
        setConnectionHealth(prev => ({
          ...prev,
          status: "disconnected",
          reconnectAttempts: reconnectAttemptsRef.current
        }));
        
        // Clear any existing timeout
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        
        const delay = Math.min(
          reconnectDelayRef.current * Math.pow(2, reconnectAttemptsRef.current - 1),
          30000 // Max 30 seconds
        );
        
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectTimeoutRef.current = null;
          // Double-check token before reconnecting
          if (tokenRef.current) {
            console.log(`🔄 Reconnecting SSE (attempt ${reconnectAttemptsRef.current})...`);
            connectRef.current?.();
          } else {
            console.log("🔒 Token lost during reconnection delay, aborting");
            reconnectAttemptsRef.current = 0;
            setConnectionHealth(prev => ({ 
              ...prev, 
              status: "disconnected",
              reconnectAttempts: 0
            }));
          }
        }, delay);
      } else {
        // No more reconnection attempts
        reconnectAttemptsRef.current = 0;
        setConnectionHealth(prev => ({ 
          ...prev, 
          status: "disconnected",
          reconnectAttempts: 0
        }));
      }
    };
  }, []); // Remove all dependencies to prevent loops
  
  // Update connect ref
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  // Disconnect
  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    setConnectionHealth(prev => ({ ...prev, status: "disconnected" }));
  }, []);

  // Apply optimistic update
  const applyOptimisticUpdate = useCallback((
    entityType: EntityType,
    entityId: string,
    changes: any,
    rollbackData?: any
  ): string => {
    const updateId = `opt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const optimisticUpdate: OptimisticUpdate = {
      id: updateId,
      entityType,
      entityId,
      changes: Array.isArray(changes) ? changes : [changes],
      timestamp: Date.now(),
      confirmed: false,
      rollbackData
    };
    
    setOptimisticUpdates(prev => {
      const updated = new Map(prev);
      updated.set(`${entityType}_${entityId}`, optimisticUpdate);
      return updated;
    });
    
    return updateId;
  }, []);

  // Rollback optimistic update
  const rollbackOptimisticUpdate = useCallback((updateId: string) => {
    setOptimisticUpdates(prev => {
      const updated = new Map(prev);
      for (const [key, update] of updated.entries()) {
        if (update.id === updateId) {
          updated.delete(key);
          break;
        }
      }
      return updated;
    });
  }, []);

  // Clear notifications
  const clearNotifications = useCallback(() => {
    setNotifications([]);
    setLastNotification(null);
  }, []);

  // Replay events from a specific point
  const replayEvents = useCallback((fromTimestamp: string) => {
    if (!enableEventReplay) return;
    
    // Disconnect and reconnect with replay parameters
    disconnect();
    
    const params = new URLSearchParams({
      clientId,
      userRole: userRole || "",
      ...(token ? { token } : {}),
      replayFrom: fromTimestamp,
      lastEventId: lastEventIdRef.current || ""
    });
    
    // Reconnect with replay parameters
    setTimeout(() => {
      const eventSource = new EventSource(`/api/notifications/stream?${params}`);
      eventSourceRef.current = eventSource;
      // Set up event handlers (same as in connect function)
      // ... (handlers setup)
    }, 100);
  }, [clientId, userRole, enableEventReplay, disconnect]);

  // Effect to handle connection lifecycle
  useEffect(() => {
    // Only connect on the client side
    if (typeof window === 'undefined') {
      return;
    }
    
    // Clear any pending reconnection when token changes
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    // Don't connect without a token
    if (!token) {
      console.log("⏳ No authentication token available");
      // Ensure we're disconnected
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      reconnectAttemptsRef.current = 0;
      setConnectionHealth(prev => ({ 
        ...prev, 
        status: "disconnected",
        reconnectAttempts: 0
      }));
      return;
    }
    
    // We have a token, connect
    console.log("✅ Token available, connecting...");
    connect();

    // Handle page visibility changes
    const handleVisibilityChange = () => {
      if (document.hidden && queueOfflineEvents) {
        // Page is hidden, prepare for offline mode
        console.log("Page hidden, preparing for offline mode");
      } else if (!document.hidden && eventSourceRef.current === null && token) {
        // Page is visible again, reconnect if needed and we have a token
        console.log("Page visible, checking token before reconnecting...");
        if (tokenRef.current) {
          connect();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      disconnect();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [token]); // Re-connect when token changes

  return {
    // Connection state
    isConnected: connectionHealth.status === "connected",
    connectionHealth,
    
    // Notifications
    notifications,
    lastNotification,
    
    // Optimistic updates
    optimisticUpdates: Array.from(optimisticUpdates.values()),
    applyOptimisticUpdate,
    rollbackOptimisticUpdate,
    
    // Event queue
    eventQueue,
    
    // Actions
    connect,
    disconnect,
    clearNotifications,
    replayEvents,
    sendAcknowledgment
  };
}