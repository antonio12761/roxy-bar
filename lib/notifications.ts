import { 
  EnhancedSSENotification, 
  NotificationPriority, 
  EntityType, 
  OperationType, 
  EntityChange, 
  FieldChange,
  NotificationTypes,
  enhancedToLegacy,
  QueuedEvent
} from "@/lib/types/notifications";
import { sseLogger } from "@/lib/sse/sse-logger";
import { sseMetrics } from "@/lib/sse/sse-metrics";

// Import the new SSE bridge for gradual migration
import * as sseBridge from "@/lib/sse/sse-bridge";

// Store per connessioni SSE attive
const connections = new Map<string, ReadableStreamDefaultController>();

// Text encoder for SSE messages
const encoder = new TextEncoder();

// Version tracking for optimistic locking
const entityVersions = new Map<string, number>();

// Event correlation tracking
const correlationGroups = new Map<string, string[]>();

// Message queues for offline support
const messageQueues = new Map<string, QueuedEvent[]>();
const connectionHealthMap = new Map<string, any>();
const acknowledgments = new Map<string, Set<string>>();

// Enhanced broadcast function with granular updates
export function broadcastEnhanced(
  notification: Partial<EnhancedSSENotification> & {
    type: string;
    message: string;
    data?: any;
    targetRoles?: string[];
  },
  options?: {
    priority?: NotificationPriority;
    correlationId?: string;
    entityChanges?: EntityChange[];
    acknowledgmentRequired?: boolean;
    ttl?: number;
  }
) {
  // Use the new SSE system via bridge
  return sseBridge.broadcastEnhanced(
    {
      ...notification,
      priority: options?.priority,
      requiresAcknowledgment: options?.acknowledgmentRequired,
      entityUpdates: options?.entityChanges
    },
    options
  );
}

// Backward compatible broadcast function
export function broadcast(notification: {
  type: string;
  message: string;
  data?: any;
  targetRoles?: string[];
}) {
  return broadcastEnhanced(notification);
}

// Enhanced helper functions with granular updates
export function notifyOrderUpdate(
  orderId: string, 
  status: string, 
  tableNumber: number, 
  rigaId?: string,
  changes?: FieldChange[]
) {
  const version = getNextVersion(`order_${orderId}`);
  
  return broadcastEnhanced(
    {
      type: NotificationTypes.ORDER_UPDATE,
      message: `Ordine Tavolo ${tableNumber} → ${status}`,
      data: { 
        orderId, 
        status, 
        tableNumber, 
        rigaId,
        timestamp: new Date().toISOString(),
        syncVersion: Date.now(),
        version
      },
      targetRoles: ["CAMERIERE", "PREPARA", "CUCINA", "CASSA"]
    },
    {
      priority: status === "PRONTO" ? NotificationPriority.HIGH : NotificationPriority.NORMAL,
      entityChanges: changes ? [{
        entityType: EntityType.ORDER,
        entityId: orderId,
        operation: OperationType.UPDATE,
        changes,
        version,
        previousVersion: version - 1
      }] : undefined,
      acknowledgmentRequired: status === "PRONTO"
    }
  );
}

export function notifyNewOrder(
  tableNumber: number, 
  items: any[], 
  orderId?: string,
  correlationId?: string
) {
  const version = orderId ? getNextVersion(`order_${orderId}`) : 1;
  
  return broadcastEnhanced(
    {
      type: NotificationTypes.NEW_ORDER,
      message: `🔔 Nuovo ordine Tavolo ${tableNumber}`,
      data: { 
        tableNumber, 
        items, 
        orderId,
        timestamp: new Date().toISOString(),
        syncVersion: Date.now(),
        version
      },
      targetRoles: ["PREPARA", "CUCINA", "CAMERIERE"]
    },
    {
      priority: NotificationPriority.HIGH,
      correlationId: correlationId || `order_${orderId}_${Date.now()}`,
      entityChanges: orderId ? [{
        entityType: EntityType.ORDER,
        entityId: orderId,
        operation: OperationType.CREATE,
        version,
        changes: []
      }] : undefined,
      acknowledgmentRequired: true,
      ttl: 3600 // 1 hour
    }
  );
}

export function notifyPaymentRequest(
  tableNumber: number, 
  amount: number,
  orderId?: string
) {
  return broadcastEnhanced(
    {
      type: NotificationTypes.PAYMENT_REQUEST,
      message: `💳 Richiesta pagamento Tavolo ${tableNumber}`,
      data: { 
        tableNumber, 
        amount,
        orderId,
        timestamp: new Date().toISOString()
      },
      targetRoles: ["CASSA"]
    },
    {
      priority: NotificationPriority.HIGH,
      acknowledgmentRequired: true,
      entityChanges: orderId ? [{
        entityType: EntityType.PAYMENT,
        entityId: `payment_${tableNumber}_${Date.now()}`,
        operation: OperationType.CREATE,
        version: 1,
        changes: []
      }] : undefined
    }
  );
}

// Notifiche per sincronizzazione avanzata
export function notifyOrderConflict(orderId: string, tableNumber: number, conflictType: string, conflictData: any) {
  broadcast({
    type: "order_conflict",
    message: `⚠️ Conflitto ordine Tavolo ${tableNumber}`,
    data: {
      orderId,
      tableNumber,
      conflictType,
      conflictData,
      timestamp: new Date().toISOString()
    },
    targetRoles: ["CAMERIERE", "MANAGER", "ADMIN"]
  });
}

export function notifyDuplicateOrder(tableNumber: number, duplicateData: any) {
  broadcast({
    type: "duplicate_order",
    message: `🔄 Possibile ordine duplicato Tavolo ${tableNumber}`,
    data: {
      tableNumber,
      duplicateData,
      timestamp: new Date().toISOString()
    },
    targetRoles: ["CAMERIERE", "MANAGER"]
  });
}

export function notifyOrderSync(orderId: string, syncData: any) {
  broadcast({
    type: "order_sync",
    message: "Sincronizzazione ordine",
    data: {
      orderId,
      syncData,
      timestamp: new Date().toISOString(),
      syncVersion: Date.now()
    },
    targetRoles: ["CAMERIERE", "PREPARA", "CUCINA", "CASSA"]
  });
}

// Bulk update support
export function notifyBulkUpdate(
  entityType: EntityType,
  updates: Array<{
    entityId: string;
    changes: FieldChange[];
    version?: number;
  }>,
  message: string,
  targetRoles?: string[]
) {
  const correlationId = `bulk_${entityType}_${Date.now()}`;
  
  const entityChanges: EntityChange[] = updates.map(update => ({
    entityType,
    entityId: update.entityId,
    operation: OperationType.UPDATE,
    changes: update.changes,
    version: update.version || getNextVersion(`${entityType}_${update.entityId}`),
    previousVersion: update.version ? update.version - 1 : undefined
  }));

  return broadcastEnhanced(
    {
      type: NotificationTypes.BULK_UPDATE,
      message,
      data: {
        entityType,
        updateCount: updates.length,
        timestamp: new Date().toISOString()
      },
      targetRoles
    },
    {
      priority: NotificationPriority.NORMAL,
      correlationId,
      entityChanges,
      acknowledgmentRequired: true
    }
  );
}

// Entity-specific granular update notifications
export function notifyEntityChange(
  entityType: EntityType,
  entityId: string,
  operation: OperationType,
  changes?: FieldChange[],
  options?: {
    message?: string;
    targetRoles?: string[];
    priority?: NotificationPriority;
    correlationId?: string;
  }
) {
  const version = getNextVersion(`${entityType}_${entityId}`);
  const notificationType = operation === OperationType.CREATE 
    ? NotificationTypes.ENTITY_CREATED
    : operation === OperationType.UPDATE
    ? NotificationTypes.ENTITY_UPDATED
    : NotificationTypes.ENTITY_DELETED;

  return broadcastEnhanced(
    {
      type: notificationType,
      message: options?.message || `${entityType} ${entityId} ${operation}`,
      data: {
        entityType,
        entityId,
        operation,
        timestamp: new Date().toISOString(),
        version
      },
      targetRoles: options?.targetRoles
    },
    {
      priority: options?.priority || NotificationPriority.NORMAL,
      correlationId: options?.correlationId,
      entityChanges: [{
        entityType,
        entityId,
        operation,
        changes: changes || [],
        version,
        previousVersion: version - 1
      }],
      acknowledgmentRequired: operation === OperationType.DELETE
    }
  );
}

// Version management helpers
function getNextVersion(entityKey: string): number {
  const currentVersion = entityVersions.get(entityKey) || 0;
  const nextVersion = currentVersion + 1;
  entityVersions.set(entityKey, nextVersion);
  return nextVersion;
}

export function getEntityVersion(entityType: EntityType, entityId: string): number {
  return entityVersions.get(`${entityType}_${entityId}`) || 0;
}

// Connection and queue management functions
export function getConnections() {
  return connections;
}

export function setConnection(clientId: string, controller: ReadableStreamDefaultController) {
  connections.set(clientId, controller);
}

export function deleteConnection(clientId: string) {
  connections.delete(clientId);
}

// Message queue management for offline support
export function getMessageQueue(clientId: string): QueuedEvent[] {
  return messageQueues.get(clientId) || [];
}

export function setConnectionHealth(clientId: string, health: any) {
  connectionHealthMap.set(clientId, health);
}

export function deleteConnectionHealth(clientId: string) {
  connectionHealthMap.delete(clientId);
}

export function getConnectionHealth(clientId: string) {
  return connectionHealthMap.get(clientId);
}

export function getAcknowledgments(clientId: string): Set<string> {
  return acknowledgments.get(clientId) || new Set();
}

export function setAcknowledgments(clientId: string, acks: Set<string>) {
  acknowledgments.set(clientId, acks);
}

export function initializeQueues(clientId: string) {
  if (!messageQueues.has(clientId)) {
    messageQueues.set(clientId, []);
  }
  if (!acknowledgments.has(clientId)) {
    acknowledgments.set(clientId, new Set());
  }
}

export function updateQueueAcknowledgment(clientId: string, eventId: string) {
  const queue = messageQueues.get(clientId) || [];
  const updatedQueue = queue.map(item => {
    if (item.id === eventId) {
      return { ...item, acknowledged: true };
    }
    return item;
  });
  messageQueues.set(clientId, updatedQueue);
}

export function addToMessageQueue(clientId: string, event: QueuedEvent) {
  const queue = messageQueues.get(clientId) || [];
  queue.push(event);
  
  // Limit queue size to prevent memory issues
  if (queue.length > 1000) {
    queue.shift(); // Remove oldest
  }
  
  messageQueues.set(clientId, queue);
}