# Out of Stock Feature Documentation

## Overview

This feature allows kitchen staff to mark products as out of stock during order preparation. When a product is marked as out of stock, the system automatically:

1. Splits affected orders into available and out-of-stock items
2. Creates waiting orders for out-of-stock items
3. Notifies waiters in real-time
4. Allows waiters to either cancel or substitute the out-of-stock items

## How It Works

### For Kitchen Staff (Prepara Page)

1. **Mark Product as Out of Stock**
   - Click the warning triangle icon (⚠️) next to any product in an order
   - The system shows all orders that will be affected
   - Confirm to mark the product as out of stock

2. **What Happens Next**
   - The product is marked as `terminato` (out of stock) in the database
   - Orders are automatically split:
     - Available items continue to be prepared normally
     - Out-of-stock items are moved to a new "waiting" order
   - Waiters receive instant notifications

### For Waiters

1. **Receiving Notifications**
   - A popup appears immediately when their order has out-of-stock items
   - An audio notification plays (configurable)
   - The notification shows which products are out of stock

2. **Handling Out-of-Stock Items**
   - **Cancel**: Remove the out-of-stock items from the order
   - **Substitute**: Replace with other available products
     - Can add multiple substitute products
     - Shows product prices for easy reference

## Technical Implementation

### Database Changes

- `Prodotto.terminato`: Boolean field to mark products as permanently out of stock
- Order splitting creates new orders with status 'ORDINATO' (waiting)

### Server Actions

- `/lib/actions/out-of-stock.ts`:
  - `markProductAsOutOfStock()`: Marks product and splits orders
  - `handleOutOfStockResponse()`: Processes waiter's decision
  - `getWaitingOutOfStockOrders()`: Lists orders waiting for resolution

### Components

- `/components/prepara/OutOfStockModal.tsx`: Confirmation modal for kitchen staff
- `/components/cameriere/OutOfStockNotification.tsx`: Waiter notification popup
- `/components/cameriere/OutOfStockNotificationProvider.tsx`: Global listener for notifications

### Real-time Events

- `product:out-of-stock`: General notification when product is marked out of stock
- `order:out-of-stock`: Specific notification to affected waiters
- `order:cancelled`: When waiter cancels out-of-stock items
- `order:substituted`: When waiter adds substitute products

## Configuration

### Notification Sound

Place your notification sound file at `/public/sounds/notification.mp3`. If the file is not found, the system will use a fallback beep sound generated via Web Audio API.

## Future Enhancements

1. **Product Availability Forecasting**
   - Track product usage patterns
   - Predict when products might run out

2. **Automatic Substitution Suggestions**
   - Suggest similar products based on category
   - Remember customer preferences

3. **Inventory Integration**
   - Connect to inventory management system
   - Automatically mark products as out of stock when inventory reaches zero

4. **Analytics**
   - Track which products frequently go out of stock
   - Optimize menu and inventory planning