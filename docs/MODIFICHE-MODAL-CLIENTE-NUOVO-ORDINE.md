# Modifiche Modal Cliente per Nuovo Ordine

## 🎯 Obiettivo
Quando si clicca "Nuovo Ordine" su qualsiasi tavolo (vuoto o occupato), deve sempre aprirsi il modal per inserire/confermare il nome cliente, come per i tavoli vuoti.

## 📝 Modifiche Effettuate

### 1. **TableOperationsModal.tsx**
- **Rimosso**: Visualizzazione del nome cliente nel header del modal
- **Rimosso**: Testo "Clienti esistenti: ..." dalla descrizione del pulsante Nuovo Ordine
- **Mantenuto**: Redirect diretto a `/cameriere/tavolo/[id]` senza parametri

#### Prima:
```tsx
// Header mostrava:
{table.clienteNome || "Nessun cliente"}

// Descrizione pulsante:
description: existingCustomers.length > 0 
  ? `Clienti esistenti: ${existingCustomers.slice(0, 2).join(", ")}...`
  : "Aggiungi un nuovo ordine a questo tavolo"
```

#### Dopo:
```tsx
// Header mostra solo:
{table.zona && `${table.zona} • `}{table.posti} posti

// Descrizione pulsante:
description: "Aggiungi un nuovo ordine a questo tavolo"
```

### 2. **tavolo/[id]/page.tsx**
- **Rimosso**: useEffect che chiudeva automaticamente il modal quando c'erano ordini attivi
- **Mantenuto**: Modal sempre aperto all'inizio (`showNameModal = true`)
- **Mantenuto**: Pre-compilazione con l'ultimo cliente che ha ordinato

#### Codice Rimosso:
```tsx
// Questo chiudeva il modal automaticamente per tavoli occupati
useEffect(() => {
  if (table && table.stato === "OCCUPATO" && activeOrders.length > 0) {
    setShowNameModal(false);
  }
}, [activeOrders, table]);
```

## 🔄 Flusso Risultante

### Per Tutti i Tavoli:
1. **Click Tavolo** → Modal operazioni (senza nome cliente)
2. **Click "Nuovo Ordine"** → Vai a `/cameriere/tavolo/[id]`
3. **CustomerNameModal si apre SEMPRE**:
   - Tavolo vuoto: Campo vuoto
   - Tavolo occupato: Nome ultimo cliente precompilato
4. **Opzioni**:
   - Conferma nome esistente
   - Cambia con altro cliente del tavolo
   - Inserisci nuovo nome

## ✅ Vantaggi
- **Uniformità**: Stesso comportamento per tutti i tavoli
- **Controllo**: L'utente ha sempre il controllo sul nome cliente
- **Velocità**: Nome precompilato per conferma rapida quando disponibile
- **Trasparenza**: Sempre chiaro per quale cliente si sta ordinando