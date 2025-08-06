import { useState, useEffect, useRef } from 'react';

interface ConnectionHealth {
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
  quality: 'excellent' | 'good' | 'fair' | 'poor';
  message: string;
  reconnectAttempts: number;
  lastError?: string;
}

export function useConnectionHealth(sseContext: any) {
  const [connectionHealth, setConnectionHealth] = useState<ConnectionHealth>({
    status: 'disconnected',
    quality: 'poor',
    message: 'Disconnesso',
    reconnectAttempts: 0
  });
  
  const lastConnectionChangeRef = useRef<number>(Date.now());
  const connectionStabilityRef = useRef<number>(0);

  useEffect(() => {
    const updateConnectionHealth = () => {
      const now = Date.now();
      const timeSinceLastChange = now - lastConnectionChangeRef.current;
      
      // Update stability score
      if (sseContext.connected) {
        connectionStabilityRef.current = Math.min(100, connectionStabilityRef.current + 1);
      } else {
        connectionStabilityRef.current = Math.max(0, connectionStabilityRef.current - 10);
      }
      
      // Determine quality based on stability and connection state
      let quality: ConnectionHealth['quality'] = 'poor';
      if (sseContext.connected) {
        if (connectionStabilityRef.current > 80) quality = 'excellent';
        else if (connectionStabilityRef.current > 50) quality = 'good';
        else if (connectionStabilityRef.current > 20) quality = 'fair';
      }
      
      // Set connection health
      setConnectionHealth({
        status: sseContext.connected ? 'connected' : 
                sseContext.connecting ? 'connecting' : 
                sseContext.error ? 'error' : 'disconnected',
        quality,
        message: sseContext.connected ? 'Connesso' :
                 sseContext.connecting ? 'Connessione in corso...' :
                 sseContext.error ? 'Errore di connessione' : 'Disconnesso',
        reconnectAttempts: sseContext.reconnectAttempts || 0,
        lastError: sseContext.error
      });
      
      lastConnectionChangeRef.current = now;
    };
    
    updateConnectionHealth();
    const interval = setInterval(updateConnectionHealth, 1000);
    
    return () => clearInterval(interval);
  }, [sseContext.connected, sseContext.connecting, sseContext.error]);
  
  return connectionHealth;
}