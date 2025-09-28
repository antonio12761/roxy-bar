# Sistema Notifiche PREPARA ↔️ CAMERIERE

## 📋 Panoramica

Il sistema di notifiche permette la comunicazione in tempo reale tra i ruoli PREPARA (preparazione bar/cucina) e CAMERIERE, garantendo un servizio efficiente e coordinato.

## 🔔 Flusso delle Notifiche

### 1. 🆕 Nuovo Ordine (CAMERIERE → PREPARA)
- **Evento**: `order:new`
- **Quando**: Un cameriere crea un nuovo ordine
- **Chi riceve**: PREPARA (solo se ci sono items per BANCO/PREPARA)
- **Notifica**: "📋 Nuovo ordine #X - Tavolo Y"
- **Priorità**: ALTA
- **Suono**: ✅ Sì

### 2. 🔄 In Lavorazione (PREPARA → CAMERIERE)
- **Evento**: `order:item:update` con stato `IN_LAVORAZIONE`
- **Quando**: PREPARA inizia a lavorare un item
- **Chi riceve**: CAMERIERE e SUPERVISORE
- **Notifica**: "🔄 Ordine #X in preparazione"
- **Priorità**: NORMALE
- **Suono**: ❌ No

### 3. ✨ Ordine Pronto (PREPARA → CAMERIERE)
- **Evento**: `order:ready`
- **Quando**: PREPARA completa tutti gli items di un ordine
- **Chi riceve**: CAMERIERE
- **Notifica**: "✨ Ordine #X PRONTO!"
- **Priorità**: ALTA
- **Suono**: ✅ Sì

### 4. ✓ Ordine Consegnato (CAMERIERE → Sistema)
- **Evento**: `order:delivered`
- **Quando**: CAMERIERE ritira e consegna l'ordine al tavolo
- **Chi riceve**: Tutti (log di sistema)
- **Notifica**: "✓ Ordine #X consegnato da [nome]"
- **Priorità**: BASSA
- **Suono**: ❌ No

### 5. ⚠️ Prodotto Esaurito (PREPARA → TUTTI)
- **Evento**: `product:availability`
- **Quando**: Un prodotto diventa non disponibile
- **Chi riceve**: TUTTI i ruoli
- **Notifica**: "⚠️ [Prodotto] non disponibile"
- **Priorità**: URGENTE
- **Suono**: ✅ Sì

## 🎯 Priorità delle Notifiche

| Priorità | Icona | Uso | Suono |
|----------|-------|-----|-------|
| URGENTE | ⚠️ | Prodotti esauriti, problemi critici | ✅ |
| ALTA | ✨ | Ordini pronti, nuovi ordini | ✅ |
| NORMALE | 🔄 | Aggiornamenti stato, info | ❌ |
| BASSA | ✓ | Log, conferme | ❌ |

## 📱 Componenti del Sistema

### NotificationCenter (`/components/NotificationCenter.tsx`)
- Centro notifiche visivo (campanella nell'header)
- Mostra storico notifiche
- Gestisce stati letto/non letto
- Riproduce suoni per notifiche importanti

### NotificationManager (`/lib/notifications/NotificationManager.ts`)
- Servizio centrale per la creazione notifiche
- Configura priorità e destinatari
- Gestisce la logica di business delle notifiche

### SSE Events (`/lib/sse/sse-events.ts`)
- Definisce tutti gli eventi real-time
- Tipizzazione TypeScript per sicurezza
- Eventi multi-tenant isolati

## 🔧 Configurazione Suoni

Le notifiche con priorità ALTA e URGENTE riproducono un suono. Il volume può essere regolato nelle impostazioni utente.

## 🚀 Test del Sistema

Per testare il flusso completo delle notifiche:

```bash
npm run tsx scripts/test-notifiche-prepara-cameriere.ts
```

Questo script:
1. Crea un ordine di test
2. Simula tutto il ciclo di vita dell'ordine
3. Invia tutte le notifiche in sequenza
4. Pulisce i dati di test

## ⚡ Performance

- **Deduplicazione**: Ignora notifiche duplicate entro 3 secondi
- **Limite notifiche**: Massimo 100 notifiche in memoria
- **Real-time**: Utilizzo di Server-Sent Events per aggiornamenti istantanei
- **Multi-tenant**: Isolamento completo tra tenant diversi

## 🔍 Debug

Per debug delle notifiche:
1. Aprire la console del browser
2. Cercare log con prefisso `[NotificationCenter]`
3. Verificare eventi SSE nella tab Network del browser
4. Controllare il componente SSEDebugger se abilitato