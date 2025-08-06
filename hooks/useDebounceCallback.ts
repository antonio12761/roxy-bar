import { useCallback, useRef } from 'react';

interface DebounceOptions {
  delay?: number;
  leading?: boolean;
  trailing?: boolean;
  maxWait?: number;
}

export function useDebounceCallback<T extends (...args: any[]) => any>(
  callback: T,
  options: DebounceOptions = {}
): [T, () => void] {
  const {
    delay = 300,
    leading = false,
    trailing = true,
    maxWait
  } = options;

  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const maxTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const lastCallTimeRef = useRef<number>(0);
  const lastArgsRef = useRef<any[] | undefined>(undefined);
  const lastThisRef = useRef<any>(undefined);
  const leadingCallRef = useRef(false);

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }
    if (maxTimeoutRef.current) {
      clearTimeout(maxTimeoutRef.current);
      maxTimeoutRef.current = undefined;
    }
    leadingCallRef.current = false;
  }, []);

  const debouncedCallback = useCallback(
    ((...args: Parameters<T>) => {
      lastArgsRef.current = args;
      // lastThisRef.current = this; // Removed 'this' context as it's not available in arrow functions
      const now = Date.now();

      // Cancel existing timeouts
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Handle leading edge
      if (leading && !leadingCallRef.current) {
        callback(...args);
        leadingCallRef.current = true;
        lastCallTimeRef.current = now;
      }

      // Handle max wait
      if (maxWait && !maxTimeoutRef.current) {
        const timeElapsed = now - lastCallTimeRef.current;
        const remainingWait = Math.max(0, maxWait - timeElapsed);
        
        maxTimeoutRef.current = setTimeout(() => {
          if (trailing && lastArgsRef.current) {
            callback(...lastArgsRef.current);
            lastCallTimeRef.current = Date.now();
          }
          maxTimeoutRef.current = undefined;
          leadingCallRef.current = false;
        }, remainingWait);
      }

      // Set new timeout for trailing edge
      timeoutRef.current = setTimeout(() => {
        if (trailing && lastArgsRef.current && !maxTimeoutRef.current) {
          callback(...lastArgsRef.current);
          lastCallTimeRef.current = Date.now();
        }
        timeoutRef.current = undefined;
        maxTimeoutRef.current = undefined;
        leadingCallRef.current = false;
        lastArgsRef.current = undefined;
      }, delay);
    }) as T,
    [callback, delay, leading, trailing, maxWait]
  );

  return [debouncedCallback, cancel];
}

// Hook per request deduplication
interface RequestDeduplicationOptions {
  cacheTime?: number; // Tempo di cache in ms
  dedupeTime?: number; // Tempo di deduplica in ms
}

export function useRequestDeduplication<T extends (...args: any[]) => Promise<any>>(
  requestFn: T,
  options: RequestDeduplicationOptions = {}
): T {
  const { cacheTime = 5000, dedupeTime = 100 } = options;
  
  const pendingRequests = useRef<Map<string, Promise<any>>>(new Map());
  const cache = useRef<Map<string, { data: any; timestamp: number }>>(new Map());
  
  return useCallback(
    (async (...args: Parameters<T>) => {
      // Crea una chiave univoca per questa richiesta
      const key = JSON.stringify(args);
      
      // Controlla cache
      const cached = cache.current.get(key);
      if (cached && Date.now() - cached.timestamp < cacheTime) {
        return cached.data;
      }
      
      // Controlla se c'è già una richiesta pendente
      const pending = pendingRequests.current.get(key);
      if (pending) {
        return pending;
      }
      
      // Crea nuova richiesta
      const promise = requestFn(...args)
        .then(data => {
          // Salva in cache
          cache.current.set(key, { data, timestamp: Date.now() });
          
          // Rimuovi dalle richieste pendenti dopo dedupeTime
          setTimeout(() => {
            pendingRequests.current.delete(key);
          }, dedupeTime);
          
          return data;
        })
        .catch(error => {
          // Rimuovi dalle richieste pendenti in caso di errore
          pendingRequests.current.delete(key);
          throw error;
        });
      
      // Aggiungi alle richieste pendenti
      pendingRequests.current.set(key, promise);
      
      return promise;
    }) as T,
    [requestFn, cacheTime, dedupeTime]
  );
}