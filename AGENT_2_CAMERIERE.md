# Agent 2 - /cameriere Implementation

## Overview
This agent is responsible for implementing the waiter-side functionality for handling out-of-stock notifications and order management in the `/cameriere` section.

## Current State
- Waiters use the `/cameriere` interface to view and manage orders
- Real-time updates via Server-Sent Events (SSE)
- Orders flow: ORDINATO → IN_PREPARAZIONE → PRONTO → CONSEGNATO

## Required Implementation

### 1. Out-of-Stock Notification System
Create notification component `/components/cameriere/OutOfStockNotification.tsx`:
- Toast/modal appears when kitchen marks item as out-of-stock
- Shows:
  - Item name and quantity marked as out-of-stock
  - Table number and customer name
  - "Gestisco io" (I'll handle it) button
  - Auto-dismiss after 30 seconds if not claimed

### 2. Notification Claim System
Implement claim functionality:
- When waiter clicks "Gestisco io":
  - Notification dismissed for all waiters
  - Claiming waiter's name recorded in system
  - Prevent multiple claims on same notification
- Add `claimedBy` field to notification tracking

### 3. Update Order Display
Modify order cards in `/cameriere` to show:
- Visual indicator for orders with out-of-stock items
- Red badge or border for ORDINATO_ESAURITO orders
- Clear distinction between available and unavailable items
- Waiter who claimed the notification

### 4. Customer Communication Flow
Add interface elements for:
- Quick access to out-of-stock orders
- Template messages for customer communication
- Option to mark customer as "informed"
- Track communication status

### 5. SSE Integration
Update SSE handlers in waiter interface:
- Listen for 'out-of-stock' events
- Update local state when notifications claimed
- Remove claimed notifications from other waiters' views
- Handle reconnection scenarios

### 6. Order Status Management
- Show ORDINATO_ESAURITO orders in dedicated section
- Allow transition back to ORDINATO when stock restored
- Maintain order history for out-of-stock incidents

## Key Files to Create/Modify
1. `/components/cameriere/OutOfStockNotification.tsx` - Notification component
2. `/components/cameriere/OutOfStockBadge.tsx` - Visual indicator component
3. `/hooks/useOutOfStockNotifications.ts` - Notification state management
4. `/app/cameriere/page.tsx` - Integrate notification system
5. `/lib/actions/cameriere.ts` - Add claim notification action

## UI/UX Requirements
- Notification appears as prominent toast/modal
- Red color scheme for out-of-stock elements
- Clear CTA button "Gestisco io"
- Smooth animations for appearance/dismissal
- Mobile-responsive design

## API Endpoints Needed
- `POST /api/notifications/claim` - Claim out-of-stock notification
- `GET /api/orders/out-of-stock` - Get all out-of-stock orders
- `PUT /api/orders/customer-informed` - Mark customer as informed

## State Management
```typescript
interface OutOfStockNotification {
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
}
```

## Testing Checklist
- [ ] Notifications appear for all connected waiters
- [ ] "Gestisco io" button claims notification
- [ ] Claimed notifications disappear for other waiters
- [ ] Orders show out-of-stock visual indicators
- [ ] Can mark customer as informed
- [ ] Notifications auto-dismiss after timeout
- [ ] Reconnection maintains notification state
- [ ] Mobile view works correctly

## Important Notes
- Ensure real-time sync across all waiter devices
- Handle offline scenarios gracefully
- Prevent duplicate notifications
- Maintain notification history for reporting
- Consider notification sound/vibration for mobile devices