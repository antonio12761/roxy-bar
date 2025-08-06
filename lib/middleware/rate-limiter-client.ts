'use client';

import { useRef, useCallback } from 'react';

interface ClientRateLimiterOptions {
  maxRequests: number;
  interval: number;
  onRateLimited?: (resetTime: Date) => void;
}

export function useClientRateLimit(options: ClientRateLimiterOptions) {
  const requestTimestamps = useRef<number[]>([]);
  const { maxRequests, interval, onRateLimited } = options;

  const checkRateLimit = useCallback((): boolean => {
    const now = Date.now();
    
    // Filtra timestamp scaduti
    requestTimestamps.current = requestTimestamps.current.filter(
      timestamp => now - timestamp < interval
    );

    if (requestTimestamps.current.length >= maxRequests) {
      // Rate limited
      const oldestTimestamp = requestTimestamps.current[0];
      const resetTime = new Date(oldestTimestamp + interval);
      
      if (onRateLimited) {
        onRateLimited(resetTime);
      }
      
      return false;
    }

    // Aggiungi timestamp corrente e permetti la richiesta
    requestTimestamps.current.push(now);
    return true;
  }, [maxRequests, interval, onRateLimited]);

  const reset = useCallback(() => {
    requestTimestamps.current = [];
  }, []);

  return {
    checkRateLimit,
    reset,
    requestCount: requestTimestamps.current.length
  };
}