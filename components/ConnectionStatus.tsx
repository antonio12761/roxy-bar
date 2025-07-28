"use client";

import { Wifi, WifiOff, AlertCircle, Clock, CheckCircle, RefreshCw } from "lucide-react";
import { ConnectionHealth } from "@/lib/types/notifications";

interface ConnectionStatusProps {
  connectionHealth: ConnectionHealth;
  showQueued?: boolean;
  queuedCount?: number;
  compact?: boolean;
  showLatency?: boolean;
  className?: string;
}

export function ConnectionStatus({
  connectionHealth,
  showQueued = true,
  queuedCount = 0,
  compact = false,
  showLatency = false,
  className = ""
}: ConnectionStatusProps) {
  const getStatusIcon = () => {
    switch (connectionHealth.status) {
      case "connected":
        if (connectionHealth.quality === "excellent") {
          return <Wifi className="h-4 w-4 text-white/70" />;
        } else if (connectionHealth.quality === "good") {
          return <Wifi className="h-4 w-4 text-white/60" />;
        } else if (connectionHealth.quality === "poor") {
          return <Wifi className="h-4 w-4 text-white/40" />;
        } else {
          return <Wifi className="h-4 w-4 text-white/20" />;
        }
      case "connecting":
        return <RefreshCw className="h-4 w-4 text-white/50 animate-spin" />;
      case "disconnected":
      case "error":
        return <WifiOff className="h-4 w-4 text-white/30" />;
      default:
        return <AlertCircle className="h-4 w-4 text-white/30" />;
    }
  };

  const getStatusText = () => {
    switch (connectionHealth.status) {
      case "connected":
        if (connectionHealth.quality === "excellent") {
          return "Eccellente";
        } else if (connectionHealth.quality === "good") {
          return "Buona";
        } else if (connectionHealth.quality === "poor") {
          return "Scarsa";
        } else {
          return "Offline";
        }
      case "connecting":
        return "Connessione...";
      case "disconnected":
        return "Disconnesso";
      case "error":
        return "Errore";
      default:
        return "Sconosciuto";
    }
  };

  const getStatusColor = () => {
    switch (connectionHealth.status) {
      case "connected":
        if (connectionHealth.quality === "excellent" || connectionHealth.quality === "good") {
          return "bg-white/10 text-white/70 border-white/20";
        } else if (connectionHealth.quality === "poor") {
          return "bg-white/5 text-white/50 border-white/15";
        } else {
          return "bg-white/5 text-white/30 border-white/15";
        }
      case "connecting":
        return "bg-white/8 text-white/50 border-white/18";
      case "disconnected":
      case "error":
        return "bg-white/5 text-white/30 border-white/15";
      default:
        return "bg-white/5 text-white/30 border-white/10";
    }
  };

  const getQualityIndicator = () => {
    if (connectionHealth.status !== "connected") return null;
    
    const bars = [
      connectionHealth.quality === "excellent" || connectionHealth.quality === "good" || connectionHealth.quality === "poor",
      connectionHealth.quality === "excellent" || connectionHealth.quality === "good",
      connectionHealth.quality === "excellent"
    ];

    return (
      <div className="flex items-end gap-0.5 ml-1">
        {bars.map((filled, index) => (
          <div
            key={index}
            className={`w-1 transition-all ${
              filled 
                ? connectionHealth.quality === "excellent" ? "bg-white/70" 
                : connectionHealth.quality === "good" ? "bg-white/60"
                : "bg-white/40"
                : "bg-white/20"
            }`}
            style={{ height: `${(index + 1) * 3}px` }}
          />
        ))}
      </div>
    );
  };

  if (compact) {
    return (
      <div className={`flex items-center gap-2 px-2 py-1 rounded border ${getStatusColor()} ${className}`}>
        {getStatusIcon()}
        {!compact && <span className="text-xs font-medium">{getStatusText()}</span>}
        {connectionHealth.status === "connected" && getQualityIndicator()}
        {showLatency && connectionHealth.latency > 0 && (
          <span className="text-xs opacity-70">{connectionHealth.latency}ms</span>
        )}
      </div>
    );
  }

  return (
    <div className={`bg-card border border-border rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span className="font-medium">Connessione</span>
        </div>
        <span className={`text-sm font-medium ${
          connectionHealth.status === "connected" ? "text-white/70" : "text-white/30"
        }`}>
          {getStatusText()}
        </span>
      </div>

      {/* Connection details */}
      <div className="space-y-2 text-sm">
        {/* Quality indicator */}
        {connectionHealth.status === "connected" && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Qualità</span>
            <div className="flex items-center gap-2">
              {getQualityIndicator()}
              <span className={`font-medium ${
                connectionHealth.quality === "excellent" ? "text-white/70" :
                connectionHealth.quality === "good" ? "text-white/60" :
                connectionHealth.quality === "poor" ? "text-white/40" :
                "text-white/30"
              }`}>
                {connectionHealth.quality === "excellent" ? "Eccellente" :
                 connectionHealth.quality === "good" ? "Buona" :
                 connectionHealth.quality === "poor" ? "Scarsa" : "Offline"}
              </span>
            </div>
          </div>
        )}

        {/* Latency */}
        {showLatency && connectionHealth.latency > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Latenza</span>
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <span className={`font-medium ${
                connectionHealth.latency < 100 ? "text-white/70" :
                connectionHealth.latency < 300 ? "text-white/50" :
                "text-white/30"
              }`}>
                {connectionHealth.latency}ms
              </span>
            </div>
          </div>
        )}

        {/* Reconnection attempts */}
        {connectionHealth.reconnectAttempts > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Tentativi riconnessione</span>
            <span className="font-medium text-white/60">
              {connectionHealth.reconnectAttempts}
            </span>
          </div>
        )}

        {/* Queued messages */}
        {showQueued && queuedCount > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Messaggi in coda</span>
            <div className="flex items-center gap-1">
              <AlertCircle className="h-3 w-3 text-white/60" />
              <span className="font-medium text-white/60">{queuedCount}</span>
            </div>
          </div>
        )}

        {/* Last ping time */}
        {connectionHealth.lastPingTime > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Ultimo ping</span>
            <span className="text-xs text-muted-foreground">
              {new Date(connectionHealth.lastPingTime).toLocaleTimeString('it-IT', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
              })}
            </span>
          </div>
        )}
      </div>

      {/* Status message */}
      {connectionHealth.status === "error" && (
        <div className="mt-3 p-2 bg-white/5 border border-white/15 rounded">
          <p className="text-xs text-white/40">
            Errore di connessione. Riconnessione in corso...
          </p>
        </div>
      )}

      {connectionHealth.status === "connecting" && (
        <div className="mt-3 p-2 bg-white/8 border border-white/18 rounded">
          <p className="text-xs text-white/50">
            Connessione al server in corso...
          </p>
        </div>
      )}
    </div>
  );
}

// Compact indicator component for use in headers
export function ConnectionStatusIndicator({ 
  connectionHealth,
  compact = true,
  showLatency = false 
}: { 
  connectionHealth: ConnectionHealth;
  compact?: boolean;
  showLatency?: boolean;
}) {
  return (
    <ConnectionStatus
      connectionHealth={connectionHealth}
      compact={compact}
      showLatency={showLatency}
      showQueued={false}
    />
  );
}