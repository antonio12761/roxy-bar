# Siplit - Sintesi del Progetto

## Panoramica Generale

Siplit è un sistema di gestione completo per bar e ristoranti, sviluppato con tecnologie moderne per gestire ordinazioni, pagamenti, preparazione ordini e supervisione delle attività.

## Stack Tecnologico

### Frontend
- **Framework**: Next.js 15.4.2 con App Router
- **UI Library**: React 19.1.0
- **Styling**: Tailwind CSS 3.4.17
- **UI Components**: Radix UI, Lucide React per icone
- **Form Management**: React Hook Form con Zod per validazione

### Backend
- **Runtime**: Node.js con TypeScript
- **Database**: PostgreSQL con Prisma ORM 6.1.0
- **Autenticazione**: JWT personalizzato con bcryptjs
- **Real-time**: Server-Sent Events (SSE) per aggiornamenti in tempo reale

### DevOps
- **Package Manager**: npm
- **Linting**: ESLint con configurazione Next.js
- **Build Tool**: SWC (configurato in Next.js)

## Architettura del Progetto

### Struttura delle Cartelle Principali

```
bar-roxy-clean/
├── app/                    # App Router di Next.js
│   ├── api/               # API Routes
│   ├── cameriere/         # Modulo camerieri
│   ├── cassa/             # Modulo cassa
│   ├── dashboard/         # Dashboard amministrativa
│   ├── gestione-ordini/   # Gestione ordini
│   ├── prepara/           # Modulo preparazione
│   └── supervisore/       # Modulo supervisione
├── lib/                   # Logica business e utility
│   ├── actions/          # Server Actions
│   ├── auth.ts           # Sistema di autenticazione
│   ├── cache/            # Sistema di caching
│   └── sse/              # Server-Sent Events
├── hooks/                # React hooks personalizzati
├── components/           # Componenti riutilizzabili
├── prisma/              # Schema database e migrazioni
└── scripts/             # Script di utility

```

## Moduli Principali

### 1. Modulo Cameriere (`/app/cameriere`)
- **Nuova Ordinazione**: Creazione ordini per tavoli
- **Conti Clienti**: Gestione conti clienti
- **Ordini in Corso**: Visualizzazione ordini attivi
- **Conti Scalari**: Gestione pagamenti rateizzati
- **Cronologia**: Storico ordini e transazioni

### 2. Modulo Prepara (`/app/prepara`)
- Visualizzazione ordini da preparare
- Sistema di notifiche real-time via SSE
- Gestione stati di preparazione
- Integrazione con SSEProvider per aggiornamenti live

### 3. Modulo Cassa (`/app/cassa`)
- Gestione pagamenti (POS, contanti, misto)
- Storico pagamenti
- Richieste di scontrino
- Integrazione con sistema notifiche

### 4. Modulo Supervisore (`/app/supervisore`)
- Panoramica completa delle attività
- Gestione utenti e permessi
- Sincronizzazione ordini
- Monitoraggio real-time

### 5. Dashboard Amministrativa (`/app/dashboard`)
- Gestione categorie e prodotti
- Menu builder
- Statistiche vendite
- Gestione inventario

## Sistema di Autenticazione

### Implementazione (`/lib/auth.ts`)
- Autenticazione basata su password (senza username)
- Token JWT con durata configurabile (7 giorni prod, 30 giorni dev)
- Cookie HTTP-only per sicurezza
- Sistema di ruoli gerarchico

### Ruoli Disponibili
```typescript
type Role = 
  | "ADMIN"        // Accesso completo
  | "MANAGER"      // Gestione operativa
  | "SUPERVISORE"  // Supervisione attività
  | "CAMERIERE"    // Gestione ordini
  | "PREPARA"      // Preparazione ordini
  | "BANCO"        // Servizio banco
  | "CUCINA"       // Preparazione cucina
  | "CASSA"        // Gestione pagamenti
```

### Middleware di Protezione (`/middleware.ts`)
- Controllo automatico sessione su route protette
- Redirect a login per utenti non autenticati
- Verifica permessi basata su ruoli
- Cookie name configurabile via environment

## Database Schema (Prisma)

### Entità Principali

#### User
- Sistema utenti con ruoli e permessi
- Tracking ultimo accesso
- Supporto blocco/sblocco utenti

#### Ordinazione
- Gestione ordini con stati (ORDINATO, IN_PREPARAZIONE, PRONTO, CONSEGNATO, RICHIESTA_CONTO, PAGATO, ANNULLATO)
- Supporto tavoli e bancone
- Relazioni con righe ordine e pagamenti
- Supporto pagamenti parziali

#### Prodotto
- Catalogo prodotti con categorie
- Prezzi, disponibilità, destinazioni
- Supporto per allergeni e info nutrizionali

#### Tavolo
- Gestione tavoli con stati
- Supporto unione tavoli
- Zone e capacità

#### Pagamento
- Multi-modalità (POS, contanti, misto)
- Tracking operatore
- Supporto pagamenti parziali

### Funzionalità Avanzate

#### Conti Scalari
- Gestione conti aperti per clienti/tavoli
- Movimenti tracciati (ordini e pagamenti)
- Saldi in tempo reale

#### Contributi Cliente
- Sistema per ordini/pagamenti per terzi
- Tracking beneficiari
- Integrazione con pagamenti

### Stati delle Ordinazioni

Il sistema gestisce il ciclo di vita completo degli ordini attraverso i seguenti stati:

1. **ORDINATO**: Ordine appena creato dal cameriere
2. **IN_PREPARAZIONE**: Almeno un prodotto è in lavorazione
3. **PRONTO**: Tutti i prodotti sono pronti per essere consegnati
4. **CONSEGNATO**: Ordine consegnato al cliente
5. **RICHIESTA_CONTO**: Cliente ha richiesto il conto
6. **PAGATO**: Ordine pagato e chiuso
7. **ANNULLATO**: Ordine annullato (possibile solo da stato ORDINATO)

## Sistema Real-Time (SSE)

### Architettura SSE
- **Endpoint**: `/api/sse`
- **Provider**: SSEProvider con context React
- **Hook personalizzato**: `useStationSSE`

### Caratteristiche
- Connessione persistente per aggiornamenti live
- Filtraggio eventi per stazione/ruolo
- Sistema di heartbeat per monitoraggio connessione
- Reconnect automatico con backoff esponenziale
- Cache locale per ottimizzazione

### Eventi Supportati
```typescript
type SSEEventName = 
  | 'order:new'      // Nuovo ordine
  | 'order:update'   // Aggiornamento ordine
  | 'order:ready'    // Ordine pronto
  | 'notification:new' // Nuova notifica
  | 'user:presence'  // Presenza utente
  | 'heartbeat'      // Controllo connessione
```

## Server Actions (`/lib/actions`)

### Categorie Principali

#### Autenticazione (`auth.ts`)
- Login con password
- Logout con cleanup sessione
- Gestione token JWT

#### Ordinazioni (`ordinazioni.ts`)
- Creazione ordini atomici
- Aggiornamento stati
- Notifiche automatiche
- Cache invalidation

#### Cassa (`cassa.ts`)
- Processamento pagamenti
- Gestione scontrini
- Storico transazioni

#### Supervisore (`supervisore.ts`)
- Gestione utenti
- Monitoraggio sistema
- Report attività

## Sistema di Caching

### Station Cache (`/lib/cache/station-cache.ts`)
- Cache per stazione di lavoro
- TTL configurabile
- Versioning per consistenza
- Cleanup automatico

### Orders Cache
- Cache centralizzata ordini
- Invalidazione selettiva
- Sincronizzazione con database

## Hook Personalizzati

### useStationSSE
- Gestione connessione SSE per stazione
- Monitoraggio qualità connessione
- Queue eventi
- Optimistic updates

### useAuthToken
- Gestione token autenticazione
- Refresh automatico
- Error handling

## Configurazione

### Environment Variables
```env
DATABASE_URL          # PostgreSQL connection string
JWT_SECRET           # Secret per token JWT (min 32 char)
SESSION_COOKIE_NAME  # Nome cookie sessione
SESSION_MAX_AGE      # Durata sessione in secondi
NODE_ENV            # development/production
```

### Next.js Config
- React Strict Mode abilitato
- SWC Minification attiva
- TypeScript strict mode

## Script Disponibili

```json
"dev": "next dev"              # Development server
"build": "next build"          # Production build  
"start": "next start"          # Production server
"db:generate": "prisma generate" # Genera client Prisma
"db:push": "prisma db push"    # Sync schema con DB
"db:studio": "prisma studio"   # GUI database
"seed:users": "node scripts/seed-users.ts" # Popola utenti
```

## Sicurezza

### Misure Implementate
- Password hash con bcryptjs (12 rounds)
- Token JWT con expiration
- HTTP-only cookies
- CSRF protection via SameSite
- Input validation con Zod
- SQL injection prevention via Prisma

### Best Practices
- Server Actions per operazioni sensibili
- Middleware per route protection
- Role-based access control
- Session cleanup su logout

## Performance

### Ottimizzazioni
- SSE per real-time invece di WebSocket
- Caching multi-livello
- Database indexing strategico
- Lazy loading componenti
- Optimistic UI updates

### Monitoring
- Connection health tracking
- Latency measurements
- Error boundaries
- Reconnection strategies

## Deployment

### Requisiti
- Node.js 18+
- PostgreSQL 13+
- 512MB RAM minimo
- HTTPS per produzione

### Build Process
1. `npm install` - Installa dipendenze
2. `npm run db:push` - Setup database
3. `npm run build` - Build produzione
4. `npm start` - Avvia server

## Manutenzione

### Database
- Backup regolari PostgreSQL
- Prisma migrations per schema changes
- Indexing monitoring

### Logs
- Server-side logging per errori
- Client-side error boundaries
- SSE connection monitoring

### Updates
- Dependency updates mensili
- Security patches immediate
- Feature updates pianificati