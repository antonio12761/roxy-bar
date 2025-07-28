// Example usage of the enhanced SSE system
// This file demonstrates how to migrate from the old useSSE to the new useEnhancedSSE

import { useEnhancedSSE } from "@/hooks/useEnhancedSSE";
import { useSSE } from "@/lib/hooks/useSSE";
import { EntityType, NotificationPriority } from "@/lib/types/notifications";

// Example 1: Basic migration - drop-in replacement
export function BasicMigrationExample() {
  // Old way
  const oldSSE = useSSE({
    clientId: "waiter-123",
    userRole: "CAMERIERE",
    onNotification: (notification) => {
      console.log("Old notification:", notification);
    }
  });

  // New way - backward compatible
  const enhancedSSE = useEnhancedSSE({
    clientId: "waiter-123",
    userRole: "CAMERIERE",
    onNotification: (notification) => {
      console.log("Enhanced notification:", notification);
    }
  });

  return (
    <div>
      <h3>Connection Status</h3>
      <p>Old: {oldSSE.isConnected ? "Connected" : "Disconnected"}</p>
      <p>New: {enhancedSSE.connectionHealth.status}</p>
      <p>Quality: {enhancedSSE.connectionHealth.quality}</p>
      <p>Latency: {enhancedSSE.connectionHealth.latency}ms</p>
    </div>
  );
}

// Example 2: Using entity updates for optimistic UI
export function OptimisticUIExample() {
  const { applyOptimisticUpdate, rollbackOptimisticUpdate, optimisticUpdates } = useEnhancedSSE({
    userRole: "CAMERIERE",
    enableOptimisticUpdates: true,
    onEntityUpdate: (entityType, entityId, changes) => {
      // Handle confirmed updates from server
      if (entityType === EntityType.ORDER) {
        console.log(`Order ${entityId} updated:`, changes);
        // Update your local state here
      }
    }
  });

  const handleOrderStatusUpdate = async (orderId: string, newStatus: string) => {
    // Apply optimistic update immediately
    const updateId = applyOptimisticUpdate(
      EntityType.ORDER,
      orderId,
      [{ field: "status", oldValue: "PENDING", newValue: newStatus }],
      { status: "PENDING" } // Rollback data
    );

    try {
      // Make API call
      const response = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) {
        // Rollback on failure
        rollbackOptimisticUpdate(updateId);
      }
      // If successful, the SSE notification will confirm the update
    } catch (error) {
      // Rollback on error
      rollbackOptimisticUpdate(updateId);
    }
  };

  return (
    <div>
      <h3>Optimistic Updates</h3>
      {optimisticUpdates.map(update => (
        <div key={update.id}>
          {update.entityType} {update.entityId}: 
          {update.confirmed ? "✓ Confirmed" : "⏳ Pending"}
        </div>
      ))}
    </div>
  );
}

// Example 3: Advanced features - event replay and offline support
export function AdvancedFeaturesExample() {
  const sse = useEnhancedSSE({
    userRole: "CASSA",
    enableEventReplay: true,
    queueOfflineEvents: true,
    maxReconnectAttempts: 15,
    reconnectDelay: 2000,
    onNotification: (notification) => {
      // Acknowledge high-priority notifications
      if (notification.acknowledgmentRequired) {
        sse.sendAcknowledgment(notification.id, "processed");
      }

      // Handle different priorities
      switch (notification.priority) {
        case NotificationPriority.URGENT:
          // Show modal or alert
          alert(`URGENT: ${notification.message}`);
          break;
        case NotificationPriority.HIGH:
          // Show toast notification
          console.warn(`HIGH PRIORITY: ${notification.message}`);
          break;
        default:
          console.log(notification.message);
      }
    }
  });

  const handleReplayEvents = () => {
    // Replay events from 5 minutes ago
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    sse.replayEvents(fiveMinutesAgo);
  };

  return (
    <div>
      <h3>Advanced Features</h3>
      <p>Queued Events: {sse.eventQueue.length}</p>
      <button onClick={handleReplayEvents}>Replay Last 5 Minutes</button>
      <button onClick={() => sse.clearNotifications()}>Clear Notifications</button>
      
      <h4>Recent Notifications</h4>
      {sse.notifications.slice(0, 5).map(notif => (
        <div key={notif.id} style={{ 
          borderLeft: `4px solid ${
            notif.priority === NotificationPriority.URGENT ? 'red' :
            notif.priority === NotificationPriority.HIGH ? 'orange' :
            'green'
          }`
        }}>
          <strong>{notif.type}</strong>: {notif.message}
          <small> ({new Date(notif.timestamp).toLocaleTimeString()})</small>
        </div>
      ))}
    </div>
  );
}

// Example 4: Using the enhanced broadcasting from server-side
export async function serverSideExample() {
  // Import the enhanced notification functions
  const { 
    notifyEntityChange, 
    notifyBulkUpdate,
    broadcastEnhanced 
  } = await import("@/lib/notifications");

  // Example 1: Granular entity update
  notifyEntityChange(
    EntityType.ORDER,
    "order_123",
    "update",
    [
      { field: "status", oldValue: "PENDING", newValue: "PREPARING" },
      { field: "updatedAt", oldValue: "2024-01-01", newValue: new Date().toISOString() }
    ],
    {
      message: "Order status changed to PREPARING",
      targetRoles: ["CAMERIERE", "CUCINA"],
      priority: NotificationPriority.HIGH
    }
  );

  // Example 2: Bulk updates with correlation
  const correlationId = `bulk_price_update_${Date.now()}`;
  notifyBulkUpdate(
    EntityType.PRODUCT,
    [
      { entityId: "prod_1", changes: [{ field: "price", oldValue: 10, newValue: 12 }] },
      { entityId: "prod_2", changes: [{ field: "price", oldValue: 15, newValue: 18 }] },
      { entityId: "prod_3", changes: [{ field: "price", oldValue: 20, newValue: 24 }] }
    ],
    "Bulk price update: 20% increase",
    ["ADMIN", "MANAGER"]
  );

  // Example 3: Custom enhanced notification
  broadcastEnhanced(
    {
      type: "kitchen_alert",
      message: "⚠️ Kitchen printer offline",
      data: { 
        printerId: "kitchen_1",
        lastSeen: new Date().toISOString()
      },
      targetRoles: ["CUCINA", "MANAGER"]
    },
    {
      priority: NotificationPriority.URGENT,
      acknowledgmentRequired: true,
      ttl: 300 // 5 minutes
    }
  );
}