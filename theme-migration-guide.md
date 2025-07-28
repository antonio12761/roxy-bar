# Guida Migrazione Tema Monocromatico

## File di Backup
- **Backup del tema originale**: `app/globals.css.backup`

## Per tornare al tema precedente:
```bash
cp app/globals.css.backup app/globals.css
```

## Mappatura Colori

### Colori Primari
- `amber-400`, `amber-500`, `amber-600` → `neutral-100` o `white/90`
- `yellow-400`, `yellow-500` → `neutral-200` 
- `green-400`, `green-500` → `neutral-300`
- `red-400`, `red-500` → `neutral-400`
- `blue-400`, `blue-500` → `neutral-300`

### Stati
- **Success (verde)**: `bg-white/10 border-white/20 text-neutral-200`
- **Error (rosso)**: `bg-white/5 border-white/15 text-neutral-300`
- **Warning (giallo)**: `bg-white/8 border-white/18 text-neutral-250`
- **Info (blu)**: `bg-white/6 border-white/16 text-neutral-300`

### Componenti Principali
1. **Bottoni Primari**: 
   - Da: `bg-amber-600 hover:bg-amber-700`
   - A: `bg-white text-black hover:bg-neutral-200`

2. **Stati Tavoli**:
   - LIBERO: `bg-white/10 border-white/20`
   - OCCUPATO: `bg-white/20 border-white/30`
   - RISERVATO: `bg-white/15 border-white/25`
   - IN_PULIZIA: `bg-white/5 border-white/15`

3. **Connection Status**:
   - Online: `text-neutral-300`
   - Offline: `text-neutral-500`
   - Connecting: `text-neutral-400`

## Modifiche Effettuate
1. Aggiornato `globals.css` con palette monocromatica
2. File di backup creato per ripristino rapido