# Schema Database Prodotti Unificato

## Struttura Prodotto Completa

```typescript
interface Prodotto {
  // Dati Base
  id: string
  codice: string
  nome: string
  categoria: string
  sottocategoria?: string
  
  // Dati Magazzino
  fornitore: string
  codiceFornitore?: string
  unitaMisura: string // "bottiglia", "cartone", "kg", etc.
  quantitaPerConfezione: number
  prezzoAcquisto: number // prezzo netto
  iva: number // percentuale IVA
  imponibile: number
  volumeMagazzino?: string // "75cl", "1L", etc.
  peso?: number
  dimensioni?: {
    lunghezza: number
    larghezza: number
    altezza: number
  }
  temperaturaConservazione?: string
  scadenzaGiorni?: number
  
  // Dati Menu
  descrizioneMenu?: string // descrizione per il cliente
  ingredienti?: string[]
  allergeni?: string[]
  prezzoVendita: number // prezzo finale al pubblico
  volumeServizio?: string // "20cl", "bicchiere", etc.
  tempoPreparazione?: number // in minuti
  disponibileMenu: boolean
  
  // Gestione Inventario
  giacenzaMinima: number
  giacenzaAttuale: number
  puntoRiordino: number
  
  // Metadata
  dataCreazione: Date
  dataUltimaModifica: Date
  attivo: boolean
}
```

## Viste Filtrate

### Vista Magazzino
```typescript
type ProdottoMagazzino = Pick<Prodotto, 
  'id' | 'codice' | 'nome' | 'fornitore' | 'codiceFornitore' |
  'unitaMisura' | 'quantitaPerConfezione' | 'prezzoAcquisto' |
  'iva' | 'imponibile' | 'volumeMagazzino' | 'peso' |
  'giacenzaMinima' | 'giacenzaAttuale' | 'puntoRiordino'
>
```

### Vista Menu
```typescript
type ProdottoMenu = Pick<Prodotto,
  'id' | 'nome' | 'categoria' | 'descrizioneMenu' |
  'ingredienti' | 'allergeni' | 'prezzoVendita' |
  'volumeServizio' | 'tempoPreparazione' | 'disponibileMenu'
>
```

## Vantaggi di questo approccio

1. **Fonte unica di verità**: Un solo record per prodotto evita duplicazioni e inconsistenze
2. **Manutenzione semplificata**: Modifichi i dati in un solo posto
3. **Flessibilità**: Puoi creare facilmente nuove viste per altri contesti
4. **Relazioni automatiche**: La giacenza del magazzino è direttamente collegata alla disponibilità nel menu
5. **Scalabilità**: Facile aggiungere nuovi campi senza stravolgere la struttura

## Esempio di utilizzo

```typescript
// Funzione per ottenere prodotti per il magazzino
function getProdottiMagazzino(): ProdottoMagazzino[] {
  return prodotti.map(p => ({
    id: p.id,
    codice: p.codice,
    nome: p.nome,
    fornitore: p.fornitore,
    // ... altri campi rilevanti
  }))
}

// Funzione per ottenere prodotti per il menu
function getProdottiMenu(): ProdottoMenu[] {
  return prodotti
    .filter(p => p.disponibileMenu && p.giacenzaAttuale > 0)
    .map(p => ({
      id: p.id,
      nome: p.nome,
      descrizioneMenu: p.descrizioneMenu,
      prezzoVendita: p.prezzoVendita,
      // ... altri campi rilevanti
    }))
}
```