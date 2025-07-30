// This file should only be imported on the server side
if (typeof window !== 'undefined') {
  throw new Error('SSE Manager cannot be imported on the client side');
}

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
  private readonly maxClientsPerUser = 3;
  private readonly maxTotalClients = 500;
  private readonly clientTimeout = 5 * 60 * 1000; // 5 minuti
  
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
    console.log(`[SSE] Client connected: ${client.id} (user: ${client.userId})`);
    
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
      console.log(`[SSE] Client disconnected: ${clientId}`);
    }
  }
  
  sendToClient(clientId: string, message: { event?: string; data: any }): boolean {
    const client = this.clients.get(clientId);
    if (!client) return false;
    
    try {
      const formattedMessage = this.formatSSEMessage(message);
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
      
      for (const [clientId, client] of this.clients) {
        if (now - client.lastActivity > timeout) {
          console.log(`[SSE] Removing inactive client: ${clientId}`);
          this.removeClient(clientId);
        }
      }
    }, 60000); // Ogni minuto
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

// Export singleton
export const sseManager = SSEManager.getInstance();

// Helper per creare client
export function createSSEClient(
  userId: string,
  tenantId: string | undefined,
  controller: ReadableStreamDefaultController
): SSEClient {
  return {
    id: `${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId,
    tenantId,
    controller,
    lastActivity: Date.now(),
    channels: new Set()
  };
}