# Sistema SSE per Aggiornamenti Real-Time

## Panoramica
Questo documento descrive l'implementazione del sistema Server-Sent Events (SSE) per aggiornamenti in tempo reale tra diverse pagine dell'applicazione, con focus specifico sul sistema di disponibilità prodotti tra `/prepara` e `/cameriere`.

## Architettura

### Componenti Principali

1. **SSE Service** (`/lib/sse/sse-service.ts`)
   - Singleton globale per gestire l'emissione eventi
   - Sistema di code per client offline
   - Rate limiting e priorità eventi

2. **SSE Manager** (`/lib/sse/sse-manager.ts`)
   - Gestione connessioni client
   - Invio messaggi ai client connessi
   - Heartbeat automatico

3. **SSE Route** (`/app/api/sse/route.ts`)
   - Endpoint API per connessioni SSE
   - Autenticazione via httpOnly cookie
   - Gestione reconnection automatica

4. **SSE Context** (`/contexts/sse-context.tsx`)
   - Provider React per client-side
   - Gestione sottoscrizioni eventi
   - Reconnection con exponential backoff

## Implementazione Disponibilità Prodotti

### 1. Emissione Eventi (Server-Side)

Quando un prodotto viene marcato come esaurito in `/prepara`:

```typescript
// /lib/actions/prodotti.ts
export async function toggleProductAvailability(productId: string, available: boolean) {
  // ... aggiornamento database ...
  
  // Emit SSE event
  const eventData = {
    productId,
    productName: product.nome,
    available,
    timestamp: new Date().toISOString()
  };
  
  // Emissione multipla con delay per catturare client che si riconnettono
  sseService.emit('product:availability', eventData, { 
    broadcast: true,
    skipRateLimit: true,
    tenantId: user.tenantId,
    queueIfOffline: true
  });
  
  // Re-emit con delay crescenti per garantire delivery
  const delays = [100, 250, 500, 1000, 2000];
  delays.forEach(delay => {
    setTimeout(() => {
      sseService.emit('product:availability', eventData, { 
        broadcast: true,
        skipRateLimit: true,
        tenantId: user.tenantId,
        queueIfOffline: true
      });
    }, delay);
  });
}
```

### 2. Ricezione Eventi (Client-Side)

In `/cameriere` per ricevere gli aggiornamenti:

```typescript
// Component che riceve gli aggiornamenti
import { useSSE } from '@/contexts/sse-context';
import { useEffect } from 'react';

export function ProductList() {
  const { subscribe, isConnected } = useSSE();
  const [products, setProducts] = useState([]);
  
  useEffect(() => {
    if (!isConnected) return;
    
    const unsubscribe = subscribe('product:availability', (data) => {
      console.log('Product availability update:', data);
      
      // Aggiorna stato locale
      setProducts(prev => prev.map(product => 
        product.id === data.productId 
          ? { ...product, disponibile: data.available }
          : product
      ));
    });
    
    return unsubscribe;
  }, [isConnected, subscribe]);
  
  // ... resto del componente
}
```

### 3. Sincronizzazione Fallback

Per garantire consistenza, implementare sincronizzazione periodica:

```typescript
// Sync periodico come fallback
useEffect(() => {
  const syncAvailability = async () => {
    const result = await syncProductAvailability();
    if (result.success) {
      setProducts(result.products);
    }
  };
  
  // Sync iniziale dopo 3 secondi
  const initialTimeout = setTimeout(syncAvailability, 3000);
  
  // Sync periodico ogni 30 secondi
  const interval = setInterval(syncAvailability, 30000);
  
  return () => {
    clearTimeout(initialTimeout);
    clearInterval(interval);
  };
}, []);
```

## Pattern Singleton Globale (CRITICO)

Per evitare istanze multiple in Next.js dev mode:

```typescript
// Pattern per SSE Service
const globalForSSE = global as unknown as { sseService?: SSEService };
export const sseService = globalForSSE.sseService || SSEService.getInstance();
if (!globalForSSE.sseService) {
  globalForSSE.sseService = sseService;
}

// Pattern per SSE Manager
const globalForSSEManager = global as unknown as { sseManager?: SSEManager };
export const sseManager = globalForSSEManager.sseManager || SSEManager.getInstance();
if (!globalForSSEManager.sseManager) {
  globalForSSEManager.sseManager = sseManager;
}
```

## Sistema di Code

### Queue per Client Offline

Eventi importanti vengono salvati se nessun client è connesso:

```typescript
// In sse-service.ts
queueEventForTenant(tenantId: string, eventName: SSEEventName, data: any) {
  const key = `tenant:${tenantId}`;
  const queue = this.eventQueue.get(key) || [];
  
  queue.push({
    eventName,
    data,
    timestamp: Date.now(),
    expiresAt: Date.now() + 300000, // 5 minuti TTL
  });
  
  this.eventQueue.set(key, queue);
}
```

### Processamento Code

Queue processor esegue ogni 2 secondi:

```typescript
// Quando un client si connette
const checkQueue = () => {
  const tenantClients = sseManager.getTenantsClients(user.tenantId);
  if (tenantClients.length > 0) {
    sseService.processQueueForTenant(user.tenantId);
  }
};

// Check multipli per garantire delivery
setTimeout(checkQueue, 100);
setTimeout(checkQueue, 500);
setTimeout(checkQueue, 1000);
setTimeout(checkQueue, 2000);
```

## Autenticazione

### HttpOnly Cookie

```typescript
// In /app/api/sse/route.ts
const cookieName = process.env.SESSION_COOKIE_NAME || 'bar-roxy-session';
const sessionCookie = cookieStore.get(cookieName);

if (sessionCookie?.value) {
  tokenData = verifyToken(sessionCookie.value);
}
```

### Fallback Token (retrocompatibilità)

```typescript
if (!tokenData) {
  const token = request.nextUrl.searchParams.get('token');
  if (token) {
    tokenData = verifyToken(token);
  }
}
```

## Gestione Reconnection

### Client-Side (Exponential Backoff)

```typescript
function getReconnectDelay(attempt: number): number {
  const baseDelay = 100; // 100ms start
  const maxDelay = 2000; // 2s max
  const delay = Math.min(baseDelay * Math.pow(1.3, attempt), maxDelay);
  const jitter = delay * 0.1 * (Math.random() - 0.5);
  return delay + jitter;
}
```

### Keep-Alive Check

```typescript
// Check ogni 2 secondi
keepAliveInterval = setInterval(() => {
  const timeSinceLastEvent = Date.now() - lastEventTime;
  if (timeSinceLastEvent > 6000) { // No eventi per 6s
    // Force reconnection
    eventSource.close();
    connect();
  }
}, 2000);
```

## Ottimizzazioni Performance

### 1. Emissioni Multiple con Delay

Per garantire che client che si riconnettono ricevano l'evento:
- Emissione immediata
- Re-emit dopo 100ms, 250ms, 500ms, 1s, 2s

### 2. Queue Processor Veloce

- Esecuzione ogni 2 secondi (invece di 5)
- Delivery solo dell'evento più recente per evitare duplicati

### 3. Heartbeat Frequente

- Server: ogni 10 secondi
- Route: ogni 2 secondi
- Previene timeout connessione

## 🚀 Come Ottenere Connessioni Istantanee

### Pattern Critico: Prevenire Sottoscrizioni Multiple

Il problema più comune che causa ritardi è la creazione di sottoscrizioni multiple. Usa sempre un `useRef` per tracciare lo stato della sottoscrizione:

```typescript
// ❌ SBAGLIATO - Crea sottoscrizioni multiple
useEffect(() => {
  if (!sseContext?.subscribe) return;
  
  const unsubscribe = sseContext.subscribe('product:availability', (data) => {
    // handler
  });
  
  return unsubscribe;
}, [sseContext]); // Ri-esegue quando sseContext cambia!

// ✅ CORRETTO - Singola sottoscrizione garantita
const subscribedRef = useRef(false);

useEffect(() => {
  if (!sseContext?.subscribe || subscribedRef.current) {
    return; // Evita sottoscrizioni duplicate
  }
  
  subscribedRef.current = true;
  
  const unsubscribe = sseContext.subscribe('product:availability', (data) => {
    // Aggiorna stato IMMEDIATAMENTE senza delay
    setProducts(prev => prev.map(p => 
      p.id === data.productId 
        ? { ...p, disponibile: data.available }
        : p
    ));
  });
  
  return () => {
    subscribedRef.current = false;
    unsubscribe();
  };
}, [sseContext]); // Dependency stabile
```

### Regole per Connessioni Istantanee

1. **Usa sempre `subscribedRef` pattern** per prevenire sottoscrizioni multiple
2. **Aggiorna stato immediatamente** nell'handler senza setTimeout o delay
3. **Minimizza i log** in produzione - ogni console.log rallenta l'esecuzione
4. **Evita re-render inutili** - usa React.memo e useCallback dove appropriato
5. **Non fare revalidatePath** dopo emit SSE - lascia che SSE gestisca gli aggiornamenti

### Esempio Completo Ottimizzato

```typescript
// /app/cameriere/tavolo/[id]/page.tsx
export default function TavoloPage() {
  const sseContext = useSSE();
  const subscribedRef = useRef(false);
  const lastUpdateRef = useRef<{[key: string]: number}>({});
  
  useEffect(() => {
    if (!sseContext?.subscribe || subscribedRef.current) {
      return;
    }
    
    subscribedRef.current = true;
    
    const unsubscribe = sseContext.subscribe('product:availability', (data: any) => {
      // Deduplicazione veloce usando timestamp
      const key = `${data.productId}-${data.available}`;
      const now = Date.now();
      
      if (lastUpdateRef.current[key] && (now - lastUpdateRef.current[key] < 3000)) {
        return; // Ignora duplicati entro 3 secondi
      }
      
      lastUpdateRef.current[key] = now;
      
      // Aggiornamento ISTANTANEO dello stato
      setMenuItems(prev => prev.map(category => ({
        ...category,
        items: category.items.map(item => 
          item.id === data.productId 
            ? { ...item, disponibile: data.available }
            : item
        )
      })));
      
      // Notifica opzionale (senza rallentare l'update)
      if (!data.available) {
        requestAnimationFrame(() => {
          toast.warning(`${data.productName} è esaurito`);
        });
      }
    });
    
    return () => {
      subscribedRef.current = false;
      unsubscribe();
    };
  }, [sseContext]);
}
```

### Debug Performance

Per verificare che le connessioni siano istantanee:

```typescript
// Aggiungi timing nel server action
const startTime = Date.now();
sseService.emit('product:availability', eventData, options);
console.log(`[TIMING] Emit took ${Date.now() - startTime}ms`);

// Aggiungi timing nel client
const unsubscribe = subscribe('product:availability', (data) => {
  console.log(`[TIMING] Event received at ${new Date().toISOString()}`);
  console.log(`[TIMING] Latency: ${Date.now() - new Date(data.timestamp).getTime()}ms`);
});
```

### Checklist Connessione Istantanea

- [ ] Pattern singleton globale implementato per SSE Service/Manager
- [ ] `subscribedRef` usato per prevenire sottoscrizioni multiple
- [ ] Stato aggiornato immediatamente senza delay
- [ ] Log minimizzati o disabilitati in produzione
- [ ] No `revalidatePath` dopo emit SSE
- [ ] Deduplicazione implementata per eventi multipli
- [ ] Heartbeat configurato (2-10 secondi)
- [ ] Queue processor veloce (2 secondi)
- [ ] Emissioni multiple con delay per reliability

## Debugging

### Log Utili

```typescript
// Vedere client connessi
console.log('[SSE Manager] Current clients:', sseManager.getConnectedClients());

// Verificare code
console.log('[SSE Queue] Queue size:', eventQueue.size);

// Debug eventi specifici
if (eventName === 'product:availability') {
  console.log('[SSE] Emitting product:availability to', clients.length, 'clients');
}
```

### Pulizia Log

Per produzione, rimuovere o condizionare i log:

```typescript
const DEBUG = process.env.NODE_ENV === 'development';
if (DEBUG) console.log('...');
```

## Troubleshooting

### Problema: Eventi non ricevuti
1. Verificare singleton pattern implementato
2. Controllare che client sia sottoscritto all'evento
3. Verificare tenantId corrisponda

### Problema: Delay nella delivery
1. Ridurre intervallo queue processor
2. Implementare emissioni multiple con delay
3. Verificare heartbeat attivo

### Problema: Connessioni perse
1. Implementare exponential backoff
2. Mantenere heartbeat frequente
3. Verificare headers SSE corretti

## Replicare per Altri Eventi

Per aggiungere un nuovo tipo di evento real-time:

### 1. Definire evento in `/lib/sse/sse-events.ts`

```typescript
export type SSEEventMap = {
  'nuovo:evento': {
    campo1: string;
    campo2: number;
    timestamp: string;
  };
  // ... altri eventi
};
```

### 2. Emettere da server action

```typescript
sseService.emit('nuovo:evento', {
  campo1: 'valore',
  campo2: 123,
  timestamp: new Date().toISOString()
}, {
  broadcast: true,
  tenantId: user.tenantId,
  queueIfOffline: true
});
```

### 3. Sottoscrivere nel client

```typescript
const unsubscribe = subscribe('nuovo:evento', (data) => {
  // Gestire l'evento
  console.log('Nuovo evento ricevuto:', data);
});
```

## Best Practices

1. **Sempre usare singleton pattern** per SSE Service e Manager
2. **Implementare fallback sync** per garantire consistenza
3. **Emettere eventi multipli** con delay per client che si riconnettono
4. **Usare queueIfOffline** per eventi critici
5. **Mantenere heartbeat frequente** (2-10 secondi)
6. **Pulire log in produzione** per performance
7. **Verificare autenticazione** prima di emettere/ricevere
8. **Gestire reconnection** con exponential backoff

## Esempio Completo

Per un sistema completo di notifiche real-time:

```typescript
// Server: quando arriva nuovo ordine
export async function createOrder(orderData: any) {
  const order = await prisma.ordine.create({ data: orderData });
  
  // Emit con tutte le opzioni
  sseService.emit('order:new', {
    orderId: order.id,
    tableNumber: order.numeroTavolo,
    items: order.items,
    totalAmount: order.totale,
    timestamp: new Date().toISOString()
  }, {
    broadcast: true,           // A tutti i client
    skipRateLimit: true,       // Ignora rate limit
    tenantId: user.tenantId,   // Solo stesso tenant
    queueIfOffline: true       // Salva se offline
  });
  
  return order;
}

// Client: ricevere notifica
function OrderNotifications() {
  const { subscribe, isConnected } = useSSE();
  
  useEffect(() => {
    if (!isConnected) return;
    
    const unsubscribe = subscribe('order:new', (data) => {
      // Mostra notifica
      toast.success(`Nuovo ordine dal tavolo ${data.tableNumber}`);
      
      // Aggiorna UI
      refetchOrders();
      
      // Play sound
      playNotificationSound();
    });
    
    return unsubscribe;
  }, [isConnected]);
}
```

## Conclusione

Il sistema SSE implementato garantisce aggiornamenti real-time istantanei tra le diverse pagine dell'applicazione. L'uso del pattern singleton globale è critico per evitare problemi in Next.js dev mode. Il sistema di code garantisce che eventi importanti non vengano persi anche quando i client sono temporaneamente offline.