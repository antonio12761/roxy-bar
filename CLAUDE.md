# Bar Roxy Clean - Gestione Bar

## 🚀 AVVIO RAPIDO - LEGGERE SEMPRE
Per riprendere il lavoro da dove si era interrotto, consultare SEMPRE il file:
```
SESSION_STATUS.md
```
Questo file contiene lo stato dell'ultima sessione, lavori in corso e TODO.

## Panoramica Progetto
Sistema completo di gestione bar con funzionalità per camerieri, preparazione ordini, cassa e supervisore.

## Stack Tecnologico
- **Framework**: Next.js 15.4.5 con App Router
- **Database**: PostgreSQL con Prisma ORM 6.13.0
- **Autenticazione**: NextAuth.js con supporto multi-tenant
- **UI**: Tailwind CSS, shadcn/ui components
- **Real-time**: Server-Sent Events (SSE) per aggiornamenti in tempo reale
- **PWA**: next-pwa per supporto Progressive Web App

## 🔴 REGOLE DI SVILUPPO IMPORTANTI

### 1. Server Actions (SEMPRE!)
**UTILIZZARE SEMPRE SERVER ACTIONS** invece di API routes per:
- Fetch di dati dal database
- Operazioni di mutazione (create, update, delete)
- Qualsiasi interazione server-side

Le server actions sono definite in `lib/actions/` e devono:
- Usare la direttiva `'use server'` all'inizio del file
- Restituire oggetti serializzabili (no Date objects diretti, convertire in string)
- Gestire gli errori con try/catch e restituire `{ success: boolean, error?: string }`
- Essere importate direttamente nei componenti client

Esempio:
```typescript
// lib/actions/esempio.ts
'use server';

export async function getDataById(id: string) {
  try {
    const data = await prisma.table.findUnique({ where: { id } });
    return { success: true, data };
  } catch (error) {
    return { success: false, error: 'Errore nel recupero dati' };
  }
}

## Struttura Progetto
```
bar-roxy-clean/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   ├── cameriere/         # Interfaccia cameriere
│   ├── prepara/           # Interfaccia preparazione
│   ├── cassa/             # Interfaccia cassa
│   └── supervisore/       # Interfaccia supervisore
├── components/            # React components
├── lib/                   # Utility e logiche condivise
│   ├── actions/          # Server actions
│   ├── sse/              # Sistema SSE
│   └── db.ts             # Configurazione Prisma
├── prisma/               # Schema e migrazioni database
└── public/               # Asset statici
```

## Funzionalità Principali

### Sistema Ordini
- Creazione e gestione ordini per tavoli
- Stati ordine: ORDINATO, IN_PREPARAZIONE, PRONTO, RITIRATO, PAGATO, ANNULLATO
- Gestione prodotti esauriti con ordini ORDINATO_ESAURITO
- Sistema di merge ordini per stesso tavolo
- Richieste di annullamento con approvazione

### Sistema SSE (Server-Sent Events)
- Eventi real-time per aggiornamenti ordini
- Eventi per prodotti esauriti e notifiche
- Gestione code eventi per tenant
- Supporto multi-tenant con isolamento dati

### Gestione Prodotti Esauriti
- Notifiche immediate quando un prodotto diventa non disponibile
- Creazione automatica ordini ORDINATO_ESAURITO
- Sistema di claim per gestione ordini esauriti
- Possibilità di modificare o annullare ordini esauriti

### Ruoli Utente
- **CAMERIERE**: Gestione tavoli e ordini
- **PREPARA**: Preparazione ordini in cucina/bar
- **CASSA**: Gestione pagamenti
- **SUPERVISORE**: Controllo completo sistema

## Comandi Utili

### Development
```bash
cd bar-roxy-clean
npm run dev          # Avvia server development
npm run build        # Build di produzione
npm run lint         # Linting codice
```

### Database
```bash
npx prisma generate  # Genera client Prisma
npx prisma migrate dev # Esegui migrazioni
npx prisma studio    # GUI database
```

### Testing
```bash
# Rileva errori TypeScript
node scripts/top/detect-all-typescript-errors.js

# Analizza errori TypeScript
node scripts/top/analyze-typescript-errors.js
```

## Configurazione Ambiente

### File .env richiesti
- `.env` - Configurazione base
- `.env.local` - Override locali
- `.env.production` - Configurazione produzione

### Variabili principali
```env
DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000
```

## Note Importanti

### Multi-tenancy
Il sistema supporta multi-tenant ma attualmente il modello Ordinazione non ha un campo tenantId diretto. Il tenant viene gestito attraverso le relazioni con User.

### TypeScript
Il progetto usa TypeScript strict mode. Tutti gli errori di tipo devono essere risolti prima del build.

### SSE Events
Gli eventi SSE sono tipizzati in `lib/sse/sse-events.ts`. Quando si aggiungono nuovi eventi, devono essere aggiunti alla SSEEventMap.

### PWA
L'applicazione è configurata come PWA con service worker per funzionamento offline e installabilità.

## Problemi Comuni e Soluzioni

### Errore "tenantId not in OrdinazioneWhereInput"
Il modello Ordinazione non ha un campo tenantId. Usare le relazioni attraverso User per filtrare per tenant.

### Eventi SSE non definiti
Aggiungere nuovi eventi alla SSEEventMap in `lib/sse/sse-events.ts` prima di utilizzarli.

### Build fallisce per errori TypeScript
Eseguire gli script di rilevamento errori per identificare e correggere tutti gli errori di tipo.

## Ultima Modifica
- Aggiunto evento 'queue:check' alla SSEEventMap
- Aggiunto evento 'order:esaurito:alert' alla SSEEventMap  
- Corretto controllo orderId undefined in getOutOfStockOrderDetails
- Rimosso filtro tenantId da test-esaurito route

## TODO
- [ ] Migrare configurazione Prisma da package.json a prisma.config.ts
- [ ] Rimuovere lockfile duplicati
- [ ] Aggiungere campo tenantId diretto al modello Ordinazione

## 📋 STATO SESSIONE
Il file `SESSION_STATUS.md` viene aggiornato alla fine di ogni sessione di lavoro e contiene:
- Lavori completati nell'ultima sessione
- Modifiche non ancora committate
- Problemi noti e loro stato
- TODO list organizzata per priorità
- Comandi utili per verifiche rapide
- Note importanti da ricordare

**IMPORTANTE**: Controllare SEMPRE `SESSION_STATUS.md` all'inizio di ogni sessione per continuare il lavoro in modo efficiente.