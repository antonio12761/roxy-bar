# 🌙 Bar Roxy - Clean Architecture

Sistema di gestione per Bar Roxy ricostruito da zero con architettura pulita.

## 🚀 Quick Start

```bash
# 1. Installa le dipendenze
npm install

# 2. Configura il database nel file .env
cp .env.example .env
# Modifica DATABASE_URL con i tuoi dati PostgreSQL

# 3. Inizializza il database
npx prisma generate
npx prisma db push

# 4. Crea gli utenti
npm run seed:users

# 5. Avvia il server
npm run dev
```

## 🔐 Login

Sistema con **solo password** (password = nome utente):

- **Antonio** (ADMIN)
- **Marco** (CAMERIERE) 
- **Paola** (CASSA)
- **Chiara** (CUCINA)
- **Andrea** (PREPARA)
- **Elena** (BANCO)
- **Giulio** (SUPERVISORE)
- **Filippo** (MANAGER)

## 🏗️ Architettura

### Stack Tecnologico
- **Next.js 15** (App Router)
- **TypeScript** con strict mode
- **Prisma ORM** con PostgreSQL
- **Tailwind CSS** (Dark Mode default)
- **Zod** per validazione
- **bcryptjs** per hash password
- **Server Actions** (NO API REST)

### Struttura Progetto
```
├── app/                 # App Router
│   ├── login/          # Pagina login
│   ├── dashboard/      # Dashboard admin/manager
│   ├── cameriere/      # Postazione cameriere
│   ├── cassa/          # Postazione cassa
│   └── ...
├── lib/                # Librerie core
│   ├── auth.ts         # Sistema autenticazione
│   └── actions/        # Server Actions
├── components/         # Componenti React
├── prisma/            # Database schema
└── scripts/           # Script utilità
```

## 🎯 Features Implementate

### ✅ Fase 1 - Base
- [x] **Dark Mode** di default
- [x] **Login con solo password**
- [x] **Autenticazione JWT + Session**
- [x] **Database Prisma setup**
- [x] **16 utenti predefiniti**

### 🚧 Fase 2 - In Sviluppo
- [ ] Dashboard per ruolo
- [ ] Postazione Cameriere
- [ ] Sistema Ordini base
- [ ] Notifiche real-time (SSE)

### 📋 Fase 3 - Pianificate
- [ ] Drawer pagamenti flessibile
- [ ] Gestione tavoli avanzata
- [ ] Notifiche sonore
- [ ] Sistema offline

## 🗄️ Database

Schema Prisma completo con:
- User (autenticazione + ruoli)
- Session (gestione sessioni)
- Tavolo, Ordinazione, RigaOrdinazione
- Prodotto, Categoria
- Pagamento, Incasso
- Notifica

## 🔧 Comandi Utili

```bash
# Database
npx prisma generate          # Genera client Prisma
npx prisma db push          # Applica schema al DB
npx prisma studio          # Interfaccia DB

# Development
npm run dev                 # Server sviluppo
npm run build              # Build produzione
npm run lint               # ESLint check

# Seeds
npm run seed:users         # Crea utenti base
```

## 💡 Best Practices

1. **Server Actions Only** - No API REST routes
2. **Dark Mode First** - Design ottimizzato per dark theme
3. **Type Safe** - Zod + TypeScript ovunque
4. **Progressive Enhancement** - Funziona senza JS
5. **Security First** - Hash password, JWT, CSRF protection

## 📚 Knowledge Base

Tutto il know-how precedente è salvato in:
`~/bar-roxy-knowledge/`

Per confrontare implementazioni diverse:
```bash
cd ~/bar-roxy-knowledge
find . -name "*.tsx" | grep login
```

---

🌟 **Clean Architecture** - Ricostruito da zero per performance e manutenibilità