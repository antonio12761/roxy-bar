# Unified Notification System Documentation

## Overview

The unified notification system centralizes all order-related notifications across all stations (Cameriere, Prepara, Cucina, Cassa, Supervisore). It provides consistent behavior, role-specific routing, and advanced features like priorities, acknowledgments, and persistence.

## Architecture

### Core Components

1. **NotificationManager** (`/lib/notifications/NotificationManager.ts`)
   - Singleton class that manages all notification types
   - Handles notification creation, routing, and history
   - Provides role-specific notification filtering
   - Manages notification configurations

2. **NotificationCenter** (`/components/NotificationCenter.tsx`)
   - UI component for displaying notifications
   - Shows real-time notifications with unread counts
   - Provides filtering by type and priority
   - Includes audio notifications and user preferences

3. **NotificationPreferencesContext** (`/lib/contexts/NotificationPreferencesContext.tsx`)
   - React context for managing user preferences
   - Persists settings to localStorage
   - Provides hooks for preference management

4. **NotificationSettings** (`/components/NotificationSettings.tsx`)
   - Settings UI for configuring notification preferences
   - Allows enabling/disabling specific notification types
   - Audio settings and volume control
   - Priority filtering options

## Notification Types

### Order Lifecycle
- `order_created` - New order created
- `order_updated` - Order status changed
- `order_ready` - All items in order are ready
- `order_delivered` - Order has been delivered
- `order_paid` - Payment completed

### Item Status
- `item_in_progress` - Item being prepared
- `item_ready` - Single item ready for delivery
- `item_delivered` - Item delivered to customer

### Payment
- `payment_requested` - Payment requested by waiter
- `payment_completed` - Payment processed successfully

### System
- `duplicate_order_warning` - Possible duplicate order detected
- `order_conflict` - Conflict in order processing

## Priority Levels

1. **URGENT** - Critical notifications requiring immediate attention
   - Duplicate order warnings
   - Order conflicts
   
2. **HIGH** - Important notifications
   - New orders
   - Items/orders ready
   - Payment requests

3. **NORMAL** - Standard notifications
   - Order updates
   - Payment completions

4. **LOW** - Informational notifications
   - System synchronization
   - Background updates

## Role-Based Routing

Each notification type targets specific roles:

- **CAMERIERE** (Waiter): All order and payment notifications
- **PREPARA** (Bar): New orders, item status for bar items
- **CUCINA** (Kitchen): New orders, item status for kitchen items
- **CASSA** (Cashier): Payment requests, delivered orders
- **SUPERVISORE** (Supervisor): All notifications

## Integration Guide

### 1. Add NotificationCenter to Layout

```tsx
import NotificationIntegration from "@/components/NotificationIntegration";
import { getCurrentUser } from "@/lib/auth";

export default async function Layout({ children }) {
  const user = await getCurrentUser();
  
  return (
    <div>
      <header>
        <nav>
          {/* Other nav items */}
          <NotificationIntegration userRole={user.ruolo} />
        </nav>
      </header>
      <main>{children}</main>
    </div>
  );
}
```

### 2. Send Notifications from Actions

```typescript
import { notificationManager } from "@/lib/notifications/NotificationManager";

// When creating an order
notificationManager.notifyOrderCreated({
  orderId: order.id,
  tableNumber: tableNumber,
  orderType: "TAVOLO",
  items: orderItems,
  customerName: customerName,
  waiterName: waiterName
});

// When updating item status
notificationManager.notifyItemStatusChange(
  orderId,
  itemId,
  "PRONTO",
  itemName,
  tableNumber
);

// When requesting payment
notificationManager.notifyPaymentRequested({
  orderId: orderId,
  tableNumber: tableNumber,
  orderType: "TAVOLO",
  amount: totalAmount,
  customerName: customerName
});
```

### 3. Add Settings Page

Create a settings page for users to configure their notification preferences:

```tsx
import NotificationSettings from "@/components/NotificationSettings";
import { NotificationPreferencesProvider } from "@/lib/contexts/NotificationPreferencesContext";

export default function SettingsPage() {
  return (
    <NotificationPreferencesProvider>
      <NotificationSettings />
    </NotificationPreferencesProvider>
  );
}
```

## Audio Notifications

The system supports audio notifications with different sounds for each priority level. Add the following audio files to `/public/sounds/`:

- `normal.mp3` - For normal priority notifications
- `high.mp3` - For high priority notifications
- `urgent.mp3` - For urgent priority notifications

## Notification Flow

1. **Order Creation**
   ```
   Cameriere creates order → NotificationManager.notifyOrderCreated()
   → Broadcasts to Prepara/Cucina based on item destinations
   → Shows in NotificationCenter with HIGH priority
   → Plays high priority sound
   ```

2. **Item Status Update**
   ```
   Prepara marks item ready → NotificationManager.notifyItemStatusChange()
   → Broadcasts to Cameriere
   → Shows in NotificationCenter
   → If all items ready, triggers order ready notification
   ```

3. **Payment Request**
   ```
   Cameriere requests payment → NotificationManager.notifyPaymentRequested()
   → Broadcasts to Cassa with URGENT priority
   → Requires acknowledgment
   → Shows in NotificationCenter until processed
   ```

## Persistence and History

- Last 50 notifications are stored in memory
- Read/unread status persisted in localStorage
- User preferences saved in localStorage
- Notifications can be filtered and searched
- History cleared on demand or when limit reached

## Best Practices

1. **Always use NotificationManager** for sending notifications
2. **Set appropriate priorities** based on urgency
3. **Include relevant data** in notifications (table number, amounts, etc.)
4. **Use acknowledgments** for critical notifications
5. **Test audio files** across different browsers
6. **Monitor notification volume** to avoid overwhelming users

## Troubleshooting

### Notifications not appearing
- Check user role matches target roles
- Verify notification type is enabled in preferences
- Check browser console for errors
- Ensure SSE connection is active

### Audio not playing
- Check audio files exist in `/public/sounds/`
- Verify audio is enabled in preferences
- Browser may block autoplay - user interaction required
- Check volume settings

### Duplicate notifications
- Ensure notifications are sent only once per action
- Check for multiple SSE connections
- Verify event IDs are unique

## Future Enhancements

1. **Push Notifications** - Browser push API integration
2. **Email Notifications** - For critical alerts
3. **Notification Templates** - Customizable message formats
4. **Analytics** - Track notification engagement
5. **Mobile App Integration** - Native mobile notifications
6. **Webhook Support** - External system integration