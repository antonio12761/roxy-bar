# Report Conversione API Route in Server Actions

## 1. API Route GIÀ CONVERTITE ✅

### Autenticazione
- ✅ `/api/auth/login` → `lib/actions/auth.ts` (login)
- ✅ `/api/logout` → `lib/actions/auth.ts` (logout)

### Inventario e Prodotti
- ✅ `/api/inventario` → `lib/actions/inventario.ts` (getInventarioProdotti)
- ✅ `/api/products/procedures` → `lib/actions/products.ts`
- ✅ `/api/products/import-csv` → `lib/actions/import-products.ts`

### Metriche e Statistiche
- ✅ `/api/metrics` → `lib/actions/metrics.ts` (getSystemMetrics)

### Ordini
- ✅ `/api/orders/customer-informed` → `lib/actions/ordinazioni/index.ts`
- ✅ `/api/orders/out-of-stock` → `lib/actions/out-of-stock.ts`

### Gestione Categorie
- ✅ `/api/dashboard/categorie` → `lib/actions/categories.ts`
- ✅ `/api/dashboard/categorie/[id]` → `lib/actions/categories.ts`

### Gestione Tavoli
- ✅ `/api/admin/tavoli` → `lib/actions/tavoli.ts`
- ✅ `/api/admin/tavoli/posizioni` → `lib/actions/tavoli.ts`
- ✅ `/api/admin/gruppi-tavoli` → `lib/actions/gruppi-tavoli.ts`

### Supervisore
- ✅ `/api/supervisore/users` → `lib/actions/users.ts`
- ✅ `/api/supervisore/sync-orders` → `lib/actions/ordinazioni/notifiche-sync.ts`

### Cassa
- ✅ `/api/cassa/payment-history` → `lib/actions/cassa.ts`
- ✅ `/api/cassa/receipt-requests` → `lib/actions/richieste-pagamento.ts`

### Impostazioni
- ✅ `/api/impostazioni-scontrino` → `lib/actions/impostazioni-scontrino.ts`

## 2. API Route DA CONVERTIRE 🔄

### Autenticazione e Permessi
- 🔄 `/api/auth/register` - Registrazione nuovi utenti
- 🔄 `/api/auth/check-permission` - Controllo permessi specifici
- 🔄 `/api/auth/permissions` - Gestione permessi

### Admin e Utenti
- 🔄 `/api/admin/users` - Gestione utenti (CRUD)
- 🔄 `/api/admin/roles` - Gestione ruoli
- 🔄 `/api/admin/permissions` - Gestione permessi amministrativi
- 🔄 `/api/admin/users/roles` - Assegnazione ruoli agli utenti

### Notifiche
- 🔄 `/api/notifications/claim` - Claim notifiche
- 🔄 `/api/notifications/metrics` - Metriche notifiche

### Utility
- 🔄 `/api/fix-destinations` - Fix destinazioni ordini
- 🔄 `/api/orders/check-code-status/[code]` - Verifica stato ordine per codice

### Dashboard
- 🔄 `/api/dashboard/category-icons` - Gestione icone categorie
- 🔄 `/api/dashboard/category-icons/[name]/upload` - Upload icone
- 🔄 `/api/dashboard/categorie/[id]/upload-icon` - Upload icona per categoria

## 3. API Route che NON DEVONO essere convertite ❌

### Server-Sent Events (SSE)
- ❌ `/api/sse` - **Motivo**: Richiede streaming real-time con ReadableStream
- ❌ `/api/notifications/stream` - **Motivo**: Deprecata, redirect a /api/sse

### Motivi tecnici per NON convertire SSE:
1. Richiede connessione persistente con streaming
2. Utilizza ReadableStream per eventi real-time
3. Gestisce heartbeat e cleanup delle connessioni
4. Non compatibile con il modello request-response delle Server Actions

## 4. Route di TEST/UTILITY da rimuovere 🗑️

- 🗑️ `/api/test-settings` - Route di test per impostazioni
- 🗑️ `/api/test-esaurito` - Route di test per prodotti esauriti

## 5. Piano di Conversione Prioritaria

### Alta Priorità (Core functionality)
1. **Autenticazione**: `/api/auth/register`, `/api/auth/check-permission`
2. **Gestione Utenti**: `/api/admin/users`, `/api/admin/roles`
3. **Notifiche**: `/api/notifications/claim`

### Media Priorità (Features secondarie)
1. **Upload Icone**: Dashboard category icons routes
2. **Metriche Notifiche**: `/api/notifications/metrics`
3. **Fix Utilities**: `/api/fix-destinations`

### Bassa Priorità (Nice to have)
1. **Check Code Status**: `/api/orders/check-code-status/[code]`

## 6. Benefici della Conversione

1. **Performance**: Eliminazione round-trip HTTP, esecuzione diretta server-side
2. **Type Safety**: TypeScript end-to-end automatico
3. **Sicurezza**: Validazione automatica, nessuna esposizione API pubblica
4. **Manutenibilità**: Codice più semplice e centralizzato
5. **Bundle Size**: Riduzione del codice client-side

## 7. Considerazioni Tecniche

### Pattern di Conversione
```typescript
// Da API Route:
export async function POST(request: NextRequest) {
  const body = await request.json();
  // logic
  return NextResponse.json(result);
}

// A Server Action:
export async function actionName(params: Type) {
  "use server";
  // same logic
  return result;
}
```

### Gestione Errori
- Utilizzare try/catch consistente
- Ritornare oggetti con `{ success, data?, error? }`
- Log errori con `secureLog`

### Autenticazione
- Sempre verificare con `getCurrentUser()`
- Controllare ruoli e permessi
- Gestire multi-tenancy

## 8. Note Finali

- Le Server Actions sono la direzione raccomandata da Next.js per le mutazioni
- Mantengono tutti i benefici delle API route con meno boilerplate
- SSE rimane come API route per requisiti tecnici specifici
- Le route di test dovrebbero essere rimosse in produzione