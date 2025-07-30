import { NextRequest } from 'next/server';
import { sseManager, createSSEClient } from '@/lib/sse/sse-manager';
import { sseService } from '@/lib/sse/sse-service';
import { SSEChannels } from '@/lib/sse/sse-events';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/db';

// Rate limiting storage
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

// Check rate limit
function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const limit = rateLimitStore.get(userId);
  
  if (!limit || limit.resetAt < now) {
    rateLimitStore.set(userId, { count: 1, resetAt: now + 60000 }); // 1 minute window
    return true;
  }
  
  if (limit.count >= 100) { // 100 requests per minute
    return false;
  }
  
  limit.count++;
  return true;
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  console.log('[SSE] New connection attempt');
  
  // 1. Verifica autenticazione
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '') || 
                request.nextUrl.searchParams.get('token');
  
  if (!token) {
    console.log('[SSE] Connection attempt without token');
    return new Response('Unauthorized: No token provided', { status: 401 });
  }
  
  console.log('[SSE] Token found, verifying...');
  
  const tokenData = verifyToken(token);
  if (!tokenData) {
    console.log('[SSE] Connection attempt with invalid token');
    return new Response('Unauthorized: Invalid token', { status: 401 });
  }
  
  // Get user from database
  const user = await prisma.user.findUnique({
    where: { id: tokenData.userId },
    select: {
      id: true,
      nome: true,
      cognome: true,
      ruolo: true,
      attivo: true
    }
  });
  
  if (!user || !user.attivo) {
    return new Response('Unauthorized: User not found or inactive', { status: 401 });
  }
  
  // Check rate limit
  if (!checkRateLimit(user.id)) {
    return new Response('Too Many Requests', { status: 429 });
  }
  
  // Get station type from query params
  const stationType = request.nextUrl.searchParams.get('station');
  const clientId = request.nextUrl.searchParams.get('clientId') || 
                   `${user.ruolo}-${user.id}-${Date.now()}`;
  
  console.log(`[SSE] User ${user.nome} (${user.ruolo}) connecting from station: ${stationType || 'unknown'}`);
  
  // 2. Crea ReadableStream
  const stream = new ReadableStream({
    async start(controller) {
      // 3. Registra client con SSE Manager con station type
      const client = createSSEClient(user.id, undefined, controller);
      client.stationType = stationType || user.ruolo; // Use role as fallback
      client.metadata = {
        userName: `${user.nome} ${user.cognome}`,
        userRole: user.ruolo,
        connectedAt: new Date().toISOString()
      };
      
      const added = sseManager.addClient(client);
      
      if (!added) {
        controller.close();
        return new Response('Service Unavailable: Too many connections', { status: 503 });
      }
      
      // Subscribe to relevant channels based on user role
      const channels: string[] = [];
      
      // All users get notifications and system channels
      channels.push(SSEChannels.NOTIFICATIONS, SSEChannels.SYSTEM);
      
      // Role-specific channels
      switch (user.ruolo) {
        case 'CAMERIERE':
          channels.push(SSEChannels.STATION_WAITER, SSEChannels.ORDERS);
          break;
        case 'PREPARA':
          channels.push(SSEChannels.STATION_PREPARE, SSEChannels.ORDERS);
          break;
        case 'CASSA':
          channels.push(SSEChannels.STATION_CASHIER, SSEChannels.ORDERS);
          break;
        case 'SUPERVISORE':
          channels.push(
            SSEChannels.STATION_SUPERVISOR, 
            SSEChannels.ORDERS,
            SSEChannels.STATION_WAITER,
            SSEChannels.STATION_PREPARE,
            SSEChannels.STATION_CASHIER
          );
          break;
      }
      
      sseService.subscribeToChannels(client.id, channels as any);
      
      // 4. Setup heartbeat (importante!)
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(new TextEncoder().encode(':heartbeat\n\n'));
        } catch (error) {
          // Connection closed
          clearInterval(heartbeat);
        }
      }, 30000);
      
      // 5. Cleanup su disconnect
      const cleanup = () => {
        clearInterval(heartbeat);
        sseManager.removeClient(client.id);
        sseService.unsubscribeFromChannels(client.id, channels as any);
        console.log(`[SSE] Client disconnected: ${client.id}`);
      };
      
      request.signal.addEventListener('abort', cleanup);
      
      // Send initial connection event
      sseService.emit('connection:status', {
        status: 'connected',
        quality: 'excellent',
        latency: 0,
        reconnectAttempts: 0
      }, {
        userId: user.id
      });
      
      console.log(`[SSE] Client connected: ${client.id} (${user.nome} ${user.cognome}, ${user.ruolo})`);
    },
    
    cancel() {
      // Additional cleanup if needed
      console.log('[SSE] Stream cancelled');
    }
  });
  
  // 6. Headers SSE corretti
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disabilita buffering nginx
      'Content-Encoding': 'none',
      'Transfer-Encoding': 'chunked',
      // CORS headers if needed
      'Access-Control-Allow-Origin': request.headers.get('origin') || '*',
      'Access-Control-Allow-Credentials': 'true',
    }
  });
}

// OPTIONS handler for CORS
export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': request.headers.get('origin') || '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400',
    }
  });
}

// POST handler for statistics (admin only)
export async function POST(request: NextRequest) {
  // Verify admin authentication
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  
  if (!token) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  const tokenData = verifyToken(token);
  if (!tokenData) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  // Check if user is supervisor/admin
  const user = await prisma.user.findUnique({
    where: { id: tokenData.userId },
    select: { ruolo: true }
  });
  
  if (!user || user.ruolo !== 'SUPERVISORE') {
    return new Response('Forbidden', { status: 403 });
  }
  
  // Return SSE statistics
  const stats = sseService.getStats();
  
  return new Response(JSON.stringify(stats), {
    headers: {
      'Content-Type': 'application/json'
    }
  });
}