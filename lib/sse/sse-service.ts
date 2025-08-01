// This file should only be imported on the server side
if (typeof window !== 'undefined') {
  throw new Error('SSE Service cannot be imported on the client side');
}

import { sseManager } from './sse-manager';
import { 
  SSEEventMap, 
  SSEEventName, 
  SSEEventData,
  SSEEventRateLimits,
  SSEEventPriorities,
  SSEEventsRequiringAck,
  SSEEventChannels,
  SSEChannel
} from './sse-events';
import { StationType, shouldReceiveEvent, getEventPriority } from './station-filters';

interface EmitOptions {
  // Target specific user
  userId?: string;
  // Target all users in tenant
  tenantId?: string;
  // Target specific channels
  channels?: SSEChannel[];
  // Broadcast to all
  broadcast?: boolean;
  // Override rate limiting
  skipRateLimit?: boolean;
  // Add to queue if client offline
  queueIfOffline?: boolean;
  // Message TTL in milliseconds
  ttl?: number;
}

interface QueuedEvent {
  eventName: SSEEventName;
  data: any;
  options: EmitOptions;
  timestamp: number;
  expiresAt?: number;
  attempts: number;
}

class SSEService {
  private static instance: SSEService;
  private rateLimitMap = new Map<string, number>();
  private eventQueue = new Map<string, QueuedEvent[]>();
  private heartbeatInterval?: NodeJS.Timeout;
  
  private constructor() {
    this.setupHeartbeat();
    this.setupQueueProcessor();
  }
  
  static getInstance(): SSEService {
    if (!SSEService.instance) {
      SSEService.instance = new SSEService();
    }
    return SSEService.instance;
  }
  
  /**
   * Emit a type-safe SSE event
   */
  emit<T extends SSEEventName>(
    eventName: T,
    data: SSEEventData<T>,
    options: EmitOptions = {}
  ): void {
    // Check rate limiting
    if (!options.skipRateLimit && !this.checkRateLimit(eventName, options.userId)) {
      console.warn(`[SSE] Rate limit exceeded for event: ${eventName}`);
      return;
    }
    
    // Format message
    const message = {
      event: eventName,
      data: {
        ...data,
        _metadata: {
          timestamp: new Date().toISOString(),
          requiresAck: SSEEventsRequiringAck.includes(eventName),
          priority: SSEEventPriorities[eventName] || 5
        }
      }
    };
    
    let sent = 0;
    
    // Broadcast to all with station filtering
    if (options.broadcast) {
      // Get all connected clients and filter by station
      const clients = sseManager.getConnectedClients();
      
      // Only log broadcast for non-heartbeat events
      // Disabled for cleaner logs
      
      for (const client of clients) {
        const shouldSend = client.stationType && shouldReceiveEvent(
          client.stationType as StationType,
          eventName,
          data,
          client.userId
        );
        
        if (shouldSend) {
          const success = sseManager.sendToClient(client.id, message);
          if (success) sent++;
          
          // Client send logging disabled for cleaner logs
        }
      }
      
      // If no clients received the event and it's important, queue it
      if (sent === 0 && (eventName === 'order:new' || eventName === 'order:merged') && options.tenantId) {
        // Silently queue events for offline clients
        this.queueEventForTenant(options.tenantId, eventName, data, options);
      }
    }
    // Send to specific user
    else if (options.userId) {
      sent = sseManager.sendToUser(options.userId, message);
      
      // Queue if offline and requested
      if (sent === 0 && options.queueIfOffline) {
        this.queueEvent(options.userId, eventName, data, options);
      }
    }
    // Send to tenant with filtering
    else if (options.tenantId) {
      const clients = sseManager.getTenantsClients(options.tenantId);
      for (const client of clients) {
        if (client.stationType && shouldReceiveEvent(
          client.stationType as StationType,
          eventName,
          data,
          client.userId
        )) {
          sent += sseManager.sendToClient(client.id, message) ? 1 : 0;
        }
      }
    }
    // Send to channels with station filtering
    else if (options.channels) {
      for (const channel of options.channels) {
        const channelClients = sseManager.getChannelClients(channel);
        for (const client of channelClients) {
          if (client.stationType && shouldReceiveEvent(
            client.stationType as StationType,
            eventName,
            data,
            client.userId
          )) {
            sent += sseManager.sendToClient(client.id, message) ? 1 : 0;
          }
        }
      }
    }
    // Use default channels for event with filtering
    else {
      const defaultChannels = SSEEventChannels[eventName];
      if (defaultChannels) {
        for (const channel of defaultChannels) {
          const channelClients = sseManager.getChannelClients(channel);
          for (const client of channelClients) {
            if (client.stationType && shouldReceiveEvent(
              client.stationType as StationType,
              eventName,
              data,
              client.userId
            )) {
              sent += sseManager.sendToClient(client.id, message) ? 1 : 0;
            }
          }
        }
      }
    }
    
    // Event logging disabled for cleaner logs
    // Only log critical warnings
    if (eventName === 'order:new' && sent === 0) {
      const clients = sseManager.getConnectedClients();
      if (clients.length > 0) {
        // Only log when we have clients but none received the event
        console.warn(`[SSE] Warning: order:new event not delivered to any of ${clients.length} connected clients`);
      }
    }
  }
  
  /**
   * Subscribe a client to specific channels
   */
  subscribeToChannels(clientId: string, channels: SSEChannel[]): void {
    for (const channel of channels) {
      sseManager.subscribeClientToChannel(clientId, channel);
    }
    
    // Check for queued events when a client connects
    const client = sseManager.getConnectedClients().find(c => c.id === clientId);
    if (client && client.tenantId) {
      this.checkAndDeliverQueuedEvents(client.tenantId);
    }
  }
  
  /**
   * Check and deliver queued events for a tenant
   */
  private checkAndDeliverQueuedEvents(tenantId: string): void {
    const key = `tenant:${tenantId}`;
    const queue = this.eventQueue.get(key);
    
    if (queue && queue.length > 0) {
      // Silently deliver queued events
      setTimeout(() => {
        for (const event of queue) {
          this.emit(event.eventName as any, event.data, {
            ...event.options,
            queueIfOffline: false,
            skipRateLimit: true // Skip rate limit for queued events
          });
        }
        // Clear the queue after delivery
        this.eventQueue.delete(key);
      }, 500); // Increased delay to ensure client is fully initialized
    }
  }
  
  /**
   * Unsubscribe a client from channels
   */
  unsubscribeFromChannels(clientId: string, channels: SSEChannel[]): void {
    for (const channel of channels) {
      sseManager.unsubscribeClientFromChannel(clientId, channel);
    }
  }
  
  /**
   * Get system statistics
   */
  getStats() {
    return {
      ...sseManager.getStats(),
      queuedEvents: this.getQueueStats(),
      rateLimitStatus: this.getRateLimitStats()
    };
  }
  
  /**
   * Check rate limiting for an event
   */
  private checkRateLimit(eventName: SSEEventName, userId?: string): boolean {
    const limit = SSEEventRateLimits[eventName];
    if (!limit) return true;
    
    const key = userId ? `${eventName}:${userId}` : eventName;
    const lastEmit = this.rateLimitMap.get(key) || 0;
    const now = Date.now();
    
    if (now - lastEmit < limit) {
      return false;
    }
    
    this.rateLimitMap.set(key, now);
    return true;
  }
  
  /**
   * Queue an event for later delivery
   */
  private queueEvent(
    userId: string,
    eventName: SSEEventName,
    data: any,
    options: EmitOptions
  ): void {
    const queue = this.eventQueue.get(userId) || [];
    const event: QueuedEvent = {
      eventName,
      data,
      options,
      timestamp: Date.now(),
      expiresAt: options.ttl ? Date.now() + options.ttl : undefined,
      attempts: 0
    };
    
    queue.push(event);
    
    // Limit queue size
    if (queue.length > 100) {
      queue.shift(); // Remove oldest
    }
    
    this.eventQueue.set(userId, queue);
  }
  
  /**
   * Queue an event for all users in a tenant
   */
  private queueEventForTenant(
    tenantId: string,
    eventName: SSEEventName,
    data: any,
    options: EmitOptions
  ): void {
    const key = `tenant:${tenantId}`;
    const queue = this.eventQueue.get(key) || [];
    const event: QueuedEvent = {
      eventName,
      data,
      options: { ...options, tenantId, broadcast: false }, // Convert to tenant-specific
      timestamp: Date.now(),
      expiresAt: Date.now() + 300000, // 5 minutes TTL for tenant events
      attempts: 0
    };
    
    queue.push(event);
    
    // Limit queue size
    if (queue.length > 50) {
      queue.shift(); // Remove oldest
    }
    
    this.eventQueue.set(key, queue);
    // Silently queue orders
  }
  
  /**
   * Process queued events periodically
   */
  private setupQueueProcessor(): void {
    setInterval(() => {
      const now = Date.now();
      
      for (const [key, queue] of this.eventQueue) {
        const validEvents = queue.filter(event => {
          // Remove expired events
          if (event.expiresAt && event.expiresAt < now) {
            return false;
          }
          return true;
        });
        
        // Check if this is a tenant queue
        if (key.startsWith('tenant:')) {
          const tenantId = key.substring(7);
          // Check if we have any PREPARA clients for this tenant now
          const tenantClients = sseManager.getTenantsClients(tenantId);
          const preparaClients = tenantClients.filter(c => c.stationType === 'PREPARA');
          
          if (preparaClients.length > 0) {
            // Silently deliver queued events
            for (const event of validEvents) {
              if (event.attempts < 3) {
                event.attempts++;
                this.emit(event.eventName as any, event.data, {
                  ...event.options,
                  queueIfOffline: false // Prevent re-queuing
                });
              }
            }
            // Clear the queue since we've delivered
            this.eventQueue.delete(key);
          }
        } else {
          // Regular user queue
          for (const event of validEvents) {
            if (event.attempts < 3) {
              event.attempts++;
              this.emit(event.eventName as any, event.data, {
                ...event.options,
                queueIfOffline: false // Prevent re-queuing
              });
            }
          }
        }
        
        // Update queue
        if (validEvents.length > 0 && !key.startsWith('tenant:')) {
          this.eventQueue.set(key, validEvents);
        } else if (!key.startsWith('tenant:')) {
          this.eventQueue.delete(key);
        }
      }
    }, 5000); // Every 5 seconds (reduced from 30s)
  }
  
  /**
   * Setup heartbeat interval
   */
  private setupHeartbeat(): void {
    let statusLogCounter = 0;
    
    this.heartbeatInterval = setInterval(() => {
      sseManager.sendHeartbeat();
      
      // Status logging disabled for cleaner logs
      
      // Also send heartbeat event
      this.emit('system:heartbeat', {
        timestamp: new Date().toISOString(),
        serverTime: new Date().toISOString()
      }, {
        broadcast: true,
        skipRateLimit: true
      });
    }, 10000); // Every 10 seconds
  }
  
  /**
   * Get queue statistics
   */
  private getQueueStats() {
    const stats = {
      totalQueued: 0,
      queuesByUser: {} as Record<string, number>
    };
    
    for (const [userId, queue] of this.eventQueue) {
      stats.totalQueued += queue.length;
      stats.queuesByUser[userId] = queue.length;
    }
    
    return stats;
  }
  
  /**
   * Get rate limit statistics
   */
  private getRateLimitStats() {
    const now = Date.now();
    const active = new Map<string, number>();
    
    for (const [key, timestamp] of this.rateLimitMap) {
      const [eventName] = key.split(':');
      const limit = SSEEventRateLimits[eventName as SSEEventName];
      
      if (limit && now - timestamp < limit) {
        active.set(key, limit - (now - timestamp));
      }
    }
    
    return Object.fromEntries(active);
  }
  
  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
  }
}

// Export singleton instance
export const sseService = SSEService.getInstance();

// Export convenient helper functions
export function emitOrderNew(orderId: string, tableNumber: number | undefined, items: any[], totalAmount: number) {
  sseService.emit('order:new', {
    orderId,
    tableNumber,
    items: items.map(item => ({
      id: item.id,
      productName: item.productName || item.nome,
      quantity: item.quantity || item.quantita,
      destination: item.destination || item.postazione
    })),
    totalAmount,
    timestamp: new Date().toISOString()
  });
}

export function emitOrderUpdate(orderId: string, status: any, previousStatus?: string, updatedBy?: string) {
  sseService.emit('order:update', {
    orderId,
    status,
    previousStatus,
    updatedBy,
    timestamp: new Date().toISOString()
  });
}

export function emitOrderReady(orderId: string, tableNumber: number | undefined, readyItems: string[]) {
  sseService.emit('order:ready', {
    orderId,
    tableNumber,
    readyItems,
    timestamp: new Date().toISOString()
  });
}

export function emitNotification(
  title: string, 
  message: string, 
  priority: 'low' | 'normal' | 'high' | 'urgent' = 'normal',
  targetRoles?: string[],
  requiresAcknowledgment?: boolean
) {
  sseService.emit('notification:new', {
    id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    title,
    message,
    priority,
    targetRoles,
    requiresAcknowledgment
  });
}

// Generic emit function for backward compatibility
export function emitSSE(eventName: string, data: any, options?: any) {
  sseService.emit(eventName as any, data, options);
}