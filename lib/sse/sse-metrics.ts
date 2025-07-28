// SSE Metrics - Sistema di metriche per monitoraggio performance

export interface SSEMetrics {
  // Connection metrics
  activeConnections: number;
  totalConnections: number;
  failedConnections: number;
  averageConnectionDuration: number;
  
  // Message metrics
  messagesSent: number;
  messagesAcknowledged: number;
  messagesQueued: number;
  messagesDropped: number;
  
  // Performance metrics
  averageLatency: number;
  maxLatency: number;
  minLatency: number;
  
  // Error metrics
  errorCount: number;
  errorRate: number;
  lastError?: string;
  
  // Resource metrics
  memoryUsage: number;
  queueSizes: Record<string, number>;
  
  // Time metrics
  uptime: number;
  lastReset: string;
}

export interface ConnectionMetrics {
  clientId: string;
  userId?: string;
  role?: string;
  connectedAt: number;
  messagesSent: number;
  messagesAcknowledged: number;
  errors: number;
  latencies: number[];
}

export class SSEMetricsCollector {
  private static instance: SSEMetricsCollector;
  private startTime: number;
  private metrics: SSEMetrics;
  private connectionMetrics: Map<string, ConnectionMetrics>;
  private metricsHistory: Array<{ timestamp: string; metrics: SSEMetrics }> = [];
  private maxHistorySize = 100;
  
  private constructor() {
    this.startTime = Date.now();
    this.connectionMetrics = new Map();
    this.metrics = this.initializeMetrics();
    
    // Collect metrics periodically
    if (typeof window === 'undefined') {
      setInterval(() => this.collectSnapshot(), 60000); // Every minute
    }
  }
  
  static getInstance(): SSEMetricsCollector {
    if (!SSEMetricsCollector.instance) {
      SSEMetricsCollector.instance = new SSEMetricsCollector();
    }
    return SSEMetricsCollector.instance;
  }
  
  private initializeMetrics(): SSEMetrics {
    return {
      activeConnections: 0,
      totalConnections: 0,
      failedConnections: 0,
      averageConnectionDuration: 0,
      messagesSent: 0,
      messagesAcknowledged: 0,
      messagesQueued: 0,
      messagesDropped: 0,
      averageLatency: 0,
      maxLatency: 0,
      minLatency: Infinity,
      errorCount: 0,
      errorRate: 0,
      memoryUsage: 0,
      queueSizes: {},
      uptime: 0,
      lastReset: new Date().toISOString()
    };
  }
  
  // Connection tracking
  trackConnection(clientId: string, userId?: string, role?: string): void {
    this.metrics.totalConnections++;
    this.metrics.activeConnections++;
    
    this.connectionMetrics.set(clientId, {
      clientId,
      userId,
      role,
      connectedAt: Date.now(),
      messagesSent: 0,
      messagesAcknowledged: 0,
      errors: 0,
      latencies: []
    });
  }
  
  trackDisconnection(clientId: string): void {
    const connection = this.connectionMetrics.get(clientId);
    if (connection) {
      const duration = Date.now() - connection.connectedAt;
      this.updateAverageConnectionDuration(duration);
      this.connectionMetrics.delete(clientId);
    }
    
    if (this.metrics.activeConnections > 0) {
      this.metrics.activeConnections--;
    }
  }
  
  trackConnectionError(clientId: string): void {
    this.metrics.failedConnections++;
    const connection = this.connectionMetrics.get(clientId);
    if (connection) {
      connection.errors++;
    }
  }
  
  // Message tracking
  trackMessageSent(clientId: string): void {
    this.metrics.messagesSent++;
    const connection = this.connectionMetrics.get(clientId);
    if (connection) {
      connection.messagesSent++;
    }
  }
  
  trackMessageAcknowledged(clientId: string): void {
    this.metrics.messagesAcknowledged++;
    const connection = this.connectionMetrics.get(clientId);
    if (connection) {
      connection.messagesAcknowledged++;
    }
  }
  
  trackMessageQueued(): void {
    this.metrics.messagesQueued++;
  }
  
  trackMessageDropped(): void {
    this.metrics.messagesDropped++;
  }
  
  // Latency tracking
  trackLatency(clientId: string, latency: number): void {
    const connection = this.connectionMetrics.get(clientId);
    if (connection) {
      connection.latencies.push(latency);
      // Keep only last 100 latencies per connection
      if (connection.latencies.length > 100) {
        connection.latencies.shift();
      }
    }
    
    // Update global latency metrics
    this.updateLatencyMetrics(latency);
  }
  
  // Error tracking
  trackError(error: string): void {
    this.metrics.errorCount++;
    this.metrics.lastError = error;
    this.updateErrorRate();
  }
  
  // Queue size tracking
  updateQueueSize(clientId: string, size: number): void {
    this.metrics.queueSizes[clientId] = size;
  }
  
  // Get current metrics
  getMetrics(): SSEMetrics {
    return {
      ...this.metrics,
      uptime: Date.now() - this.startTime,
      memoryUsage: this.getMemoryUsage()
    };
  }
  
  // Get connection-specific metrics
  getConnectionMetrics(clientId: string): ConnectionMetrics | undefined {
    return this.connectionMetrics.get(clientId);
  }
  
  // Get all connection metrics
  getAllConnectionMetrics(): ConnectionMetrics[] {
    return Array.from(this.connectionMetrics.values());
  }
  
  // Get metrics history
  getMetricsHistory(): Array<{ timestamp: string; metrics: SSEMetrics }> {
    return this.metricsHistory;
  }
  
  // Reset metrics
  resetMetrics(): void {
    this.metrics = this.initializeMetrics();
    this.connectionMetrics.clear();
    this.metricsHistory = [];
    this.startTime = Date.now();
  }
  
  // Private helper methods
  private updateAverageConnectionDuration(duration: number): void {
    const total = this.metrics.averageConnectionDuration * (this.metrics.totalConnections - 1) + duration;
    this.metrics.averageConnectionDuration = total / this.metrics.totalConnections;
  }
  
  private updateLatencyMetrics(latency: number): void {
    // Update min/max
    this.metrics.maxLatency = Math.max(this.metrics.maxLatency, latency);
    this.metrics.minLatency = Math.min(this.metrics.minLatency, latency);
    
    // Update average
    const totalLatency = this.metrics.averageLatency * this.metrics.messagesSent + latency;
    this.metrics.averageLatency = totalLatency / (this.metrics.messagesSent + 1);
  }
  
  private updateErrorRate(): void {
    if (this.metrics.messagesSent > 0) {
      this.metrics.errorRate = this.metrics.errorCount / this.metrics.messagesSent;
    }
  }
  
  private getMemoryUsage(): number {
    if (typeof window === 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed;
    }
    return 0;
  }
  
  private collectSnapshot(): void {
    const snapshot = {
      timestamp: new Date().toISOString(),
      metrics: this.getMetrics()
    };
    
    this.metricsHistory.push(snapshot);
    
    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory.shift();
    }
  }
}

// Export singleton instance
export const sseMetrics = SSEMetricsCollector.getInstance();