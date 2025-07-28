// SSE Logger - Centralizzazione del logging per il sistema SSE

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export interface SSELogEntry {
  timestamp: string;
  level: LogLevel;
  component: string;
  message: string;
  metadata?: Record<string, any>;
  error?: Error;
}

export class SSELogger {
  private static instance: SSELogger;
  private logLevel: LogLevel = LogLevel.INFO;
  private logs: SSELogEntry[] = [];
  private maxLogs = 1000;
  
  private constructor() {
    // Set log level based on environment
    if (process.env.NODE_ENV === 'development') {
      this.logLevel = LogLevel.DEBUG;
    } else if (process.env.NEXT_PUBLIC_SSE_LOG_LEVEL) {
      this.logLevel = parseInt(process.env.NEXT_PUBLIC_SSE_LOG_LEVEL) || LogLevel.INFO;
    }
  }
  
  static getInstance(): SSELogger {
    if (!SSELogger.instance) {
      SSELogger.instance = new SSELogger();
    }
    return SSELogger.instance;
  }
  
  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }
  
  private log(level: LogLevel, component: string, message: string, metadata?: Record<string, any>, error?: Error): void {
    if (level < this.logLevel) return;
    
    const entry: SSELogEntry = {
      timestamp: new Date().toISOString(),
      level,
      component,
      message,
      metadata,
      error
    };
    
    // Store in memory
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
    
    // Console output with colors
    const levelName = LogLevel[level];
    const prefix = `[SSE ${levelName}] ${component}:`;
    
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(prefix, message, metadata || '');
        break;
      case LogLevel.INFO:
        console.log(prefix, message, metadata || '');
        break;
      case LogLevel.WARN:
        console.warn(prefix, message, metadata || '');
        break;
      case LogLevel.ERROR:
        console.error(prefix, message, metadata || '', error || '');
        break;
    }
    
    // In production, send errors to monitoring service
    if (level === LogLevel.ERROR && process.env.NODE_ENV === 'production') {
      this.sendToMonitoring(entry);
    }
  }
  
  debug(component: string, message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, component, message, metadata);
  }
  
  info(component: string, message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.INFO, component, message, metadata);
  }
  
  warn(component: string, message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.WARN, component, message, metadata);
  }
  
  error(component: string, message: string, error?: Error, metadata?: Record<string, any>): void {
    this.log(LogLevel.ERROR, component, message, metadata, error);
  }
  
  // Get recent logs for diagnostics
  getRecentLogs(count = 100, minLevel = LogLevel.DEBUG): SSELogEntry[] {
    return this.logs
      .filter(log => log.level >= minLevel)
      .slice(-count);
  }
  
  // Get log statistics
  getLogStats(): Record<string, number> {
    const stats: Record<string, number> = {
      total: this.logs.length,
      debug: 0,
      info: 0,
      warn: 0,
      error: 0
    };
    
    this.logs.forEach(log => {
      const levelName = LogLevel[log.level].toLowerCase();
      stats[levelName]++;
    });
    
    return stats;
  }
  
  // Clear logs
  clearLogs(): void {
    this.logs = [];
  }
  
  // Send to external monitoring (placeholder)
  private sendToMonitoring(entry: SSELogEntry): void {
    // TODO: Integrate with Sentry, LogRocket, etc.
    // For now, just log that we would send it
    if (process.env.MONITORING_ENDPOINT) {
      fetch(process.env.MONITORING_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry)
      }).catch(() => {
        // Ignore monitoring errors to avoid infinite loops
      });
    }
  }
}

// Export singleton instance
export const sseLogger = SSELogger.getInstance();