// Type-safe SSE event definitions for the bar management system

export interface SSEEventMap {
  // Order events
  'order:new': {
    orderId: string;
    tableNumber?: number;
    customerName?: string;
    items: Array<{
      id: string;
      productName: string;
      quantity: number;
      destination: string;
    }>;
    totalAmount: number;
    timestamp: string;
  };
  
  'order:update': {
    orderId: string;
    status: 'APERTO' | 'IN_PREPARAZIONE' | 'PRONTO' | 'RITIRATO' | 'PAGATO';
    previousStatus?: string;
    updatedBy?: string;
    timestamp: string;
  };
  
  'order:status-change': {
    orderId: string;
    oldStatus: string;
    newStatus: string;
    tableNumber?: number;
    timestamp: string;
  };
  
  'order:item:update': {
    itemId: string;
    orderId: string;
    status: 'INSERITO' | 'IN_LAVORAZIONE' | 'PRONTO' | 'CONSEGNATO';
    previousStatus?: string;
    updatedBy?: string;
    timestamp: string;
  };
  
  'order:ready': {
    orderId: string;
    tableNumber?: number;
    readyItems: string[];
    timestamp: string;
  };
  
  'order:delivered': {
    orderId: string;
    tableNumber?: number;
    deliveredBy?: string;
    timestamp: string;
  };
  
  'order:paid': {
    orderId: string;
    amount: number;
    paymentMethod: string;
    cashierId?: string;
    timestamp: string;
  };
  
  'order:sent': {
    orderId: string;
    tableNumber?: number;
    orderType: string;
    timestamp: string;
  };
  
  'order:in-preparation': {
    orderId: string;
    tableNumber?: number;
    orderType: string;
    timestamp: string;
  };
  
  'order:cancelled': {
    orderId: string;
    tableNumber?: number;
    orderType: string;
    reason?: string;
    timestamp: string;
  };
  
  // Notification events
  'notification:new': {
    id: string;
    title: string;
    message: string;
    priority: 'low' | 'normal' | 'high' | 'urgent';
    targetRoles?: string[];
    requiresAcknowledgment?: boolean;
  };
  
  'notification:reminder': {
    orderId: string;
    tableNumber?: number;
    type: 'pickup' | 'payment' | 'preparation';
    message: string;
  };
  
  // System events
  'system:announcement': {
    message: string;
    type: 'info' | 'warning' | 'error';
    expiresAt?: string;
  };
  
  'system:heartbeat': {
    timestamp: string;
    serverTime: string;
  };
  
  // Data sync events
  'data:update': {
    entity: 'order' | 'product' | 'table' | 'user';
    action: 'create' | 'update' | 'delete';
    id: string;
    data?: any;
    version?: number;
  };
  
  'data:sync': {
    entities: Array<{
      type: string;
      count: number;
      lastUpdate: string;
    }>;
  };
  
  // User activity events
  'user:activity': {
    userId: string;
    userName: string;
    action: string;
    entityType?: string;
    entityId?: string;
    timestamp: string;
  };
  
  'user:presence': {
    userId: string;
    status: 'online' | 'away' | 'offline';
    lastActivity?: string;
  };
  
  // Station-specific events
  'station:status': {
    stationType: 'CAMERIERE' | 'PREPARA' | 'CASSA' | 'SUPERVISORE';
    status: 'active' | 'busy' | 'offline';
    queueLength?: number;
    lastActivity?: string;
  };
  
  'station:request': {
    fromStation: string;
    toStation: string;
    type: 'assistance' | 'approval' | 'info';
    message: string;
    priority?: 'normal' | 'urgent';
  };
  
  // Connection events
  'connection:status': {
    status: 'connected' | 'disconnected' | 'error';
    quality?: 'excellent' | 'good' | 'fair' | 'poor';
    latency?: number;
    reconnectAttempts?: number;
  };
  
  'connection:error': {
    code: string;
    message: string;
    retryable: boolean;
    retryAfter?: number;
  };
}

// Helper type to extract event names
export type SSEEventName = keyof SSEEventMap;

// Helper type to extract event data for a specific event
export type SSEEventData<T extends SSEEventName> = SSEEventMap[T];

// Rate limits for different event types (in milliseconds)
export const SSEEventRateLimits: Partial<Record<SSEEventName, number>> = {
  'user:activity': 1000,      // Max 1/second
  'user:presence': 5000,      // Max 1/5 seconds
  'system:heartbeat': 30000,  // Max 1/30 seconds
};

// Event priorities for queuing
export const SSEEventPriorities: Partial<Record<SSEEventName, number>> = {
  'order:new': 10,
  'order:ready': 10,
  'notification:reminder': 9,
  'order:update': 8,
  'notification:new': 7,
  'data:update': 5,
  'user:activity': 3,
  'system:heartbeat': 1,
};

// Events that require acknowledgment
export const SSEEventsRequiringAck: SSEEventName[] = [
  'order:new',
  'order:ready',
  'notification:reminder',
  'station:request'
];

// Channel definitions for event routing
export const SSEChannels = {
  ORDERS: 'orders',
  NOTIFICATIONS: 'notifications',
  SYSTEM: 'system',
  STATION_WAITER: 'station:waiter',
  STATION_PREPARE: 'station:prepare',
  STATION_CASHIER: 'station:cashier',
  STATION_SUPERVISOR: 'station:supervisor',
} as const;

export type SSEChannel = typeof SSEChannels[keyof typeof SSEChannels];

// Map events to their default channels
export const SSEEventChannels: Partial<Record<SSEEventName, SSEChannel[]>> = {
  'order:new': [SSEChannels.ORDERS, SSEChannels.STATION_PREPARE],
  'order:update': [SSEChannels.ORDERS],
  'order:sent': [SSEChannels.ORDERS, SSEChannels.STATION_PREPARE],
  'order:in-preparation': [SSEChannels.ORDERS, SSEChannels.STATION_WAITER],
  'order:ready': [SSEChannels.ORDERS, SSEChannels.STATION_WAITER],
  'order:delivered': [SSEChannels.ORDERS, SSEChannels.STATION_CASHIER],
  'order:paid': [SSEChannels.ORDERS, SSEChannels.STATION_WAITER],
  'order:cancelled': [SSEChannels.ORDERS, SSEChannels.STATION_PREPARE, SSEChannels.STATION_WAITER],
  'notification:new': [SSEChannels.NOTIFICATIONS],
  'system:announcement': [SSEChannels.SYSTEM],
  'station:request': [SSEChannels.NOTIFICATIONS],
};