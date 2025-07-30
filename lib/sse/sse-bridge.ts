/**
 * Bridge module to connect the old notification system with the new SSE system
 * This allows gradual migration from the old system to the new one
 */

import { sseService } from './sse-service';
import { SSEEventName, SSEChannels, SSEChannel } from './sse-events';

// Map user roles to SSE channels
const roleToChannelMap: Record<string, SSEChannel> = {
  'CAMERIERE': SSEChannels.STATION_WAITER,
  'PREPARA': SSEChannels.STATION_PREPARE,
  'CASSA': SSEChannels.STATION_CASHIER,
  'SUPERVISORE': SSEChannels.STATION_SUPERVISOR,
  'CUCINA': SSEChannels.STATION_PREPARE
};

// Map old notification types to new SSE event names
const notificationTypeMap: Record<string, SSEEventName> = {
  'new_order': 'order:new',
  'nuovo-ordine': 'order:new',
  'order_update': 'order:update',
  'order_ready': 'order:ready',
  'order_delivered': 'order:delivered',
  'payment_request': 'notification:new',
  'payment_completed': 'order:paid',
  'order_conflict': 'notification:new',
  'duplicate_order': 'notification:new',
  'order_sync': 'data:sync',
  'bulk_update': 'data:update',
  'entity_created': 'data:update',
  'entity_updated': 'data:update',
  'entity_deleted': 'data:update',
};

// Priority mapping
const priorityMap = {
  'low': 'low' as const,
  'normal': 'normal' as const,
  'high': 'high' as const,
  'urgent': 'urgent' as const,
};

/**
 * Enhanced broadcast function that works with both old and new systems
 */
export function broadcastEnhanced(
  notification: {
    type: string;
    message: string;
    data?: any;
    targetRoles?: string[];
    title?: string;
    priority?: string;
    requiresAcknowledgment?: boolean;
    entityUpdates?: any[];
  },
  options?: {
    priority?: string;
    correlationId?: string;
    entityChanges?: any[];
    acknowledgmentRequired?: boolean;
    ttl?: number;
  }
) {
  // Map to new event name
  const eventName = notificationTypeMap[notification.type];
  
  if (!eventName) {
    console.warn(`[SSE Bridge] Unknown notification type: ${notification.type}`);
    return;
  }
  
  // Determine priority
  const priorityInput = (options?.priority || notification.priority || 'normal').toLowerCase();
  const priority = priorityInput in priorityMap 
    ? priorityMap[priorityInput as keyof typeof priorityMap]
    : 'normal';
  
  // Emit appropriate event based on type
  switch (eventName) {
    case 'order:new':
      sseService.emit('order:new', {
        orderId: notification.data?.orderId || `temp_${Date.now()}`,
        tableNumber: notification.data?.tableNumber,
        customerName: notification.data?.customerName,
        items: notification.data?.items || [],
        totalAmount: notification.data?.totalAmount || 0,
        timestamp: new Date().toISOString()
      }, {
        channels: notification.targetRoles?.map(role => 
          roleToChannelMap[role] || SSEChannels.NOTIFICATIONS
        ).filter(Boolean)
      });
      break;
      
    case 'order:update':
      sseService.emit('order:update', {
        orderId: notification.data?.orderId || '',
        status: notification.data?.status || 'APERTO',
        previousStatus: notification.data?.previousStatus,
        updatedBy: notification.data?.updatedBy,
        timestamp: new Date().toISOString()
      }, {
        channels: notification.targetRoles?.map(role => 
          roleToChannelMap[role] || SSEChannels.NOTIFICATIONS
        ).filter(Boolean)
      });
      break;
      
    case 'order:ready':
      sseService.emit('order:ready', {
        orderId: notification.data?.orderId || '',
        tableNumber: notification.data?.tableNumber,
        readyItems: notification.data?.readyItems || [],
        timestamp: new Date().toISOString()
      }, {
        channels: notification.targetRoles?.map(role => 
          roleToChannelMap[role] || SSEChannels.NOTIFICATIONS
        ).filter(Boolean)
      });
      break;
      
    case 'notification:new':
      sseService.emit('notification:new', {
        id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: notification.title || notification.type,
        message: notification.message,
        priority,
        targetRoles: notification.targetRoles,
        requiresAcknowledgment: options?.acknowledgmentRequired || 
                                notification.requiresAcknowledgment
      }, {
        channels: notification.targetRoles?.map(role => 
          roleToChannelMap[role] || SSEChannels.NOTIFICATIONS
        ).filter(Boolean)
      });
      break;
      
    case 'data:update':
      sseService.emit('data:update', {
        entity: notification.data?.entityType || 'unknown',
        action: notification.data?.operation || 'update',
        id: notification.data?.entityId || '',
        data: notification.data,
        version: notification.data?.version
      }, {
        broadcast: !notification.targetRoles || notification.targetRoles.length === 0,
        channels: notification.targetRoles?.map(role => 
          roleToChannelMap[role] || SSEChannels.NOTIFICATIONS
        ).filter(Boolean)
      });
      break;
      
    default:
      // Fallback to generic notification
      sseService.emit('notification:new', {
        id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: notification.type,
        message: notification.message,
        priority,
        targetRoles: notification.targetRoles,
        requiresAcknowledgment: false
      });
  }
  
  return `bridge_${Date.now()}`;
}

// Re-export as broadcast for backward compatibility
export const broadcast = broadcastEnhanced;

// Export specific notification functions that match old API
export function notifyOrderUpdate(
  orderId: string, 
  status: string, 
  tableNumber: number, 
  rigaId?: string,
  changes?: any[]
) {
  return broadcastEnhanced({
    type: 'order_update',
    message: `Ordine Tavolo ${tableNumber} → ${status}`,
    data: { 
      orderId, 
      status, 
      tableNumber, 
      rigaId,
      timestamp: new Date().toISOString(),
    },
    targetRoles: ["CAMERIERE", "PREPARA", "CUCINA", "CASSA"]
  }, {
    priority: status === "PRONTO" ? 'high' : 'normal',
    acknowledgmentRequired: status === "PRONTO"
  });
}

export function notifyNewOrder(
  tableNumber: number, 
  items: any[], 
  orderId?: string,
  correlationId?: string
) {
  return broadcastEnhanced({
    type: 'new_order',
    message: `🔔 Nuovo ordine Tavolo ${tableNumber}`,
    data: { 
      tableNumber, 
      items, 
      orderId,
      timestamp: new Date().toISOString(),
    },
    targetRoles: ["PREPARA", "CUCINA", "CAMERIERE"]
  }, {
    priority: 'high',
    correlationId,
    acknowledgmentRequired: true,
    ttl: 3600
  });
}

export function notifyPaymentRequest(
  tableNumber: number, 
  amount: number,
  orderId?: string
) {
  return broadcastEnhanced({
    type: 'payment_request',
    message: `💳 Richiesta pagamento Tavolo ${tableNumber}`,
    data: { 
      tableNumber, 
      amount,
      orderId,
      timestamp: new Date().toISOString()
    },
    targetRoles: ["CASSA"]
  }, {
    priority: 'high',
    acknowledgmentRequired: true
  });
}