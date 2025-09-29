import { NextRequest } from 'next/server';
import { sseManager, createSSEClient } from '@/lib/sse/sse-manager';
import { sseService } from '@/lib/sse/sse-service';
import { SSEChannels } from '@/lib/sse/sse-events';
import { verifyToken } from '@/lib/auth-multi-tenant';
import { prisma } from '@/lib/db';
import { secureLog, logHttpRequest } from '@/lib/utils/log-sanitizer';
// import { rateLimiter } from '@/lib/security/rate-limiter'; // Removed - file deleted
// import { crashRecovery } from '@/lib/sse/crash-recovery'; // Removed - file deleted
// import { secureNotificationService } from '@/lib/sse/secure-notification-service'; // Removed - file deleted

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Disabilita i log se impostato
const DISABLE_LOGS = process.env.DISABLE_SSE_LOGS === 'true';

export async function GET(request: NextRequest) {
  // 1. Verifica autenticazione - prima prova dal cookie, poi dal token
  const cookieStore = request.cookies;
  const cookieName = process.env.SESSION_COOKIE_NAME || 'bar-roxy-session';
  const sessionCookie = cookieStore.get(cookieName);
  
  // Debug: log cookie names only (no values)
  if (!DISABLE_LOGS) {
    const allCookies = cookieStore.getAll();
    secureLog.debug('[SSE] All cookies received:', allCookies.map(c => c.name).join(', '));
    secureLog.debug(`[SSE] Looking for cookie: ${cookieName}`);
    secureLog.debug('[SSE] Cookie found:', sessionCookie ? 'yes' : 'no');
  }
  
  let tokenData = null;
  
  // Prima prova a leggere dal cookie httpOnly
  if (sessionCookie?.value) {
    tokenData = verifyToken(sessionCookie.value);
    if (!DISABLE_LOGS) secureLog.debug('[SSE] Auth via cookie:', tokenData ? 'valid' : 'invalid');
  }
  
  // Se non c'è il cookie, prova con il token dal query parameter (per retrocompatibilità)
  if (!tokenData) {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || 
                  request.nextUrl.searchParams.get('token');
    
    if (token) {
      tokenData = verifyToken(token);
      if (!DISABLE_LOGS) secureLog.debug('[SSE] Auth via token:', tokenData ? 'valid' : 'invalid');
    }
  }
  
  if (!tokenData) {
    secureLog.warn('[SSE] Authentication failed - no valid authentication');
    return new Response('Unauthorized: No valid authentication', { status: 401 });
  }
  
  // Get user from database with tenant info
  const user = await prisma.user.findUnique({
    where: { id: tokenData.userId },
    select: {
      id: true,
      nome: true,
      cognome: true,
      ruolo: true,
      attivo: true,
      tenantId: true,
      Tenant: {
        select: {
          id: true,
          isActive: true
        }
      }
    }
  });
  
  if (!user || !user.attivo || !user.Tenant.isActive) {
    return new Response('Unauthorized: User not found or inactive', { status: 401 });
  }
  
  // Verify tenant matches token
  if (user.tenantId !== tokenData.tenantId) {
    return new Response('Unauthorized: Tenant mismatch', { status: 401 });
  }
  
  // Check rate limit using persistent rate limiter
  const ip = request.headers.get('x-forwarded-for') || 
             request.headers.get('x-real-ip') || 
             'unknown';
  
  // Rate limiting disabled
  // const [userLimit, tenantLimit, ipLimit] = await Promise.all([
  //   rateLimiter.checkUserLimit(user.id, 'sse'),
  //   rateLimiter.checkTenantLimit(user.tenantId, 'sse'),
  //   rateLimiter.checkIPLimit(ip, 'sse')
  // ]);
  
  // Rate limiting check disabled
  // if (!userLimit.allowed || !tenantLimit.allowed || !ipLimit.allowed) {
  //   const limit = !userLimit.allowed ? userLimit : !tenantLimit.allowed ? tenantLimit : ipLimit;
  //   return new Response(
  //     JSON.stringify({ 
  //       error: 'Too Many Requests', 
  //       retryAfter: limit.retryAfter 
  //     }), 
  //     { 
  //       status: 429,
  //       headers: {
  //         'Retry-After': Math.ceil((limit.retryAfter || 60000) / 1000).toString(),
  //         'X-RateLimit-Remaining': limit.remaining.toString(),
  //         'X-RateLimit-Reset': limit.resetAt.toISOString()
  //       }
  //     }
  //   );
  // }
  
  // Get station type from query params
  const stationType = request.nextUrl.searchParams.get('station');
  const clientId = request.nextUrl.searchParams.get('clientId') || 
                   `${user.ruolo}-${user.id}-${Date.now()}`;
  
  // Silent connection
  
  // 2. Crea ReadableStream
  const stream = new ReadableStream({
    async start(controller) {
      // 3. Registra client con SSE Manager con station type e tenant
      const client = createSSEClient(user.id, user.tenantId, controller);
      client.stationType = stationType || user.ruolo; // Use role as fallback
      client.metadata = {
        userName: `${user.nome} ${user.cognome}`,
        userRole: user.ruolo,
        tenantId: user.tenantId,
        connectedAt: new Date().toISOString()
      };
      
      const added = sseManager.addClient(client);
      
      if (!added) {
        controller.close();
        return new Response('Service Unavailable: Too many connections', { status: 503 });
      }
      
      secureLog.info(`[SSE Route] Client connected: ${client.id}, station: ${client.stationType}, user: ${user.nome}`);
      
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
      
      // Recover undelivered notifications using the new crash recovery service - Disabled
      // crashRecovery.recoverUserNotifications(user.id, user.tenantId, client.id)
      //   .then(() => {
      //     console.log(`[SSE Route] Recovered notifications for user ${user.id}`);
      //   })
      //   .catch((error: any) => {
      //     console.error(`[SSE Route] Failed to recover notifications:`, error);
      //   });
      
      // Also recover from secure notification service - Disabled
      // secureNotificationService.recoverUndeliveredNotifications(user.id, user.tenantId, client.id)
      //   .then(() => {
      //     console.log(`[SSE Route] Recovered secure notifications for user ${user.id}`);
      //   })
      //   .catch((error: any) => {
      //     console.error(`[SSE Route] Failed to recover secure notifications:`, error);
      //   });
      
      // Queue check is already done below, no need to duplicate
      
      // 4. Setup heartbeat (importante!) - Reduced to 2s for maximum reliability
      const heartbeat = setInterval(() => {
        try {
          // Send heartbeat as a proper event instead of comment
          const heartbeatData = JSON.stringify({ 
            type: 'system:heartbeat', 
            timestamp: Date.now() 
          });
          controller.enqueue(new TextEncoder().encode(`data: ${heartbeatData}\n\n`));
        } catch (error) {
          // Connection closed
          clearInterval(heartbeat);
        }
      }, 2000); // Every 2 seconds to prevent any timeout
      
      // 5. Cleanup su disconnect
      const cleanup = () => {
        clearInterval(heartbeat);
        sseManager.removeClient(client.id);
        sseService.unsubscribeFromChannels(client.id, channels as any);
        
        // Mark client as disconnected in crash recovery - Disabled
        // crashRecovery.markClientDisconnected(client.id);
        
        secureLog.info(`[SSE Route] Client disconnected: ${client.id}, station: ${client.stationType}`);
      };
      
      request.signal.addEventListener('abort', cleanup);
      
      // Send initial connection event
      sseService.emit('connection:status', {
        status: 'connected',
        quality: 'excellent',
        latency: 0,
        reconnectAttempts: 0
      }, {
        userId: user.id,
        tenantId: user.tenantId
      });
      
      // Force immediate queue check for this specific client
      // This ensures that any queued events are delivered immediately
      // Try multiple times to ensure delivery
      const checkQueue = () => {
        const tenantClients = sseManager.getTenantsClients(user.tenantId);
        secureLog.debug(`[SSE Route] Force queue check - found ${tenantClients.length} clients for tenant`);
        
        // Manually trigger queue processor for immediate delivery
        sseService.processQueueForTenant(user.tenantId);
      };
      
      // Check once after a short delay
      setTimeout(checkQueue, 500);
      
      // Silent connect
    },
    
    cancel() {
      // Additional cleanup if needed
    }
  });
  
  // 6. Headers SSE corretti
  // Log solo se non disabilitato
  if (!DISABLE_LOGS) {
    secureLog.info(`[SSE] New connection from ${user.ruolo}`);
  }
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform, no-store, must-revalidate',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disabilita buffering nginx
      'Content-Encoding': 'none',
      'Transfer-Encoding': 'chunked',
      'Keep-Alive': 'timeout=300', // Keep connection alive for 5 minutes
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