// Script di migrazione per unificare i dati prodotti esistenti nel nuovo schema

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

// Interfaccia per il nuovo schema prodotti unificato
interface ProdottoUnificato {
  // Dati esistenti da Prodotto
  id: number
  codice: string
  nome: string
  descrizione?: string
  
  // Categorie (da unificare)
  categoria: string
  categoriaMenuId?: number
  categoryId?: number
  subcategoryId?: number
  
  // Dati Menu (già presenti)
  prezzoVendita: number // era prezzo
  descrizioneMenu?: string
  ingredienti?: string[]
  allergeni?: string[]
  disponibileMenu: boolean // era disponibile
  tempoPreparazione?: number
  volumeServizio?: string // da aggiungere
  
  // Dati Magazzino (da ProdottoFornitore + nuovi campi)
  fornitore?: string
  codiceFornitore?: string
  prezzoAcquisto?: number
  unitaMisura: string
  quantitaPerConfezione: number // da aggiungere
  iva: number // da aggiungere
  imponibile?: number
  volumeMagazzino?: string // da aggiungere
  
  // Inventario (da Inventario)
  giacenzaAttuale: number
  giacenzaMinima?: number
  puntoRiordino?: number // da calcolare
  
  // Conversioni (nuovo)
  fattoreConversione?: number
  unitaServizio?: string
  
  // Metadata
  attivo: boolean
  createdAt: Date
  updatedAt: Date
}

// Mappa IVA per categoria (da configurare in base al business)
const IVA_PER_CATEGORIA: Record<string, number> = {
  'BEVANDE': 22,
  'BIBITE': 22,
  'ALCOLICI': 22,
  'BIRRE': 22,
  'COCKTAIL': 22,
  'CAFFETTERIA': 10,
  'PANINI': 10,
  'GELATI': 10,
  'APERITIVI': 10,
  'DEFAULT': 22
}

// Fattori di conversione comuni
const CONVERSIONI_COMUNI: Record<string, { fattore: number; unitaServizio: string }> = {
  'bottiglia_vino': { fattore: 5, unitaServizio: 'calice' },
  'bottiglia_liquore': { fattore: 20, unitaServizio: 'shot' },
  'cartone_bibite': { fattore: 24, unitaServizio: 'lattina' },
  'fusto_birra': { fattore: 100, unitaServizio: 'bicchiere' },
  'kg_caffe': { fattore: 140, unitaServizio: 'tazzina' }
}

async function migraProdotti() {
  try {
    // 1. Recupera tutti i prodotti esistenti con relazioni
    const prodottiEsistenti = await prisma.prodotto.findMany({
      where: { isDeleted: false },
      include: {
        inventario: true,
        fornitori: {
          include: {
            fornitore: true
          }
        },
        categoriaMenu: true,
        category: true,
        subcategory: true
      }
    })

    console.log(`Trovati ${prodottiEsistenti.length} prodotti da migrare`)

    // 2. Trasforma i dati nel nuovo formato
    const prodottiUnificati: ProdottoUnificato[] = []

    for (const prodotto of prodottiEsistenti) {
      // Determina il fornitore principale (quello con costo più basso)
      const fornitorePrincipale = prodotto.fornitori
        .filter((pf: any) => pf.attivo)
        .sort((a: any, b: any) => Number(a.costoAcquisto || 0) - Number(b.costoAcquisto || 0))[0]

      // Calcola IVA in base alla categoria
      const categoriaUpper = prodotto.categoria?.toUpperCase() || 'DEFAULT'
      const iva = IVA_PER_CATEGORIA[categoriaUpper] || IVA_PER_CATEGORIA.DEFAULT

      // Determina conversione se applicabile
      let fattoreConversione = 1
      let unitaServizio = prodotto.unitaMisura || 'pz'

      // Logica conversioni basata su categoria e nome prodotto
      if (prodotto.categoria === 'BIRRE' && prodotto.nome.toLowerCase().includes('fusto')) {
        fattoreConversione = CONVERSIONI_COMUNI.fusto_birra.fattore
        unitaServizio = CONVERSIONI_COMUNI.fusto_birra.unitaServizio
      } else if (prodotto.categoria === 'BIBITE' && prodotto.unitaMisura === 'cartone') {
        fattoreConversione = CONVERSIONI_COMUNI.cartone_bibite.fattore
        unitaServizio = CONVERSIONI_COMUNI.cartone_bibite.unitaServizio
      } else if (prodotto.categoria === 'ALCOLICI' && prodotto.unitaMisura === 'bottiglia') {
        if (prodotto.nome.toLowerCase().includes('vino')) {
          fattoreConversione = CONVERSIONI_COMUNI.bottiglia_vino.fattore
          unitaServizio = CONVERSIONI_COMUNI.bottiglia_vino.unitaServizio
        } else {
          fattoreConversione = CONVERSIONI_COMUNI.bottiglia_liquore.fattore
          unitaServizio = CONVERSIONI_COMUNI.bottiglia_liquore.unitaServizio
        }
      }

      // Calcola punto riordino (150% della giacenza minima)
      const giacenzaMinima = Number(prodotto.inventario?.giacenzaMinima || 0)
      const puntoRiordino = giacenzaMinima > 0 ? Math.ceil(giacenzaMinima * 1.5) : 5

      const prodottoUnificato: ProdottoUnificato = {
        // Dati base
        id: prodotto.id,
        codice: prodotto.codice?.toString() || `PROD-${prodotto.id}`,
        nome: prodotto.nome,
        descrizione: prodotto.descrizione || undefined,
        
        // Categorie
        categoria: prodotto.categoria,
        categoriaMenuId: prodotto.categoriaMenuId || undefined,
        categoryId: prodotto.categoryId || undefined,
        subcategoryId: prodotto.subcategoryId || undefined,
        
        // Dati Menu
        prezzoVendita: Number(prodotto.prezzo),
        descrizioneMenu: prodotto.descrizione || undefined,
        ingredienti: prodotto.ingredienti ? prodotto.ingredienti.split(',').map((i: string) => i.trim()) : undefined,
        allergeni: prodotto.allergeni ? prodotto.allergeni.split(',').map((a: string) => a.trim()) : undefined,
        disponibileMenu: prodotto.disponibile,
        tempoPreparazione: prodotto.tempoPreparazione || undefined,
        volumeServizio: undefined, // Da configurare manualmente
        
        // Dati Magazzino
        fornitore: fornitorePrincipale?.fornitore.nome,
        codiceFornitore: fornitorePrincipale?.codiceFornitore || undefined,
        prezzoAcquisto: fornitorePrincipale ? Number(fornitorePrincipale.costoAcquisto) : Number(prodotto.prezzo) * 0.4,
        unitaMisura: prodotto.unitaMisura || 'pz',
        quantitaPerConfezione: 1, // Default, da aggiornare manualmente
        iva: iva,
        imponibile: undefined, // Verrà calcolato
        volumeMagazzino: undefined, // Da configurare manualmente
        
        // Inventario
        giacenzaAttuale: Number(prodotto.inventario?.giacenzaAttuale || 0),
        giacenzaMinima: giacenzaMinima,
        puntoRiordino: puntoRiordino,
        
        // Conversioni
        fattoreConversione: fattoreConversione,
        unitaServizio: unitaServizio,
        
        // Metadata
        attivo: prodotto.disponibile && !prodotto.terminato,
        createdAt: prodotto.createdAt,
        updatedAt: prodotto.updatedAt
      }

      // Calcola imponibile
      if (prodottoUnificato.prezzoAcquisto) {
        prodottoUnificato.imponibile = prodottoUnificato.prezzoAcquisto / (1 + iva / 100)
      }

      prodottiUnificati.push(prodottoUnificato)
    }

    // 3. Genera report di migrazione
    console.log('\n=== REPORT MIGRAZIONE ===')
    console.log(`Prodotti totali: ${prodottiUnificati.length}`)
    console.log(`Prodotti con fornitore: ${prodottiUnificati.filter(p => p.fornitore).length}`)
    console.log(`Prodotti con conversione: ${prodottiUnificati.filter(p => p.fattoreConversione && p.fattoreConversione > 1).length}`)
    console.log(`Prodotti con giacenza: ${prodottiUnificati.filter(p => p.giacenzaAttuale > 0).length}`)

    // 4. Salva i dati migrati
    await salvaProdottiMigrati(prodottiUnificati)

    console.log('\nMigrazione completata con successo!')
    
  } catch (error) {
    console.error('Errore durante la migrazione:', error)
  } finally {
    await prisma.$disconnect()
  }
}

async function salvaProdottiMigrati(prodotti: ProdottoUnificato[]) {
  // Qui puoi implementare la logica per salvare i prodotti nel nuovo schema
  // Per ora salviamo in un file JSON per revisione
  
  const fs = require('fs')
  const path = require('path')
  
  const outputPath = path.join(__dirname, 'prodotti-migrati.json')
  fs.writeFileSync(outputPath, JSON.stringify(prodotti, null, 2))
  
  console.log(`\nDati migrati salvati in: ${outputPath}`)
  
  // Genera anche un CSV per revisione in Excel
  const csvPath = path.join(__dirname, 'prodotti-migrati.csv')
  const csv = generaCSV(prodotti)
  fs.writeFileSync(csvPath, csv)
  
  console.log(`CSV per revisione salvato in: ${csvPath}`)
}

function generaCSV(prodotti: ProdottoUnificato[]): string {
  const headers = [
    'ID', 'Codice', 'Nome', 'Categoria', 'Fornitore',
    'Prezzo Acquisto', 'IVA %', 'Prezzo Vendita', 'Margine %',
    'Unità Magazzino', 'Fattore Conversione', 'Unità Servizio',
    'Giacenza Attuale', 'Giacenza Minima', 'Punto Riordino',
    'Disponibile Menu', 'Attivo'
  ]
  
  const rows = prodotti.map(p => {
    const margine = p.prezzoAcquisto 
      ? ((p.prezzoVendita - p.prezzoAcquisto) / p.prezzoVendita * 100).toFixed(2)
      : 'N/A'
    
    return [
      p.id,
      p.codice,
      `"${p.nome}"`,
      p.categoria,
      p.fornitore || '',
      p.prezzoAcquisto?.toFixed(2) || '',
      p.iva,
      p.prezzoVendita.toFixed(2),
      margine,
      p.unitaMisura,
      p.fattoreConversione,
      p.unitaServizio,
      p.giacenzaAttuale,
      p.giacenzaMinima || '',
      p.puntoRiordino || '',
      p.disponibileMenu ? 'SI' : 'NO',
      p.attivo ? 'SI' : 'NO'
    ].join(',')
  })
  
  return [headers.join(','), ...rows].join('\n')
}

// Esegui la migrazione
migraProdotti()