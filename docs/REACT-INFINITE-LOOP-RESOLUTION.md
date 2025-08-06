# Risoluzione Loop Infinito React - Caso Studio Completo

## Il Problema Principale

Il componente `/app/cameriere/tavolo/[id]/page.tsx` entrava in un loop infinito di render e richieste HTTP, causando:
- 40+ render in pochi secondi
- Richieste POST continue a `/cameriere/tavolo/1` e `/cameriere/nuova-ordinazione`
- Richieste di merge duplicate (11 volte invece di 1)
- Blocco dell'invio ordini dopo 3 tentativi
- Consumo eccessivo di risorse
- Esperienza utente completamente degradata

## Sintomi Osservati

1. **Render multipli continui**
   ```
   [Tavolo 1] Render #40 at 2025-08-04T15:23:02.140Z
   [Tavolo 1] Render #41 at 2025-08-04T15:23:02.818Z
   [Tavolo 1] Render #42 at 2025-08-04T15:23:03.224Z
   ```

2. **Richieste HTTP in loop**
   ```
   POST /cameriere/tavolo/1 200 in 230ms
   POST /cameriere/tavolo/1 200 in 236ms
   POST /cameriere/tavolo/1 200 in 215ms
   ```

3. **Eventi e chiamate duplicate**
   - `sseContext` che cambiava continuamente
   - Connessioni e disconnessioni SSE ripetute
   - `handleNameSubmit` chiamato 3 volte consecutive
   - Richieste di merge create 11 volte

## Cause Identificate

### 1. **Dipendenze instabili negli useEffect**
```javascript
// PROBLEMA: Oggetti e funzioni nelle dipendenze
useEffect(() => {
  loadData();
}, [tavoloId, loadActiveOrders, loadInventarioLimitato]); // ❌ Funzioni ricreate ad ogni render
```

### 2. **Funzioni non memoizzate**
```javascript
// PROBLEMA: Funzione ricreata ad ogni render
async function loadActiveOrders() {
  // ...
}
```

### 3. **Oggetti come dipendenze**
```javascript
// PROBLEMA: Confronto di oggetti interi
useEffect(() => {
  // ...
}, [sseContext, table, loadActiveOrders]); // ❌ Oggetti cambiano riferimento
```

### 4. **Mancanza di debouncing**
- Eventi SSE multipli triggeravano chiamate immediate
- Nessun controllo per chiamate concorrenti

### 5. **React StrictMode**
- In development, React esegue gli effect due volte
- Senza controlli adeguati, questo raddoppia le sottoscrizioni

### 6. **Chiamate multiple duplicate**
- `handleNameSubmit` veniva chiamato 3 volte
- Auto-submit duplicato nel modal del nome cliente
- Mancanza di flag per prevenire invii simultanei

### 7. **Errori di riferimento**
```javascript
// PROBLEMA: Accesso a variabile prima della dichiarazione
useEffect(() => {
  if (order.length === 0) { // ❌ order non ancora dichiarato
    // ...
  }
}, [order.length]);
```

## Soluzioni Implementate

### 1. **Stabilizzazione delle dipendenze**
```javascript
// SOLUZIONE: Memoizzazione con useCallback
const loadActiveOrders = useCallback(async () => {
  // ...
}, [tavoloId]); // ✅ Solo dipendenze primitive

// SOLUZIONE: useMemo per valori derivati
const tavoloId = useMemo(() => parseInt(params.id as string), [params.id]);
const tableNumber = useMemo(() => table?.numero || null, [table?.numero]);
```

### 2. **Rimozione di dipendenze non necessarie**
```javascript
// SOLUZIONE: Solo tavoloId come dipendenza
useEffect(() => {
  loadData();
}, [tavoloId]); // ✅ Solo ciò che è veramente necessario
```

### 3. **Uso di valori primitivi invece di oggetti**
```javascript
// SOLUZIONE: Proprietà specifiche invece di oggetti interi
useEffect(() => {
  // ...
}, [sseContext?.subscribe, table?.id, table?.numero, tavoloId]); // ✅
```

### 4. **Implementazione di debouncing**
```javascript
// SOLUZIONE: Debounce per evitare chiamate multiple
const loadTimer = setTimeout(async () => {
  console.log('Loading data after 300ms debounce');
  await loadData();
}, 300);

return () => clearTimeout(loadTimer);
```

### 5. **Flag per prevenire operazioni concorrenti**
```javascript
// SOLUZIONE: Flag per evitare chiamate multiple
const isLoadingActiveOrdersRef = useRef(false);

const loadActiveOrders = useCallback(async () => {
  if (isLoadingActiveOrdersRef.current) {
    console.log('Already loading, skipping');
    return;
  }
  isLoadingActiveOrdersRef.current = true;
  try {
    // ... caricamento
  } finally {
    isLoadingActiveOrdersRef.current = false;
  }
}, [tavoloId]);
```

### 6. **Gestione della navigazione**
```javascript
// SOLUZIONE: Flag per prevenire operazioni durante navigazione
const isNavigatingAwayRef = useRef(false);

// Prima di navigare
isNavigatingAwayRef.current = true;
router.push('/nuova-pagina');

// Nei caricamenti
if (isNavigatingAwayRef.current) {
  console.log('Navigating away, skipping operation');
  return;
}
```

### 7. **Prevenzione sottoscrizioni duplicate**
```javascript
// SOLUZIONE: Flag per evitare sottoscrizioni multiple in StrictMode
const orderSSESetupRef = useRef(false);

useEffect(() => {
  if (orderSSESetupRef.current) {
    console.log('SSE already setup, skipping');
    return;
  }
  orderSSESetupRef.current = true;
  
  // ... setup SSE
  
  return () => {
    orderSSESetupRef.current = false;
  };
}, [/* deps */]);
```

### 8. **Fix per richieste di merge duplicate**
```javascript
// SOLUZIONE: Controllo duplicati nel backend
const richiestaEsistente = await tx.richiestaMerge.findFirst({
  where: {
    ordinazioneId: ordineInPreparazione.id,
    richiedenteId: utente.id,
    stato: 'PENDING',
    prodotti: prodottiString,
    createdAt: {
      gte: new Date(Date.now() - 5000) // Ultimi 5 secondi
    }
  }
});

if (richiestaEsistente) {
  console.log('Richiesta duplicata rilevata, skipping');
  return { success: true, mergePending: true };
}
```

### 9. **Fix per chiamate multiple a handleNameSubmit**
```javascript
// SOLUZIONE: Flag per prevenire chiamate simultanee
const isHandlingNameSubmitRef = useRef(false);

const handleNameSubmit = async (name, seats) => {
  if (isHandlingNameSubmitRef.current) {
    console.log('Already handling, skipping');
    return;
  }
  isHandlingNameSubmitRef.current = true;
  
  try {
    // ... logica
  } finally {
    isHandlingNameSubmitRef.current = false;
  }
};

// E rimozione auto-submit duplicato nel CustomerNameModal
```

### 10. **Fix per errore di riferimento**
```javascript
// SOLUZIONE: Spostare useEffect dopo la dichiarazione
const [order, setOrder] = useState<OrderItem[]>([]);

// ✅ Ora order è definito
useEffect(() => {
  if (order.length === 0) {
    setIsSubmittingFromModal(false);
    setIsSubmittingOrder(false);
  }
}, [order.length]);
```

### 11. **Gestione intelligente dei tentativi**
```javascript
// SOLUZIONE: Incrementare counter solo per errori reali
catch (error) {
  submissionAttemptsRef.current++;
  if (submissionAttemptsRef.current > 3) {
    notifyError('Troppi errori di invio');
  }
}

// Reset quando cambia tavolo
useEffect(() => {
  submissionAttemptsRef.current = 0;
}, [tavoloId]);
```

## Come Prevenire Questi Problemi

### 1. **Best Practices per useEffect**
- Usa sempre dipendenze primitive quando possibile
- Memoizza funzioni con `useCallback`
- Memoizza valori derivati con `useMemo`
- Evita oggetti e array nelle dipendenze

### 2. **Gestione asincrona corretta**
- Implementa sempre cleanup functions
- Usa flag per prevenire operazioni concorrenti
- Implementa debouncing per operazioni costose

### 3. **Debug efficace**
```javascript
// Aggiungi log per tracciare i render
useEffect(() => {
  console.log('Component rendered', { 
    timestamp: new Date().toISOString(),
    dependencies: { tavoloId, tableNumber }
  });
});

// Traccia cosa causa i re-render
const prevDepsRef = useRef({});
useEffect(() => {
  const changes = [];
  if (prevDepsRef.current.dep1 !== dep1) changes.push('dep1');
  if (prevDepsRef.current.dep2 !== dep2) changes.push('dep2');
  console.log('Dependencies changed:', changes);
  prevDepsRef.current = { dep1, dep2 };
});
```

### 4. **Testing in development**
- Testa sempre con React StrictMode attivo
- Monitora il Network tab per richieste duplicate
- Usa React DevTools Profiler per identificare render eccessivi

## Checklist di Risoluzione

Quando affronti un loop infinito:

1. ✅ **Identifica le dipendenze degli useEffect**
   - Sono tutte necessarie?
   - Ci sono oggetti o funzioni?

2. ✅ **Controlla le funzioni**
   - Sono memoizzate con useCallback?
   - Le dipendenze sono corrette?

3. ✅ **Verifica gli stati**
   - Qualche setState triggera un effect che modifica lo stesso stato?
   - Ci sono dipendenze circolari?

4. ✅ **Aggiungi log strategici**
   - All'inizio di ogni effect
   - Prima di ogni setState
   - In ogni funzione async

5. ✅ **Implementa protezioni**
   - Flag per operazioni in corso
   - Debouncing per eventi frequenti
   - Cleanup adeguati

## Risultati Ottenuti

Dopo l'implementazione di tutte le soluzioni:

### Prima:
- 40+ render in pochi secondi
- Richieste HTTP continue in loop
- Richieste di merge create 11 volte
- Blocco dopo 3 tentativi di invio
- CPU al 100%, browser rallentato

### Dopo:
- 14 render normali (dovuti a StrictMode)
- Nessun loop di richieste HTTP
- Richieste di merge create una sola volta
- Gestione intelligente degli errori
- Performance normale
- Log finale: "Almeno non è infinito" ✅

## Conclusione

Il loop infinito era causato da una **tempesta perfetta** di problemi:
1. Dipendenze instabili negli useEffect
2. Mancanza di memoizzazione
3. SSE context che cambiava frequentemente
4. Assenza di debouncing e controlli concorrenti
5. Chiamate multiple non controllate
6. Auto-submit duplicati nei componenti
7. Errori di timing nell'accesso alle variabili

La soluzione ha richiesto un approccio **sistematico e completo**:
- Stabilizzazione di tutte le dipendenze
- Implementazione di flag e controlli
- Debouncing intelligente
- Gestione corretta del ciclo di vita
- Rimozione di logiche duplicate
- Controlli di duplicazione nel backend

Il caso dimostra l'importanza di:
- Comprendere profondamente React hooks e dipendenze
- Implementare sempre controlli per operazioni asincrone
- Testare con React StrictMode attivo
- Monitorare le performance durante lo sviluppo
- Avere una strategia di logging efficace