/**
 * Utility functions for synchronizing notification state across components
 */

export interface NotificationSyncData {
  notifications: any[];
  readNotifications: string[];
  unreadCount: number;
}

/**
 * Get current notification sync data from localStorage
 */
export function getNotificationSyncData(): NotificationSyncData {
  try {
    const notifications = JSON.parse(localStorage.getItem('notifications') || '[]');
    const readNotifications = JSON.parse(localStorage.getItem('readNotifications') || '[]');
    const unreadCount = notifications.filter((n: any) => !readNotifications.includes(n.id)).length;
    
    return {
      notifications,
      readNotifications,
      unreadCount
    };
  } catch (error) {
    console.error('Error getting notification sync data:', error);
    return {
      notifications: [],
      readNotifications: [],
      unreadCount: 0
    };
  }
}

/**
 * Mark all notifications as read and sync across components
 */
export function markAllNotificationsAsRead(): void {
  try {
    const { notifications } = getNotificationSyncData();
    const allIds = notifications.map((n: any) => n.id);
    
    localStorage.setItem('readNotifications', JSON.stringify(allIds));
    
    // Dispatch event to notify all components
    window.dispatchEvent(new CustomEvent('notificationCountChanged'));
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
  }
}

/**
 * Add a new notification and sync across components
 */
export function addNotificationAndSync(notification: any): void {
  try {
    const { notifications } = getNotificationSyncData();
    const updated = [notification, ...notifications].slice(0, 50); // Keep max 50
    
    localStorage.setItem('notifications', JSON.stringify(updated));
    
    // Dispatch event to notify all components
    window.dispatchEvent(new CustomEvent('notificationCountChanged'));
  } catch (error) {
    console.error('Error adding notification:', error);
  }
}

/**
 * Subscribe to notification count changes
 */
export function subscribeToNotificationChanges(callback: (data: NotificationSyncData) => void): () => void {
  const handleChange = () => {
    callback(getNotificationSyncData());
  };

  window.addEventListener('notificationCountChanged', handleChange);
  window.addEventListener('storage', handleChange);

  return () => {
    window.removeEventListener('notificationCountChanged', handleChange);
    window.removeEventListener('storage', handleChange);
  };
}

/**
 * Notify that a notification was added (for NotificationCenter to pick up)
 */
export function notifyNotificationAdded(notification: any): void {
  // Dispatch custom event that NotificationCenter listens to
  window.dispatchEvent(new CustomEvent('notificationAdded', { 
    detail: notification 
  }));
}