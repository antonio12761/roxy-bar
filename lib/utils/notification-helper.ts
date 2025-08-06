import { toast } from "@/lib/toast";
import { EnhancedSSENotification, NotificationPriority, NotificationTypes } from "@/lib/types/notifications";

// Safe browser notification wrapper
export class BrowserNotificationHelper {
  private static isSupported = typeof window !== 'undefined' && 
                               'Notification' in window &&
                               typeof Notification !== 'undefined';

  static async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported) {
      console.warn('Browser notifications not supported');
      return 'denied';
    }

    try {
      return await Notification.requestPermission();
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return 'denied';
    }
  }

  static canShow(): boolean {
    if (!this.isSupported) return false;
    
    try {
      return Notification.permission === 'granted';
    } catch {
      return false;
    }
  }

  static show(title: string, options?: NotificationOptions): void {
    if (!this.canShow()) return;

    try {
      requestAnimationFrame(() => {
        try {
          const notification = new Notification(title, {
            icon: '/icon-192.png',
            badge: '/icon-72.png',
            ...options
          });

          // Auto-close after 5 seconds
          setTimeout(() => {
            try {
              notification.close();
            } catch {}
          }, 5000);

          notification.onclick = () => {
            window.focus();
            notification.close();
          };

          notification.onerror = (error) => {
            console.error('Notification error:', error);
          };
        } catch (error) {
          console.error('Error creating notification:', error);
          console.log(`[NOTIFICA] ${title}`, options?.body);
        }
      });
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  }

  static showWithSound(title: string, body: string, soundUrl = '/sounds/notification.mp3'): void {
    this.show(title, { body });
    
    // Try to play sound
    if (typeof Audio !== 'undefined') {
      try {
        const audio = new Audio(soundUrl);
        audio.volume = 0.5;
        audio.play().catch(() => {
          // Autoplay blocked, ignore
        });
      } catch {}
    }
  }
}

// Helper to emit both toast and notification
export function showNotification(
  message: string, 
  type: 'success' | 'info' | 'error' | 'warning',
  options?: {
    title?: string;
    priority?: NotificationPriority;
    notificationType?: string;
    targetRoles?: string[];
    requiresAcknowledgment?: boolean;
    actionUrl?: string;
    metadata?: Record<string, any>;
  }
) {
  // Show toast
  toast[type](message);
  
  // Create notification for NotificationCenter
  const notification: EnhancedSSENotification = {
    id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: options?.notificationType || getDefaultNotificationType(type),
    message,
    priority: options?.priority || getDefaultPriority(type),
    timestamp: new Date().toISOString(),
    targetRoles: options?.targetRoles,
    acknowledgmentRequired: options?.requiresAcknowledgment || false,
    metadata: {
      ...options?.metadata,
      title: options?.title || getDefaultTitle(type),
      actionUrl: options?.actionUrl
    },
    syncVersion: 1,
    data: {}
  };
  
  // Add to notifications in localStorage for NotificationCenter to pick up
  const existingNotifications = JSON.parse(localStorage.getItem('notifications') || '[]');
  existingNotifications.unshift(notification);
  // Keep only last 50 notifications
  const trimmedNotifications = existingNotifications.slice(0, 50);
  localStorage.setItem('notifications', JSON.stringify(trimmedNotifications));
  
  // Dispatch event to notify NotificationCenter
  window.dispatchEvent(new CustomEvent('notificationAdded', { 
    detail: notification 
  }));
  
  return notification;
}

// Helper to determine default notification type based on toast type
function getDefaultNotificationType(type: 'success' | 'info' | 'error' | 'warning'): string {
  switch (type) {
    case 'success':
      return NotificationTypes.ORDER_UPDATE;
    case 'error':
      return NotificationTypes.ORDER_FAILED;
    case 'warning':
      return NotificationTypes.ORDER_OUT_OF_STOCK;
    case 'info':
    default:
      return NotificationTypes.ORDER_UPDATE;
  }
}

// Helper to determine default title based on toast type
function getDefaultTitle(type: 'success' | 'info' | 'error' | 'warning'): string {
  switch (type) {
    case 'success':
      return 'Operazione completata';
    case 'error':
      return 'Errore';
    case 'warning':
      return 'Attenzione';
    case 'info':
    default:
      return 'Informazione';
  }
}

// Helper to determine default priority based on toast type
function getDefaultPriority(type: 'success' | 'info' | 'error' | 'warning'): NotificationPriority {
  switch (type) {
    case 'error':
      return NotificationPriority.HIGH;
    case 'warning':
      return NotificationPriority.NORMAL;
    case 'success':
    case 'info':
    default:
      return NotificationPriority.LOW;
  }
}

// Product availability notification
export function notifyProductAvailability(productName: string, available: boolean) {
  const message = available 
    ? `${productName} è ora disponibile`
    : `${productName} è esaurito`;
  
  return showNotification(message, available ? 'info' : 'warning', {
    title: available ? 'Prodotto disponibile' : 'Prodotto esaurito',
    priority: available ? NotificationPriority.LOW : NotificationPriority.NORMAL,
    notificationType: available ? NotificationTypes.ORDER_UPDATE : NotificationTypes.ORDER_OUT_OF_STOCK,
    targetRoles: ['CAMERIERE'],
    metadata: {
      productName,
      available
    }
  });
}

// Order sent notification
export function notifyOrderSent(orderNumber: string, tableNumber?: string) {
  const message = tableNumber 
    ? `Ordine #${orderNumber} inviato per tavolo ${tableNumber}`
    : `Ordine #${orderNumber} inviato`;
  
  return showNotification(message, 'success', {
    title: 'Ordine inviato',
    priority: NotificationPriority.NORMAL,
    notificationType: NotificationTypes.NEW_ORDER,
    targetRoles: ['CAMERIERE'],
    metadata: {
      orderNumber,
      tableNumber
    }
  });
}

// Order ready notification
export function notifyOrderReady(orderNumber: string, tableNumber?: string) {
  const message = tableNumber 
    ? `Ordine #${orderNumber} pronto per tavolo ${tableNumber}`
    : `Ordine #${orderNumber} pronto`;
  
  return showNotification(message, 'success', {
    title: 'Ordine pronto',
    priority: NotificationPriority.HIGH,
    notificationType: NotificationTypes.ORDER_READY,
    targetRoles: ['CAMERIERE'],
    requiresAcknowledgment: true,
    metadata: {
      orderNumber,
      tableNumber
    }
  });
}

// Error notification
export function notifyError(error: string, details?: string) {
  return showNotification(details || error, 'error', {
    title: 'Errore',
    priority: NotificationPriority.HIGH,
    notificationType: NotificationTypes.ORDER_FAILED,
    targetRoles: ['CAMERIERE'],
    metadata: {
      error,
      details
    }
  });
}

// Warning notification
export function notifyWarning(warning: string) {
  return showNotification(warning, 'warning', {
    title: 'Attenzione',
    priority: NotificationPriority.NORMAL,
    notificationType: NotificationTypes.ORDER_OUT_OF_STOCK,
    targetRoles: ['CAMERIERE']
  });
}

// Info notification
export function notifyInfo(info: string, title?: string) {
  return showNotification(info, 'info', {
    title: title || 'Informazione',
    priority: NotificationPriority.LOW,
    notificationType: NotificationTypes.ORDER_UPDATE,
    targetRoles: ['CAMERIERE']
  });
}