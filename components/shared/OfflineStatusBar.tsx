"use client";

import { useState } from "react";
import { 
  WifiOff, 
  Wifi, 
  CloudOff, 
  CloudUpload, 
  AlertCircle, 
  RefreshCw,
  CheckCircle,
  Clock,
  X,
  AlertTriangle
} from "lucide-react";
import { useOfflineManager, OfflineAction } from "@/lib/services/offline-manager";

export default function OfflineStatusBar() {
  const {
    isOnline,
    lastOnline,
    pendingActions,
    syncInProgress,
    conflicts,
    syncPendingActions,
    clearConflicts,
    retryFailedAction
  } = useOfflineManager();

  const [showDetails, setShowDetails] = useState(false);

  // Se online e nessuna azione in sospeso, non mostrare la barra
  if (isOnline && pendingActions.length === 0 && conflicts.length === 0) {
    return null;
  }

  const getStatusColor = () => {
    if (!isOnline) return 'bg-red-500';
    if (conflicts.length > 0) return 'bg-orange-500';
    if (pendingActions.length > 0) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStatusIcon = () => {
    if (!isOnline) return <WifiOff className="h-4 w-4" />;
    if (syncInProgress) return <RefreshCw className="h-4 w-4 animate-spin" />;
    if (conflicts.length > 0) return <AlertTriangle className="h-4 w-4" />;
    if (pendingActions.length > 0) return <CloudUpload className="h-4 w-4" />;
    return <Wifi className="h-4 w-4" />;
  };

  const getStatusMessage = () => {
    if (!isOnline) {
      const offlineTime = Math.floor((Date.now() - lastOnline.getTime()) / 60000);
      return `Modalità offline • ${offlineTime}m fa`;
    }
    if (conflicts.length > 0) {
      return `${conflicts.length} conflitti da risolvere`;
    }
    if (pendingActions.length > 0) {
      return `${pendingActions.length} azioni da sincronizzare`;
    }
    return 'Online';
  };

  const getActionTypeLabel = (type: string) => {
    switch (type) {
      case 'CREATE_ORDER': return 'Nuovo Ordine';
      case 'UPDATE_ORDER': return 'Aggiorna Ordine';
      case 'PROCESS_PAYMENT': return 'Pagamento';
      case 'UPDATE_STATUS': return 'Cambia Stato';
      default: return type;
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  return (
    <>
      {/* Status Bar */}
      <div 
        className={`fixed top-0 left-0 right-0 z-50 ${getStatusColor()} text-white shadow-lg transition-all duration-300`}
      >
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-3">
            {getStatusIcon()}
            <span className="text-sm font-medium">
              {getStatusMessage()}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Sync Button */}
            {isOnline && pendingActions.length > 0 && (
              <button
                onClick={() => syncPendingActions()}
                disabled={syncInProgress}
                className="flex items-center gap-1 px-3 py-1 bg-white bg-opacity-20 rounded text-xs hover:bg-opacity-30 transition-colors disabled:opacity-50"
              >
                <CloudUpload className="h-3 w-3" />
                {syncInProgress ? 'Sincronizzando...' : 'Sincronizza'}
              </button>
            )}
            
            {/* Details Button */}
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="px-3 py-1 bg-white bg-opacity-20 rounded text-xs hover:bg-opacity-30 transition-colors"
            >
              Dettagli
            </button>
          </div>
        </div>
      </div>

      {/* Spacer per evitare che il contenuto vada sotto la barra */}
      <div className="h-10" />

      {/* Details Panel */}
      {showDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-xl font-semibold">Stato Sincronizzazione</h3>
              <button
                onClick={() => setShowDetails(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[60vh] space-y-6">
              {/* Connection Status */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-3">
                  {isOnline ? (
                    <Wifi className="h-5 w-5 text-green-600" />
                  ) : (
                    <WifiOff className="h-5 w-5 text-red-600" />
                  )}
                  <div>
                    <div className="font-medium">
                      {isOnline ? 'Connesso' : 'Offline'}
                    </div>
                    {!isOnline && (
                      <div className="text-sm text-gray-600">
                        Ultima connessione: {lastOnline.toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>
                
                {!isOnline && (
                  <div className="text-sm text-gray-700 bg-yellow-50 border border-yellow-200 rounded p-3">
                    <AlertCircle className="h-4 w-4 inline mr-2 text-yellow-600" />
                    Le azioni vengono salvate localmente e saranno sincronizzate quando la connessione sarà ripristinata.
                  </div>
                )}
              </div>

              {/* Pending Actions */}
              {pendingActions.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium">Azioni in Sospeso ({pendingActions.length})</h4>
                    {isOnline && (
                      <button
                        onClick={() => syncPendingActions()}
                        disabled={syncInProgress}
                        className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                      >
                        <RefreshCw className={`h-3 w-3 ${syncInProgress ? 'animate-spin' : ''}`} />
                        Sincronizza Tutto
                      </button>
                    )}
                  </div>
                  
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {pendingActions.map((action: OfflineAction) => (
                      <div key={action.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-gray-500" />
                            <span className="font-medium text-sm">
                              {getActionTypeLabel(action.type)}
                            </span>
                            {action.critical && (
                              <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                                Critico
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-600 mt-1">
                            {formatTimestamp(action.timestamp)} • 
                            Retry: {action.retryCount}/{action.maxRetries}
                          </div>
                        </div>
                        
                        {isOnline && (
                          <button
                            onClick={() => retryFailedAction(action.id)}
                            className="text-blue-600 hover:text-blue-800 text-xs"
                          >
                            Riprova
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Conflicts */}
              {conflicts.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-orange-600">
                      Conflitti da Risolvere ({conflicts.length})
                    </h4>
                    <button
                      onClick={clearConflicts}
                      className="text-orange-600 hover:text-orange-800 text-sm"
                    >
                      Segna come Risolti
                    </button>
                  </div>
                  
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {conflicts.map((conflict: any, index: number) => (
                      <div key={index} className="p-3 bg-orange-50 border border-orange-200 rounded">
                        <div className="flex items-center gap-2 mb-1">
                          <AlertTriangle className="h-4 w-4 text-orange-600" />
                          <span className="font-medium text-sm">
                            {getActionTypeLabel(conflict.action.type)}
                          </span>
                        </div>
                        <div className="text-xs text-orange-700">
                          {conflict.error}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          {new Date(conflict.timestamp).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Success State */}
              {isOnline && pendingActions.length === 0 && conflicts.length === 0 && (
                <div className="text-center py-8">
                  <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-500" />
                  <h4 className="font-medium text-green-800 mb-2">Tutto Sincronizzato!</h4>
                  <p className="text-sm text-gray-600">
                    Tutte le azioni sono state sincronizzate con successo.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}