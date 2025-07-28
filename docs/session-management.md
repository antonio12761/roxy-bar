# Gestione Sessioni e Sincronizzazione Utenti

## Problema Identificato

Il sistema mostrava incongruenze tra utenti visualizzati come "non attivi" nel pannello supervisore ma che potevano ancora creare ordini senza dover fare login.

## Cause del Problema

1. **Mismatch tra Cookie e Sessioni Database**
   - Cookie: valido per 24 ore (produzione) o 30 giorni (sviluppo)
   - Sessione DB: valida per 7 giorni (produzione) o 30 giorni (sviluppo)
   - Un utente può avere un cookie valido anche se appare "offline"

2. **Metodi Diversi per Determinare "Online"**
   - Stats: basato su `ultimoAccesso` negli ultimi 30 minuti
   - User List: basato su sessioni attive nel database

## Soluzione Implementata

1. **Aggiornamento `ultimoAccesso`**
   - Ora aggiornato ad ogni chiamata a `getCurrentUser()`
   - Mantiene traccia dell'attività reale dell'utente

2. **Uniformità nel Controllo Online**
   - Tutti i controlli ora usano sessioni attive nel database
   - Rimozione del controllo basato su `ultimoAccesso`

3. **Sincronizzazione Ordini**
   - Nuovo pulsante "Sincronizza" nel pannello supervisore
   - Identifica ordini "orfani" (senza utente attivo)
   - Auto-annulla ordini vecchi più di 24 ore

4. **Indicatore Visivo**
   - Warning quando ci sono ordini attivi ma 0 utenti online

## Come Usare la Sincronizzazione

1. Se vedi ordini attivi ma 0 utenti connessi:
   - Clicca il pulsante "Sincronizza" 
   - Il sistema identificherà ordini orfani
   - Ordini molto vecchi saranno annullati automaticamente

2. Per forzare il logout di un utente:
   - Usa lo switch nel modal utenti
   - L'utente dovrà fare login nuovamente

## Note Tecniche

- Le sessioni sono la fonte di verità per lo stato "online"
- Il cookie JWT deve corrispondere a una sessione valida nel DB
- `ultimoAccesso` è ora un campo di audit, non di stato