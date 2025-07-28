# Sistema SSE (Server-Sent Events) - Guida Completa

## 📋 Indice
1. [Panoramica](#panoramica)
2. [Architettura del Sistema](#architettura-del-sistema)
3. [Componenti Principali](#componenti-principali)
4. [Implementazione Server-Side](#implementazione-server-side)
5. [Implementazione Client-Side](#implementazione-client-side)
6. [Best Practices e Regole](#best-practices-e-regole)
7. [Gestione Errori e Riconnessione](#gestione-errori-e-riconnessione)
8. [Sicurezza](#sicurezza)
9. [Performance e Ottimizzazioni](#performance-e-ottimizzazioni)
10. [Troubleshooting](#troubleshooting)

## 🎯 Panoramica

Il sistema SSE implementato in questo progetto fornisce comunicazione real-time unidirezionale dal server ai client. È ottimizzato per scalabilità, affidabilità e facilità d'uso.

### Caratteristiche Principali
- **Type-safe**: Eventi completamente tipizzati con TypeScript
- **Multi-tenant**: Supporto per isolamento per tenant/agency
- **Auto-riconnessione**: Con backoff esponenziale
- **Rate limiting**: Protezione contro spam di eventi
- **Memory management**: Prevenzione memory leak con limiti e cleanup
- **Canali multipli**: Sistema di sottoscrizione a canali specifici

## 🏗️ Architettura del Sistema

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Client    │────▶│  SSE Route   │────▶│ SSE Manager │
│  (Browser)  │     │ (/api/sse)   │     │ (Singleton) │
└─────────────┘     └──────────────┘     └─────────────┘
                            │                     │
                            ▼                     ▼
                    ┌──────────────┐     ┌─────────────┐
                    │ SSE Service  │     │   Events    │
                    │  (Emitter)   │     │   (Types)   │
                    └──────────────┘     └─────────────┘
```

## 📦 Componenti Principali

### 1. SSE Manager (`/lib/sse/sse-manager.ts`)
Gestisce le connessioni client e la distribuzione degli eventi.

```typescript
// Singleton pattern con protezione per Next.js dev mode
class SSEManager extends EventEmitter {
  private static instance: SSEManager
  private clients: Map<string, SSEClient> = new Map()
  
  // Limiti configurabili
  private readonly maxClientsPerUser = 3
  private readonly maxTotalClients = 500
  private readonly clientTimeout = 5 * 60 * 1000 // 5 minuti
}
```

### 2. SSE Service (`/lib/sse/sse-service.ts`)
Fornisce API type-safe per emettere eventi.

```typescript
// Esempio di emissione evento
sseService.emit('chat:message', {
  conversationId: '123',
  message: { ... }
}, {
  userId: 'user123' // Target specifico
})
```

### 3. SSE Events (`/lib/sse/sse-events.ts`)
Definisce tutti gli eventi disponibili nel sistema.

```typescript
export interface SSEEventMap {
  'chat:message': { conversationId: string; message: {...} }
  'notification:new': { id: string; title: string; ... }
  // Altri eventi...
}
```

## 🖥️ Implementazione Server-Side

### Route Handler (`/app/api/sse/route.ts`)

```typescript
export async function GET(request: Request) {
  // 1. Verifica autenticazione
  const session = await auth()
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }

  // 2. Crea ReadableStream
  const stream = new ReadableStream({
    async start(controller) {
      // 3. Registra client con SSE Manager
      const client = createSSEClient(userId, tenantId, controller)
      sseManager.addClient(client)
      
      // 4. Setup heartbeat (importante!)
      const heartbeat = setInterval(() => {
        controller.enqueue(':heartbeat\n\n')
      }, 30000)
      
      // 5. Cleanup su disconnect
      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeat)
        sseManager.removeClient(client.id)
      })
    }
  })

  // 6. Headers SSE corretti
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disabilita buffering nginx
      'Content-Encoding': 'none'
    }
  })
}
```

### Emissione Eventi

```typescript
// Da qualsiasi parte del server
import { sseService } from '@/lib/sse/sse-service'

// Emit a utente specifico
sseService.emit('notification:new', {
  id: '123',
  title: 'Nuovo messaggio',
  message: 'Hai ricevuto un nuovo messaggio'
}, {
  userId: 'user123'
})

// Emit a tutti gli utenti di un tenant
sseService.emit('data:update', {
  entity: 'invoice',
  action: 'create',
  id: 'inv123'
}, {
  tenantId: 'tenant123'
})

// Broadcast globale
sseService.emit('system:announcement', {
  message: 'Manutenzione programmata',
  type: 'warning'
}, {
  broadcast: true
})
```

## 💻 Implementazione Client-Side

### Context Provider (`/contexts/sse-context.tsx`)

```typescript
export function SSEProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState({
    connected: false,
    connecting: false,
    error: null
  })
  
  const connect = useCallback(() => {
    const eventSource = new EventSource('/api/sse')
    
    eventSource.onopen = () => {
      setState({ connected: true, connecting: false, error: null })
    }
    
    eventSource.onerror = () => {
      // Auto-riconnessione con backoff
      reconnectWithBackoff()
    }
  }, [])
  
  return (
    <SSEContext.Provider value={{ ...state, subscribe }}>
      {children}
    </SSEContext.Provider>
  )
}
```

### Hook Utilizzo

```typescript
// Hook base
function MyComponent() {
  const sse = useSSE()
  
  useEffect(() => {
    const unsubscribe = sse.subscribe('notification:new', (data) => {
      toast.success(data.message)
    })
    
    return unsubscribe
  }, [sse])
}

// Hook specializzato per chat
function ChatComponent({ conversationId }: { conversationId: string }) {
  const chat = useChatSSE()
  
  useEffect(() => {
    return chat.subscribeToConversation(conversationId, {
      onMessage: (data) => {
        // Nuovo messaggio ricevuto
      },
      onTyping: (data) => {
        // Indicatore typing
      }
    })
  }, [conversationId])
}
```

## ✅ Best Practices e Regole

### 1. **Gestione Memoria**
```typescript
// ❌ EVITARE
const clients = [] // Array non limitato

// ✅ CORRETTO
const clients = new Map() // Con limiti
if (clients.size >= MAX_CLIENTS) {
  removeOldestClient()
}
```

### 2. **Formato Eventi SSE**
```typescript
// Formato corretto (nota gli spazi dopo i due punti!)
const message = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`
```

### 3. **Cleanup Connessioni**
```typescript
// SEMPRE pulire risorse su disconnect
request.signal.addEventListener('abort', () => {
  clearInterval(heartbeat)
  sseManager.removeClient(clientId)
  controller.close()
})
```

### 4. **Rate Limiting**
```typescript
// Definisci limiti per eventi frequenti
export const SSEEventRateLimits = {
  'chat:typing': 1000,     // Max 1/secondo
  'presence:update': 5000  // Max 1/5 secondi
}
```

### 5. **Type Safety**
```typescript
// SEMPRE usare tipi per eventi
sseService.emit<'chat:message'>('chat:message', {
  // TypeScript verificherà il payload
})
```

## 🔄 Gestione Errori e Riconnessione

### Backoff Esponenziale
```typescript
function getReconnectDelay(attempt: number): number {
  const baseDelay = 1000
  const maxDelay = 30000
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay)
  const jitter = delay * 0.2 * (Math.random() - 0.5)
  return delay + jitter
}
```

### Gestione Stati Connessione
```typescript
// Stati possibili
type ConnectionState = {
  connected: boolean
  connecting: boolean
  error: Error | null
  reconnectAttempts: number
}

// Gestione errore 503 (servizio disabilitato)
if (response.status === 503) {
  console.log('SSE service disabled by admin')
  return // Non tentare riconnessione
}
```

## 🔒 Sicurezza

### 1. **Autenticazione**
```typescript
// SEMPRE verificare sessione
const session = await auth()
if (!session?.user?.id) {
  return new Response('Unauthorized', { status: 401 })
}
```

### 2. **Isolamento Tenant**
```typescript
// Eventi isolati per tenant
client.tenantId = session.user.lastActiveTenantId
// Solo eventi del proprio tenant saranno ricevuti
```

### 3. **Validazione Input**
```typescript
// Sanitizza sempre i dati prima di inviarli
const sanitizedData = {
  message: DOMPurify.sanitize(userInput),
  timestamp: new Date()
}
```

## ⚡ Performance e Ottimizzazioni

### 1. **Limiti Client**
- Max 3 connessioni per utente
- Max 500 connessioni totali
- Timeout inattività: 5 minuti

### 2. **Heartbeat**
- Intervallo: 30 secondi
- Formato: `:heartbeat\n\n`
- Previene timeout proxy/firewall

### 3. **Cleanup Automatico**
```typescript
// Cleanup ogni minuto
setInterval(() => {
  clients.forEach((client, id) => {
    if (isInactive(client)) {
      removeClient(id)
    }
  })
}, 60000)
```

### 4. **Headers Ottimizzati**
```typescript
headers: {
  'X-Accel-Buffering': 'no',    // Nginx
  'Content-Encoding': 'none',    // No compression
  'Cache-Control': 'no-cache'    // No caching
}
```

## 🛠️ Troubleshooting

### Problema: Connessione si chiude immediatamente
```typescript
// Soluzione: Verifica headers e heartbeat
headers['X-Accel-Buffering'] = 'no'
// Assicurati heartbeat sia attivo
```

### Problema: Memory leak
```typescript
// Soluzione: Verifica cleanup
- Listener rimossi su disconnect
- Timeout/interval cancellati
- Client rimossi da Map
```

### Problema: Eventi non ricevuti
```typescript
// Debug:
console.log('Client channels:', client.channels)
console.log('Event target:', target)
// Verifica che client sia sottoscritto al canale corretto
```

### Problema: Too many connections
```typescript
// Soluzioni:
1. Aumenta MAX_SSE_CLIENTS
2. Riduci timeout inattività
3. Implementa connection pooling
```

## 📊 Monitoraggio

### Statistiche Sistema
```typescript
const stats = sseManager.getStats()
// {
//   totalClients: 42,
//   clientsByUser: { user1: 2, user2: 1 },
//   clientsByTenant: { tenant1: 20 },
//   memoryUsage: { ... }
// }
```

### Logging
```typescript
// Livelli di log appropriati
console.log('[SSE] Client connected:', clientId)
console.error('[SSE] Connection error:', error)
console.warn('[SSE] Rate limit exceeded:', eventName)
```

## 🚀 Esempio Completo

```typescript
// Server: Emetti evento quando invoice creata
export async function createInvoice(data: InvoiceData) {
  const invoice = await db.invoice.create({ data })
  
  // Notifica tutti gli utenti del tenant
  sseService.emit('data:update', {
    entity: 'invoice',
    action: 'create',
    id: invoice.id,
    data: invoice
  }, {
    tenantId: invoice.tenantId
  })
  
  return invoice
}

// Client: Ricevi e gestisci evento
function InvoiceList() {
  const sse = useSSE()
  const [invoices, setInvoices] = useState([])
  
  useEffect(() => {
    return sse.subscribe('data:update', (event) => {
      if (event.entity === 'invoice') {
        if (event.action === 'create') {
          setInvoices(prev => [...prev, event.data])
        }
      }
    })
  }, [sse])
  
  return <div>{/* Render invoices */}</div>
}
```

## 📝 Checklist Implementazione

- [ ] Setup SSE Manager singleton
- [ ] Implementare route `/api/sse`
- [ ] Configurare autenticazione
- [ ] Aggiungere heartbeat
- [ ] Implementare cleanup su disconnect
- [ ] Creare SSE Context Provider
- [ ] Implementare hook client
- [ ] Aggiungere backoff riconnessione
- [ ] Configurare rate limiting
- [ ] Testare memory management
- [ ] Monitorare performance
- [ ] Documentare eventi custom

Questa architettura garantisce un sistema SSE robusto, scalabile e facile da mantenere.