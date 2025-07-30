"use client";

import { useState, useEffect } from "react";
import { 
  Bell, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  X,
  Users,
  ChefHat,
  Coffee,
  AlertCircle
} from "lucide-react";
import { getAllConsolidatedNotifications, ConsolidatedNotification } from "@/lib/services/notification-consolidator";

interface ConsolidatedNotificationPanelProps {
  userRole: string;
  userId?: string;
  onNotificationClick?: (notification: ConsolidatedNotification) => void;
}

export default function ConsolidatedNotificationPanel({ 
  userRole, 
  userId, 
  onNotificationClick 
}: ConsolidatedNotificationPanelProps) {
  const [notifications, setNotifications] = useState<ConsolidatedNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [acknowledgedIds, setAcknowledgedIds] = useState<Set<string>>(new Set());

  // Carica notifiche
  const loadNotifications = async () => {
    try {
      const result = await getAllConsolidatedNotifications(userRole, userId);
      setNotifications(result.filter(n => !acknowledgedIds.has(n.id)));
    } catch (error) {
      console.error("Errore caricamento notifiche:", error);
    }
  };

  // Auto refresh ogni 30 secondi
  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [userRole, userId, acknowledgedIds]);

  const acknowledgeNotification = (notificationId: string) => {
    setAcknowledgedIds(prev => new Set(prev).add(notificationId));
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  };

  const acknowledgeAll = () => {
    const allIds = notifications.map(n => n.id);
    setAcknowledgedIds(prev => new Set([...prev, ...allIds]));
    setNotifications([]);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-blue-500 text-white';
      case 'low': return 'bg-gray-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'table_status': return <Users className="h-4 w-4" />;
      case 'station_status': return <ChefHat className="h-4 w-4" />;
      case 'ready_items': return <CheckCircle className="h-4 w-4" />;
      case 'payment_request': return <AlertCircle className="h-4 w-4" />;
      default: return <Bell className="h-4 w-4" />;
    }
  };

  const urgentCount = notifications.filter(n => n.priority === 'urgent').length;
  const highCount = notifications.filter(n => n.priority === 'high').length;
  const totalCount = notifications.length;

  return (
    <div className="relative">
      {/* Notification Bell */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 rounded-lg transition-colors ${
          totalCount > 0 
            ? 'bg-red-100 text-red-600 hover:bg-red-200' 
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        <Bell className="h-5 w-5" />
        {totalCount > 0 && (
          <span className={`absolute -top-1 -right-1 min-w-[20px] h-5 rounded-full flex items-center justify-center text-xs font-bold ${
            urgentCount > 0 ? 'bg-red-600 text-white' :
            highCount > 0 ? 'bg-orange-500 text-white' :
            'bg-blue-500 text-white'
          }`}>
            {totalCount}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-96 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-[80vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-gray-600" />
              <h3 className="font-semibold">Notifiche</h3>
              <span className="text-sm text-gray-500">({totalCount})</span>
            </div>
            <div className="flex items-center gap-2">
              {totalCount > 0 && (
                <button
                  onClick={acknowledgeAll}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Segna tutte come lette
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Notifications List */}
          <div className="max-h-[60vh] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <CheckCircle className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                <p>Nessuna notifica</p>
              </div>
            ) : (
              <div className="divide-y">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => {
                      onNotificationClick?.(notification);
                      acknowledgeNotification(notification.id);
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1">
                        <div className={`p-1 rounded ${getPriorityColor(notification.priority)}`}>
                          {getTypeIcon(notification.type)}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-sm truncate">
                              {notification.title}
                            </h4>
                            {notification.priority === 'urgent' && (
                              <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
                            )}
                          </div>
                          
                          <p className="text-sm text-gray-600 line-clamp-2">
                            {notification.message}
                          </p>
                          
                          {/* Station Status Indicators */}
                          {notification.stationStatus && (
                            <div className="flex items-center gap-2 mt-2">
                              <div className="flex items-center gap-1 text-xs">
                                <Coffee className="h-3 w-3" />
                                <span className={`w-2 h-2 rounded-full ${
                                  notification.stationStatus.prepara === 'ready' ? 'bg-green-500' :
                                  notification.stationStatus.prepara === 'working' ? 'bg-yellow-500 animate-pulse' :
                                  'bg-gray-300'
                                }`} />
                                <span className="text-gray-500">Bar</span>
                              </div>
                              
                              <div className="flex items-center gap-1 text-xs">
                                <ChefHat className="h-3 w-3" />
                                <span className={`w-2 h-2 rounded-full ${
                                  notification.stationStatus.cucina === 'ready' ? 'bg-green-500' :
                                  notification.stationStatus.cucina === 'working' ? 'bg-yellow-500 animate-pulse' :
                                  'bg-gray-300'
                                }`} />
                                <span className="text-gray-500">Cucina</span>
                              </div>
                            </div>
                          )}
                          
                          {/* Items Ready */}
                          {notification.itemsReady && (
                            <div className="mt-2 text-xs text-gray-500">
                              {notification.itemsReady.count} prodotti pronti da {notification.itemsReady.station}
                            </div>
                          )}
                          
                          <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                            <Clock className="h-3 w-3" />
                            <span>{notification.timestamp.toLocaleTimeString()}</span>
                            {notification.tableNumber && (
                              <>
                                <span>•</span>
                                <span>Tavolo {notification.tableNumber}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          acknowledgeNotification(notification.id);
                        }}
                        className="p-1 hover:bg-gray-200 rounded flex-shrink-0"
                        title="Segna come letta"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {totalCount > 0 && (
            <div className="p-3 border-t bg-gray-50 text-center">
              <div className="flex items-center justify-center gap-4 text-xs text-gray-500">
                {urgentCount > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-red-500 rounded-full" />
                    {urgentCount} urgenti
                  </span>
                )}
                {highCount > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-orange-500 rounded-full" />
                    {highCount} prioritarie
                  </span>
                )}
                <button
                  onClick={loadNotifications}
                  className="text-blue-600 hover:text-blue-800"
                >
                  Aggiorna
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}