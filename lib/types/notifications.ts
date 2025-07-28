// Enhanced notification types with granular change tracking

export enum NotificationPriority {
  LOW = "low",
  NORMAL = "normal",
  HIGH = "high",
  URGENT = "urgent"
}

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  BULK_UPDATE = "bulk_update",
  SYNC = "sync"
}

export enum EntityType {
  ORDER = "order",
  ORDER_ITEM = "order_item",
  TABLE = "table",
  PRODUCT = "product",
  CATEGORY = "category",
  USER = "user",
  PAYMENT = "payment"
}

export interface FieldChange {
  field: string;
  oldValue: any;
  newValue: any;
}

export interface EntityChange {
  entityType: EntityType;
  entityId: string;
  operation: OperationType;
  changes?: FieldChange[];
  version: number;
  previousVersion?: number;
}

export interface NotificationPayload {
  id: string;
  type: string;
  priority: NotificationPriority;
  timestamp: string;
  correlationId?: string; // For grouping related events
  targetRoles?: string[];
  entityChanges?: EntityChange[];
  metadata?: Record<string, any>;
  acknowledgmentRequired?: boolean;
  ttl?: number; // Time to live in seconds
}

export interface EnhancedSSENotification extends NotificationPayload {
  message: string;
  data?: any;
  syncVersion: number;
  sequenceNumber?: number; // For ordering events
}

// Event queue item for offline support
export interface QueuedEvent {
  id: string;
  notification: EnhancedSSENotification;
  timestamp: number;
  attempts: number;
  acknowledged: boolean;
  expiresAt?: number;
}

// Connection health status
export interface ConnectionHealth {
  status: "connected" | "disconnected" | "connecting" | "error";
  quality: "excellent" | "good" | "fair" | "poor";
  latency: number;
  lastPingTime: number;
  missedPings: number;
  reconnectAttempts: number;
}

// Optimistic update tracking
export interface OptimisticUpdate {
  id: string;
  entityType: EntityType;
  entityId: string;
  changes: FieldChange[];
  timestamp: number;
  confirmed: boolean;
  rollbackData?: any;
}

// Event acknowledgment
export interface EventAcknowledgment {
  eventId: string;
  clientId: string;
  timestamp: string;
  status: "received" | "processed" | "failed";
  error?: string;
}

// Backward compatibility types
export interface LegacySSENotification {
  type: string;
  message: string;
  data?: any;
  timestamp: string;
  id: string;
  targetRoles?: string[];
}

// Helper function to convert legacy to enhanced format
export function legacyToEnhanced(legacy: LegacySSENotification): EnhancedSSENotification {
  return {
    id: legacy.id,
    type: legacy.type,
    priority: NotificationPriority.NORMAL,
    timestamp: legacy.timestamp,
    targetRoles: legacy.targetRoles,
    message: legacy.message,
    data: legacy.data,
    syncVersion: legacy.data?.syncVersion || Date.now(),
    metadata: {}
  };
}

// Helper function to convert enhanced to legacy format
export function enhancedToLegacy(enhanced: EnhancedSSENotification): LegacySSENotification {
  return {
    id: enhanced.id,
    type: enhanced.type,
    message: enhanced.message,
    data: enhanced.data,
    timestamp: enhanced.timestamp,
    targetRoles: enhanced.targetRoles
  };
}

// Notification type constants for backward compatibility
export const NotificationTypes = {
  // Order related
  ORDER_UPDATE: "order_update",
  NEW_ORDER: "new_order",
  ORDER_READY: "order_ready",
  ORDER_DELIVERED: "order_delivered",
  ORDER_CONFLICT: "order_conflict",
  DUPLICATE_ORDER: "duplicate_order",
  ORDER_SYNC: "order_sync",
  
  // Order item related
  ITEM_STATUS_CHANGE: "item_status_change",
  ITEM_IN_PROGRESS: "item_in_progress",
  ITEM_READY: "item_ready",
  ITEM_DELIVERED: "item_delivered",
  
  // Payment related
  PAYMENT_REQUEST: "payment_request",
  PAYMENT_COMPLETED: "payment_completed",
  PAYMENT_PARTIAL: "payment_partial",
  
  // Table related
  TABLE_OCCUPIED: "table_occupied",
  TABLE_FREED: "table_freed",
  
  // System
  CONNECTION: "connection",
  PING: "ping",
  PONG: "pong",
  ACK: "acknowledgment",
  STATION_SYNC: "station_sync",
  FORCE_REFRESH: "force_refresh",
  
  // Entity updates
  ENTITY_CREATED: "entity_created",
  ENTITY_UPDATED: "entity_updated",
  ENTITY_DELETED: "entity_deleted",
  BULK_UPDATE: "bulk_update"
} as const;

export type NotificationType = typeof NotificationTypes[keyof typeof NotificationTypes];