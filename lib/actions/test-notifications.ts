"use server";

import { getCurrentUser } from "@/lib/auth";
import { notificationManager } from "@/lib/notifications/NotificationManager";
import { sseService } from "@/lib/sse/sse-service";

/**
 * Test function to send a notification to all waiters
 * This helps verify the notification system is working
 */
export async function testWaiterNotification() {
  try {
    const utente = await getCurrentUser();
    if (!utente) {
      return { success: false, error: "Utente non autenticato" };
    }

    console.log("🧪 Testing waiter notifications...");

    // Test 1: Send via notification manager
    const notificationId = notificationManager.notifyOrderReady({
      orderId: "test-order-123",
      tableNumber: 99,
      orderType: "TAVOLO",
      items: [
        { nome: "Test Item", quantita: 1, destinazione: "BAR" }
      ]
    });

    console.log("✅ NotificationManager event sent:", notificationId);

    // Test 2: Send direct SSE event
    sseService.emit('order:ready', {
      orderId: 'test-order-456',
      tableNumber: 88,
      readyItems: ['Test Item 1', 'Test Item 2'],
      timestamp: new Date().toISOString()
    }, {
      broadcast: true // Send to all connected clients for testing
    });

    console.log("✅ Direct SSE event sent");

    // Test 3: Send generic notification
    sseService.emit('notification:new', {
      id: `test_${Date.now()}`,
      title: 'Test Notification',
      message: 'Questa è una notifica di test per i camerieri',
      priority: 'high' as const,
      targetRoles: ['CAMERIERE']
    }, {
      channels: ['station:waiter', 'notifications']
    });

    console.log("✅ Generic notification sent");

    return {
      success: true,
      message: "Test notifications sent successfully. Check waiter pages for notifications."
    };

  } catch (error) {
    console.error("❌ Error testing notifications:", error);
    return {
      success: false,
      error: "Error during notification test"
    };
  }
}

/**
 * Test the connection status for a specific user
 */
export async function checkSSEConnection() {
  try {
    const utente = await getCurrentUser();
    if (!utente) {
      return { success: false, error: "Utente non autenticato" };
    }

    const stats = sseService.getStats();
    
    return {
      success: true,
      stats: {
        totalClients: stats.totalClients,
        userConnections: stats.clientsByUser[utente.id] || 0,
        memoryUsage: stats.memoryUsage
      }
    };

  } catch (error) {
    console.error("Error checking SSE connection:", error);
    return {
      success: false,
      error: "Error checking connection"
    };
  }
}