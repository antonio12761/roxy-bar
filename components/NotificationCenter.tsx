"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Bell, X, Check, Filter, Volume2, VolumeX } from "lucide-react";
import { EnhancedSSENotification, NotificationPriority } from "@/lib/types/notifications";
import { notificationManager } from "@/lib/notifications/NotificationManager";
import { useEnhancedSSE } from "@/hooks/useEnhancedSSE";
import { useAuthToken } from "@/hooks/useAuthToken";
import { useRouter } from "next/navigation";
import { subscribeToNotificationChanges, getNotificationSyncData } from "@/lib/utils/notification-sync";

interface NotificationCenterProps {
  userRole: string;
  maxNotifications?: number;
}

interface NotificationPreferences {
  enabledTypes: Set<string>;
  audioEnabled: boolean;
  audioVolume: number;
  retentionCount: number;
  priorityFilter: NotificationPriority[];
}

const defaultPreferences: NotificationPreferences = {
  enabledTypes: new Set(notificationManager.getAvailableTypes()),
  audioEnabled: true,
  audioVolume: 0.5,
  retentionCount: 50,
  priorityFilter: [
    NotificationPriority.LOW,
    NotificationPriority.NORMAL,
    NotificationPriority.HIGH,
    NotificationPriority.URGENT
  ]
};

export default function NotificationCenter({ 
  userRole, 
  maxNotifications = 50 
}: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<EnhancedSSENotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [readNotifications, setReadNotifications] = useState<Set<string>>(new Set());
  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences);
  const [showPreferences, setShowPreferences] = useState(false);
  const [filterType, setFilterType] = useState<string | null>(null);
  const [filterPriority, setFilterPriority] = useState<NotificationPriority | null>(null);

  // Get auth token and router
  const { token } = useAuthToken();
  const router = useRouter();
  
  // Use SSE hook to receive real-time notifications
  const sse = useEnhancedSSE({
    clientId: `notification_center_${Date.now()}`,
    userRole,
    token: token || undefined,
    onNotification: (notification) => {
      handleNewNotification(notification);
    }
  });

  // Load preferences from localStorage
  useEffect(() => {
    const savedPreferences = localStorage.getItem("notificationPreferences");
    if (savedPreferences) {
      const parsed = JSON.parse(savedPreferences);
      setPreferences({
        ...parsed,
        enabledTypes: new Set(parsed.enabledTypes)
      });
    }

    // Load initial notifications and read status from sync data
    const syncData = getNotificationSyncData();
    setNotifications(syncData.notifications);
    setReadNotifications(new Set(syncData.readNotifications));
  }, []);

  // Subscribe to notification changes from other components
  useEffect(() => {
    const unsubscribe = subscribeToNotificationChanges((syncData) => {
      setNotifications(syncData.notifications);
      setReadNotifications(new Set(syncData.readNotifications));
    });

    return unsubscribe;
  }, []);

  // Save preferences to localStorage
  useEffect(() => {
    localStorage.setItem("notificationPreferences", JSON.stringify({
      ...preferences,
      enabledTypes: Array.from(preferences.enabledTypes)
    }));
  }, [preferences]);

  // Save read notifications to localStorage
  useEffect(() => {
    localStorage.setItem("readNotifications", JSON.stringify(Array.from(readNotifications)));
  }, [readNotifications]);

  // Play notification sound based on priority
  const playNotificationSound = useCallback((priority: NotificationPriority) => {
    const audio = new Audio();
    switch (priority) {
      case NotificationPriority.URGENT:
        audio.src = "/sounds/urgent.mp3";
        break;
      case NotificationPriority.HIGH:
        audio.src = "/sounds/high.mp3";
        break;
      default:
        audio.src = "/sounds/normal.mp3";
    }
    audio.volume = preferences.audioVolume;
    audio.play().catch(() => {
      // Ignore audio play errors
    });
  }, [preferences.audioVolume]);

  // Handle new notification
  const handleNewNotification = useCallback((notification: EnhancedSSENotification) => {
    // Check if this notification type is enabled and for this role
    if (preferences.enabledTypes.has(notification.type) &&
        (!notification.targetRoles || notification.targetRoles.includes(userRole))) {
      
      // Add to notifications
      setNotifications(prev => {
        const updated = [notification, ...prev];
        return updated.slice(0, maxNotifications);
      });

      // Play sound if enabled
      if (preferences.audioEnabled && !readNotifications.has(notification.id)) {
        playNotificationSound(notification.priority);
      }
    }
  }, [preferences, userRole, readNotifications, maxNotifications, playNotificationSound]);

  // Update unread count and sync with localStorage
  useEffect(() => {
    const unread = notifications.filter(n => !readNotifications.has(n.id)).length;
    setUnreadCount(unread);
    
    // Store notifications and read status in localStorage for synchronization
    try {
      localStorage.setItem('notifications', JSON.stringify(notifications));
      localStorage.setItem('readNotifications', JSON.stringify(Array.from(readNotifications)));
      
      // Dispatch custom event to notify other components
      window.dispatchEvent(new CustomEvent('notificationCountChanged'));
    } catch (error) {
      console.error('Error syncing notifications to localStorage:', error);
    }
  }, [notifications, readNotifications]);

  // Mark notification as read
  const markAsRead = useCallback((notificationId: string) => {
    setReadNotifications(prev => new Set([...prev, notificationId]));
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(() => {
    const allIds = notifications.map(n => n.id);
    setReadNotifications(prev => new Set([...prev, ...allIds]));
  }, [notifications]);

  // Clear all notifications
  const clearAll = useCallback(() => {
    setNotifications([]);
    setReadNotifications(new Set());
    notificationManager.clearHistory();
  }, []);

  // Toggle notification type
  const toggleNotificationType = useCallback((type: string) => {
    setPreferences(prev => {
      const newEnabledTypes = new Set(prev.enabledTypes);
      if (newEnabledTypes.has(type)) {
        newEnabledTypes.delete(type);
      } else {
        newEnabledTypes.add(type);
      }
      return { ...prev, enabledTypes: newEnabledTypes };
    });
  }, []);

  // Get priority color
  const getPriorityColor = (priority: NotificationPriority) => {
    switch (priority) {
      case NotificationPriority.URGENT:
        return "text-red-600 bg-red-50";
      case NotificationPriority.HIGH:
        return "text-orange-600 bg-orange-50";
      case NotificationPriority.NORMAL:
        return "text-blue-600 bg-blue-50";
      case NotificationPriority.LOW:
        return "text-gray-600 bg-gray-50";
    }
  };

  // Get priority badge
  const getPriorityBadge = (priority: NotificationPriority) => {
    switch (priority) {
      case NotificationPriority.URGENT:
        return "URGENTE";
      case NotificationPriority.HIGH:
        return "ALTA";
      case NotificationPriority.NORMAL:
        return "NORMALE";
      case NotificationPriority.LOW:
        return "BASSA";
    }
  };

  // Filter notifications
  const filteredNotifications = notifications.filter(n => {
    if (filterType && n.type !== filterType) return false;
    if (filterPriority && n.priority !== filterPriority) return false;
    if (!preferences.priorityFilter.includes(n.priority)) return false;
    return true;
  });

  // Navigate to orders page based on user role
  const handleBellClick = () => {
    const orderRoutes = {
      'SUPERVISORE': '/supervisore',
      'CAMERIERE': '/cameriere/ordini-in-corso',
      'PREPARA': '/prepara',
      'BAR': '/prepara',
      'CUCINA': '/prepara',
      'CASSA': '/cassa'
    };
    
    const targetRoute = orderRoutes[userRole as keyof typeof orderRoutes] || '/gestione-ordini';
    router.push(targetRoute);
  };

  return (
    <>
      {/* Notification Bell */}
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative p-2 rounded-full hover:bg-gray-100 transition-colors"
        >
          <Bell size={24} />
          {unreadCount > 0 && (
            <span 
              onClick={(e) => {
                e.stopPropagation();
                handleBellClick();
              }}
              className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center cursor-pointer hover:bg-red-600 transition-colors"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Notification Panel */}
      {isOpen && (
        <div className="fixed right-4 top-16 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-[80vh] flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Notifiche</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowPreferences(!showPreferences)}
                  className="p-1 hover:bg-gray-100 rounded transition-colors"
                  title="Preferenze"
                >
                  <Filter size={20} />
                </button>
                <button
                  onClick={() => setPreferences(prev => ({ ...prev, audioEnabled: !prev.audioEnabled }))}
                  className="p-1 hover:bg-gray-100 rounded transition-colors"
                  title={preferences.audioEnabled ? "Disattiva audio" : "Attiva audio"}
                >
                  {preferences.audioEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-gray-100 rounded transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between mt-2">
              <span className="text-sm text-gray-600">
                {unreadCount} non lette di {filteredNotifications.length}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={markAllAsRead}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  Segna tutte come lette
                </button>
                <button
                  onClick={clearAll}
                  className="text-sm text-red-600 hover:text-red-700"
                >
                  Cancella tutto
                </button>
              </div>
            </div>
          </div>

          {/* Preferences Panel */}
          {showPreferences && (
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <h4 className="font-medium mb-2">Tipi di notifica</h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {notificationManager.getAvailableTypes().map(type => (
                  <label key={type} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.enabledTypes.has(type)}
                      onChange={() => toggleNotificationType(type)}
                      className="rounded"
                    />
                    <span className="text-sm">{type.replace(/_/g, " ")}</span>
                  </label>
                ))}
              </div>

              <h4 className="font-medium mt-4 mb-2">Volume notifiche</h4>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={preferences.audioVolume}
                onChange={(e) => setPreferences(prev => ({ 
                  ...prev, 
                  audioVolume: parseFloat(e.target.value) 
                }))}
                className="w-full"
              />

              <h4 className="font-medium mt-4 mb-2">Filtra per priorità</h4>
              <div className="flex gap-2">
                {[
                  NotificationPriority.LOW,
                  NotificationPriority.NORMAL,
                  NotificationPriority.HIGH,
                  NotificationPriority.URGENT
                ].map(priority => (
                  <button
                    key={priority}
                    onClick={() => setFilterPriority(filterPriority === priority ? null : priority)}
                    className={`px-2 py-1 text-xs rounded ${
                      filterPriority === priority
                        ? getPriorityColor(priority)
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {getPriorityBadge(priority)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Notifications List */}
          <div className="flex-1 overflow-y-auto">
            {filteredNotifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                Nessuna notifica
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {filteredNotifications.map(notification => (
                  <div
                    key={notification.id}
                    className={`p-4 hover:bg-gray-50 transition-colors cursor-pointer ${
                      !readNotifications.has(notification.id) ? "bg-blue-50" : ""
                    }`}
                    onClick={() => markAsRead(notification.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs px-2 py-1 rounded ${getPriorityColor(notification.priority)}`}>
                            {getPriorityBadge(notification.priority)}
                          </span>
                          <span className="text-xs text-gray-500">
                            {notification.type.replace(/_/g, " ")}
                          </span>
                        </div>
                        <p className="text-sm font-medium">{notification.message}</p>
                        {notification.data && (
                          <div className="text-xs text-gray-600 mt-1">
                            {notification.data.tableNumber && (
                              <span>Tavolo {notification.data.tableNumber} • </span>
                            )}
                            {notification.data.customerName && (
                              <span>Cliente: {notification.data.customerName} • </span>
                            )}
                            {notification.data.amount && (
                              <span>€{notification.data.amount.toFixed(2)}</span>
                            )}
                          </div>
                        )}
                        <span className="text-xs text-gray-400">
                          {new Date(notification.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      {!readNotifications.has(notification.id) && (
                        <div className="ml-2">
                          <div className="h-2 w-2 bg-white/10 rounded-full"></div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}