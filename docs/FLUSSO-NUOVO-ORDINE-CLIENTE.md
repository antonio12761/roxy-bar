# Flusso Nuovo Ordine con Modal Cliente

## 📋 Panoramica
Il sistema ora richiede SEMPRE la selezione/conferma del cliente quando si crea un nuovo ordine, anche per tavoli che hanno già ordini esistenti.

## 🔄 Flusso Completo

### 1. Selezione Tavolo
- Utente clicca su un tavolo (vuoto o occupato)
- Si apre il `TableOperationsModal`

### 2. Nuovo Ordine
- Utente clicca "Nuovo Ordine"
- Viene reindirizzato a `/cameriere/tavolo/[id]` (SENZA parametro cliente)

### 3. Modal Cliente SEMPRE Visibile
Il `CustomerNameModal` si apre SEMPRE con:

#### Per Tavolo Vuoto:
- Campo nome vuoto
- Lista clienti recenti generali
- Autocomplete per ricerca

#### Per Tavolo con Ordini Esistenti:
- **Nome precompilato**: Ultimo cliente che ha ordinato al tavolo
- **Clienti al tavolo**: Lista evidenziata (es: "Mario, Luigi, Anna")
- **Autocomplete**: Cerca in tutti i clienti del database

### 4. Opzioni Utente
L'utente può:
- ✅ **Confermare** il nome precompilato (un click su "Conferma")
- 🔄 **Cambiare** selezionando un altro cliente del tavolo
- 🔍 **Cercare** un cliente nell'elenco generale
- ➕ **Aggiungere** un nuovo nome cliente

## 🛠️ Implementazione Tecnica

### Modifiche Chiave:

1. **TableOperationsModal.tsx**
   ```typescript
   const handleNewOrder = () => {
     // Vai sempre direttamente alla pagina ordine
     router.push(`/cameriere/tavolo/${table.id}`);
     onClose();
   };
   ```

2. **tavolo/[id]/page.tsx**
   ```typescript
   const [showNameModal, setShowNameModal] = useState(true); // SEMPRE true
   const [customerName, setCustomerName] = useState(""); // Inizializza vuoto
   
   // Nel caricamento dati:
   if (previousCustomers.lastCustomerName) {
     setCustomerName(previousCustomers.lastCustomerName);
   }
   ```

3. **getCustomerNamesForTable**
   - Restituisce `customerNames[]`: tutti i clienti del tavolo
   - Restituisce `lastCustomerName`: ultimo cliente che ha ordinato

## 📱 Esperienza Utente

### Tavolo Nuovo
1. Click tavolo → Click "Nuovo Ordine"
2. Modal si apre vuoto
3. Inserisci nome → Conferma → Crea ordine

### Tavolo con Clienti
1. Click tavolo → Click "Nuovo Ordine"  
2. Modal si apre con:
   - Nome: "Anna Verdi" (precompilato)
   - Testo: "Clienti già al tavolo: Mario, Luigi, Anna"
3. Opzioni:
   - Conferma "Anna Verdi" → Crea ordine
   - Cambia in "Mario" → Crea ordine
   - Inserisci nuovo "Giuseppe" → Crea ordine

## ✅ Vantaggi
- **Velocità**: Nome precompilato per conferma rapida
- **Flessibilità**: Sempre possibile cambiare cliente
- **Tracciabilità**: Ogni ordine ha sempre un cliente associato
- **Coerenza**: Stesso flusso per tutti i tavoli