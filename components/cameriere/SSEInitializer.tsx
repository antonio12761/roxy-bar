'use client';

import { useEffect, useRef } from 'react';
import { useSSE } from '@/contexts/sse-context';

export function SSEInitializer() {
  const sseContext = useSSE();
  const hasInitialized = useRef(false);
  const connectionAttempts = useRef(0);

  useEffect(() => {
    if (!sseContext) {
      return;
    }
    
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      connectionAttempts.current++;
      sseContext.connect();
    }

    // No monitoring logs - they slow down performance
  }, [sseContext]);

  // Re-establish connection if lost
  useEffect(() => {
    if (!sseContext) return;

    const checkConnection = setInterval(() => {
      if (!sseContext.isConnected && !sseContext.connecting) {
        sseContext.connect();
      }
    }, 5000); // Check every 5 seconds

    return () => clearInterval(checkConnection);
  }, [sseContext]);

  return null; // This component doesn't render anything
}