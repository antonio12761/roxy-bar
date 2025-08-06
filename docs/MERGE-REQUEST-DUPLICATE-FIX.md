# Fix Richieste di Merge Duplicate

## Il Problema

Quando un ordine viene inviato e deve essere unito a un ordine già in preparazione, la richiesta di merge veniva creata 11 volte invece di una sola volta.

## Causa del Problema

Il problema era simile al loop infinito precedente:

1. **Chiamate multiple a `creaOrdinazione`**: Il componente React chiamava la funzione multiple volte a causa di re-render
2. **Mancanza di controllo duplicati**: Non c'era un meccanismo per evitare la creazione di richieste duplicate
3. **Assenza di timeout nella transazione**: La transazione poteva rimanere appesa causando retry

## Soluzioni Implementate

### 1. **Controllo Duplicati nel Backend**

```javascript
// Prima controlla se esiste già una richiesta di merge pendente con gli stessi prodotti
const prodottiString = JSON.stringify(dati.prodotti);
const richiestaEsistente = await tx.richiestaMerge.findFirst({
  where: {
    ordinazioneId: ordineInPreparazione.id,
    richiedenteId: utente.id,
    stato: 'PENDING',
    prodotti: prodottiString,
    // Controlla che sia stata creata negli ultimi 5 secondi per evitare duplicati
    createdAt: {
      gte: new Date(Date.now() - 5000)
    }
  }
});

if (richiestaEsistente) {
  console.log('[creaOrdinazione] Richiesta di merge duplicata rilevata, skipping creation');
  return {
    success: true,
    mergePending: true,
    message: 'Richiesta di aggiunta prodotti già inviata. In attesa di conferma dalla preparazione.'
  };
}
```

### 2. **Timeout sulla Transazione**

```javascript
const result = await prisma.$transaction(async (tx) => {
  // ... logica della transazione
}, {
  timeout: 10000, // 10 secondi
  maxWait: 5000   // Massimo tempo di attesa per acquisire il lock
});
```

### 3. **Contatore di Tentativi nel Frontend**

```javascript
// Track submission attempts
const submissionAttemptsRef = useRef(0);

const submitOrder = async (fromModal: boolean = false) => {
  // Check if we've tried too many times
  submissionAttemptsRef.current++;
  if (submissionAttemptsRef.current > 3) {
    console.error('[submitOrder] Too many submission attempts, aborting');
    notifyError('Troppi tentativi di invio. Ricarica la pagina e riprova.');
    return;
  }
  
  // ... resto della logica
  
  // Reset counter on success
  if (result.success || result.mergePending) {
    submissionAttemptsRef.current = 0;
  }
};
```

### 4. **Flag di Navigazione**

```javascript
// Prevent operations when navigating away
const isNavigatingAwayRef = useRef(false);

// Set flag before navigation
isNavigatingAwayRef.current = true;
router.push('/cameriere/nuova-ordinazione');
```

## Meccanismo di Deduplicazione

Il controllo di duplicazione funziona così:

1. **Confronto Prodotti**: Verifica se esistono richieste con gli stessi prodotti (JSON stringified)
2. **Finestra Temporale**: Controlla solo richieste create negli ultimi 5 secondi
3. **Stesso Utente**: Verifica che sia lo stesso utente a fare la richiesta
4. **Stato PENDING**: Considera solo richieste ancora pendenti

## Best Practices per Evitare Duplicati

1. **Sempre controllare duplicati prima di creare record**
   ```javascript
   const esistente = await tx.model.findFirst({
     where: {
       // criteri univoci
       createdAt: { gte: new Date(Date.now() - 5000) }
     }
   });
   ```

2. **Usare flag per prevenire invii multipli**
   ```javascript
   if (isSubmitting) return;
   setIsSubmitting(true);
   ```

3. **Implementare timeout nelle transazioni**
   ```javascript
   await prisma.$transaction(async (tx) => {
     // ...
   }, { timeout: 10000, maxWait: 5000 });
   ```

4. **Limitare i tentativi**
   ```javascript
   if (attempts > MAX_ATTEMPTS) {
     throw new Error('Too many attempts');
   }
   ```

## Logging e Monitoraggio

Sono stati aggiunti log per tracciare:
- Quando viene creata una richiesta di merge
- Quando viene rilevata una richiesta duplicata
- Il numero di prodotti da aggiungere
- L'ID della richiesta creata

```javascript
console.log('[creaOrdinazione] Creando nuova richiesta di merge per ordine:', ordineInPreparazione.id);
console.log('[creaOrdinazione] Prodotti da aggiungere:', dati.prodotti.length);
console.log('[creaOrdinazione] Richiesta di merge creata con ID:', richiestaMerge.id);
```

## Conclusione

La combinazione di:
- Controllo duplicati nel backend
- Timeout sulla transazione
- Limitazione tentativi nel frontend
- Flag di navigazione

Ha risolto il problema delle richieste di merge duplicate, garantendo che ogni richiesta venga creata una sola volta anche in presenza di re-render multipli o problemi di rete.