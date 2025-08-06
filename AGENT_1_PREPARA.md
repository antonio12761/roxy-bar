# Agent 1 - /prepara Implementation

## Overview
This agent is responsible for implementing the out-of-stock product handling functionality in the `/prepara` section of the application.

## Current State
- The `/prepara` page has been refactored and split into multiple components
- Main file: `/app/prepara/page-wrapper-optimized.tsx` (reduced from 2661 to 1288 lines)
- Order management uses Prisma with transaction isolation
- Real-time updates via Server-Sent Events (SSE)

## Required Implementation

### 1. Database Schema Update
Add new order status `ORDINATO_ESAURITO` to the Prisma schema:
- Update the `StatoOrdinazione` enum in `schema.prisma`
- Run migrations to update the database

### 2. Add "Esauriti" Tab
- Add new tab before "Attesa" in `/components/prepara/PreparaTabs.tsx`
- Tab should have red background color
- Update `activeTab` type to include 'esauriti'
- Update filtering logic in `/utils/orderFilters.ts`

### 3. Out-of-Stock Modal Implementation
Create a new component `/components/prepara/OutOfStockModal.tsx`:
- Modal appears when marking item as out-of-stock
- If quantity > 1, ask how many are out-of-stock
- If quantity = 1, proceed directly without modal
- Modal should have:
  - Item name and current quantity
  - Input field for out-of-stock quantity
  - Confirm/Cancel buttons

### 4. Order Splitting Logic
Implement in `/lib/actions/ordinazioni.ts`:
- Create function `splitOrderForOutOfStock(orderId, itemId, outOfStockQuantity)`
- Logic:
  1. Create new order with status `ORDINATO_ESAURITO`
  2. Copy basic order info (table, customer, waiter)
  3. Move out-of-stock items to new order
  4. Update original order to keep only available items
  5. Both orders should maintain relationship

### 5. Update Order Actions
Modify existing functions in `/lib/actions/ordinazioni.ts`:
- Add `markItemAsOutOfStock(itemId, quantity)` function
- Update item status handling to support out-of-stock state
- Ensure transaction safety with Prisma

### 6. SSE Event Updates
Update SSE handlers in `/app/api/sse/ordinazioni/route.ts`:
- Add new event type for out-of-stock notifications
- Broadcast to all connected waiters when item marked out-of-stock
- Include order split information in events

## Key Files to Modify
1. `/prisma/schema.prisma` - Add ORDINATO_ESAURITO status
2. `/components/prepara/PreparaTabs.tsx` - Add Esauriti tab
3. `/utils/orderFilters.ts` - Add filtering for ORDINATO_ESAURITO
4. `/lib/actions/ordinazioni.ts` - Add order splitting logic
5. `/app/prepara/page-wrapper-optimized.tsx` - Integrate out-of-stock handling
6. `/app/api/sse/ordinazioni/route.ts` - Add SSE events

## Testing Checklist
- [ ] ORDINATO_ESAURITO status appears in database
- [ ] Esauriti tab shows with red background
- [ ] Orders can be split when marking items out-of-stock
- [ ] Original order maintains only available items
- [ ] New order created with out-of-stock items
- [ ] All waiters receive notifications
- [ ] Orders can move from ORDINATO_ESAURITO back to ORDINATO when stock restored

## Important Notes
- Maintain transaction isolation level 'Serializable' for all order updates
- Use exponential backoff for retry logic
- Ensure no duplicate state transitions
- Test concurrent access scenarios