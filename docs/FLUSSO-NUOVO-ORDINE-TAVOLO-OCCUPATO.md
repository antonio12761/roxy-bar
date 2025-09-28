# Flusso Nuovo Ordine per Tavolo Occupato

## 🎯 Problema Identificato
Quando si crea un nuovo ordine per un tavolo già occupato, l'ordine non arriva a PREPARA perché l'utente probabilmente non sta aggiungendo prodotti all'ordine.

## 📋 Flusso Corretto

### 1. Selezione Tavolo
- Utente clicca su tavolo occupato
- Si apre `TableOperationsModal` (senza nome cliente)
- Utente clicca "Nuovo Ordine"

### 2. Pagina Ordine con Modal Cliente
- Redirect a `/cameriere/tavolo/[id]`
- `CustomerNameModal` si apre SEMPRE
- Nome ultimo cliente precompilato
- Utente conferma o cambia nome
- Clicca "Conferma"

### 3. Modal si Chiude - IMPORTANTE!
- Dopo la conferma del nome, il modal si chiude
- **ORA l'utente può aggiungere prodotti**
- L'interfaccia per aggiungere prodotti diventa accessibile

### 4. Aggiungere Prodotti
- Utente cerca/seleziona prodotti
- Aggiunge quantità desiderata
- Prodotti appaiono nel carrello

### 5. Inviare Ordine
- Solo DOPO aver aggiunto prodotti
- Clicca "Invia Ordine"
- Se ordine vuoto → Messaggio errore
- Se ordine con prodotti → Invio a PREPARA

## ⚠️ Errore Comune
L'utente potrebbe:
1. Confermare il nome nel modal
2. NON aggiungere prodotti
3. Cercare di inviare ordine vuoto
4. Sistema blocca invio → Rimane su pagina

## ✅ Verifica Corretta
1. **Modal Nome**: Si apre sempre ✓
2. **Nome Precompilato**: Ultimo cliente ✓
3. **Dopo Conferma Nome**: Modal si chiude ✓
4. **Aggiungere Prodotti**: NECESSARIO
5. **Invio a PREPARA**: Solo con prodotti

## 🔧 Controlli di Sicurezza

### In `submitOrder()`:
```typescript
// Check if order is empty
if (order.length === 0) {
  console.log('[submitOrder] Order is empty, aborting');
  notifyWarning("L'ordine è vuoto. Aggiungi almeno un prodotto.");
  return;
}
```

### Eventi SSE:
- `order:new` viene emesso SOLO dopo creazione ordine con successo
- PREPARA riceve notifica SOLO per ordini con prodotti

## 📝 Istruzioni per l'Utente
1. Seleziona tavolo → Nuovo Ordine
2. Conferma/Cambia nome cliente
3. **AGGIUNGI PRODOTTI ALL'ORDINE**
4. Invia ordine
5. Ordine arriva a PREPARA