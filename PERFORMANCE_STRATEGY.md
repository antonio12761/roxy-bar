# 🚀 Bar Roxy - Strategia di Performance e Notifiche Real-Time

## 📋 Panoramica

Questo documento definisce la strategia di ottimizzazione per il sistema di notifiche e aggiornamenti real-time di Bar Roxy. L'obiettivo è ridurre drasticamente il carico di rete, migliorare la reattività dell'interfaccia e garantire scalabilità.

## 🎯 Principi Fondamentali

### 1. **Filtri Server-Side Intelligenti**
- Ogni postazione riceve SOLO eventi pertinenti
- Filtri basati su ruolo, destinazione e contesto
- Prioritizzazione dinamica degli eventi

### 2. **Cache Station-Specific**
- Cache dedicata per ogni tipo di postazione
- TTL ottimizzato per caso d'uso
- Sincronizzazione incrementale

### 3. **Aggiornamenti Ottimistici**
- UI reattiva con update immediati
- Rollback automatico in caso di errore
- Queue di retry intelligente

### 4. **Server Actions First**
- Tutte le operazioni CRUD via Server Actions
- API solo per streaming (SSE/WebSocket)
- Type safety end-to-end

## 🏗️ Architettura

### Stati Ordinazione
```
ORDINAZIONE: APERTA → INVIATA → IN_PREPARAZIONE → PRONTA → CONSEGNATA → PAGATA
RIGA:        INSERITO → IN_LAVORAZIONE → PRONTO → CONSEGNATO
```

### Flusso Eventi per Postazione

#### 🍽️ PREPARA/CUCINA
```typescript
Eventi Ricevuti:
- order:new (solo items BAR/CUCINA)
- order:item:update (solo propria destinazione)
- order:cancelled (se contiene propri items)

Cache Keys:
- orders:active:bar
- orders:queue:bar
- items:in-progress
```

#### 👨‍💼 CAMERIERE
```typescript
Eventi Ricevuti:
- order:ready (propri tavoli)
- order:delivered
- notification:new

Cache Keys:
- orders:my-tables
- orders:ready
- notifications:unread
```

#### 💰 CASSA
```typescript
Eventi Ricevuti:
- order:delivered
- order:paid
- payment:request

Cache Keys:
- orders:payable
- payments:today
- receipts:pending
```

#### 📊 SUPERVISORE
```typescript
Eventi Ricevuti:
- Tutti gli eventi (con priorità)
- station:status
- system:metrics

Cache Keys:
- stats:realtime
- orders:all
- activities:log
```

## 📁 Struttura File

```
/lib/
├── sse/
│   ├── station-filters.ts    # Filtri per postazione
│   ├── sse-service.ts        # Service SSE ottimizzato
│   └── sse-events.ts         # Definizioni eventi
├── cache/
│   ├── station-cache.ts      # Cache per postazione
│   └── orders-cache.ts       # Cache ordini condivisa
└── services/
    └── orders-sync-service.ts # Sincronizzazione ordini

/hooks/
├── useStationSSE.ts          # Hook ottimizzato postazioni
└── useOrdersData.ts          # Hook dati ordini cached

/components/
└── optimized/
    ├── OptimizedOrderCard.tsx
    └── OptimizedOrderList.tsx
```

## 🔧 Implementazione

### Hook Utilizzo Base
```typescript
// In un componente postazione
const { 
  connectionHealth, 
  eventQueue,
  getCachedData,
  applyOptimisticUpdate 
} = useStationSSE({
  stationType: StationType.PREPARA,
  userId: currentUser.id,
  enableCache: true,
  enableOptimisticUpdates: true
});

// Gestione eventi
useEffect(() => {
  eventQueue.forEach(({ event, data }) => {
    switch (event) {
      case 'order:new':
        handleNewOrder(data);
        break;
      case 'order:ready':
        handleOrderReady(data);
        break;
    }
  });
}, [eventQueue]);
```

### Server Action con Cache
```typescript
export async function updateOrderStatus(orderId: string, status: string) {
  // 1. Validazione e autorizzazione
  const user = await getCurrentUser();
  if (!user) throw new Error("Non autorizzato");
  
  // 2. Update database
  const result = await prisma.ordinazione.update({
    where: { id: orderId },
    data: { stato: status }
  });
  
  // 3. Invalida cache
  ordersSyncService.invalidateOrder(orderId);
  
  // 4. Emetti evento SSE filtrato
  sseService.emit('order:update', {
    orderId,
    status,
    // Station filter applicherà filtri automaticamente
  });
  
  return serializeDecimalData(result);
}
```

## 📊 Metriche di Performance

### Target Performance
- **Latenza Eventi**: < 100ms (95° percentile)
- **Cache Hit Rate**: > 80%
- **Re-render Ridotti**: -70%
- **Traffico Rete**: -60%

### Monitoraggio
```typescript
// Metriche automatiche in ConnectionStatusIndicator
<ConnectionStatusIndicator 
  connectionHealth={connectionHealth}
  showMetrics={true}
  alertThreshold={300} // ms
/>
```

## 🚦 Best Practices

### DO ✅
1. Usa sempre `useStationSSE` invece di `useEnhancedSSE`
2. Applica filtri server-side per tutti gli eventi
3. Implementa cache con TTL appropriato
4. Usa aggiornamenti ottimistici per azioni utente
5. Serializza sempre i Decimal con `serializeDecimalData`

### DON'T ❌
1. Non fare broadcasting di eventi a tutte le stazioni
2. Non caricare tutti gli ordini per poi filtrare
3. Non usare polling quando hai SSE attivo
4. Non dimenticare di invalidare la cache dopo update
5. Non creare API quando puoi usare Server Actions

## 🔄 Migrazione

### Fase 1: Filtri Server-Side
1. Implementare `station-filters.ts`
2. Integrare in `sse-service.ts`
3. Test con metriche before/after

### Fase 2: Cache Ottimizzata
1. Deploy `station-cache.ts`
2. Integrare in hooks esistenti
3. Monitorare hit rate

### Fase 3: Hook Migration
1. Sostituire `useEnhancedSSE` → `useStationSSE`
2. Una postazione alla volta
3. Validare performance

### Fase 4: Cleanup
1. Rimuovere codice legacy
2. Ottimizzare bundle size
3. Documentare metriche finali

## 📈 Risultati Attesi

### Performance
- **Prepara**: Da 100 → 20 eventi/min (-80%)
- **Cameriere**: Da 150 → 30 eventi/min (-80%)
- **Cassa**: Da 50 → 15 eventi/min (-70%)
- **Supervisore**: Da 200 → 100 eventi/min (-50%)

### User Experience
- Interfaccia più reattiva
- Meno lag negli aggiornamenti
- Riduzione battery drain su mobile
- Migliore gestione offline

## 🛠️ Troubleshooting

### Eventi Non Ricevuti
1. Verifica filtri in `station-filters.ts`
2. Controlla ruolo utente e permessi
3. Verifica connessione SSE in DevTools

### Cache Non Aggiornata
1. Verifica TTL configurato
2. Controlla invalidazione dopo update
3. Verifica version control in cache

### Performance Degradata
1. Monitora event queue size
2. Verifica memory leaks in cache
3. Controlla re-render con React DevTools

---

*Ultimo aggiornamento: ${new Date().toISOString()}*
*Versione: 1.0.0*