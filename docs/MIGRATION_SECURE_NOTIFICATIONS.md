# Guida Migrazione Sistema Notifiche Sicuro

## Panoramica
Il nuovo sistema di notifiche risolve tutti i problemi critici identificati nell'analisi, fornendo:
- ✅ Persistenza su database
- ✅ Storage offline con IndexedDB
- ✅ Isolamento multi-tenant sicuro
- ✅ Rate limiting persistente
- ✅ ID crittograficamente sicuri
- ✅ Sistema acknowledgment affidabile
- ✅ Crittografia dati sensibili
- ✅ Recovery automatico dopo crash
- ✅ Monitoring e metriche complete

## 1. Migrazione Database

### Eseguire la migrazione
```bash
# Genera il client Prisma con i nuovi modelli
npx prisma generate

# Applica la migrazione al database
npx prisma migrate deploy
```

### Nuove tabelle create:
- `Notification` - Persistenza notifiche
- `NotificationDelivery` - Tracciamento consegne
- `RateLimit` - Rate limiting persistente
- `SSEConnection` - Tracking connessioni SSE

## 2. Variabili d'Ambiente

Aggiungi al file `.env`:
```env
# Encryption key per dati sensibili (32+ caratteri)
ENCRYPTION_KEY=your-secure-encryption-key-min-32-chars
ENCRYPTION_SALT=your-encryption-salt

# Optional: Disabilita log SSE in produzione
DISABLE_SSE_LOGS=true
```

## 3. Migrazione Codice

### Da: Vecchio sistema notifiche
```typescript
import { broadcast, notifyNewOrder } from '@/lib/notifications';

// Vecchio modo - NON SICURO
broadcast({
  type: 'new_order',
  message: 'Nuovo ordine',
  data: { orderId: '123' }
});
```

### A: Nuovo sistema sicuro
```typescript
import { sendSecureNotification } from '@/lib/sse/secure-notification-service';

// Nuovo modo - SICURO con tenant isolation
await sendSecureNotification(
  {
    type: 'new_order',
    title: 'Nuovo Ordine',
    message: 'Nuovo ordine ricevuto',
    data: { orderId: '123' }
  },
  {
    tenantId: user.tenantId, // OBBLIGATORIO
    targetRoles: ['PREPARA', 'CUCINA'],
    priority: NotificationPriority.HIGH,
    requiresAck: true,
    ttl: 3600000 // 1 ora
  }
);
```

### Client-side: Da useEnhancedSSE a useSecureSSE
```typescript
// Prima
import { useEnhancedSSE } from '@/hooks/useEnhancedSSE';

const { notifications } = useEnhancedSSE({
  clientId: 'client123',
  onNotification: (n) => console.log(n)
});

// Dopo
import { useSecureSSE } from '@/hooks/useSecureSSE';

const { isConnected, offlineQueueSize } = useSecureSSE({
  onNotification: (n) => console.log(n),
  enableOfflineQueue: true,
  enableEncryption: true,
  autoAcknowledge: true
});
```

## 4. Funzionalità Nuove

### Rate Limiting Persistente
```typescript
import { rateLimiter } from '@/lib/security/rate-limiter';

// Middleware per API routes
export async function middleware(req: NextRequest) {
  const limit = await rateLimiter.checkCombinedLimits(
    userId,
    tenantId,
    'api'
  );
  
  if (!limit.allowed) {
    return new Response('Too Many Requests', {
      status: 429,
      headers: {
        'Retry-After': Math.ceil(limit.retryAfter / 1000).toString()
      }
    });
  }
}
```

### ID Sicuri
```typescript
// Prima - INSICURO
const id = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Dopo - SICURO
import { generateSecureId, orderId, notificationId } from '@/lib/utils/secure-id';

const id = generateSecureId(); // ID crittograficamente sicuro
const orderIdValue = orderId(); // ord_xxxxxxxxxxxx
const notifId = notificationId(); // notif_xxxxxxxxxxxx
```

### Storage Offline con IndexedDB
```typescript
import { getIndexedDBStore } from '@/lib/offline/indexed-db-store';

const store = getIndexedDBStore();

// Salva notifica offline
await store.addNotification(notification);

// Recupera notifiche non consegnate
const pending = await store.getUndeliveredNotifications(userId, tenantId);

// Pulisci notifiche scadute
const cleared = await store.clearExpired();
```

### Crittografia Dati Sensibili
```typescript
import { encryptionService, BrowserEncryption } from '@/lib/security/encryption';

// Server-side
await encryptionService.initialize();
const encrypted = await encryptionService.encrypt(sensitiveData);
const decrypted = await encryptionService.decrypt(encrypted);

// Client-side
const browserEncryption = new BrowserEncryption();
await browserEncryption.initialize('password');
const encrypted = await browserEncryption.encrypt(data);
```

### Recovery Dopo Crash
Il sistema recupera automaticamente le notifiche dopo un crash del server:
```typescript
// Avvio automatico al boot del server
crashRecovery.performStartupRecovery();

// Recovery manuale per un utente
await crashRecovery.recoverUserNotifications(userId, tenantId, clientId);
```

## 5. Monitoring e Metriche

### Endpoint Metriche
```bash
# JSON format
GET /api/metrics
Authorization: Bearer <admin-token>

# Prometheus format
GET /api/metrics?format=prometheus
Authorization: Bearer <admin-token>
```

### Dashboard Metriche
```typescript
import { getSystemHealth, getNotificationStats } from '@/lib/monitoring/notification-metrics';

const health = await getSystemHealth();
console.log('System status:', health.status); // 'healthy' | 'degraded' | 'critical'

const stats = await getNotificationStats();
console.log('Delivery rate:', stats.deliveryRate);
```

## 6. Testing

### Test Rate Limiting
```typescript
// Test rate limit
for (let i = 0; i < 150; i++) {
  const response = await fetch('/api/sse');
  if (response.status === 429) {
    console.log('Rate limit hit at request', i);
    break;
  }
}
```

### Test Recovery
```typescript
// Simula crash e recovery
await crashRecovery.performStartupRecovery();
const stats = crashRecovery.getStatus();
console.log('Recovery stats:', stats);
```

### Test Acknowledgments
```typescript
// Invia notifica con acknowledgment richiesto
const notifId = await sendSecureNotification(
  { /* notification data */ },
  { requiresAck: true, maxRetries: 3 }
);

// Client acknowledges
await fetch('/api/notifications/acknowledge', {
  method: 'POST',
  body: JSON.stringify({
    notificationId: notifId,
    clientId: 'client123',
    status: 'received'
  })
});
```

## 7. Troubleshooting

### Problema: Notifiche non arrivano
1. Verifica tenant isolation: `tenantId` è obbligatorio
2. Controlla rate limits: `/api/metrics`
3. Verifica connessioni SSE: `sseManager.getConnectedClients()`

### Problema: Memory leak
1. Controlla pending acknowledgments: `reliableDelivery.getStats()`
2. Pulisci notifiche scadute: `secureNotificationService.cleanupExpired()`
3. Verifica metriche memoria: `/api/metrics`

### Problema: Notifiche duplicate
1. Verifica sequence numbers
2. Controlla correlation IDs
3. Usa deduplicazione client-side con `processedNotificationsRef`

## 8. Best Practices

### Sempre specificare tenantId
```typescript
// ❌ MAI fare questo
await sendNotification(data, { broadcast: true });

// ✅ SEMPRE specificare tenant
await sendSecureNotification(data, { 
  tenantId: user.tenantId,
  broadcast: true 
});
```

### Usa priorità appropriate
- `LOW`: Notifiche informative
- `NORMAL`: Operazioni standard
- `HIGH`: Azioni importanti (ordini pronti)
- `URGENT`: Emergenze (sistema down)

### Implementa retry logic
```typescript
const notifId = await sendSecureNotification(data, {
  maxRetries: 3,
  retryDelay: 1000, // Exponential backoff
  ttl: 3600000 // Scade dopo 1 ora
});
```

### Monitor regolarmente
- Controlla delivery rate: target >99.9%
- Monitora latenza: target <100ms P95
- Verifica rate limit violations
- Controlla memory usage

## 9. Rollback (se necessario)

Per tornare al vecchio sistema:
1. Commenta imports nuovi servizi in `/app/api/sse/route.ts`
2. Ripristina vecchio `lib/notifications.ts`
3. NON rimuovere le tabelle del database (mantieni i dati)

## 10. Supporto

Per problemi o domande:
- Controlla logs: `pm2 logs` o `docker logs`
- Verifica metriche: `/api/metrics`
- Consulta health check: `/api/health`
- Apri issue su GitHub con tag `notifications`