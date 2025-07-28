# SSE System Login Instructions

## The SSE Authentication Loop Issue Has Been Fixed

The infinite loop of SSE reconnection attempts was caused by the old SSE system trying to connect without an authentication token. 

### What Was Fixed:

1. **Migration to New SSE System**: The preparation page (`/prepara`) now uses the new SSE system with proper authentication handling.

2. **Endpoint Redirect**: The old endpoint `/api/notifications/stream` now redirects to the new `/api/sse` endpoint.

3. **Authentication Check**: The new SSE system properly checks for authentication before attempting to connect and stops reconnection attempts when no token is present.

## How to Access the Preparation Station:

### Step 1: Login First
Navigate to `/login` and use one of these credentials:

**For PREPARA role:**
- Username: `Andrea`, Password: `Andrea`
- Username: `Sara`, Password: `Sara`

**Other available roles:**
- ADMIN: `Antonio` (password: `Antonio`)
- CAMERIERE: `Marco` (password: `Marco`)
- CASSA: `Paola` (password: `Paola`)
- SUPERVISORE: `Giulio` (password: `Giulio`)

### Step 2: Access Your Station
After successful login, you'll be automatically redirected to your station based on your role:
- PREPARA → `/prepara`
- CAMERIERE → `/cameriere`
- CASSA → `/cassa`
- etc.

### Step 3: Real-time Updates
Once logged in, the SSE connection will automatically establish and you'll receive real-time updates for:
- New orders
- Order status changes
- Notifications
- System announcements

## If Users Don't Exist:

Run the seed script to create all users:
```bash
npm run seed:users
# or
node scripts/seed-users.ts
```

## Technical Details:

The new SSE system implements:
- **Token-based authentication**: No connection without valid token
- **Automatic reconnection**: With exponential backoff (only when authenticated)
- **Role-based channels**: Users only receive relevant notifications
- **Connection health monitoring**: Real-time connection status
- **Message queuing**: Offline support for missed messages

## Connection Status Indicators:

- 🟢 **Connected**: Real-time updates active
- 🟡 **Connecting**: Establishing connection
- 🔴 **Disconnected**: No active connection (login required)

The system will no longer attempt infinite reconnections when not authenticated.