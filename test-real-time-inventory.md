# Test Aggiornamenti Real-Time Inventario

## Scenario di Test

### 1. Setup Iniziale
1. Apri due finestre del browser:
   - **Finestra A**: /prepara (Gestione prodotti e inventario)
   - **Finestra B**: /cameriere (Gestione ordini)

### 2. Test Aggiornamento Inventario Durante Modifica Ordine Esaurito

#### Passo 1: Creare un ordine esaurito
1. In **Finestra A** (/prepara):
   - Trova un prodotto (es. "Acqua naturale")
   - Rendilo parzialmente esaurito impostando quantità disponibile a 3

2. In **Finestra B** (/cameriere):
   - Crea un ordine con 5 unità del prodotto
   - L'ordine dovrebbe andare automaticamente in stato esaurito

#### Passo 2: Modificare l'ordine esaurito
1. In **Finestra B**:
   - Vai in "Ordini Esauriti"
   - Clicca su "Modifica" per l'ordine creato
   - Il drawer dovrebbe mostrare:
     - Acqua naturale x5 con indicazione "Solo 3 disponibili"

#### Passo 3: Aggiornare inventario in real-time
1. Mentre il drawer è aperto in **Finestra B**, vai in **Finestra A** (/prepara):
   - Cambia la quantità disponibile da 3 a 1
   
2. Verifica in **Finestra B** che:
   - Il drawer si aggiorna automaticamente mostrando "Solo 1 disponibile"
   - Appare un toast warning con il messaggio di aggiornamento
   - La quantità nel drawer si riduce automaticamente a 1
   - L'indicatore visuale cambia colore (giallo/arancione per disponibilità limitata)

#### Passo 4: Rendere prodotto completamente esaurito
1. In **Finestra A**:
   - Imposta la quantità disponibile a 0
   
2. Verifica in **Finestra B** che:
   - Il drawer mostra "ESAURITO" o "0 disponibili"
   - Appare un toast error con messaggio di rimuovere il prodotto
   - Il pulsante "Invia Ordine" si disabilita automaticamente
   - Lo sfondo dell'item diventa rosso

### 3. Test Cambio Disponibilità Prodotto

#### Passo 1: Prodotto diventa non disponibile
1. Con il drawer ancora aperto in **Finestra B**
2. In **Finestra A** (/prepara):
   - Clicca su "Non disponibile" per il prodotto
   
3. Verifica in **Finestra B** che:
   - Il prodotto nel drawer viene marcato come "Non disponibile"
   - Appare un toast error
   - Il pulsante "Invia Ordine" si disabilita

#### Passo 2: Prodotto torna disponibile
1. In **Finestra A**:
   - Ripristina la disponibilità del prodotto
   - Resetta l'inventario (rimuovi limite quantità)
   
2. Verifica in **Finestra B** che:
   - Il prodotto torna disponibile nel drawer
   - Le limitazioni di quantità vengono rimosse
   - Il pulsante "Invia Ordine" si riabilita (se non ci sono altri prodotti non disponibili)

### 4. Test con Ordini Normali (non esauriti)

1. In **Finestra B**, crea un nuovo ordine normale
2. Aggiungi alcuni prodotti al carrello
3. In **Finestra A**, rendi uno dei prodotti non disponibile
4. Verifica che in **Finestra B**:
   - Appare un toast informativo
   - Il prodotto viene aggiornato nella lista prodotti
   - Se il prodotto è nel drawer, viene marcato come non disponibile

## Verifiche Chiave

✅ **Aggiornamenti Real-Time**:
- Gli aggiornamenti dell'inventario si riflettono immediatamente nel drawer
- I toast notification appaiono per informare l'utente
- Non è necessario ricaricare la pagina

✅ **Stato UI Coerente**:
- I colori e gli indicatori visuali cambiano in base alla disponibilità
- Il pulsante "Invia Ordine" si abilita/disabilita correttamente
- Le quantità si aggiustano automaticamente ai limiti disponibili

✅ **Gestione Errori**:
- Messaggi chiari quando i prodotti diventano non disponibili
- Suggerimenti su cosa fare (rimuovere prodotti, trovare alternative)
- Prevenzione invio ordini con prodotti non disponibili

## Note Tecniche

- Gli eventi SSE utilizzati sono:
  - `inventory:updated`: Aggiornamento quantità inventario
  - `inventory:reset`: Reset inventario (rimozione limiti)
  - `product:availability`: Cambio disponibilità prodotto
  
- Il drawer mantiene lo stato sincronizzato attraverso:
  - `inventarioLimitato`: Map con le quantità disponibili
  - `order`: Array con gli items dell'ordine e loro stato
  - `quantitaDisponibile`: Quantità esplicita per ordini esauriti