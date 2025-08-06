# Sistema di Manutenzione con Accesso Controllato

## Panoramica
Il sistema implementa una pagina di manutenzione elegante che blocca l'accesso normale al sito, ma permette l'accesso autorizzato attraverso un percorso speciale.

## Funzionamento

### 1. Pagina Principale (`/`)
- **Mostra**: Pagina di manutenzione elegante con animazioni
- **Contenuto**:
  - Icona animata di manutenzione
  - Messaggio "Sito in Manutenzione"
  - Barra di progresso animata
  - Cards informative (Aggiornamenti, Performance, Sicurezza)
  - Contatti di supporto

### 2. Accesso Speciale (`/ordine`)
- **Percorso segreto**: `/ordine`
- **Comportamento**: Reindirizza automaticamente a `/login?access=ordine`
- **Scopo**: Permette al personale autorizzato di accedere al sistema

### 3. Pagina Login con Accesso Autorizzato
- **Riconosce** l'accesso da `/ordine` tramite parametro URL
- **Mostra**: Badge verde "✅ Accesso autorizzato - Area operatori"
- **Funzione**: Login normale con indicazione visiva dell'accesso autorizzato

## File Implementati

### `/app/page.tsx`
```typescript
// Pagina di manutenzione principale
- Design moderno con gradiente scuro
- Animazioni CSS personalizzate
- Responsive per mobile e desktop
- Auto-detect se l'utente arriva da /ordine
```

### `/app/ordine/page.tsx`
```typescript
// Route speciale per accesso autorizzato
- Redirect immediato a /login con parametro speciale
```

### `/app/login/page.tsx`
```typescript
// Pagina login aggiornata
- Rileva parametro 'access=ordine'
- Mostra badge di accesso autorizzato
```

## Caratteristiche UI

### Animazioni
1. **Icona Wrench**: Rotazione lenta continua (8s)
2. **Pulse Background**: Effetto pulse sull'alone arancione
3. **Progress Bar**: Animazione scorrevole della barra di progresso
4. **Loading Spinner**: Indicatore di controllo stato

### Colori e Tema
- **Background**: Gradiente nero/grigio scuro
- **Accent**: Arancione (#F97316)
- **Text**: Bianco e grigio chiaro
- **Cards**: Sfondo semi-trasparente con backdrop blur

## Come Usare

### Per Utenti Normali
1. Visitano il sito normalmente (`/`)
2. Vedono la pagina di manutenzione
3. Non possono accedere al sistema

### Per Staff Autorizzato
1. Navigano a `/ordine`
2. Vengono reindirizzati automaticamente al login
3. Vedono il badge "Accesso autorizzato"
4. Effettuano login normalmente
5. Accedono al sistema

## Sicurezza

- Il percorso `/ordine` non è pubblicizzato
- Solo chi conosce il percorso può accedere
- Il sistema di login rimane sicuro
- Nessuna backdoor, solo un redirect controllato

## Personalizzazione

### Modificare il Messaggio
Modifica in `/app/page.tsx`:
```typescript
<h1>Sito in Manutenzione</h1>
<p>Il tuo messaggio personalizzato</p>
```

### Cambiare il Percorso Segreto
1. Rinomina la cartella `/app/ordine` con il nuovo nome
2. Aggiorna il check in `/app/page.tsx`:
```typescript
const fromOrdine = referrer.includes('/nuovo-percorso')
```

### Disattivare la Manutenzione
Per tornare al funzionamento normale:
1. Ripristina `/app/page.tsx` al redirect originale:
```typescript
import { redirect } from "next/navigation";
export default function Home() {
  redirect("/login");
}
```
2. Rimuovi la cartella `/app/ordine`

## Note Tecniche

- La pagina di manutenzione è completamente client-side
- Il redirect da `/ordine` è server-side per sicurezza
- Il sistema preserva la sicurezza del login
- Compatibile con il sistema multi-tenant esistente

## Testing

1. **Test Accesso Normale**:
   - Vai su `/` → Vedi manutenzione
   
2. **Test Accesso Autorizzato**:
   - Vai su `/ordine` → Redirect a login con badge verde
   
3. **Test Mobile**:
   - Verifica responsive design su dispositivi mobili