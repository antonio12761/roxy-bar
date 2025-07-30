"use client";

import { useState, useEffect } from "react";
import { 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  Clock, 
  AlertCircle,
  CheckCircle,
  Activity,
  Zap
} from "lucide-react";

interface ConnectionHealth {
  status: 'connected' | 'connecting' | 'disconnected';
  latency: number;
  lastActivity: Date;
  reconnectAttempts: number;
}

interface UpdateStats {
  totalUpdates: number;
  appliedUpdates: number;
  pendingCount: number;
}

interface RealTimeStatusIndicatorProps {
  connectionHealth: ConnectionHealth;
  updateStats: UpdateStats;
  hasPendingUpdates: boolean;
  lastUpdate: Date;
  onForceReload?: () => void;
  onApplyUpdates?: () => void;
  className?: string;
  showDetails?: boolean;
}

export default function RealTimeStatusIndicator({
  connectionHealth,
  updateStats,
  hasPendingUpdates,
  lastUpdate,
  onForceReload,
  onApplyUpdates,
  className = "",
  showDetails = true
}: RealTimeStatusIndicatorProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [timeSinceUpdate, setTimeSinceUpdate] = useState<string>("");

  // Aggiorna il tempo trascorso dall'ultimo aggiornamento
  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const diffMs = now.getTime() - lastUpdate.getTime();
      const diffMinutes = Math.floor(diffMs / 60000);
      const diffSeconds = Math.floor((diffMs % 60000) / 1000);
      
      if (diffMinutes > 0) {
        setTimeSinceUpdate(`${diffMinutes}m fa`);
      } else {
        setTimeSinceUpdate(`${diffSeconds}s fa`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    
    return () => clearInterval(interval);
  }, [lastUpdate]);

  const getConnectionIcon = () => {
    switch (connectionHealth.status) {
      case 'connected':
        return <Wifi className="h-4 w-4 text-green-600" />;
      case 'connecting':
        return <RefreshCw className="h-4 w-4 text-yellow-600 animate-spin" />;
      case 'disconnected':
        return <WifiOff className="h-4 w-4 text-red-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getConnectionColor = () => {
    switch (connectionHealth.status) {
      case 'connected':
        return connectionHealth.latency > 1000 ? 'text-yellow-600' : 'text-green-600';
      case 'connecting':
        return 'text-yellow-600';
      case 'disconnected':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getStatusMessage = () => {
    switch (connectionHealth.status) {
      case 'connected':
        return connectionHealth.latency > 1000 
          ? `Connesso (lento: ${connectionHealth.latency}ms)`
          : `Connesso (${connectionHealth.latency}ms)`;
      case 'connecting':
        return `Connessione... (tentativo ${connectionHealth.reconnectAttempts})`;
      case 'disconnected':
        return 'Disconnesso';
      default:
        return 'Stato sconosciuto';
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* Main Status Indicator */}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className={`flex items-center gap-2 p-2 rounded-lg transition-colors ${
          connectionHealth.status === 'connected' ? 'hover:bg-green-50' :
          connectionHealth.status === 'connecting' ? 'hover:bg-yellow-50' :
          'hover:bg-red-50'
        }`}
        title={getStatusMessage()}
      >
        {getConnectionIcon()}
        
        {/* Pending Updates Badge */}
        {hasPendingUpdates && (
          <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full animate-pulse">
            {updateStats.pendingCount}
          </span>
        )}
        
        {showDetails && (
          <span className={`text-sm ${getConnectionColor()}`}>
            {connectionHealth.latency}ms
          </span>
        )}
      </button>

      {/* Dropdown Details */}
      {showDropdown && (
        <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          {/* Header */}
          <div className="p-4 border-b">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Stato Real-Time</h3>
              <button
                onClick={() => setShowDropdown(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Connection Status */}
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getConnectionIcon()}
                <span className="text-sm font-medium">Connessione</span>
              </div>
              <span className={`text-sm ${getConnectionColor()}`}>
                {getStatusMessage()}
              </span>
            </div>

            {/* Update Statistics */}
            <div className="bg-gray-50 rounded p-3 space-y-2">
              <div className="text-sm font-medium text-gray-700">Statistiche Aggiornamenti</div>
              
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="text-center">
                  <div className="font-bold text-blue-600">{updateStats.totalUpdates}</div>
                  <div className="text-gray-500">Totali</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-green-600">{updateStats.appliedUpdates}</div>
                  <div className="text-gray-500">Applicati</div>
                </div>
                <div className="text-center">
                  <div className={`font-bold ${
                    updateStats.pendingCount > 0 ? 'text-yellow-600' : 'text-gray-600'
                  }`}>
                    {updateStats.pendingCount}
                  </div>
                  <div className="text-gray-500">In coda</div>
                </div>
              </div>
            </div>

            {/* Last Update Time */}
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-1 text-gray-600">
                <Clock className="h-3 w-3" />
                <span>Ultimo aggiornamento</span>
              </div>
              <span className="text-gray-500">{timeSinceUpdate}</span>
            </div>

            {/* Pending Updates Warning */}
            {hasPendingUpdates && (
              <div className="bg-blue-50 border border-blue-200 rounded p-3">
                <div className="flex items-center gap-2 text-blue-800 text-sm">
                  <Activity className="h-4 w-4" />
                  <span>Aggiornamenti in sospeso</span>
                </div>
                <div className="text-xs text-blue-600 mt-1">
                  {updateStats.pendingCount} aggiornamenti verranno applicati automaticamente
                </div>
              </div>
            )}

            {/* Connection Issues */}
            {connectionHealth.status === 'disconnected' && (
              <div className="bg-red-50 border border-red-200 rounded p-3">
                <div className="flex items-center gap-2 text-red-800 text-sm">
                  <AlertCircle className="h-4 w-4" />
                  <span>Connessione persa</span>
                </div>
                <div className="text-xs text-red-600 mt-1">
                  I dati potrebbero non essere aggiornati. Tentativo di riconnessione in corso...
                </div>
              </div>
            )}

            {connectionHealth.latency > 1000 && connectionHealth.status === 'connected' && (
              <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                <div className="flex items-center gap-2 text-yellow-800 text-sm">
                  <Zap className="h-4 w-4" />
                  <span>Connessione lenta</span>
                </div>
                <div className="text-xs text-yellow-600 mt-1">
                  Latenza elevata ({connectionHealth.latency}ms). Gli aggiornamenti potrebbero arrivare in ritardo.
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="p-4 border-t bg-gray-50 space-y-2">
            {hasPendingUpdates && onApplyUpdates && (
              <button
                onClick={() => {
                  onApplyUpdates();
                  setShowDropdown(false);
                }}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
              >
                <CheckCircle className="h-4 w-4" />
                Applica Aggiornamenti ({updateStats.pendingCount})
              </button>
            )}
            
            {onForceReload && (
              <button
                onClick={() => {
                  onForceReload();
                  setShowDropdown(false);
                }}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors text-sm"
              >
                <RefreshCw className="h-4 w-4" />
                Ricarica Dati
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}