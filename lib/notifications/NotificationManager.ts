import {
  NotificationPriority,
  EntityType,
  OperationType,
  FieldChange,
  NotificationTypes,
  EnhancedSSENotification
} from "@/lib/types/notifications";
import {
  broadcastEnhanced,
  notifyEntityChange,
  getEntityVersion
} from "@/lib/notifications";

export interface NotificationConfig {
  type: string;
  priority: NotificationPriority;
  targetRoles: string[];
  requiresAcknowledgment: boolean;
  ttl?: number; // Time to live in seconds
}

export interface OrderNotificationData {
  orderId: string;
  tableNumber?: number;
  orderType: "TAVOLO" | "ASPORTO" | "BANCONE";
  items?: Array<{
    nome: string;
    quantita: number;
    destinazione: string;
  }>;
  status?: string;
  amount?: number;
  customerName?: string;
  waiterName?: string;
  changes?: FieldChange[];
}

export interface NotificationPreferences {
  enabledTypes: Set<string>;
  audioEnabled: boolean;
  audioVolume: number;
  retentionCount: number;
  priorityFilter: NotificationPriority[];
}

export class NotificationManager {
  private static instance: NotificationManager;
  private notificationConfigs: Map<string, NotificationConfig>;
  private notificationHistory: EnhancedSSENotification[] = [];
  private maxHistorySize = 50;

  private constructor() {
    this.notificationConfigs = new Map([
      // Order lifecycle notifications
      ["order_created", {
        type: NotificationTypes.NEW_ORDER,
        priority: NotificationPriority.HIGH,
        targetRoles: ["PREPARA", "CUCINA", "CAMERIERE", "SUPERVISORE"],
        requiresAcknowledgment: true,
        ttl: 3600
      }],
      ["order_updated", {
        type: NotificationTypes.ORDER_UPDATE,
        priority: NotificationPriority.NORMAL,
        targetRoles: ["PREPARA", "CUCINA", "CAMERIERE", "CASSA", "SUPERVISORE"],
        requiresAcknowledgment: false,
        ttl: 1800
      }],
      ["order_ready", {
        type: NotificationTypes.ORDER_UPDATE,
        priority: NotificationPriority.HIGH,
        targetRoles: ["CAMERIERE", "SUPERVISORE"],
        requiresAcknowledgment: true,
        ttl: 1800
      }],
      ["order_delivered", {
        type: NotificationTypes.ORDER_UPDATE,
        priority: NotificationPriority.NORMAL,
        targetRoles: ["CASSA", "SUPERVISORE"],
        requiresAcknowledgment: false,
        ttl: 1800
      }],
      ["order_paid", {
        type: NotificationTypes.PAYMENT_COMPLETED,
        priority: NotificationPriority.NORMAL,
        targetRoles: ["CAMERIERE", "SUPERVISORE"],
        requiresAcknowledgment: false,
        ttl: 900
      }],
      ["order_cancelled", {
        type: NotificationTypes.ORDER_UPDATE,
        priority: NotificationPriority.HIGH,
        targetRoles: ["CAMERIERE", "SUPERVISORE", "PREPARA", "CUCINA"],
        requiresAcknowledgment: false,
        ttl: 3600
      }],
      
      // Payment notifications
      ["payment_requested", {
        type: NotificationTypes.PAYMENT_REQUEST,
        priority: NotificationPriority.HIGH,
        targetRoles: ["CASSA", "SUPERVISORE"],
        requiresAcknowledgment: true,
        ttl: 3600
      }],
      ["receipt_requested", {
        type: NotificationTypes.PAYMENT_REQUEST,
        priority: NotificationPriority.HIGH,
        targetRoles: ["CASSA", "SUPERVISORE"],
        requiresAcknowledgment: true,
        ttl: 3600
      }],
      
      // Item status notifications
      ["item_in_progress", {
        type: NotificationTypes.ENTITY_UPDATED,
        priority: NotificationPriority.NORMAL,
        targetRoles: ["CAMERIERE", "SUPERVISORE"],
        requiresAcknowledgment: false,
        ttl: 1800
      }],
      ["item_ready", {
        type: NotificationTypes.ENTITY_UPDATED,
        priority: NotificationPriority.HIGH,
        targetRoles: ["CAMERIERE", "SUPERVISORE"],
        requiresAcknowledgment: true,
        ttl: 1800
      }],
      ["item_delivered", {
        type: NotificationTypes.ENTITY_UPDATED,
        priority: NotificationPriority.NORMAL,
        targetRoles: ["CASSA", "SUPERVISORE"],
        requiresAcknowledgment: false,
        ttl: 900
      }],
      
      // Payment notifications
      ["payment_requested", {
        type: NotificationTypes.PAYMENT_REQUEST,
        priority: NotificationPriority.HIGH,
        targetRoles: ["CASSA", "SUPERVISORE"],
        requiresAcknowledgment: true,
        ttl: 3600
      }],
      ["payment_completed", {
        type: NotificationTypes.PAYMENT_COMPLETED,
        priority: NotificationPriority.NORMAL,
        targetRoles: ["CAMERIERE", "SUPERVISORE"],
        requiresAcknowledgment: false,
        ttl: 900
      }],
      
      // System notifications
      ["duplicate_order_warning", {
        type: NotificationTypes.DUPLICATE_ORDER,
        priority: NotificationPriority.URGENT,
        targetRoles: ["CAMERIERE", "MANAGER", "SUPERVISORE"],
        requiresAcknowledgment: true,
        ttl: 600
      }],
      ["order_conflict", {
        type: NotificationTypes.ORDER_CONFLICT,
        priority: NotificationPriority.URGENT,
        targetRoles: ["CAMERIERE", "MANAGER", "ADMIN", "SUPERVISORE"],
        requiresAcknowledgment: true,
        ttl: 1800
      }]
    ]);
  }

  public static getInstance(): NotificationManager {
    if (!NotificationManager.instance) {
      NotificationManager.instance = new NotificationManager();
    }
    return NotificationManager.instance;
  }

  /**
   * Send a notification for order creation
   */
  public notifyOrderCreated(data: OrderNotificationData): string {
    const config = this.notificationConfigs.get("order_created")!;
    const correlationId = `order_${data.orderId}_${Date.now()}`;
    
    const message = data.tableNumber 
      ? `Nuovo ordine Tavolo ${data.tableNumber}`
      : `Nuovo ordine ${data.orderType}`;

    const eventId = broadcastEnhanced(
      {
        type: config.type,
        message,
        data: {
          orderId: data.orderId,
          tableNumber: data.tableNumber,
          orderType: data.orderType,
          items: data.items,
          customerName: data.customerName,
          waiterName: data.waiterName,
          timestamp: new Date().toISOString(),
          syncVersion: Date.now()
        },
        targetRoles: config.targetRoles
      },
      {
        priority: config.priority,
        correlationId,
        entityChanges: [{
          entityType: EntityType.ORDER,
          entityId: data.orderId,
          operation: OperationType.CREATE,
          version: 1,
          changes: []
        }],
        acknowledgmentRequired: config.requiresAcknowledgment,
        ttl: config.ttl
      }
    );

    this.addToHistory({
      id: eventId,
      type: config.type,
      message,
      timestamp: new Date().toISOString(),
      priority: config.priority,
      targetRoles: config.targetRoles,
      data: data,
      syncVersion: Date.now(),
      correlationId
    });

    // Emit specific order:new event for real-time updates
    if (typeof window === 'undefined') { // Server-side only
      const { sseService } = require('@/lib/sse/sse-service');
      sseService.emit('order:new', {
        orderId: data.orderId,
        tableNumber: data.tableNumber,
        customerName: data.customerName,
        items: data.items,
        totalAmount: data.amount,
        timestamp: new Date().toISOString()
      });
    }

    return eventId;
  }

  /**
   * Send a notification for order updates
   */
  public notifyOrderUpdated(data: OrderNotificationData): string {
    const config = this.notificationConfigs.get("order_updated")!;
    
    const message = data.tableNumber 
      ? `Ordine Tavolo ${data.tableNumber} aggiornato`
      : `Ordine ${data.orderType} aggiornato`;

    const version = getEntityVersion(EntityType.ORDER, data.orderId) + 1;

    const eventId = broadcastEnhanced(
      {
        type: config.type,
        message,
        data: {
          orderId: data.orderId,
          tableNumber: data.tableNumber,
          orderType: data.orderType,
          status: data.status,
          timestamp: new Date().toISOString(),
          syncVersion: Date.now(),
          version
        },
        targetRoles: config.targetRoles
      },
      {
        priority: config.priority,
        entityChanges: data.changes ? [{
          entityType: EntityType.ORDER,
          entityId: data.orderId,
          operation: OperationType.UPDATE,
          changes: data.changes,
          version,
          previousVersion: version - 1
        }] : undefined,
        acknowledgmentRequired: config.requiresAcknowledgment,
        ttl: config.ttl
      }
    );

    this.addToHistory({
      id: eventId,
      type: config.type,
      message,
      timestamp: new Date().toISOString(),
      priority: config.priority,
      targetRoles: config.targetRoles,
      data: data,
      syncVersion: Date.now()
    });

    return eventId;
  }

  /**
   * Send a notification when order is ready
   */
  public notifyOrderReady(data: OrderNotificationData): string {
    const config = this.notificationConfigs.get("order_ready")!;
    
    const message = data.tableNumber 
      ? `Ordine Tavolo ${data.tableNumber} PRONTO`
      : `Ordine ${data.orderType} PRONTO`;

    const eventId = broadcastEnhanced(
      {
        type: config.type,
        message,
        data: {
          orderId: data.orderId,
          tableNumber: data.tableNumber,
          orderType: data.orderType,
          status: "PRONTO",
          timestamp: new Date().toISOString(),
          syncVersion: Date.now()
        },
        targetRoles: config.targetRoles
      },
      {
        priority: config.priority,
        acknowledgmentRequired: config.requiresAcknowledgment,
        ttl: config.ttl
      }
    );

    this.addToHistory({
      id: eventId,
      type: config.type,
      message,
      timestamp: new Date().toISOString(),
      priority: config.priority,
      targetRoles: config.targetRoles,
      data: data,
      syncVersion: Date.now()
    });

    return eventId;
  }

  /**
   * Send a notification when order is delivered
   */
  public notifyOrderDelivered(data: OrderNotificationData): string {
    const config = this.notificationConfigs.get("order_delivered")!;
    
    const message = data.tableNumber 
      ? `Ordine Tavolo ${data.tableNumber} consegnato`
      : `Ordine ${data.orderType} consegnato`;

    const eventId = broadcastEnhanced(
      {
        type: config.type,
        message,
        data: {
          orderId: data.orderId,
          tableNumber: data.tableNumber,
          orderType: data.orderType,
          status: "CONSEGNATO",
          timestamp: new Date().toISOString(),
          syncVersion: Date.now()
        },
        targetRoles: config.targetRoles
      },
      {
        priority: config.priority,
        acknowledgmentRequired: config.requiresAcknowledgment,
        ttl: config.ttl
      }
    );

    this.addToHistory({
      id: eventId,
      type: config.type,
      message,
      timestamp: new Date().toISOString(),
      priority: config.priority,
      targetRoles: config.targetRoles,
      data: data,
      syncVersion: Date.now()
    });

    return eventId;
  }

  /**
   * Send a notification when order is paid
   */
  public notifyOrderPaid(data: OrderNotificationData): string {
    const config = this.notificationConfigs.get("order_paid")!;
    
    const message = data.tableNumber 
      ? `Tavolo ${data.tableNumber} pagato - €${data.amount?.toFixed(2)}`
      : `Ordine ${data.orderType} pagato - €${data.amount?.toFixed(2)}`;

    const eventId = broadcastEnhanced(
      {
        type: config.type,
        message,
        data: {
          orderId: data.orderId,
          tableNumber: data.tableNumber,
          orderType: data.orderType,
          amount: data.amount,
          customerName: data.customerName,
          timestamp: new Date().toISOString(),
          syncVersion: Date.now()
        },
        targetRoles: config.targetRoles
      },
      {
        priority: config.priority,
        acknowledgmentRequired: config.requiresAcknowledgment,
        ttl: config.ttl
      }
    );

    this.addToHistory({
      id: eventId,
      type: config.type,
      message,
      timestamp: new Date().toISOString(),
      priority: config.priority,
      targetRoles: config.targetRoles,
      data: data,
      syncVersion: Date.now()
    });

    return eventId;
  }

  /**
   * Send a notification when payment is requested
   */
  public notifyPaymentRequested(data: OrderNotificationData): string {
    const config = this.notificationConfigs.get("payment_requested")!;
    
    const message = data.tableNumber 
      ? `Richiesta pagamento Tavolo ${data.tableNumber} - €${data.amount?.toFixed(2)}`
      : `Richiesta pagamento ${data.orderType} - €${data.amount?.toFixed(2)}`;

    const eventId = broadcastEnhanced(
      {
        type: config.type,
        message,
        data: {
          orderId: data.orderId,
          tableNumber: data.tableNumber,
          orderType: data.orderType,
          amount: data.amount,
          customerName: data.customerName,
          timestamp: new Date().toISOString(),
          syncVersion: Date.now()
        },
        targetRoles: config.targetRoles
      },
      {
        priority: config.priority,
        acknowledgmentRequired: config.requiresAcknowledgment,
        ttl: config.ttl
      }
    );

    this.addToHistory({
      id: eventId,
      type: config.type,
      message,
      timestamp: new Date().toISOString(),
      priority: config.priority,
      targetRoles: config.targetRoles,
      data: data,
      syncVersion: Date.now()
    });

    return eventId;
  }

  /**
   * Send a notification when receipt is requested
   */
  public notifyReceiptRequested(data: OrderNotificationData & { paymentMethod?: string }): string {
    const config = this.notificationConfigs.get("receipt_requested")!;
    
    const message = data.tableNumber 
      ? `Richiesta scontrino Tavolo ${data.tableNumber} - €${data.amount?.toFixed(2)} (${data.paymentMethod || 'N/A'})`
      : `Richiesta scontrino ${data.orderType} - €${data.amount?.toFixed(2)} (${data.paymentMethod || 'N/A'})`;

    const eventId = broadcastEnhanced(
      {
        type: config.type,
        message,
        data: {
          orderId: data.orderId,
          tableNumber: data.tableNumber,
          orderType: data.orderType,
          amount: data.amount,
          customerName: data.customerName,
          waiterName: data.waiterName,
          paymentMethod: data.paymentMethod,
          timestamp: new Date().toISOString(),
          syncVersion: Date.now()
        },
        targetRoles: config.targetRoles
      },
      {
        priority: config.priority,
        acknowledgmentRequired: config.requiresAcknowledgment,
        ttl: config.ttl
      }
    );

    this.addToHistory({
      id: eventId,
      type: config.type,
      message,
      timestamp: new Date().toISOString(),
      priority: config.priority,
      targetRoles: config.targetRoles,
      data: data,
      syncVersion: Date.now()
    });

    return eventId;
  }

  /**
   * Send a notification when order is cancelled
   */
  public notifyOrderCancelled(data: OrderNotificationData & { reason?: string }): string {
    const config = this.notificationConfigs.get("order_cancelled") || {
      type: NotificationTypes.ORDER_UPDATE,
      priority: NotificationPriority.HIGH,
      targetRoles: ["CAMERIERE", "SUPERVISORE", "PREPARA", "CUCINA"],
      requiresAcknowledgment: false,
      ttl: 3600
    };
    
    const message = data.tableNumber 
      ? `Ordine Tavolo ${data.tableNumber} ANNULLATO`
      : `Ordine ${data.orderType} ANNULLATO`;

    const eventId = broadcastEnhanced(
      {
        type: config.type,
        message,
        data: {
          orderId: data.orderId,
          tableNumber: data.tableNumber,
          orderType: data.orderType,
          status: "ANNULLATO",
          reason: data.reason || "Annullato dall'utente",
          timestamp: new Date().toISOString(),
          syncVersion: Date.now()
        },
        targetRoles: config.targetRoles
      },
      {
        priority: config.priority,
        acknowledgmentRequired: config.requiresAcknowledgment,
        ttl: config.ttl
      }
    );

    this.addToHistory({
      id: eventId,
      type: config.type,
      message,
      timestamp: new Date().toISOString(),
      priority: config.priority,
      targetRoles: config.targetRoles,
      data: data,
      syncVersion: Date.now()
    });

    return eventId;
  }

  /**
   * Send a notification for item status changes
   */
  public notifyItemStatusChange(
    orderId: string,
    itemId: string,
    newStatus: string,
    itemName: string,
    tableNumber?: number
  ): string {
    let configKey = "item_in_progress";
    if (newStatus === "PRONTO") configKey = "item_ready";
    else if (newStatus === "CONSEGNATO") configKey = "item_delivered";
    
    const config = this.notificationConfigs.get(configKey)!;
    
    const message = tableNumber 
      ? `${itemName} - Tavolo ${tableNumber} → ${newStatus}`
      : `${itemName} → ${newStatus}`;

    const eventId = notifyEntityChange(
      EntityType.ORDER_ITEM,
      itemId,
      OperationType.UPDATE,
      [{
        field: "stato",
        oldValue: null,
        newValue: newStatus
      }],
      {
        message,
        targetRoles: config.targetRoles,
        priority: config.priority
      }
    );

    this.addToHistory({
      id: eventId,
      type: config.type,
      message,
      timestamp: new Date().toISOString(),
      priority: config.priority,
      targetRoles: config.targetRoles,
      data: { orderId, itemId, newStatus, itemName, tableNumber },
      syncVersion: Date.now()
    });

    return eventId;
  }

  /**
   * Send a notification for payment requests
   */
  public notifyPaymentRequested(data: OrderNotificationData): string {
    const config = this.notificationConfigs.get("payment_requested")!;
    
    const message = data.tableNumber 
      ? `Richiesta pagamento Tavolo ${data.tableNumber} - €${data.amount?.toFixed(2)}`
      : `Richiesta pagamento ${data.orderType} - €${data.amount?.toFixed(2)}`;

    const eventId = broadcastEnhanced(
      {
        type: config.type,
        message,
        data: {
          orderId: data.orderId,
          tableNumber: data.tableNumber,
          orderType: data.orderType,
          amount: data.amount,
          customerName: data.customerName,
          timestamp: new Date().toISOString()
        },
        targetRoles: config.targetRoles
      },
      {
        priority: config.priority,
        acknowledgmentRequired: config.requiresAcknowledgment,
        ttl: config.ttl,
        entityChanges: [{
          entityType: EntityType.PAYMENT,
          entityId: `payment_${data.orderId}_${Date.now()}`,
          operation: OperationType.CREATE,
          version: 1,
          changes: []
        }]
      }
    );

    this.addToHistory({
      id: eventId,
      type: config.type,
      message,
      timestamp: new Date().toISOString(),
      priority: config.priority,
      targetRoles: config.targetRoles,
      data: data,
      syncVersion: Date.now()
    });

    return eventId;
  }

  /**
   * Send a notification for duplicate order warnings
   */
  public notifyDuplicateOrderWarning(
    tableNumber: number,
    existingOrderId: string,
    attemptedItems: any[]
  ): string {
    const config = this.notificationConfigs.get("duplicate_order_warning")!;
    
    const message = `Possibile ordine duplicato - Tavolo ${tableNumber}`;

    const eventId = broadcastEnhanced(
      {
        type: config.type,
        message,
        data: {
          tableNumber,
          existingOrderId,
          attemptedItems,
          timestamp: new Date().toISOString()
        },
        targetRoles: config.targetRoles
      },
      {
        priority: config.priority,
        acknowledgmentRequired: config.requiresAcknowledgment,
        ttl: config.ttl
      }
    );

    this.addToHistory({
      id: eventId,
      type: config.type,
      message,
      timestamp: new Date().toISOString(),
      priority: config.priority,
      targetRoles: config.targetRoles,
      data: { tableNumber, existingOrderId, attemptedItems },
      syncVersion: Date.now()
    });

    return eventId;
  }

  /**
   * Get notification history
   */
  public getHistory(filters?: {
    types?: string[];
    priorities?: NotificationPriority[];
    targetRoles?: string[];
    limit?: number;
  }): EnhancedSSENotification[] {
    let history = [...this.notificationHistory];

    if (filters?.types) {
      history = history.filter(n => filters.types!.includes(n.type));
    }

    if (filters?.priorities) {
      history = history.filter(n => filters.priorities!.includes(n.priority));
    }

    if (filters?.targetRoles) {
      history = history.filter(n => 
        n.targetRoles?.some(role => filters.targetRoles!.includes(role))
      );
    }

    if (filters?.limit) {
      history = history.slice(0, filters.limit);
    }

    return history;
  }

  /**
   * Clear notification history
   */
  public clearHistory(): void {
    this.notificationHistory = [];
  }

  /**
   * Get notification configuration
   */
  public getConfig(notificationType: string): NotificationConfig | undefined {
    return this.notificationConfigs.get(notificationType);
  }

  /**
   * Update notification configuration
   */
  public updateConfig(notificationType: string, config: Partial<NotificationConfig>): void {
    const existing = this.notificationConfigs.get(notificationType);
    if (existing) {
      this.notificationConfigs.set(notificationType, {
        ...existing,
        ...config
      });
    }
  }

  /**
   * Get all available notification types
   */
  public getAvailableTypes(): string[] {
    return Array.from(this.notificationConfigs.keys());
  }

  /**
   * Check if a notification type should be sent to a specific role
   */
  public shouldNotifyRole(notificationType: string, role: string): boolean {
    const config = this.notificationConfigs.get(notificationType);
    return config ? config.targetRoles.includes(role) : false;
  }

  private addToHistory(notification: EnhancedSSENotification): void {
    this.notificationHistory.unshift(notification);
    
    // Keep only the most recent notifications
    if (this.notificationHistory.length > this.maxHistorySize) {
      this.notificationHistory = this.notificationHistory.slice(0, this.maxHistorySize);
    }
  }
}

// Export singleton instance
export const notificationManager = NotificationManager.getInstance();