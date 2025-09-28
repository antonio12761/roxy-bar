// Type-safe SSE event definitions for the bar management system

export interface SSEEventMap {
  // Order events
  'order:new': {
    orderId: string;
    tableNumber?: string | number;
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
    status: 'APERTO' | 'IN_PREPARAZIONE' | 'PRONTO' | 'RITIRATO' | 'PAGATO' | 'CONSEGNATO';
    previousStatus?: string;
    updatedBy?: string;
    timestamp: string;
  };
  
  'order:status-change': {
    orderId: string;
    oldStatus: string;
    newStatus: string;
    tableNumber?: string | number;
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
    orderNumber?: number;
    tableNumber?: string | number;
    readyItems: string[];
    timestamp: string;
  };
  
  'order:delivered': {
    orderId: string;
    tableNumber?: string | number;
    deliveredBy?: string;
    timestamp: string;
  };
  
  'order:paid': {
    orderId?: string;
    ordinazioneId?: string;
    numero?: number;
    tavolo?: string | number;
    totale?: number;
    amount?: number;
    paymentMethod?: string;
    cashierId?: string;
    timestamp: string;
  };
  
  'payment:update': {
    ordinazioneId: string;
    statoPagamento: string;
    totaleRimanente: number;
    pagamenti: Array<{
      id: string;
      importo: number;
      clienteNome: string | null;
      modalita: string;
    }>;
    timestamp: string;
  };
  
  'payment:cancelled': {
    ordinazioneId: string;
    numero: number;
    tavolo: string;
    operatore: string;
    motivo: string;
    timestamp: string;
  };
  
  'payment:partial-cancelled': {
    ordinazioneId: string;
    pagamentoId: string;
    numero: number;
    tavolo: string;
    importoAnnullato: number;
    clienteNome: string | null;
    operatore: string;
    motivo: string;
    timestamp: string;
  };
  
  'payment:request': {
    requestId: string;
    orderId: string;
    tableNumber?: string;
    orderType?: string;
    amount: number;
    customerName?: string;
    waiterName?: string;
    paymentMethod: string;
    timestamp: string;
  };
  
  'order:sent': {
    orderId: string;
    tableNumber?: string | number;
    orderType: string;
    timestamp: string;
  };
  
  'order:in-preparation': {
    orderId: string;
    tableNumber?: string | number;
    orderType: string;
    timestamp: string;
  };
  
  'order:cancelled': {
    orderId: string;
    orderNumber?: number;
    tableNumber?: string | number;
    orderType?: string;
    reason?: string;
    approvedBy?: string;
    cancelledBy?: string;
    timestamp: string;
  };
  
  'order:cancellation-request': {
    requestId: string;
    orderId: string;
    tableNumber?: string | number;
    reason: string;
    requestedBy: string;
    timestamp: string;
  };
  
  'order:cancellation-rejected': {
    requestId: string;
    orderId: string;
    tableNumber?: string | number;
    rejectedBy: string;
    reason?: string;
    timestamp: string;
  };
  
  'order:esaurito:alert': {
    orderId: string;
    orderNumber: number;
    tableNumber: number | string;
    products?: Array<{
      name: string;
      quantity: number;
    }>;
    outOfStockItems?: Array<{
      id: string;
      productName: string;
      quantity: number;
    }>;
    timestamp: string;
    needsAttention?: boolean;
    takenBy?: string | null;
  };
  
  'order:esaurito:taken': {
    orderId: string;
    orderNumber: number;
    tableNumber: string;
    takenBy: string;
    takenById?: string;
    timestamp: string;
  };
  
  'order:esaurito:released': {
    orderId: string;
    orderNumber: number;
    tableNumber: string;
    timestamp: string;
  };
  
  'order:esaurito:resolved': {
    originalOrderId: string;
    originalOrderNumber: number;
    newOrderId: string;
    newOrderNumber: number;
    tableNumber: string;
    resolvedBy: string;
    timestamp: string;
  };
  
  'order:esaurito:cancelled': {
    orderId: string;
    orderNumber: number;
    tableNumber: string;
    cancelledBy: string;
    timestamp: string;
  };
  
  'order:merged': {
    orderId: string;
    tableNumber: string | number;
    newItems: Array<{
      id: string;
      productName: string;
      quantity: number;
      station: string;
    }>;
    totalAmount: number;
    mergedBy: string;
  };
  
  'merge:request': {
    id: string;
    ordinazioneId: string;
    tavoloId: number;
    numeroTavolo: string;
    numeroOrdine: number;
    richiedenteName: string;
    prodotti: Array<{
      prodottoId: number;
      nome: string;
      quantita: number;
      prezzo?: number;
      note?: string;
    }>;
  };
  
  // Order item events
  'order:item-cancelled': {
    orderId: string;
    itemId: string;
    productName?: string;
    tableNumber?: string | number;
    cancelledBy: string;
    timestamp: string;
  };
  
  'order:item-modified': {
    orderId: string;
    itemId: string;
    productName?: string;
    oldQuantity: number;
    newQuantity: number;
    tableNumber?: string | number;
    modifiedBy: string;
    timestamp: string;
  };
  
  'order:table_changed': {
    fromTable: string;
    toTable: string;
    ordersCount: number;
  };
  
  // Table events
  'table:updated': {
    tableNumber: string;
    newStatus: string;
  };
  
  'tables:reordered': {
    groups: Array<{
      id: number;
      name: string;
      ordinamento: number;
    }>;
    updatedBy: string;
    timestamp: string;
  };
  
  // Product events
  'product:availability': {
    productId: number;
    productName: string;
    available: boolean;
    updatedBy?: string;
    timestamp: string;
  };
  
  'product:unavailable-in-order': {
    productId: number;
    productName: string;
    affectedOrders: Array<{
      orderId: string;
      orderNumber: number;
      tableNumber?: string;
      itemId: string;
      quantity: number;
      status: string;
    }>;
    timestamp: string;
  };
  
  'product:unavailable-urgent': {
    productId: number;
    productName: string;
    affectedOrders: Array<{
      orderId: string;
      orderNumber: number;
      tableNumber?: string;
      itemId: string;
      quantity: number;
      waiterName?: string;
      status: string;
    }>;
    timestamp: string;
  };
  
  'order:out-of-stock': {
    originalOrderId: string;
    originalOrderNumber: number;
    newOrderId: string;
    newOrderNumber: number;
    tableNumber?: string;
    waiterId: string;
    waiterName?: string;
    outOfStockProduct: string;
    outOfStockItems: Array<{
      id: string;
      productName: string;
      quantity: number;
    }>;
    timestamp: string;
  };
  
  'out-of-stock:notification': {
    id: string;
    orderId: string;
    itemId: string;
    itemName: string;
    quantity: number;
    table: string;
    customerName: string;
    timestamp: Date;
    claimedBy?: string;
    claimedAt?: Date;
  };
  
  'out-of-stock:claimed': {
    notificationId: string;
    claimedBy: string;
    claimedAt: Date;
  };
  
  'out-of-stock:dismissed': {
    notificationId: string;
  };
  
  'product:out-of-stock': {
    productId: number;
    productName: string;
    markedBy: string;
    affectedOrdersCount: number;
    timestamp: string;
  };

  'product:temporarily-unavailable': {
    productId: number;
    productName: string;
    affectedOrders: number[];
    updatedBy: string;
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
    tableNumber?: string | number;
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
  
  'system:reset': {
    message: string;
    resetBy: string;
    timestamp: string;
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
  
  // Additional order events
  'order:substituted': {
    originalOrderId: string;
    originalOrderNumber: number;
    newOrderId: string;
    newOrderNumber: number;
    tableNumber?: string;
    waiterId: string;
    waiterName?: string;
    outOfStockProduct: string;
    outOfStockItems: Array<{
      id: string;
      productName: string;
      quantity: number;
    }>;
    timestamp: string;
  };
  
  'products:all-available': {
    timestamp: string;
  };
  
  'inventory:updated': {
    productId: number;
    productName: string;
    availableQuantity: number;
    updatedBy: string;
    timestamp: string;
  };
  
  'inventory:reset': {
    productId: number;
    productName: string;
    resetBy: string;
    timestamp: string;
  };
  
  'debt:created': {
    debtId: string;
    userId: string;
    amount: number;
    description?: string;
    timestamp: string;
  };
  
  'debt-created': {
    debitoId: string;
    clienteId: string;
    clienteName: string;
    amount: number;
    timestamp: string;
  };
  
  'debt:paid': {
    debtId: string;
    userId: string;
    amount: number;
    timestamp: string;
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
  
  // Queue management events
  'queue:check': {
    tenantId: string;
  };
  
  // Groups reordering event
  'groups:reordered': {
    groups: Array<{ id: number; nome: string; ordinamento: number }>;
    updatedBy: string;
    timestamp: string;
  };
  
  // Visibility events
  'groups:visibility:update': {
    gruppoId: number;
    visibile: boolean;
    updatedBy: string;
    timestamp: string;
  };
  
  'tables:visibility:update': {
    tavoloId: number;
    visibile: boolean;
    updatedBy: string;
    timestamp: string;
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
  'order:paid': [SSEChannels.ORDERS, SSEChannels.STATION_WAITER, SSEChannels.STATION_PREPARE],
  'payment:update': [SSEChannels.ORDERS, SSEChannels.STATION_CASHIER],
  'payment:cancelled': [SSEChannels.ORDERS, SSEChannels.STATION_CASHIER, SSEChannels.STATION_WAITER],
  'payment:partial-cancelled': [SSEChannels.ORDERS, SSEChannels.STATION_CASHIER],
  'payment:request': [SSEChannels.STATION_CASHIER, SSEChannels.NOTIFICATIONS],
  'order:cancelled': [SSEChannels.ORDERS, SSEChannels.STATION_PREPARE, SSEChannels.STATION_WAITER],
  'order:merged': [SSEChannels.ORDERS, SSEChannels.STATION_PREPARE, SSEChannels.STATION_WAITER],
  'merge:request': [SSEChannels.ORDERS, SSEChannels.STATION_PREPARE],
  'product:availability': [SSEChannels.ORDERS, SSEChannels.STATION_WAITER, SSEChannels.STATION_PREPARE],
  'product:unavailable-in-order': [SSEChannels.ORDERS, SSEChannels.STATION_WAITER, SSEChannels.STATION_PREPARE],
  'product:unavailable-urgent': [SSEChannels.ORDERS, SSEChannels.STATION_WAITER, SSEChannels.STATION_PREPARE, SSEChannels.NOTIFICATIONS],
  'order:out-of-stock': [SSEChannels.ORDERS, SSEChannels.STATION_WAITER, SSEChannels.NOTIFICATIONS],
  'out-of-stock:notification': [SSEChannels.NOTIFICATIONS, SSEChannels.STATION_WAITER],
  'out-of-stock:claimed': [SSEChannels.NOTIFICATIONS, SSEChannels.STATION_WAITER],
  'out-of-stock:dismissed': [SSEChannels.NOTIFICATIONS, SSEChannels.STATION_WAITER],
  'product:out-of-stock': [SSEChannels.ORDERS, SSEChannels.STATION_PREPARE, SSEChannels.NOTIFICATIONS],
  'notification:new': [SSEChannels.NOTIFICATIONS],
  'system:announcement': [SSEChannels.SYSTEM],
  'station:request': [SSEChannels.NOTIFICATIONS],
  'tables:reordered': [SSEChannels.ORDERS, SSEChannels.STATION_WAITER],
  'groups:reordered': [SSEChannels.ORDERS, SSEChannels.STATION_WAITER],
  'groups:visibility:update': [SSEChannels.ORDERS, SSEChannels.STATION_WAITER],
  'tables:visibility:update': [SSEChannels.ORDERS, SSEChannels.STATION_WAITER],
};