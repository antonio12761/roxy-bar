# 🍺 Git Manager Bar Roxy - Guida all'uso

## 📖 Panoramica

Il Git Manager Safe è uno strumento interattivo per gestire in sicurezza il repository del progetto Bar Roxy. È stato personalizzato specificamente per questo progetto Next.js + TypeScript + Prisma.

## 🚀 Come avviare

```bash
node git-manager-safe.js
```

## 🎯 Funzionalità principali

### 🔐 Autenticazione GitHub
- Configurazione automatica token GitHub
- Supporto SSH e Personal Access Token
- Salvataggio sicuro del token in `.env`

### 📝 Commit & Push
- Commit guidati con tipi convenzionali (feat, fix, docs, etc.)
- Selezione selettiva dei file da committare
- Push intelligente su branch esistenti o nuovi

### 🚀 Deploy su Main
- **Controlli pre-deploy automatici** con gli script TypeScript del progetto
- Backup automatico prima del deploy
- Tre modalità di deploy:
  - **Merge** (consigliato): mantiene la storia
  - **Fast-forward**: solo se possibile
  - **Reset** (pericoloso): sovrascrive completamente

### 🔍 Analisi TypeScript
- Usa gli script personalizzati del progetto:
  - `analyze-typescript-errors.js`
  - `detect-all-typescript-errors.js`
- Fix automatico con ESLint
- Fallback ai controlli standard se gli script non funzionano

### 🗃️ Gestione Database
- **Stato Database**: verifica schema, client, tabelle
- **Generate Prisma Client**: `npm run db:generate`
- **Push Schema**: `npm run db:push` con conferma
- **Prisma Studio**: avvio automatico del browser
- **Lista Tabelle**: visualizza struttura database
- **Backup Database**: copia sicura del file `.db`
- **Reset Database**: ricrea completamente (PERICOLOSO)

### 🌿 Gestione Branch
- Creazione branch con prefissi (feature/, hotfix/, backup/)
- Eliminazione sicura con doppia conferma
- Protezione automatica dei branch critici (main, master, production, staging)
- Merge con diverse strategie

### 💾 Backup Intelligente
- Backup rapidi con timestamp
- Backup con tag annotati
- Gestione backup esistenti
- Cleanup automatico dei backup vecchi

## 🛡️ Sicurezza

### Branch Protetti
I seguenti branch NON possono essere eliminati:
- `main`
- `master` 
- `develop`
- `production`
- `staging`

### File Protetti
I seguenti file/directory sono protetti dalla pulizia:
- `.git`
- `.env`, `.env.local`
- `node_modules`
- `.next`
- `prisma/dev.db`, `dev.db`
- `package-lock.json`, `pnpm-lock.yaml`

### Backup Automatici
Prima di qualsiasi operazione pericolosa viene creato automaticamente un backup, incluso:
- Branch deletion
- Database reset
- Deploy
- Merge operations

## 🎮 Controlli di Sicurezza

### Doppia Conferma
Le operazioni pericolose richiedono:
1. Prima conferma
2. Digitare una parola chiave specifica (es. "ELIMINA")

### Pre-deploy Checks
Prima di ogni deploy viene eseguito:
1. Analisi TypeScript con script personalizzati
2. Build test per verificare che compili
3. Visualizzazione degli errori trovati
4. Opzione per procedere comunque o annullare

## 🔧 Configurazione Progetto

Il manager riconosce automaticamente:
- **Next.js**: `next.config.ts`
- **Prisma**: `schema.prisma`
- **Package.json**: dipendenze e script
- **Database**: file SQLite

## 📊 Monitoring

Il manager mostra sempre:
- Branch corrente
- Numero di file modificati
- Stato autenticazione GitHub
- Configurazione del progetto
- Eventuali modifiche al database

## 🎯 Script NPM Utilizzati

- `npm run lint`: ESLint check/fix
- `npm run build`: Build del progetto
- `npm run db:generate`: Genera Prisma Client
- `npm run db:push`: Applica schema al database
- `npm run db:studio`: Apre Prisma Studio

## 💡 Suggerimenti d'uso

1. **Sempre** fare il backup prima di operazioni rischiose
2. **Controllare** gli errori TypeScript prima del deploy
3. **Testare** in locale prima di pushare su main
4. **Usare** branch feature per sviluppi
5. **Verificare** lo stato del database dopo modifiche allo schema

## 🆘 In caso di problemi

### Deploy fallito
```bash
# Il backup è automatico, puoi ripristinare con:
git checkout nome-branch-backup
```

### Database corrotto
```bash
# Usa i backup automatici in prisma/
cp prisma/database-backup-TIMESTAMP.db prisma/dev.db
```

### Script TypeScript non funzionanti
Il manager ha fallback automatici ai controlli standard TypeScript/ESLint.

---

**⚠️ Importante**: Questo tool è configurato per il progetto Bar Roxy. Le path e gli script sono specifici per questo setup.