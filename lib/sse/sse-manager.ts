// This file should only be imported on the server side
if (typeof window !== 'undefined') {
  throw new Error('SSE Manager cannot be imported on the client side');
}

// Disable logs in production for performance
const DEBUG = false; // Set to true to enable debug logs
const log = DEBUG ? console.log : () => {};

import { EventEmitter } from 'events';

interface SSEClient {
  id: string;
  userId: string;
  tenantId?: string;
  controller: ReadableStreamDefaultController;
  lastActivity: number;
  channels: Set<string>;
  stationType?: string; // Added for station filtering
  metadata?: Record<string, any>;
}

// Singleton pattern con protezione per Next.js dev mode
class SSEManager extends EventEmitter {
  private static instance: SSEManager;
  private clients: Map<string, SSEClient> = new Map();
  
  // Limiti configurabili
  private readonly maxClientsPerUser = 5; // Increased from 3
  private readonly maxTotalClients = 1000; // Increased from 500
  private readonly clientTimeout = 2 * 60 * 1000; // 2 minutes (reduced from 5)
  
  private encoder: TextEncoder;
  
  private constructor() {
    super();
    // Use global TextEncoder if available, otherwise use a polyfill for Node.js
    if (typeof TextEncoder !== 'undefined') {
      this.encoder = new TextEncoder();
    } else {
      // For Node.js environment
      const { TextEncoder: NodeTextEncoder } = require('util');
      this.encoder = new NodeTextEncoder();
    }
    this.setupCleanupInterval();
  }
  
  static getInstance(): SSEManager {
    if (!SSEManager.instance) {
      SSEManager.instance = new SSEManager();
    }
    return SSEManager.instance;
  }
  
  addClient(client: SSEClient): boolean {
    // Verifica limite totale
    if (this.clients.size >= this.maxTotalClients) {
      console.warn('[SSE] Max total clients reached');
      return false;
    }
    
    // Verifica limite per utente
    const userClients = this.getClientsByUser(client.userId);
    if (userClients.length >= this.maxClientsPerUser) {
      // Rimuovi il client più vecchio
      const oldestClient = userClients.sort((a, b) => 
        a.lastActivity - b.lastActivity
      )[0];
      this.removeClient(oldestClient.id);
    }
    
    this.clients.set(client.id, client);
    log(`[SSE Manager] Client added: ${client.id} (station: ${client.stationType}, user: ${client.userId}, tenant: ${client.tenantId}, total clients: ${this.clients.size})`);
    
    // Log all current clients
    log('[SSE Manager] Current clients:', Array.from(this.clients.values()).map(c => ({
      id: c.id.substring(0, 20) + '...',
      station: c.stationType,
      userId: c.userId,
      tenantId: c.tenantId
    })));
    
    // Invia messaggio di benvenuto
    this.sendToClient(client.id, {
      event: 'connected',
      data: { 
        clientId: client.id,
        timestamp: new Date().toISOString()
      }
    });
    
    return true;
  }
  
  removeClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      try {
        client.controller.close();
      } catch (error) {
        // Controller già chiuso
      }
      this.clients.delete(clientId);
      log(`[SSE Manager] Client removed: ${clientId} (station: ${client.stationType}, remaining: ${this.clients.size}`);
    }
  }
  
  sendToClient(clientId: string, message: { event?: string; data: any }): boolean {
    const client = this.clients.get(clientId);
    if (!client) return false;
    
    try {
      const formattedMessage = this.formatSSEMessage(message);
      
      // Debug for product:availability
      if (message.event === 'product:availability') {
        log(`[SSE Manager] Sending product:availability to client ${clientId}`);
        log('[SSE Manager] Formatted message:', new TextDecoder().decode(formattedMessage));
      }
      
      client.controller.enqueue(formattedMessage);
      client.lastActivity = Date.now();
      return true;
    } catch (error) {
      console.error(`[SSE] Error sending to client ${clientId}:`, error);
      this.removeClient(clientId);
      return false;
    }
  }
  
  sendToUser(userId: string, message: { event?: string; data: any }): number {
    const clients = this.getClientsByUser(userId);
    let sent = 0;
    
    for (const client of clients) {
      if (this.sendToClient(client.id, message)) {
        sent++;
      }
    }
    
    return sent;
  }
  
  sendToTenant(tenantId: string, message: { event?: string; data: any }): number {
    const clients = this.getClientsByTenant(tenantId);
    let sent = 0;
    
    for (const client of clients) {
      if (this.sendToClient(client.id, message)) {
        sent++;
      }
    }
    
    return sent;
  }
  
  sendToChannel(channel: string, message: { event?: string; data: any }): number {
    let sent = 0;
    
    for (const [clientId, client] of this.clients) {
      if (client.channels.has(channel)) {
        if (this.sendToClient(clientId, message)) {
          sent++;
        }
      }
    }
    
    return sent;
  }
  
  broadcast(message: { event?: string; data: any }): number {
    let sent = 0;
    
    for (const clientId of this.clients.keys()) {
      if (this.sendToClient(clientId, message)) {
        sent++;
      }
    }
    
    return sent;
  }
  
  subscribeClientToChannel(clientId: string, channel: string): boolean {
    const client = this.clients.get(clientId);
    if (!client) return false;
    
    client.channels.add(channel);
    return true;
  }
  
  unsubscribeClientFromChannel(clientId: string, channel: string): boolean {
    const client = this.clients.get(clientId);
    if (!client) return false;
    
    client.channels.delete(channel);
    return true;
  }
  
  private formatSSEMessage(message: { event?: string; data: any }): Uint8Array {
    let formatted = '';
    
    if (message.event) {
      formatted += `event: ${message.event}\n`;
    }
    
    formatted += `data: ${JSON.stringify(message.data)}\n\n`;
    
    return this.encoder.encode(formatted);
  }
  
  private getClientsByUser(userId: string): SSEClient[] {
    return Array.from(this.clients.values()).filter(
      client => client.userId === userId
    );
  }
  
  private getClientsByTenant(tenantId: string): SSEClient[] {
    return Array.from(this.clients.values()).filter(
      client => client.tenantId === tenantId
    );
  }
  
  private setupCleanupInterval(): void {
    setInterval(() => {
      const now = Date.now();
      const timeout = this.clientTimeout;
      
      log(`[SSE Cleanup] Checking ${this.clients.size} clients for inactivity`);
      
      for (const [clientId, client] of this.clients) {
        const timeSinceLastActivity = now - client.lastActivity;
        if (timeSinceLastActivity > timeout) {
          log(`[SSE Cleanup] Removing inactive client: ${clientId} (inactive for ${Math.round(timeSinceLastActivity/1000)}s)`);
          this.removeClient(clientId);
        }
      }
    }, 30000); // Every 30 seconds (reduced from 60s)
  }
  
  // Heartbeat per tutti i client
  sendHeartbeat(): void {
    const heartbeat = this.encoder.encode(':heartbeat\n\n');
    
    for (const [clientId, client] of this.clients) {
      try {
        client.controller.enqueue(heartbeat);
        client.lastActivity = Date.now();
      } catch (error) {
        this.removeClient(clientId);
      }
    }
  }
  
  // New methods for station filtering support
  
  getConnectedClients(): SSEClient[] {
    return Array.from(this.clients.values());
  }
  
  getTenantsClients(tenantId: string): SSEClient[] {
    return this.getClientsByTenant(tenantId);
  }
  
  getChannelClients(channel: string): SSEClient[] {
    return Array.from(this.clients.values()).filter(
      client => client.channels.has(channel)
    );
  }
  
  // Statistiche sistema
  getStats() {
    const stats = {
      totalClients: this.clients.size,
      clientsByUser: {} as Record<string, number>,
      clientsByTenant: {} as Record<string, number>,
      memoryUsage: process.memoryUsage()
    };
    
    for (const client of this.clients.values()) {
      // Conta per utente
      stats.clientsByUser[client.userId] = 
        (stats.clientsByUser[client.userId] || 0) + 1;
      
      // Conta per tenant
      if (client.tenantId) {
        stats.clientsByTenant[client.tenantId] = 
          (stats.clientsByTenant[client.tenantId] || 0) + 1;
      }
    }
    
    return stats;
  }
}

// Export singleton with global cache to prevent multiple instances
// This is critical for Next.js dev mode which can create multiple module instances
const globalForSSEManager = global as unknown as { sseManager?: SSEManager };

export const sseManager = globalForSSEManager.sseManager || SSEManager.getInstance();

if (!globalForSSEManager.sseManager) {
  globalForSSEManager.sseManager = sseManager;
}

// Helper per creare client
import { generateSecureId } from '@/lib/utils/secure-id';

export function createSSEClient(
  userId: string,
  tenantId: string | undefined,
  controller: ReadableStreamDefaultController
): SSEClient {
  return {
    id: `${userId}_${Date.now()}_${generateSecureId(8)}`,
    userId,
    tenantId,
    controller,
    lastActivity: Date.now(),
    channels: new Set()
  };
}