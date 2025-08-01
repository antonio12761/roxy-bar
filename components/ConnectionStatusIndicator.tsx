"use client";

import { Wifi, WifiOff, RefreshCw, AlertCircle } from "lucide-react";
import { ConnectionHealth } from "@/lib/types/notifications";

interface ConnectionStatusIndicatorProps {
  connectionHealth: ConnectionHealth;
  compact?: boolean;
  showLatency?: boolean;
  showReconnectAttempts?: boolean;
  className?: string;
}

export function ConnectionStatusIndicator({
  connectionHealth,
  compact = false,
  showLatency = true,
  showReconnectAttempts = true,
  className = ""
}: ConnectionStatusIndicatorProps) {
  // Add safety check for undefined connectionHealth
  if (!connectionHealth) {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-gray-400 bg-gray-500/20 ${className}`}>
        <WifiOff className="h-4 w-4" />
        <span className="text-sm font-medium">Disconnesso</span>
      </div>
    );
  }

  const getStatusColor = () => {
    switch (connectionHealth.status) {
      case "connected":
        if (connectionHealth.quality === "poor") return "text-white/70 bg-white/15/20";
        if (connectionHealth.quality === "fair") return "text-white/60 bg-white/10/20";
        return "text-white/60 bg-white/10/20";
      case "connecting":
        return "text-white/60 bg-white/10/20";
      case "disconnected":
        return "text-gray-400 bg-gray-500/20";
      case "error":
        return "text-white/50 bg-white/8/20";
      default:
        return "text-gray-400 bg-gray-500/20";
    }
  };

  const getStatusIcon = () => {
    switch (connectionHealth.status) {
      case "connected":
        return null; // No icon when connected, only show signal bars
      case "connecting":
        return null; // No icon during connecting, we'll show animated bars instead
      case "disconnected":
        return null; // No icon when disconnected, we'll show static bars instead  
      case "error":
        return <AlertCircle className="h-4 w-4" />;
      default:
        return null; // Default to no icon, show bars instead
    }
  };

  const getStatusText = () => {
    switch (connectionHealth.status) {
      case "connected":
        return "Online";
      case "connecting":
        return "Connessione...";
      case "disconnected":
        return "Offline";
      case "error":
        return "Errore";
      default:
        return "Sconosciuto";
    }
  };

  const getQualityIndicator = () => {
    // For connecting state, show animated searching bars
    if (connectionHealth.status === "connecting") {
      return (
        <div className="flex gap-0.5 ml-1 scale-x-[-1] scale-y-[-1]">
          {[0, 1, 2].map((index) => {
            const heightClass = index === 0 ? "h-2" : index === 1 ? "h-3" : "h-4";
            return (
              <div
                key={index}
                className={`w-1 ${heightClass} bg-current opacity-30 rounded-sm animate-pulse`}
                style={{
                  animation: `signal-search 1.5s ease-in-out infinite`,
                  animationDelay: `${index * 0.2}s`
                }}
              />
            );
          })}
        </div>
      );
    }
    
    // For disconnected state, show inactive bars
    if (connectionHealth.status !== "connected") {
      return (
        <div className="flex gap-0.5 ml-1 scale-x-[-1] scale-y-[-1]">
          {[0, 1, 2].map((index) => {
            const heightClass = index === 0 ? "h-2" : index === 1 ? "h-3" : "h-4";
            return (
              <div
                key={index}
                className={`w-1 ${heightClass} bg-current opacity-20 rounded-sm`}
              />
            );
          })}
        </div>
      );
    }
    
    // For connected state, show quality-based bars
    const bars = [
      connectionHealth.quality === "excellent" || connectionHealth.quality === "good" || connectionHealth.quality === "fair" || connectionHealth.quality === "poor",
      connectionHealth.quality === "excellent" || connectionHealth.quality === "good" || connectionHealth.quality === "fair",
      connectionHealth.quality === "excellent" || connectionHealth.quality === "good"
    ];

    return (
      <div className="flex gap-0.5 ml-1 scale-x-[-1] scale-y-[-1]">
        {bars.map((active, index) => {
          // Use explicit height classes to ensure Tailwind includes them
          const heightClass = index === 0 ? "h-2" : index === 1 ? "h-3" : "h-4";
          return (
            <div
              key={index}
              className={`w-1 ${heightClass} ${
                active ? "bg-current" : "bg-current opacity-20"
              } rounded-sm`}
            />
          );
        })}
      </div>
    );
  };

  if (compact) {
    return (
      <div
        className={`flex items-center gap-2 px-2 py-1 rounded ${getStatusColor()} ${className}`}
        title={`${getStatusText()}${
          showLatency && connectionHealth.latency > 0
            ? ` - Latenza: ${connectionHealth.latency}ms`
            : ""
        }${
          showReconnectAttempts && connectionHealth.reconnectAttempts > 0
            ? ` - Tentativi riconnessione: ${connectionHealth.reconnectAttempts}`
            : ""
        }`}
      >
        {getStatusIcon()}
        {(connectionHealth.status === "connected" || connectionHealth.status === "connecting" || connectionHealth.status === "disconnected") && getQualityIndicator()}
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-lg ${getStatusColor()} ${className}`}
    >
      <div className="flex items-center gap-2">
        {getStatusIcon()}
        <span className="text-sm font-medium">{getStatusText()}</span>
        {(connectionHealth.status === "connected" || connectionHealth.status === "connecting" || connectionHealth.status === "disconnected") && getQualityIndicator()}
      </div>
      
      {connectionHealth.status === "connected" && showLatency && connectionHealth.latency > 0 && (
        <span className="text-xs opacity-70">
          {connectionHealth.latency}ms
        </span>
      )}
      
      {showReconnectAttempts && connectionHealth.reconnectAttempts > 0 && (
        <span className="text-xs opacity-70">
          Tentativo {connectionHealth.reconnectAttempts}
        </span>
      )}
    </div>
  );
}