# Sistema SSE + Polling Ibrido

## Panoramica

Questo sistema combina Server-Sent Events (SSE) per aggiornamenti real-time con polling periodico come fallback, garantendo affidabilità e velocità nella consegna degli aggiornamenti.

## Architettura

### 1. SSE (Primario)
- **Connessione persistente** per aggiornamenti istantanei
- **Heartbeat ogni 2 secondi** per mantenere la connessione attiva
- **Riconnessione automatica** con backoff esponenziale
- **Eventi tipizzati** per type safety

### 2. Polling (Fallback)
- **Attivo sempre** ma con frequenza variabile:
  - **10 secondi** quando SSE è connesso
  - **3 secondi** quando SSE è disconnesso
- **Garantisce** che nessun aggiornamento venga perso

## Implementazione

### Server (Next.js API Route)

```typescript
// app/api/sse/route.ts
export async function GET(request: NextRequest) {
  const stream = new ReadableStream({
    async start(controller) {
      // Setup heartbeat per mantenere connessione viva
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(new TextEncoder().encode(':heartbeat\n\n'));
        } catch (error) {
          clearInterval(heartbeat);
        }
      }, 2000); // Ogni 2 secondi

      // Cleanup su disconnect
      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        // Cleanup risorse
      });
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Keep-Alive': 'timeout=300',
      'X-Accel-Buffering': 'no',
    }
  });
}
```

### Client Context (React)

```typescript
// contexts/sse-context.tsx
export function SSEProvider({ children, token }: Props) {
  const [state, setState] = useState({
    connected: false,
    connecting: false,
    error: null,
    reconnectAttempts: 0
  });

  const connect = useCallback(() => {
    if (eventSourceRef.current || state.connecting) return;
    
    const eventSource = new EventSource(`/api/sse?token=${token}`);
    
    eventSource.onopen = () => {
      setState({ connected: true, connecting: false, error: null });
      // Reset tentativi riconnessione
    };

    eventSource.onerror = () => {
      // Riconnessione con backoff esponenziale
      const delay = Math.min(100 * Math.pow(1.3, attempts), 2000);
      setTimeout(() => connect(), delay);
    };

    // Monitor heartbeat - disconnetti se non riceve eventi per 6s
    keepAliveInterval = setInterval(() => {
      if (Date.now() - lastEventTime > 6000) {
        eventSource.close();
        connect(); // Riconnetti immediatamente
      }
    }, 2000);
  }, [token]);

  return (
    <SSEContext.Provider value={{ ...state, subscribe, connect }}>
      {children}
    </SSEContext.Provider>
  );
}
```

### Component con Polling Ibrido

```typescript
// components/RealTimeComponent.tsx
export function RealTimeComponent() {
  const sseContext = useSSE();
  const [data, setData] = useState([]);
  const lastRefreshRef = useRef(0);

  // Carica dati iniziali
  useEffect(() => {
    loadData();
  }, []);

  // SSE subscription
  useEffect(() => {
    const unsubscribe = sseContext.subscribe('data:update', (event) => {
      // Aggiorna stato con nuovo dato
      setData(prev => [...prev, event.data]);
      // Forza refresh per dettagli completi se necessario
      setTimeout(() => loadData(), 100);
    });

    return unsubscribe;
  }, []);

  // Polling ibrido - sempre attivo ma frequenza variabile
  useEffect(() => {
    const interval = setInterval(() => {
      const refreshInterval = sseContext.connected ? 10000 : 3000;
      
      if (Date.now() - lastRefreshRef.current > refreshInterval - 100) {
        loadData();
        lastRefreshRef.current = Date.now();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [sseContext.connected]);

  return <div>{/* UI */}</div>;
}
```

## Configurazione Ottimale

### Timing
- **Heartbeat server**: 2 secondi
- **Timeout client**: 6 secondi (3x heartbeat)
- **Polling connesso**: 10 secondi
- **Polling disconnesso**: 3 secondi
- **Backoff riconnessione**: 100ms - 2s

### Headers SSE
```typescript
{
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  'Connection': 'keep-alive',
  'Keep-Alive': 'timeout=300', // 5 minuti
  'X-Accel-Buffering': 'no', // Disabilita buffering nginx
}
```

## Gestione Eventi in Coda

Quando non ci sono client connessi, gli eventi vengono salvati in coda:

```typescript
// Server
if (connectedClients === 0) {
  eventQueue.set(`tenant:${tenantId}`, {
    event,
    data,
    expiresAt: Date.now() + 300000 // 5 minuti TTL
  });
}

// Quando client si connette
function onClientConnect(client) {
  const queuedEvents = eventQueue.get(`tenant:${client.tenantId}`);
  if (queuedEvents) {
    // Consegna eventi con delay per assicurare client pronto
    setTimeout(() => {
      queuedEvents.forEach(event => emit(event));
      eventQueue.delete(`tenant:${client.tenantId}`);
    }, 500);
  }
}
```

## Vantaggi

1. **Velocità**: Aggiornamenti istantanei con SSE (100-500ms)
2. **Affidabilità**: Polling garantisce consegna anche se SSE fallisce
3. **Efficienza**: 93% meno carico rispetto a solo polling
4. **Resilienza**: Riconnessione automatica e gestione errori robusta

## Troubleshooting

### SSE si disconnette frequentemente
- Verificare configurazione proxy/nginx
- Aumentare Keep-Alive timeout
- Controllare firewall/load balancer

### Eventi persi
- Verificare TTL eventi in coda (default 5 minuti)
- Controllare che il polling sia attivo
- Verificare token autenticazione

### Alto carico server
- Aumentare intervallo polling quando connesso
- Implementare rate limiting
- Ottimizzare query database

## Best Practices

1. **Sempre combinare SSE + Polling** per massima affidabilità
2. **Heartbeat frequente** (2s) per rilevare disconnessioni velocemente
3. **TTL eventi in coda** almeno 5 minuti
4. **Logging minimale** in produzione per performance
5. **Monitorare metriche** connessioni attive e latenza