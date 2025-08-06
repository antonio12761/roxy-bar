# PWA Configuration for Roxy Bar

## Overview
L'app Roxy Bar è ora configurata come Progressive Web App (PWA) per Android e altri dispositivi.

## Funzionalità PWA Implementate

### 1. Manifest.json
- Nome completo e breve dell'app
- Icone in tutte le dimensioni richieste (72x72 fino a 512x512)
- Icone maskable per Android adaptive icons
- Scorciatoie rapide per Cameriere, Cucina e Cassa
- Tema nero per integrazione con il design dell'app
- Configurazione per display standalone

### 2. Service Worker (via next-pwa)
- Caching automatico delle risorse statiche
- Strategia Network First per le API
- Cache per font, immagini, JS e CSS
- Supporto offline con pagina di fallback
- Aggiornamento automatico del service worker

### 3. Installazione su Android
Per installare l'app su Android:
1. Apri Chrome su Android
2. Naviga all'URL dell'app
3. Tocca il menu (3 punti) in alto a destra
4. Seleziona "Aggiungi a schermata Home" o "Installa app"
5. Conferma il nome e tocca "Aggiungi"

### 4. Icone Placeholder
Sono state create icone placeholder. Per la produzione:
1. Sostituisci tutti i file icon-*.png in /public con il logo reale
2. Assicurati che le icone maskable abbiano padding extra per Android
3. Crea screenshot reali per screenshot-1.png e screenshot-2.png

## Testing PWA

### Chrome DevTools
1. Apri Chrome DevTools (F12)
2. Vai alla tab "Application"
3. Controlla:
   - Manifest nella sezione "Manifest"
   - Service Worker nella sezione "Service Workers"
   - Cache Storage per vedere le risorse cached

### Lighthouse
1. In Chrome DevTools, vai alla tab "Lighthouse"
2. Seleziona "Progressive Web App"
3. Esegui l'audit per verificare la conformità PWA

### Test su Android
1. Usa Chrome Remote Debugging per testare su dispositivi reali
2. Verifica che l'app si installi correttamente
3. Testa il funzionamento offline
4. Verifica che le notifiche funzionino (se implementate)

## Prossimi Passi

1. **Icone Reali**: Sostituisci le icone placeholder con il logo Roxy Bar reale
2. **Screenshot**: Aggiungi screenshot reali dell'app per il Play Store
3. **Notifiche Push**: Implementa le notifiche push per ordini e aggiornamenti
4. **Background Sync**: Aggiungi sincronizzazione in background per ordini offline
5. **App Store**: Considera la pubblicazione su Google Play Store usando TWA (Trusted Web Activities)

## Note Tecniche

- Il service worker è disabilitato in development per evitare problemi di caching
- next-pwa genera automaticamente sw.js e workbox-*.js in produzione
- Le risorse statiche sono cached con strategia StaleWhileRevalidate
- Le API usano NetworkFirst con fallback alla cache