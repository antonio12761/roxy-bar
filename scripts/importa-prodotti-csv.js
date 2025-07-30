// Script per importare i dati prodotti revisionati dal CSV

const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const path = require('path')
const csv = require('csv-parse/sync')

const prisma = new PrismaClient()

interface ProdottoCSV {
  ID: string
  Codice: string
  Nome: string
  Categoria: string
  Fornitore: string
  'Prezzo Acquisto': string
  'IVA %': string
  'Prezzo Vendita': string
  'Margine %': string
  'Unità Magazzino': string
  'Fattore Conversione': string
  'Unità Servizio': string
  'Giacenza Attuale': string
  'Giacenza Minima': string
  'Punto Riordino': string
  'Disponibile Menu': string
  Attivo: string
  // Campi aggiuntivi che potrebbero essere aggiunti manualmente
  'Quantità Confezione'?: string
  'Volume Magazzino'?: string
  'Volume Servizio'?: string
  'Codice Fornitore'?: string
}

async function importaProdottiDaCSV(filePath: string) {
  try {
    console.log('Lettura file CSV...')
    const fileContent = fs.readFileSync(filePath, 'utf-8')
    
    // Parse CSV
    const records: ProdottoCSV[] = csv.parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      cast: false
    })
    
    console.log(`Trovati ${records.length} prodotti da importare`)
    
    let importati = 0
    let errori = 0
    const erroriDettagli: string[] = []
    
    // Crea una mappa dei fornitori esistenti
    const fornitori = await prisma.fornitore.findMany({
      where: { attivo: true }
    })
    const fornitoriMap = new Map(fornitori.map(f => [f.nome.toLowerCase(), f]))
    
    for (const record of records) {
      try {
        const prodottoId = parseInt(record.ID)
        
        // Trova il prodotto esistente
        const prodottoEsistente = await prisma.prodotto.findUnique({
          where: { id: prodottoId },
          include: {
            inventario: true,
            fornitori: true
          }
        })
        
        if (!prodottoEsistente) {
          throw new Error(`Prodotto con ID ${prodottoId} non trovato`)
        }
        
        // Prepara i dati per l'aggiornamento
        const prezzoAcquisto = parseFloat(record['Prezzo Acquisto']) || 0
        const prezzoVendita = parseFloat(record['Prezzo Vendita']) || 0
        const iva = parseFloat(record['IVA %']) || 22
        const fattoreConversione = parseFloat(record['Fattore Conversione']) || 1
        const quantitaConfezione = parseFloat(record['Quantità Confezione'] || '1')
        
        // Calcola imponibile
        const imponibile = prezzoAcquisto / (1 + iva / 100)
        
        // Aggiorna il prodotto con i nuovi campi
        await prisma.prodotto.update({
          where: { id: prodottoId },
          data: {
            codice: record.Codice ? parseInt(record.Codice.replace('PROD-', '')) : undefined,
            unitaMisura: record['Unità Magazzino'],
            prezzo: prezzoVendita,
            // Questi campi devono essere aggiunti allo schema Prisma
            // unitaServizio: record['Unità Servizio'],
            // fattoreConversione: fattoreConversione,
            // quantitaConfezione: quantitaConfezione,
            // iva: iva,
            // imponibile: imponibile,
            // volumeMagazzino: record['Volume Magazzino'],
            // volumeServizio: record['Volume Servizio']
          }
        })
        
        // Gestisci il fornitore se specificato
        if (record.Fornitore && prezzoAcquisto > 0) {
          const fornitore = fornitoriMap.get(record.Fornitore.toLowerCase())
          
          if (fornitore) {
            // Verifica se esiste già la relazione prodotto-fornitore
            const relazioneEsistente = prodottoEsistente.fornitori.find(
              pf => pf.fornitoreId === fornitore.id
            )
            
            if (relazioneEsistente) {
              // Aggiorna la relazione esistente
              await prisma.prodottoFornitore.update({
                where: { id: relazioneEsistente.id },
                data: {
                  costoAcquisto: prezzoAcquisto,
                  codiceFornitore: record['Codice Fornitore'],
                  attivo: true
                }
              })
            } else {
              // Crea nuova relazione
              await prisma.prodottoFornitore.create({
                data: {
                  prodottoId: prodottoId,
                  fornitoreId: fornitore.id,
                  costoAcquisto: prezzoAcquisto,
                  codiceFornitore: record['Codice Fornitore'],
                  attivo: true
                }
              })
            }
          } else {
            console.warn(`Fornitore "${record.Fornitore}" non trovato per prodotto ${record.Nome}`)
          }
        }
        
        // Aggiorna l'inventario
        const giacenzaAttuale = parseFloat(record['Giacenza Attuale']) || 0
        const giacenzaMinima = parseFloat(record['Giacenza Minima']) || 0
        const puntoRiordino = parseFloat(record['Punto Riordino']) || giacenzaMinima * 1.5
        
        if (prodottoEsistente.inventario) {
          await prisma.inventario.update({
            where: { id: prodottoEsistente.inventario.id },
            data: {
              giacenzaAttuale: giacenzaAttuale,
              giacenzaMinima: giacenzaMinima > 0 ? giacenzaMinima : undefined
            }
          })
        } else if (giacenzaAttuale > 0 || giacenzaMinima > 0) {
          // Crea inventario se non esiste
          await prisma.inventario.create({
            data: {
              prodottoId: prodottoId,
              giacenzaAttuale: giacenzaAttuale,
              giacenzaMinima: giacenzaMinima > 0 ? giacenzaMinima : undefined
            }
          })
        }
        
        importati++
        
        if (importati % 10 === 0) {
          console.log(`Importati ${importati}/${records.length} prodotti...`)
        }
        
      } catch (error) {
        errori++
        const messaggio = `Errore prodotto ${record.Nome} (ID: ${record.ID}): ${error instanceof Error ? error.message : 'Errore sconosciuto'}`
        erroriDettagli.push(messaggio)
        console.error(messaggio)
      }
    }
    
    // Report finale
    console.log('\n=== REPORT IMPORTAZIONE ===')
    console.log(`Totale prodotti: ${records.length}`)
    console.log(`Importati con successo: ${importati}`)
    console.log(`Errori: ${errori}`)
    
    if (erroriDettagli.length > 0) {
      console.log('\nDettaglio errori:')
      erroriDettagli.forEach(err => console.log(`- ${err}`))
      
      // Salva log errori
      const logPath = path.join(path.dirname(filePath), 'importazione-errori.log')
      fs.writeFileSync(logPath, erroriDettagli.join('\n'))
      console.log(`\nLog errori salvato in: ${logPath}`)
    }
    
  } catch (error) {
    console.error('Errore durante l\'importazione:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Funzione helper per validare i dati
function validaDatiProdotto(record: ProdottoCSV): string[] {
  const errori: string[] = []
  
  if (!record.ID || isNaN(parseInt(record.ID))) {
    errori.push('ID non valido')
  }
  
  if (!record.Nome || record.Nome.trim() === '') {
    errori.push('Nome prodotto mancante')
  }
  
  const prezzoVendita = parseFloat(record['Prezzo Vendita'])
  if (isNaN(prezzoVendita) || prezzoVendita < 0) {
    errori.push('Prezzo vendita non valido')
  }
  
  const prezzoAcquisto = parseFloat(record['Prezzo Acquisto'])
  if (record['Prezzo Acquisto'] && (isNaN(prezzoAcquisto) || prezzoAcquisto < 0)) {
    errori.push('Prezzo acquisto non valido')
  }
  
  if (prezzoAcquisto > prezzoVendita) {
    errori.push('Prezzo acquisto maggiore del prezzo vendita')
  }
  
  const iva = parseFloat(record['IVA %'])
  if (isNaN(iva) || iva < 0 || iva > 100) {
    errori.push('IVA non valida')
  }
  
  return errori
}

// Verifica se è necessario installare csv-parse
async function verificaDipendenze() {
  try {
    require('csv-parse/sync')
  } catch (error) {
    console.log('Installazione dipendenza csv-parse...')
    const { execSync } = require('child_process')
    execSync('npm install csv-parse', { stdio: 'inherit' })
  }
}

// Main
async function main() {
  await verificaDipendenze()
  
  const args = process.argv.slice(2)
  if (args.length === 0) {
    console.log('Uso: ts-node importa-prodotti-csv.ts <percorso-file-csv>')
    console.log('Esempio: ts-node importa-prodotti-csv.ts prodotti-migrati.csv')
    process.exit(1)
  }
  
  const filePath = args[0]
  if (!fs.existsSync(filePath)) {
    console.error(`File non trovato: ${filePath}`)
    process.exit(1)
  }
  
  await importaProdottiDaCSV(filePath)
}

main()