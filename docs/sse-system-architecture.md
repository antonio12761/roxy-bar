# Sistema SSE (Server-Sent Events) - Architettura e Implementazione

## 📋 Panoramica

Il sistema SSE fornisce comunicazione real-time unidirezionale dal server ai client per notifiche, messaggi chat, aggiornamenti presenza e altri eventi in tempo reale.

## 🏗️ Architettura

### Componenti Principali

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Client Hook   │────▶│   SSE Endpoint   │────▶│   SSE Manager   │
│  (use-sse.ts)   │     │  (/api/sse)      │     │ (sse-manager.ts)│
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                │                          │
                                ▼                          ▼
                        ┌──────────────────┐     ┌─────────────────┐
                        │   SSE Service    │────▶│   Event Types   │
                        │ (sse-service.ts) │     │ (sse-events.ts) │
                        └──────────────────┘     └─────────────────┘
```

### 1. **SSE Manager** (`/lib/sse/sse-manager.ts`)
Singleton globale che gestisce le connessioni client.

```typescript
// Singleton pattern per Next.js
static getInstance(): SSEManager {
  const globalAny = global as any
  if (!globalAny.__sseManagerInstance) {
    globalAny.__sseManagerInstance = new SSEManager()
  }
  return globalAny.__sseManagerInstance
}
```

**Funzionalità principali:**
- Registrazione/rimozione client
- Invio eventi a utenti specifici, tenant o canali
- Cleanup automatico connessioni inattive
- Gestione canali di sottoscrizione

### 2. **SSE Service** (`/lib/sse/sse-service.ts`)
Livello di astrazione per emettere eventi tipizzati.

```typescript
// Esempio emissione messaggio chat
sseService.emitChatMessage(
  conversationId,
  message,
  participantIds // Array di user IDs destinatari
)
```

**Eventi supportati:**
- `chat:message` - Nuovi messaggi
- `chat:typing` - Indicatore digitazione
- `chat:unread-count` - Contatori non letti
- `notification:new` - Notifiche generali
- `presence:update` - Stato presenza utenti
- `ping` - Heartbeat connessione

### 3. **SSE Endpoint** (`/app/api/sse/route.ts`)
Endpoint HTTP che stabilisce la connessione SSE.

```typescript
export async function GET(request: Request) {
  // 1. Autenticazione
  const session = await auth()
  
  // 2. Creazione stream
  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()
  
  // 3. Registrazione client
  const client: SSEClient = {
    id: generateClientId(),
    userId: session.user.id,
    tenantId: session.user.lastActiveTenantId,
    channels: new Set([
      SSEChannels.user(userId),
      SSEChannels.tenant(tenantId),
      SSEChannels.global
    ])
  }
  
  sseManager.addClient(client)
  
  // 4. Headers SSE
  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Content-Encoding': 'none'
    }
  })
}
```

### 4. **Client Hook** (`/hooks/use-sse-improved.ts`)
Hook React per gestire la connessione lato client.

```typescript
const sse = useSSEImproved()

// Sottoscrizione a eventi
const unsubscribe = sse.subscribe('chat:message', (data) => {
  console.log('Nuovo messaggio:', data)
})

// Hook specifico per chat
const chatSSE = useChatSSEImproved()
const unsubscribe = chatSSE.subscribeToConversation(conversationId, {
  onMessage: (data) => { /* ... */ },
  onTyping: (data) => { /* ... */ }
})
```

## 🔧 Implementazione

### Invio Messaggi Chat

```typescript
// Server-side (action)
export async function sendMessage(data) {
  // 1. Salva messaggio nel DB
  const message = await db.chatMessage.create({ /* ... */ })
  
  // 2. Identifica destinatari
  const participantIds = [
    conversation.user1Id,
    conversation.user2Id
  ].filter(Boolean)
  
  // 3. Emetti evento SSE
  sseService.emitChatMessage(
    conversationId,
    {
      id: message.id,
      content: message.content,
      senderId: message.senderId,
      senderName: message.senderName,
      createdAt: message.createdAt
    },
    participantIds
  )
}
```

### Ricezione Messaggi Client

```typescript
// Client-side (React component)
useEffect(() => {
  if (!conversationId || !sse.connected) return

  const unsubscribe = sse.subscribe('chat:message', (data) => {
    // Filtra per conversazione corrente
    if (data.conversationId === conversationId) {
      // Aggiungi solo messaggi di altri utenti
      if (data.message.senderId !== currentUserId) {
        setMessages(prev => [...prev, data.message])
      }
    }
  })

  return unsubscribe
}, [conversationId, sse.connected, currentUserId])
```

## 🚀 Best Practices

### 1. **Gestione Connessioni**
- Usa sempre il singleton SSE Manager
- Cleanup automatico delle connessioni inattive
- Heartbeat ogni 30 secondi per mantenere la connessione

### 2. **Sicurezza**
- Autenticazione obbligatoria per l'endpoint SSE
- Invio eventi solo agli utenti autorizzati
- Validazione tenant/agency per multi-tenancy

### 3. **Performance**
- Batch di eventi quando possibile
- Rate limiting per prevenire spam
- Compressione non abilitata per SSE (interferisce con streaming)

### 4. **Error Handling**
- Reconnect automatico con backoff esponenziale
- Gestione graceful di disconnessioni
- Logging dettagliato per debug

## 🐛 Troubleshooting

### Problema: "Found 0 clients"
**Causa**: SSE Manager non persiste tra richieste in dev mode
**Soluzione**: Usa singleton globale pattern

```typescript
const globalAny = global as any
if (!globalAny.__sseManagerInstance) {
  globalAny.__sseManagerInstance = new SSEManager()
}
```

### Problema: Eventi non ricevuti
**Verifiche**:
1. Client connesso? Check `sse.connected`
2. Sottoscrizione attiva? Verifica return di `subscribe()`
3. Canale corretto? Log `client.channels`
4. User IDs corretti? Verifica `participantIds`

### Problema: Connessione che si chiude
**Cause comuni**:
- Timeout proxy/CDN (aggiungi heartbeat)
- Errori di autenticazione
- Client cleanup troppo aggressivo

## 📊 Monitoraggio

### Endpoint di diagnostica (solo dev)
```typescript
// GET /api/sse/diagnostics
{
  totalClients: 6,
  clientsByUser: {
    "user123": 3,
    "user456": 3
  },
  clientsByTenant: {
    "tenant1": 6
  }
}
```

### Metriche importanti
- Numero client connessi per utente
- Latenza eventi (timestamp invio vs ricezione)
- Frequenza reconnect
- Eventi persi/non consegnati

## 🔮 Espansioni Future

1. **Persistenza Eventi**: Store eventi non consegnati per retry
2. **Acknowledgment**: Conferma ricezione eventi critici
3. **Filtering Server-Side**: Sottoscrizione a specifici tipi di eventi
4. **Compression**: Eventi compressi per payload grandi
5. **Clustering**: Supporto multi-server con Redis pub/sub

## 📝 Checklist Implementazione Nuove Feature

- [ ] Definire nuovo tipo evento in `sse-events.ts`
- [ ] Aggiungere metodo emit in `sse-service.ts`
- [ ] Implementare handler lato server
- [ ] Aggiungere sottoscrizione nel client hook
- [ ] Testare con più client simultanei
- [ ] Verificare cleanup e memory leaks
- [ ] Aggiungere logging e monitoring

## 🔗 File Correlati

- `/lib/sse/sse-manager.ts` - Gestione connessioni
- `/lib/sse/sse-service.ts` - Emissione eventi
- `/lib/sse/sse-events.ts` - Tipi eventi
- `/app/api/sse/route.ts` - Endpoint HTTP
- `/hooks/use-sse-improved.ts` - Client hook
- `/components/chat/chat-window.tsx` - Esempio uso in produzione