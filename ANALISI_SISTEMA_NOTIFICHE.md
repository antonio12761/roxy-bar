# Analisi Completa Sistema Notifiche e SSE - Bar Roxy

## Executive Summary

Il sistema attuale presenta diverse criticità che compromettono l'affidabilità delle notifiche:
- **Mancanza di persistenza delle notifiche**
- **Assenza di gestione offline robusta**
- **Problemi di sicurezza nell'isolamento multi-tenant**
- **Rate limiting insufficiente**
- **Mancanza di crittografia dei dati sensibili**

## 1. PROBLEMI CRITICI IDENTIFICATI

### 1.1 Persistenza Notifiche
**🔴 CRITICO: Nessuna persistenza su database**
- Le notifiche vengono gestite solo in memoria (Map in SSE Manager)
- Se il server crasha o riavvia, tutte le notifiche in coda vengono perse
- Nessun meccanismo di recovery dopo errori di sistema

### 1.2 Gestione Offline/Online
**🟡 MEDIO: Gestione offline limitata**
- Il sistema usa solo memoria locale (localStorage) per notifiche
- Limite di 5-10MB per localStorage, insufficiente per applicazioni intensive
- Nessun fallback a IndexedDB per maggiore capacità
- La sincronizzazione offline dipende da localStorage che può essere cancellato

### 1.3 Sicurezza Multi-Tenant
**🔴 CRITICO: Isolamento tenant insufficiente**
```typescript
// In sse-service.ts linea 116-126
if (options.broadcast) {
  const clients = sseManager.getConnectedClients();
  for (const client of clients) {
    // PROBLEMA: Il filtro tenant viene dopo il broadcast
    if (options.tenantId && client.tenantId !== options.tenantId) {
      continue;
    }
```
- Il broadcast può esporre dati a tenant errati se non configurato correttamente
- Mancanza di validazione del tenantId in alcuni endpoint

### 1.4 Rate Limiting
**🟡 MEDIO: Rate limiting non persistente**
```typescript
// In app/api/sse/route.ts linea 9
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
```
- Rate limiting solo in memoria, resettato ad ogni riavvio
- Facilmente aggirabile con riconnessioni multiple
- Nessun rate limiting per tenant (solo per utente)

### 1.5 Sicurezza Dati
**🔴 CRITICO: Dati sensibili non crittografati**
- Token JWT nel localStorage (può essere letto da XSS)
- Nessuna crittografia per dati sensibili in localStorage
- ID generati con Math.random() non sicuri:
```typescript
// Multipli file
id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
```

### 1.6 Memory Leaks
**🟡 MEDIO: Potenziali memory leak**
- Event listeners non sempre rimossi correttamente
- Maps che crescono senza limiti (rateLimitStore, eventQueue)
- Heartbeat intervals multipli possono accumularsi

## 2. VULNERABILITÀ DI SICUREZZA

### 2.1 Session Hijacking
- Token in localStorage vulnerabile a XSS
- Nessun refresh token mechanism
- Session cookie senza flag SameSite strict

### 2.2 Data Exposure
- Console.log con dati sensibili in produzione
- Stack trace esposti agli utenti
- Nessuna sanitizzazione input in notifiche

### 2.3 DoS Vulnerabilities
- Nessun limite globale connessioni SSE
- Queue illimitate possono causare OOM
- Heartbeat ogni 2 secondi può sovraccaricare il server

## 3. PROBLEMI DI AFFIDABILITÀ

### 3.1 Perdita Eventi
- Eventi persi durante reconnection window
- Nessun sequence number per rilevare gap
- Queue processing non garantisce ordine

### 3.2 Duplicazione Eventi
- Possibile duplicazione durante retry
- Nessun idempotency key
- Multiple subscription dello stesso evento

### 3.3 Sincronizzazione
- Race condition tra localStorage e SSE
- Nessun conflict resolution
- Stati inconsistenti tra client

## 4. SOLUZIONI PROPOSTE

### 4.1 Sistema di Persistenza Notifiche
```typescript
// Nuovo modello Prisma
model Notification {
  id            String   @id @default(cuid())
  tenantId      String
  userId        String?
  type          String
  priority      String
  title         String
  message       String
  data          Json?
  status        String   @default("pending") // pending, delivered, acknowledged, failed
  deliveredAt   DateTime?
  acknowledgedAt DateTime?
  expiresAt     DateTime
  retryCount    Int      @default(0)
  createdAt     DateTime @default(now())
  
  @@index([tenantId, status, createdAt])
  @@index([userId, status])
  @@index([expiresAt])
}

model NotificationDelivery {
  id             String   @id @default(cuid())
  notificationId String
  clientId       String
  deliveredAt    DateTime @default(now())
  acknowledgedAt DateTime?
  
  notification   Notification @relation(fields: [notificationId], references: [id])
  
  @@unique([notificationId, clientId])
}
```

### 4.2 Gestione Offline Robusta
```typescript
// Utilizzare IndexedDB per storage offline
class OfflineNotificationStore {
  private db: IDBDatabase;
  
  async init() {
    const request = indexedDB.open('notifications', 1);
    // Setup IndexedDB con indici appropriati
  }
  
  async addNotification(notification: Notification) {
    // Store in IndexedDB con TTL
  }
  
  async getUndelivered(): Promise<Notification[]> {
    // Recupera notifiche non consegnate
  }
  
  async markDelivered(id: string) {
    // Marca come consegnata
  }
}
```

### 4.3 Sicurezza Multi-Tenant Migliorata
```typescript
// Validazione rigorosa tenant
class SecureSSEService {
  emit(event: SSEEvent, options: EmitOptions) {
    // Validazione tenant PRIMA di qualsiasi operazione
    if (!this.validateTenant(options.tenantId)) {
      throw new SecurityError('Invalid tenant');
    }
    
    // Isolare completamente per tenant
    const tenantClients = this.getClientsByTenant(options.tenantId);
    
    // Nessun broadcast globale senza tenant
    if (options.broadcast && !options.tenantId) {
      throw new SecurityError('Broadcast requires tenantId');
    }
  }
}
```

### 4.4 Rate Limiting Persistente
```typescript
// Utilizzare Redis per rate limiting
import Redis from 'ioredis';

class PersistentRateLimiter {
  private redis: Redis;
  
  async checkLimit(key: string, limit: number, window: number): Promise<boolean> {
    const current = await this.redis.incr(key);
    
    if (current === 1) {
      await this.redis.expire(key, window);
    }
    
    return current <= limit;
  }
}
```

### 4.5 Crittografia e Sicurezza
```typescript
// Utilizzare crypto sicuro
import { randomBytes } from 'crypto';

function generateSecureId(): string {
  return randomBytes(16).toString('hex');
}

// Crittografia localStorage
class SecureStorage {
  private key: CryptoKey;
  
  async encrypt(data: any): Promise<string> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      this.key,
      new TextEncoder().encode(JSON.stringify(data))
    );
    return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
  }
  
  async decrypt(encrypted: string): Promise<any> {
    // Decrypt logic
  }
}
```

### 4.6 Sistema di Acknowledgment Affidabile
```typescript
interface ReliableNotification {
  id: string;
  sequenceNumber: number;
  requiresAck: boolean;
  maxRetries: number;
  retryDelay: number;
  timeout: number;
}

class ReliableSSEService {
  private pendingAcks = new Map<string, {
    notification: ReliableNotification,
    timer: NodeJS.Timeout,
    retries: number
  }>();
  
  async sendWithAck(notification: ReliableNotification) {
    // Invia con retry automatico
    this.pendingAcks.set(notification.id, {
      notification,
      retries: 0,
      timer: setTimeout(() => this.retry(notification.id), notification.timeout)
    });
  }
  
  private async retry(id: string) {
    const pending = this.pendingAcks.get(id);
    if (!pending) return;
    
    if (pending.retries < pending.notification.maxRetries) {
      pending.retries++;
      // Reinvia con exponential backoff
      const delay = pending.notification.retryDelay * Math.pow(2, pending.retries);
      pending.timer = setTimeout(() => this.retry(id), delay);
      
      // Reinvia notifica
      await this.send(pending.notification);
    } else {
      // Salva come fallita nel database
      await this.markAsFailed(pending.notification);
      this.pendingAcks.delete(id);
    }
  }
}
```

## 5. IMPLEMENTAZIONE PRIORITARIA

### Fase 1 (Immediata - 1 settimana)
1. **Persistenza notifiche su database**
2. **Fix isolamento multi-tenant**
3. **Sostituire Math.random() con crypto sicuro**

### Fase 2 (Urgente - 2 settimane)
1. **Implementare IndexedDB per offline**
2. **Rate limiting con Redis**
3. **Sistema acknowledgment affidabile**

### Fase 3 (Importante - 1 mese)
1. **Crittografia dati sensibili**
2. **Monitoring e alerting**
3. **Test di carico e stress test**

## 6. METRICHE DI SUCCESSO

- **Delivery Rate**: >99.9% notifiche consegnate
- **Latenza**: <100ms per notifica P95
- **Offline Recovery**: 100% notifiche recuperate dopo reconnection
- **Security**: 0 data leak tra tenant
- **Reliability**: 0 notifiche perse in 30 giorni

## 7. STIMA RISORSE

- **Sviluppo**: 2-3 sviluppatori per 1 mese
- **Infrastruttura**: Redis cluster, storage aggiuntivo DB
- **Testing**: Suite completa test automatizzati
- **Monitoring**: Grafana/Prometheus setup

## CONCLUSIONE

Il sistema attuale necessita interventi urgenti per garantire affidabilità e sicurezza. Le soluzioni proposte risolvono i problemi critici mantenendo retrocompatibilità dove possibile. L'implementazione dovrebbe seguire l'ordine di priorità indicato per minimizzare rischi immediati.