"use client";

import { useSSE } from "@/contexts/sse-context";
import { ConnectionStatusIndicator } from "./ConnectionStatusIndicator";
import { ConnectionHealth } from "@/lib/types/notifications";

interface SSEConnectionStatusProps {
  compact?: boolean;
  showLatency?: boolean;
  showReconnectAttempts?: boolean;
  className?: string;
}

export function SSEConnectionStatus({
  compact = true,
  showLatency = true,
  showReconnectAttempts = false,
  className = ""
}: SSEConnectionStatusProps) {
  const { connected, connecting, quality, latency, reconnectAttempts } = useSSE();

  // Convert SSE context state to ConnectionHealth format
  const connectionHealth: ConnectionHealth = {
    status: connected ? "connected" : connecting ? "connecting" : "disconnected",
    quality: quality || "poor",
    latency: latency || 0,
    lastPingTime: Date.now(),
    missedPings: 0,
    reconnectAttempts: reconnectAttempts
  };

  return (
    <ConnectionStatusIndicator
      connectionHealth={connectionHealth}
      compact={compact}
      showLatency={showLatency}
      showReconnectAttempts={showReconnectAttempts}
      className={className}
    />
  );
}