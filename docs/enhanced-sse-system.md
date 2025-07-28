# Enhanced SSE Event System Documentation

## Overview

The enhanced SSE (Server-Sent Events) system provides real-time communication with improved reliability, granular updates, and offline support. It's fully backward compatible with the existing system.

## Key Improvements

### 1. Enhanced Event Payload Structure
- **Operation Types**: `create`, `update`, `delete`, `bulk_update`, `sync`
- **Entity-specific Change Tracking**: Track individual field changes
- **Version Control**: Optimistic locking with version numbers
- **Priority Levels**: `low`, `normal`, `high`, `urgent`

### 2. Connection Health Monitoring
- Real-time connection quality indicators
- Latency measurements
- Automatic reconnection with exponential backoff
- Connection state tracking

### 3. Message Queuing & Offline Support
- Messages queued during disconnections
- Automatic redelivery when reconnected
- Event expiration (TTL) support
- Queue size limits to prevent memory issues

### 4. Event Acknowledgment System
- Clients can acknowledge receipt of important events
- Server tracks acknowledgments
- Automatic retry for unacknowledged events

### 5. Incremental Updates
- Send only changed fields instead of full objects
- Optimistic UI updates with automatic rollback
- Conflict detection and resolution

## Migration Guide

### Client-Side Migration

#### Basic Usage (Backward Compatible)
```typescript
// Old way
import { useSSE } from "@/lib/hooks/useSSE";

const sse = useSSE({
  clientId: "user123",
  userRole: "CAMERIERE",
  onNotification: (notif) => console.log(notif)
});

// New way - drop-in replacement
import { useEnhancedSSE } from "@/hooks/useEnhancedSSE";

const sse = useEnhancedSSE({
  clientId: "user123",
  userRole: "CAMERIERE",
  onNotification: (notif) => console.log(notif)
});
```

#### Using New Features
```typescript
const sse = useEnhancedSSE({
  userRole: "CAMERIERE",
  
  // Handle entity-specific updates
  onEntityUpdate: (entityType, entityId, changes) => {
    if (entityType === EntityType.ORDER) {
      updateOrderInUI(entityId, changes);
    }
  },
  
  // Enable optimistic updates
  enableOptimisticUpdates: true,
  
  // Connection settings
  maxReconnectAttempts: 10,
  reconnectDelay: 3000,
  
  // Enable offline support
  queueOfflineEvents: true,
  enableEventReplay: true
});

// Apply optimistic update
const updateId = sse.applyOptimisticUpdate(
  EntityType.ORDER,
  "order123",
  [{ field: "status", oldValue: "PENDING", newValue: "CONFIRMED" }]
);

// Rollback if needed
sse.rollbackOptimisticUpdate(updateId);

// Check connection health
console.log(sse.connectionHealth.quality); // "excellent" | "good" | "fair" | "poor"
console.log(sse.connectionHealth.latency); // milliseconds
```

### Server-Side Migration

#### Basic Notifications (Backward Compatible)
```typescript
import { broadcast, notifyOrderUpdate } from "@/lib/notifications";

// Old way still works
broadcast({
  type: "order_update",
  message: "Order updated",
  data: { orderId: "123" }
});

// Enhanced way with same function
notifyOrderUpdate("123", "READY", 5);
```

#### Using Enhanced Features
```typescript
import { 
  notifyEntityChange, 
  notifyBulkUpdate,
  broadcastEnhanced,
  EntityType,
  OperationType,
  NotificationPriority 
} from "@/lib/notifications";

// Granular entity update
notifyEntityChange(
  EntityType.ORDER,
  "order_123",
  OperationType.UPDATE,
  [
    { field: "status", oldValue: "PENDING", newValue: "CONFIRMED" },
    { field: "total", oldValue: 50, newValue: 55 }
  ],
  {
    message: "Order confirmed with price adjustment",
    targetRoles: ["CAMERIERE", "CASSA"],
    priority: NotificationPriority.HIGH,
    correlationId: "checkout_flow_123"
  }
);

// Bulk updates
notifyBulkUpdate(
  EntityType.PRODUCT,
  [
    { entityId: "prod1", changes: [{ field: "stock", oldValue: 10, newValue: 5 }] },
    { entityId: "prod2", changes: [{ field: "stock", oldValue: 20, newValue: 15 }] }
  ],
  "Stock updated after sale",
  ["MANAGER", "WAREHOUSE"]
);

// Custom enhanced notification
broadcastEnhanced(
  {
    type: "custom_alert",
    message: "Important system message",
    data: { /* custom data */ }
  },
  {
    priority: NotificationPriority.URGENT,
    acknowledgmentRequired: true,
    ttl: 600, // 10 minutes
    entityChanges: [/* optional entity changes */]
  }
);
```

## API Reference

### Types

#### NotificationPriority
```typescript
enum NotificationPriority {
  LOW = "low",
  NORMAL = "normal",
  HIGH = "high",
  URGENT = "urgent"
}
```

#### OperationType
```typescript
enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  BULK_UPDATE = "bulk_update",
  SYNC = "sync"
}
```

#### EntityType
```typescript
enum EntityType {
  ORDER = "order",
  ORDER_ITEM = "order_item",
  TABLE = "table",
  PRODUCT = "product",
  CATEGORY = "category",
  USER = "user",
  PAYMENT = "payment"
}
```

#### ConnectionHealth
```typescript
interface ConnectionHealth {
  status: "connected" | "disconnected" | "connecting" | "error";
  quality: "excellent" | "good" | "fair" | "poor";
  latency: number;
  lastPingTime: number;
  missedPings: number;
  reconnectAttempts: number;
}
```

### useEnhancedSSE Hook

#### Options
- `clientId`: Unique client identifier (auto-generated if not provided)
- `userRole`: User role for filtering notifications
- `onNotification`: Callback for all notifications
- `onEntityUpdate`: Callback for entity-specific updates
- `autoReconnect`: Enable auto-reconnection (default: true)
- `enableOptimisticUpdates`: Enable optimistic UI updates (default: true)
- `maxReconnectAttempts`: Maximum reconnection attempts (default: 10)
- `reconnectDelay`: Base delay between reconnections in ms (default: 3000)
- `enableEventReplay`: Enable event replay capability (default: true)
- `queueOfflineEvents`: Queue events when offline (default: true)

#### Returns
- `isConnected`: Boolean connection status
- `connectionHealth`: Detailed connection health metrics
- `notifications`: Array of recent notifications
- `lastNotification`: Most recent notification
- `optimisticUpdates`: Array of pending optimistic updates
- `eventQueue`: Queued events (offline support)
- `applyOptimisticUpdate()`: Apply optimistic update
- `rollbackOptimisticUpdate()`: Rollback optimistic update
- `connect()`: Manually connect
- `disconnect()`: Manually disconnect
- `clearNotifications()`: Clear notification history
- `replayEvents()`: Replay events from timestamp
- `sendAcknowledgment()`: Acknowledge event receipt

## Best Practices

1. **Use Entity-Specific Updates**: Instead of broadcasting entire objects, send only the changed fields.

2. **Set Appropriate Priorities**: Use priority levels to ensure important notifications get proper attention.

3. **Implement Acknowledgments**: For critical notifications, require acknowledgments to ensure delivery.

4. **Handle Offline Scenarios**: The system automatically queues messages, but consider UI indicators for offline state.

5. **Version Control**: Use version numbers to detect and handle concurrent updates.

6. **Correlation IDs**: Group related events using correlation IDs for better tracking.

## Performance Considerations

- Message queues are limited to 1000 messages per client
- Latency checks run every 60 seconds
- Keep-alive pings sent every 15 seconds
- Staggered message delivery for queued events (100ms intervals)
- Automatic cleanup of expired messages based on TTL

## Troubleshooting

### Connection Issues
- Check `connectionHealth.status` and `connectionHealth.quality`
- Monitor `connectionHealth.reconnectAttempts`
- Verify network connectivity

### Message Delivery
- Check if messages require acknowledgment
- Verify TTL hasn't expired
- Check message queue size

### Performance
- Monitor queue sizes
- Check for message acknowledgment backlog
- Verify version conflicts aren't causing repeated updates