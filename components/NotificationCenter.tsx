"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { Bell, X, Check, Volume2, VolumeX, Trash2, Settings, UserCheck } from "lucide-react";
import { EnhancedSSENotification, NotificationPriority, NotificationTypes } from "@/lib/types/notifications";
import { useSSE } from "@/contexts/sse-context";
import { useRouter } from "next/navigation";
import { subscribeToNotificationChanges, getNotificationSyncData } from "@/lib/utils/notification-sync";
import { useTheme } from "@/contexts/ThemeContext";
import { takeChargeOfOutOfStockOrder } from "@/lib/actions/esaurito-handling";
import { toast } from "@/lib/toast";

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

// Default notification types
const defaultNotificationTypes = [
  NotificationTypes.ORDER_UPDATE,
  NotificationTypes.NEW_ORDER,
  NotificationTypes.ORDER_READY,
  NotificationTypes.ORDER_DELIVERED,
  NotificationTypes.ORDER_OUT_OF_STOCK,
  NotificationTypes.ORDER_FAILED,
  NotificationTypes.PAYMENT_REQUEST,
  NotificationTypes.PAYMENT_COMPLETED
];

const defaultPreferences: NotificationPreferences = {
  enabledTypes: new Set(defaultNotificationTypes),
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

// Simple notification sound as data URL (works offline in PWA)
const NOTIFICATION_SOUND = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSl+0fPTgjMGHm7A7+OZURE';

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
  const [mounted, setMounted] = useState(false);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [processingAction, setProcessingAction] = useState<string | null>(null);
  
  const router = useRouter();
  const sseContext = useSSE();
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode as keyof typeof currentTheme.colors];
  const isUpdatingRef = useRef(false);
  const audioBuffersRef = useRef<{ [key: string]: AudioBuffer }>({});
  const subscribedRef = useRef(false);
  const lastUpdateRef = useRef<{[key: string]: number}>({});

  // Initialize audio context (required for PWA)
  const initializeAudioContext = useCallback(() => {
    if (!audioContext) {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioContextClass();
        setAudioContext(ctx);
        
        // Resume context if it's suspended (common in mobile browsers)
        if (ctx.state === 'suspended') {
          ctx.resume();
        }
        
        setAudioEnabled(true);
        localStorage.setItem('notificationAudioEnabled', 'true');
        
        // Preload notification sound from data URL (works offline)
        fetch(NOTIFICATION_SOUND)
          .then(response => response.arrayBuffer())
          .then(data => ctx.decodeAudioData(data))
          .then(buffer => {
            audioBuffersRef.current['notification'] = buffer;
            // Play a very quiet test sound to "unlock" audio in PWA
            const source = ctx.createBufferSource();
            const gainNode = ctx.createGain();
            source.buffer = buffer;
            gainNode.gain.value = 0.01; // Very quiet
            source.connect(gainNode);
            gainNode.connect(ctx.destination);
            source.start(0);
          })
          .catch(err => console.error('Error loading notification sound:', err));
        
        return ctx;
      } catch (err) {
        console.error('Error initializing audio context:', err);
        return null;
      }
    }
    return audioContext;
  }, [audioContext]);

  // Ensure component is mounted before using portal
  useEffect(() => {
    setMounted(true);
    
    // Check if audio was previously enabled
    const savedAudioEnabled = localStorage.getItem('notificationAudioEnabled');
    if (savedAudioEnabled === 'true') {
      setAudioEnabled(true);
    }
  }, []);

  // Apply blur effect when modal is open
  useEffect(() => {
    if (isOpen) {
      const rootElement = document.getElementById('__next') || document.querySelector('body > div:first-child');
      if (rootElement) {
        rootElement.style.filter = 'blur(4px)';
        rootElement.style.transition = 'filter 0.3s ease-in-out';
      }
      document.body.style.overflow = 'hidden';
      
      // Try to initialize audio context when modal opens (for better PWA experience)
      if (!audioContext && preferences.audioEnabled) {
        initializeAudioContext();
      }
    } else {
      const rootElement = document.getElementById('__next') || document.querySelector('body > div:first-child');
      if (rootElement) {
        rootElement.style.filter = '';
      }
      document.body.style.overflow = '';
    }

    return () => {
      const rootElement = document.getElementById('__next') || document.querySelector('body > div:first-child');
      if (rootElement) {
        rootElement.style.filter = '';
      }
      document.body.style.overflow = '';
    };
  }, [isOpen, audioContext, preferences.audioEnabled, initializeAudioContext]);
  
  // Cleanup audio context on unmount
  useEffect(() => {
    return () => {
      if (audioContext) {
        audioContext.close();
      }
    };
  }, [audioContext]);

  // Play notification sound (PWA compatible)
  const playNotificationSound = useCallback((priority: NotificationPriority) => {
    if (!preferences.audioEnabled || !audioEnabled) return;
    
    // Try Web Audio API first (better for PWA)
    if (audioContext && audioBuffersRef.current['notification']) {
      try {
        const source = audioContext.createBufferSource();
        const gainNode = audioContext.createGain();
        
        source.buffer = audioBuffersRef.current['notification'];
        gainNode.gain.value = preferences.audioVolume;
        
        source.connect(gainNode);
        gainNode.connect(audioContext.destination);
        source.start(0);
      } catch (err) {
        console.error('Error playing sound with Web Audio API:', err);
        // Fallback to HTML5 Audio
        try {
          const audio = new Audio(NOTIFICATION_SOUND);
          audio.volume = preferences.audioVolume;
          audio.play().catch(() => {});
        } catch (e) {
          console.error('Error playing sound with HTML5 Audio:', e);
        }
      }
    } else {
      // Fallback to HTML5 Audio
      try {
        const audio = new Audio(NOTIFICATION_SOUND);
        audio.volume = preferences.audioVolume;
        audio.play().catch(() => {});
      } catch (err) {
        console.error('Error playing sound:', err);
      }
    }
  }, [preferences.audioEnabled, preferences.audioVolume, audioEnabled, audioContext]);

  // Handle new notification
  const handleNewNotification = useCallback((notification: EnhancedSSENotification) => {
    if (preferences.enabledTypes.has(notification.type) &&
        (!notification.targetRoles || notification.targetRoles.includes(userRole))) {
      
      setNotifications(prev => {
        const exists = prev.some(n => n.id === notification.id);
        if (exists) return prev;
        const updated = [notification, ...prev];
        return updated.slice(0, maxNotifications);
      });

      if (!readNotifications.has(notification.id)) {
        playNotificationSound(notification.priority);
      }
    }
  }, [preferences.enabledTypes, userRole, readNotifications, maxNotifications, playNotificationSound]);

  // Load initial data
  useEffect(() => {
    const savedPreferences = localStorage.getItem("notificationPreferences");
    if (savedPreferences) {
      const parsed = JSON.parse(savedPreferences);
      setPreferences({
        ...parsed,
        enabledTypes: new Set(parsed.enabledTypes)
      });
    }

    const syncData = getNotificationSyncData();
    setNotifications(syncData.notifications);
    setReadNotifications(new Set(syncData.readNotifications));
  }, []);

  // Subscribe to ALL SSE events directly here using subscribedRef pattern from bibbi-sse.md
  useEffect(() => {
    // Follow EXACT pattern from bibbi-sse.md line 290
    if (!sseContext?.subscribe || subscribedRef.current) {
      return; // Avoid duplicate subscriptions
    }
    
    subscribedRef.current = true;
    
    // Subscribe to notification:new event
    const unsubNotification = sseContext.subscribe('notification:new', (data: any) => {
      
      const notification = data as EnhancedSSENotification;
      
      // Deduplication
      const key = `${notification.id}-${notification.type}`;
      const now = Date.now();
      if (lastUpdateRef.current[key] && (now - lastUpdateRef.current[key] < 3000)) {
        return;
      }
      lastUpdateRef.current[key] = now;
      
      // Add notification IMMEDIATELY
      setNotifications(prev => {
        const exists = prev.some(n => n.id === notification.id);
        if (exists) return prev;
        const updated = [notification, ...prev];
        return updated.slice(0, maxNotifications);
      });
      
      // Play sound asynchronously to not block state update
      requestAnimationFrame(() => {
        playNotificationSound(notification.priority);
      });
    });
    
    // Subscribe to product availability updates
    const unsubAvailability = sseContext.subscribe('product:availability', (data: any) => {
      
      // Deduplication for product availability
      const key = `${data.productId}-${data.available}`;
      const now = Date.now();
      
      if (lastUpdateRef.current[key] && (now - lastUpdateRef.current[key] < 3000)) {
        return; // Ignore duplicates within 3 seconds
      }
      
      lastUpdateRef.current[key] = now;
      
      const notification: EnhancedSSENotification = {
        id: `prod-${data.productId}-${Date.now()}`,
        type: data.available ? NotificationTypes.ORDER_UPDATE : NotificationTypes.ORDER_OUT_OF_STOCK,
        message: data.available 
          ? `✅ ${data.productName} è ora DISPONIBILE`
          : `⚠️ ${data.productName} è ESAURITO`,
        priority: data.available ? NotificationPriority.NORMAL : NotificationPriority.HIGH,
        timestamp: new Date().toISOString(),
        data: {
          productId: data.productId,
          productName: data.productName,
          available: data.available,
          updatedBy: data.updatedBy
        },
        targetRoles: ['CAMERIERE'],
        syncVersion: Date.now()
      };
      
      // Add notification IMMEDIATELY
      setNotifications(prev => {
        const exists = prev.some(n => n.id === notification.id);
        if (exists) return prev;
        const updated = [notification, ...prev];
        return updated.slice(0, maxNotifications);
      });
      
      // Play sound asynchronously to not block state update
      requestAnimationFrame(() => {
        playNotificationSound(notification.priority);
      });
    });
    
    // Subscribe to out-of-stock events
    const unsubOutOfStock = sseContext.subscribe('order:out-of-stock', (data: any) => {
      
      // Deduplication for out-of-stock
      const key = `out-stock-${data.originalOrderId}`;
      const now = Date.now();
      
      if (lastUpdateRef.current[key] && (now - lastUpdateRef.current[key] < 3000)) {
        return; // Ignore duplicates within 3 seconds
      }
      
      lastUpdateRef.current[key] = now;
      
      const notification: EnhancedSSENotification = {
        id: `out-stock-${data.originalOrderId}-${Date.now()}`,
        type: NotificationTypes.ORDER_OUT_OF_STOCK,
        message: `🚫 ${data.outOfStockProduct} esaurito! Ordine #${data.originalOrderNumber}`,
        priority: NotificationPriority.URGENT,
        timestamp: new Date().toISOString(),
        data: {
          ...data,
          tableNumber: data.tableNumber
        },
        targetRoles: ['CAMERIERE'],
        syncVersion: Date.now()
      };
      
      // Add notification IMMEDIATELY
      setNotifications(prev => {
        const exists = prev.some(n => n.id === notification.id);
        if (exists) return prev;
        const updated = [notification, ...prev];
        return updated.slice(0, maxNotifications);
      });
      
      // Play sound asynchronously to not block state update
      requestAnimationFrame(() => {
        playNotificationSound(notification.priority);
      });
    });
    
    // Subscribe to order updates
    const unsubOrderUpdate = sseContext.subscribe('order:update', (data: any) => {
      
      // Deduplication for order updates
      const key = `order-update-${data.orderId || data.id}`;
      const now = Date.now();
      
      if (lastUpdateRef.current[key] && (now - lastUpdateRef.current[key] < 3000)) {
        return; // Ignore duplicates within 3 seconds
      }
      
      lastUpdateRef.current[key] = now;
      
      const notification: EnhancedSSENotification = {
        id: `order-update-${data.orderId || data.id}-${Date.now()}`,
        type: NotificationTypes.ORDER_UPDATE,
        message: `📝 Ordine #${data.orderNumber || data.orderId || data.id} aggiornato`,
        priority: NotificationPriority.NORMAL,
        timestamp: new Date().toISOString(),
        data: data,
        targetRoles: ['CAMERIERE'],
        syncVersion: Date.now()
      };
      
      // Add notification IMMEDIATELY
      setNotifications(prev => {
        const exists = prev.some(n => n.id === notification.id);
        if (exists) return prev;
        const updated = [notification, ...prev];
        return updated.slice(0, maxNotifications);
      });
      
      // Play sound asynchronously to not block state update
      requestAnimationFrame(() => {
        playNotificationSound(notification.priority);
      });
    });
    
    // Subscribe to order ready
    const unsubOrderReady = sseContext.subscribe('order:ready', (data: any) => {
      
      // Deduplication for order ready
      const key = `order-ready-${data.orderId || data.id}`;
      const now = Date.now();
      
      if (lastUpdateRef.current[key] && (now - lastUpdateRef.current[key] < 3000)) {
        return; // Ignore duplicates within 3 seconds
      }
      
      lastUpdateRef.current[key] = now;
      
      const notification: EnhancedSSENotification = {
        id: `order-ready-${data.orderId || data.id}-${Date.now()}`,
        type: NotificationTypes.ORDER_READY,
        message: `✨ Ordine #${data.orderNumber || data.id} PRONTO!`,
        priority: NotificationPriority.HIGH,
        timestamp: new Date().toISOString(),
        data: data,
        targetRoles: ['CAMERIERE'],
        syncVersion: Date.now()
      };
      
      // Add notification IMMEDIATELY
      setNotifications(prev => {
        const exists = prev.some(n => n.id === notification.id);
        if (exists) return prev;
        const updated = [notification, ...prev];
        return updated.slice(0, maxNotifications);
      });
      
      // Play sound asynchronously to not block state update
      requestAnimationFrame(() => {
        playNotificationSound(notification.priority);
      });
    });
    
    // Subscribe to esaurito alert events
    const unsubEsauritoAlert = sseContext.subscribe('order:esaurito:alert', (data: any) => {
      console.log('[NotificationCenter] Received order:esaurito:alert event:', data);
      
      const key = `esaurito-alert-${data.orderId}`;
      const now = Date.now();
      
      if (lastUpdateRef.current[key] && (now - lastUpdateRef.current[key] < 3000)) {
        console.log('[NotificationCenter] Ignoring duplicate esaurito alert for order:', data.orderId);
        return;
      }
      
      lastUpdateRef.current[key] = now;
      
      const notification: EnhancedSSENotification = {
        id: `esaurito-alert-${data.orderId}-${Date.now()}`,
        type: NotificationTypes.ORDER_OUT_OF_STOCK,
        message: `⚠️ ESAURITO: Ordine #${data.orderNumber} Tavolo ${data.tableNumber}`,
        priority: NotificationPriority.URGENT,
        timestamp: new Date().toISOString(),
        data: {
          ...data,
          isEsauritoAlert: true,
          needsAction: !data.takenBy
        },
        targetRoles: ['CAMERIERE', 'PREPARA'],
        syncVersion: Date.now()
      };
      
      console.log('[NotificationCenter] Creating esaurito notification:', notification);
      
      setNotifications(prev => {
        const exists = prev.some(n => n.id === notification.id);
        if (exists) {
          console.log('[NotificationCenter] Esaurito notification already exists:', notification.id);
          return prev;
        }
        const updated = [notification, ...prev];
        console.log('[NotificationCenter] Added esaurito notification. Total notifications:', updated.length);
        return updated.slice(0, maxNotifications);
      });
      
      // Play sound immediately for urgent notifications
      playNotificationSound(notification.priority);
      
      // Also show a toast notification for urgent esaurito alerts
      if (userRole === 'CAMERIERE') {
        toast.error(`⚠️ Ordine #${data.orderNumber} - Prodotti esauriti!`, {
          duration: 10000
        });
      }
    });
    
    // Subscribe to esaurito taken events
    const unsubEsauritoTaken = sseContext.subscribe('order:esaurito:taken', (data: any) => {
      const key = `esaurito-taken-${data.orderId}`;
      const now = Date.now();
      
      if (lastUpdateRef.current[key] && (now - lastUpdateRef.current[key] < 3000)) {
        return;
      }
      
      lastUpdateRef.current[key] = now;
      
      // Update existing esaurito notification
      setNotifications(prev => prev.map(n => {
        if (n.data?.orderId === data.orderId && n.data?.isEsauritoAlert) {
          return {
            ...n,
            data: {
              ...n.data,
              takenBy: data.takenBy,
              takenById: data.takenById,
              needsAction: false
            }
          };
        }
        return n;
      }));
      
      // Add info notification about who took charge
      const notification: EnhancedSSENotification = {
        id: `esaurito-taken-${data.orderId}-${Date.now()}`,
        type: NotificationTypes.ORDER_UPDATE,
        message: `✅ ${data.takenBy} sta gestendo l'ordine #${data.orderNumber}`,
        priority: NotificationPriority.NORMAL,
        timestamp: new Date().toISOString(),
        data: data,
        targetRoles: ['CAMERIERE', 'PREPARA'],
        syncVersion: Date.now()
      };
      
      setNotifications(prev => {
        const exists = prev.some(n => n.id === notification.id);
        if (exists) return prev;
        const updated = [notification, ...prev];
        return updated.slice(0, maxNotifications);
      });
    });
    
    // Subscribe to order delivered
    const unsubOrderDelivered = sseContext.subscribe('order:delivered', (data: any) => {
      
      // Deduplication for order delivered
      const key = `order-delivered-${data.orderId || data.id}`;
      const now = Date.now();
      
      if (lastUpdateRef.current[key] && (now - lastUpdateRef.current[key] < 3000)) {
        return; // Ignore duplicates within 3 seconds
      }
      
      lastUpdateRef.current[key] = now;
      
      const notification: EnhancedSSENotification = {
        id: `order-delivered-${data.orderId || data.id}-${Date.now()}`,
        type: NotificationTypes.ORDER_DELIVERED,
        message: `✓ Ordine #${data.orderNumber || data.orderId || data.id} consegnato${data.deliveredBy ? ` da ${data.deliveredBy}` : ''}`,
        priority: NotificationPriority.LOW,
        timestamp: new Date().toISOString(),
        data: data,
        targetRoles: ['CAMERIERE'],
        syncVersion: Date.now()
      };
      
      // Add notification IMMEDIATELY
      setNotifications(prev => {
        const exists = prev.some(n => n.id === notification.id);
        if (exists) return prev;
        const updated = [notification, ...prev];
        return updated.slice(0, maxNotifications);
      });
      
      // Play sound asynchronously to not block state update
      requestAnimationFrame(() => {
        playNotificationSound(notification.priority);
      });
    });
    
    // All subscriptions are now active
    
    return () => {
      subscribedRef.current = false;
      unsubNotification();
      unsubAvailability();
      unsubOutOfStock();
      unsubOrderUpdate();
      unsubOrderReady();
      unsubOrderDelivered();
      unsubEsauritoAlert();
      unsubEsauritoTaken();
    };
  }, [sseContext]); // Stable dependency only - no handleNewNotification or other callbacks

  // Update unread count
  useEffect(() => {
    const unread = notifications.filter(n => !readNotifications.has(n.id)).length;
    setUnreadCount(unread);
  }, [notifications, readNotifications]);

  // Mark as read
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
    localStorage.removeItem('notifications');
    localStorage.removeItem('readNotifications');
  }, []);

  // Get priority badge styles
  const getPriorityStyles = (priority: NotificationPriority) => {
    switch (priority) {
      case NotificationPriority.URGENT:
        return {
          backgroundColor: `${colors.button.danger}20`,
          color: colors.button.danger,
          label: 'URGENTE'
        };
      case NotificationPriority.HIGH:
        return {
          backgroundColor: `${colors.text.accent}20`,
          color: colors.text.accent,
          label: 'ALTA'
        };
      case NotificationPriority.NORMAL:
        return {
          backgroundColor: `${colors.button.primary}20`,
          color: colors.button.primary,
          label: 'NORMALE'
        };
      case NotificationPriority.LOW:
        return {
          backgroundColor: colors.bg.hover,
          color: colors.text.muted,
          label: 'BASSA'
        };
    }
  };

  // Modal content
  const modalContent = (
    <div 
      className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[9999] animate-in fade-in duration-300"
      onClick={() => setIsOpen(false)}
    >
      <div className="flex items-center justify-center min-h-screen p-4">
        <div 
          className="bg-white rounded-lg shadow-2xl w-full max-w-lg animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
          style={{ 
            backgroundColor: colors.bg.card,
            border: `1px solid ${colors.border.primary}`,
            maxHeight: '85vh'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: colors.border.secondary }}>
            <div>
              <h2 className="text-lg font-semibold" style={{ color: colors.text.primary }}>
                Notifiche
              </h2>
              <p className="text-sm mt-1" style={{ color: colors.text.secondary }}>
                {unreadCount} non lette · {notifications.length} totali
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowPreferences(!showPreferences)}
                className="p-2 rounded-lg transition-colors"
                style={{ 
                  backgroundColor: showPreferences ? colors.bg.hover : 'transparent',
                  color: showPreferences ? colors.button.primary : colors.text.secondary
                }}
                title="Impostazioni"
              >
                <Settings size={18} />
              </button>
              <button
                onClick={() => {
                  // Initialize audio context on first user interaction (required for PWA)
                  if (!audioContext && !preferences.audioEnabled) {
                    initializeAudioContext();
                  }
                  setPreferences(prev => ({ ...prev, audioEnabled: !prev.audioEnabled }));
                }}
                className="p-2 rounded-lg transition-colors"
                style={{ 
                  backgroundColor: 'transparent',
                  color: preferences.audioEnabled && audioEnabled ? colors.button.primary : colors.text.muted
                }}
                title={preferences.audioEnabled && audioEnabled ? "Audio attivo" : "Audio disattivato"}
              >
                {preferences.audioEnabled && audioEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
              </button>
              <button
                onClick={markAllAsRead}
                className="p-2 rounded-lg transition-colors"
                style={{ 
                  backgroundColor: 'transparent',
                  color: colors.button.primary
                }}
                title="Segna tutte come lette"
              >
                <Check size={18} />
              </button>
              <button
                onClick={clearAll}
                className="p-2 rounded-lg transition-colors"
                style={{ 
                  backgroundColor: 'transparent',
                  color: colors.button.danger
                }}
                title="Cancella tutte"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>

          {/* Preferences Panel */}
          {showPreferences && (
            <div className="p-4 border-b" style={{ 
              borderColor: colors.border.secondary,
              backgroundColor: colors.bg.hover 
            }}>
              <div className="mb-3">
                <h3 className="text-sm font-medium mb-2" style={{ color: colors.text.primary }}>
                  Tipi di notifica
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {defaultNotificationTypes.map(type => (
                    <label key={type} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preferences.enabledTypes.has(type)}
                        onChange={() => {
                          const newTypes = new Set(preferences.enabledTypes);
                          if (newTypes.has(type)) {
                            newTypes.delete(type);
                          } else {
                            newTypes.add(type);
                          }
                          setPreferences(prev => ({ ...prev, enabledTypes: newTypes }));
                        }}
                        className="rounded"
                        style={{ accentColor: colors.button.primary }}
                      />
                      <span className="text-xs" style={{ color: colors.text.secondary }}>
                        {type.replace(/_/g, " ").toLowerCase()}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              
              <div>
                <h3 className="text-sm font-medium mb-2" style={{ color: colors.text.primary }}>
                  Volume notifiche: {Math.round(preferences.audioVolume * 100)}%
                  {audioEnabled && audioContext && (
                    <span className="ml-2 text-xs" style={{ color: colors.button.success }}>
                      (Audio attivo)
                    </span>
                  )}
                </h3>
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
                  style={{ accentColor: colors.button.primary }}
                />
              </div>
            </div>
          )}

          {/* Notifications List */}
          <div className="overflow-y-auto" style={{ maxHeight: '60vh' }}>
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4">
                <Bell size={48} style={{ color: colors.text.muted, opacity: 0.3 }} />
                <p className="mt-3 text-center" style={{ color: colors.text.muted }}>
                  Nessuna notifica
                </p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: colors.border.secondary }}>
                {notifications.map(notification => {
                  const isUnread = !readNotifications.has(notification.id);
                  const priorityStyle = getPriorityStyles(notification.priority);
                  
                  return (
                    <div
                      key={notification.id}
                      className="p-4 cursor-pointer transition-colors relative"
                      style={{
                        backgroundColor: isUnread ? `${colors.button.primary}08` : 'transparent'
                      }}
                      onClick={() => markAsRead(notification.id)}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = colors.bg.hover;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = isUnread ? `${colors.button.primary}08` : 'transparent';
                      }}
                    >
                      {isUnread && (
                        <div 
                          className="absolute left-0 top-0 bottom-0 w-1"
                          style={{ backgroundColor: colors.button.primary }}
                        />
                      )}
                      
                      <div className="pl-2">
                        <div className="flex items-center gap-2 mb-1">
                          <span 
                            className="text-xs px-2 py-0.5 rounded font-medium"
                            style={priorityStyle}
                          >
                            {priorityStyle.label}
                          </span>
                          <span className="text-xs" style={{ color: colors.text.muted }}>
                            {new Date(notification.timestamp).toLocaleTimeString('it-IT', { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </span>
                        </div>
                        
                        <p className="text-sm font-medium mb-1" style={{ color: colors.text.primary }}>
                          {notification.message}
                        </p>
                        
                        {notification.data && (
                          <div>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {notification.data.tableNumber && (
                                <span className="text-xs px-2 py-1 rounded" style={{
                                  backgroundColor: colors.bg.hover,
                                  color: colors.text.secondary
                                }}>
                                  Tavolo {notification.data.tableNumber}
                                </span>
                              )}
                              {notification.data.customerName && (
                                <span className="text-xs px-2 py-1 rounded" style={{
                                  backgroundColor: colors.bg.hover,
                                  color: colors.text.secondary
                                }}>
                                  {notification.data.customerName}
                                </span>
                              )}
                              {notification.data.amount && (
                                <span className="text-xs px-2 py-1 rounded font-medium" style={{
                                  backgroundColor: `${colors.button.success}20`,
                                  color: colors.button.success
                                }}>
                                  €{notification.data.amount.toFixed(2)}
                                </span>
                              )}
                            </div>
                            
                            {/* Esaurito products list */}
                            {notification.data.isEsauritoAlert && notification.data.products && (
                              <div className="mt-2 text-xs" style={{ color: colors.text.secondary }}>
                                <p className="font-semibold mb-1">Prodotti esauriti:</p>
                                {notification.data.products.map((p: any, idx: number) => (
                                  <p key={idx}>• {p.quantity}x {p.name}</p>
                                ))}
                              </div>
                            )}
                            
                            {/* Action button for esaurito orders */}
                            {notification.data.isEsauritoAlert && notification.data.needsAction && userRole === 'CAMERIERE' && (
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (processingAction === notification.data.orderId) return;
                                  
                                  setProcessingAction(notification.data.orderId);
                                  try {
                                    const result = await takeChargeOfOutOfStockOrder(notification.data.orderId);
                                    if (result.success) {
                                      toast.success('Hai preso in carico l\'ordine');
                                    } else {
                                      toast.error(result.error || 'Errore nella presa in carico');
                                    }
                                  } catch (error) {
                                    toast.error('Errore imprevisto');
                                  } finally {
                                    setProcessingAction(null);
                                  }
                                }}
                                disabled={processingAction === notification.data.orderId}
                                className="mt-3 w-full py-2 px-3 rounded-lg font-semibold text-sm transition-colors"
                                style={{
                                  backgroundColor: processingAction === notification.data.orderId ? colors.bg.hover : colors.button.danger,
                                  color: processingAction === notification.data.orderId ? colors.text.muted : colors.button.dangerText,
                                  cursor: processingAction === notification.data.orderId ? 'not-allowed' : 'pointer'
                                }}
                              >
                                {processingAction === notification.data.orderId ? 'Presa in carico...' : 'Gestisco io'}
                              </button>
                            )}
                            
                            {/* Show who took charge */}
                            {notification.data.isEsauritoAlert && notification.data.takenBy && (
                              <div className="mt-2 flex items-center gap-2 text-xs p-2 rounded" style={{
                                backgroundColor: `${colors.button.primary}10`,
                                color: colors.button.primary
                              }}>
                                <UserCheck size={14} />
                                <span>{notification.data.takenBy} sta gestendo questo ordine</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t" style={{ borderColor: colors.border.secondary }}>
            <button
              onClick={() => setIsOpen(false)}
              className="w-full py-2 rounded-lg transition-colors"
              style={{ 
                backgroundColor: colors.bg.hover,
                color: colors.text.primary
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = colors.bg.darker;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = colors.bg.hover;
              }}
            >
              Chiudi
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Bell Button */}
      <div className="relative">
        <button
          onClick={() => setIsOpen(true)}
          className="relative p-2 rounded-lg transition-all duration-200"
          style={{
            backgroundColor: 'transparent',
            color: colors.text.primary
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = colors.bg.hover;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <Bell size={20} />
          {unreadCount > 0 && (
            <span 
              className="absolute -top-1 -right-1 text-xs rounded-full h-5 w-5 flex items-center justify-center animate-pulse"
              style={{
                backgroundColor: colors.button.danger,
                color: colors.button.dangerText
              }}
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Modal rendered via portal */}
      {isOpen && mounted && createPortal(modalContent, document.body)}
    </>
  );
}