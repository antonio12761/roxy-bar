# Gestione Icone Categorie

## Panoramica
Sistema completo per gestire le icone delle categorie nel sistema Bar Roxy, con supporto per emoji e immagini personalizzate.

## Funzionalità Implementate

### 1. Modal Impostazioni Categoria
- **Posizione**: `/dashboard/categorie`
- **Accesso**: Click sul pulsante impostazioni (⚙️) quando una categoria è selezionata
- **Funzioni disponibili**:
  - ✏️ Modifica nome categoria
  - 🎨 Cambio icona (emoji o immagine)
  - 🎨 Selezione colore per temi
  - 🗑️ Eliminazione categoria

### 2. Gestione Icone
#### Emoji
- Input diretto per inserire qualsiasi emoji
- Lista di emoji suggerite per categorie comuni
- Salvataggio immediato nel database

#### Immagini Personalizzate
- Upload di file PNG/JPG/GIF (max 2MB)
- Le immagini vengono salvate in `/public/category-icons/`
- Anteprima immediata dopo il caricamento
- Supporto per switch tra emoji e immagine

### 3. Database Schema
```prisma
model CategoryIcon {
  id           Int      @id @default(autoincrement())
  categoryName String   @unique
  icon         String?  // Emoji or path to image
  iconType     String   @default("emoji") // "emoji" or "image"
  color        String?  // Hex color
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

### 4. API Endpoints

#### GET `/api/dashboard/category-icons`
Recupera tutte le categorie con le loro icone

#### POST `/api/dashboard/category-icons`
Aggiorna emoji e colore per una categoria

#### POST `/api/dashboard/category-icons/[name]/upload`
Upload di un'immagine per una categoria specifica

### 5. Integrazione con Menu Cliente
- Le icone personalizzate sono mostrate in `/menu`
- Supporto completo per immagini e emoji
- Le modifiche sono immediate senza necessità di riavvio

## File Modificati

### Frontend
- `/app/dashboard/categorie/page.tsx` - Aggiunto modal impostazioni completo
- `/app/menu/menu-client.tsx` - Supporto per visualizzazione icone personalizzate
- `/lib/actions/get-category-emojis.ts` - Server action per recuperare icone

### Backend
- `/app/api/dashboard/category-icons/route.ts` - API per gestione icone
- `/app/api/dashboard/category-icons/[name]/upload/route.ts` - API per upload immagini
- `/prisma/schema.prisma` - Aggiunto modello CategoryIcon

### Scripts
- `/scripts/sync-category-icons.ts` - Script per sincronizzare categorie con icone di default

## Come Usare

1. **Accedere a Gestione Categorie**
   ```
   Vai su /dashboard/categorie
   ```

2. **Selezionare una Categoria**
   Click su una categoria dai tab orizzontali

3. **Aprire Impostazioni**
   Click sull'icona impostazioni (⚙️) che appare quando la categoria è selezionata

4. **Modificare Impostazioni**
   - Nome: Modifica il nome della categoria
   - Icona: Scegli tra emoji o carica un'immagine
   - Colore: Seleziona un colore per i temi personalizzati
   - Elimina: Rimuovi la categoria (i prodotti verranno spostati)

5. **Salvare le Modifiche**
   Click su "Salva Modifiche" per applicare i cambiamenti

## Note Tecniche

- Le immagini caricate sono ottimizzate automaticamente
- Il sistema mantiene la compatibilità con le categorie esistenti
- Le icone sono condivise tra tutti i tenant (multi-tenancy)
- Cache automatica delle icone per prestazioni ottimali

## Sicurezza

- Validazione tipo file (solo immagini)
- Limite dimensione file (2MB)
- Sanitizzazione nomi file
- Protezione percorsi file system

## Prossimi Passi Consigliati

1. Aggiungere compressione automatica immagini
2. Supporto per SVG
3. Libreria icone predefinite
4. Export/Import configurazione icone
5. Anteprima icone in tempo reale durante la modifica