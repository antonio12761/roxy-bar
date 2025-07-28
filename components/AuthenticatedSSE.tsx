"use client";

import { useEffect, useRef, ReactNode } from "react";
import { useAuthToken } from "@/hooks/useAuthToken";
import { useEnhancedSSE } from "@/hooks/useEnhancedSSE";
import { EnhancedSSENotification, EntityType } from "@/lib/types/notifications";

interface AuthenticatedSSEProps {
  children: ReactNode;
  clientId?: string;
  userRole?: string;
  onNotification?: (notification: EnhancedSSENotification) => void;
  onEntityUpdate?: (entityType: EntityType, entityId: string, changes: any) => void;
  autoReconnect?: boolean;
  enableOptimisticUpdates?: boolean;
  maxReconnectAttempts?: number;
  reconnectDelay?: number;
  enableEventReplay?: boolean;
  queueOfflineEvents?: boolean;
}

export function AuthenticatedSSE({
  children,
  clientId,
  userRole,
  onNotification,
  onEntityUpdate,
  autoReconnect = true,
  enableOptimisticUpdates = true,
  maxReconnectAttempts = 10,
  reconnectDelay = 3000,
  enableEventReplay = true,
  queueOfflineEvents = true
}: AuthenticatedSSEProps) {
  const { token, isLoading } = useAuthToken();
  const sseRef = useRef<ReturnType<typeof useEnhancedSSE> | null>(null);
  const hasConnected = useRef(false);

  // Generate a stable client ID if not provided
  const stableClientId = useRef(clientId || `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);

  useEffect(() => {
    // Only connect once we have a token
    if (!isLoading && token && !hasConnected.current) {
      hasConnected.current = true;
      
      // Initialize SSE with authentication
      sseRef.current = useEnhancedSSE({
        clientId: stableClientId.current,
        token,
        userRole,
        onNotification,
        onEntityUpdate,
        autoReconnect,
        enableOptimisticUpdates,
        maxReconnectAttempts,
        reconnectDelay,
        enableEventReplay,
        queueOfflineEvents
      });
    }

    // Cleanup on unmount
    return () => {
      if (sseRef.current) {
        sseRef.current.disconnect();
      }
    };
  }, [token, isLoading]); // Only reconnect if token changes

  // Don't render children until we have authentication sorted
  if (isLoading) {
    return null;
  }

  if (!token) {
    console.warn("AuthenticatedSSE: No authentication token available");
    return <>{children}</>;
  }

  return <>{children}</>;
}