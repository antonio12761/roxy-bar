'use server'

import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { quickFixDecimals } from '@/lib/utils/auto-fix-decimals'

export interface ProdottoMagazzino {
  id: number
  codice: string
  nome: string
  categoria: string
  fornitore?: string
  codiceFornitore?: string
  unitaMisura: string
  quantitaConfezione: number
  prezzoAcquisto: number
  iva: number
  giacenzaAttuale: number
  giacenzaMinima?: number
  puntoRiordino: number
  valoreGiacenza: number
  daRiordinare: boolean
}

export interface ProdottoMenu {
  id: number
  nome: string
  categoria: string
  categoriaMenu?: string
  descrizione: string
  prezzoVendita: number
  volumeServizio?: string
  disponibilita: number
  margineUnitario: number
  marginePercentuale: string
  ingredienti?: string
  allergeni?: string
}

export interface FiltriProdotti {
  vista?: 'magazzino' | 'menu' | 'completa'
  categoria?: string
  daRiordinare?: boolean
  ricerca?: string
}

// Recupera prodotti con filtri
export async function getProdottiUnificati(filtri: FiltriProdotti = {}) {
  const session = await getServerSession(authOptions)
  if (!session) {
    throw new Error('Non autorizzato')
  }

  const { vista = 'completa', categoria, daRiordinare, ricerca } = filtri

  try {
    let risultati: any[]

    switch (vista) {
      case 'magazzino':
        risultati = await prisma.$queryRaw`
          SELECT * FROM vista_prodotti_magazzino
          WHERE 1=1
          ${categoria ? prisma.$queryRaw`AND categoria = ${categoria}` : prisma.$queryRaw``}
          ${daRiordinare ? prisma.$queryRaw`AND da_riordinare = true` : prisma.$queryRaw``}
          ${ricerca ? prisma.$queryRaw`AND (nome ILIKE ${'%' + ricerca + '%'} OR codice ILIKE ${'%' + ricerca + '%'})` : prisma.$queryRaw``}
          ORDER BY categoria, nome
        `
        break

      case 'menu':
        risultati = await prisma.$queryRaw`
          SELECT * FROM vista_prodotti_menu
          WHERE disponibilita > 0
          ${categoria ? prisma.$queryRaw`AND (categoria = ${categoria} OR categoria_menu = ${categoria})` : prisma.$queryRaw``}
          ${ricerca ? prisma.$queryRaw`AND (nome ILIKE ${'%' + ricerca + '%'} OR descrizione ILIKE ${'%' + ricerca + '%'})` : prisma.$queryRaw``}
          ORDER BY categoria_menu, nome
        `
        break

      default:
        // Vista completa
        const prodotti = await prisma.prodotto.findMany({
          where: {
            isDeleted: false,
            ...(categoria && { categoria }),
            ...(ricerca && {
              OR: [
                { nome: { contains: ricerca, mode: 'insensitive' } },
                { descrizione: { contains: ricerca, mode: 'insensitive' } }
              ]
            })
          },
          include: {
            inventario: true,
            fornitori: {
              where: { attivo: true },
              include: { fornitore: true },
              orderBy: { costoAcquisto: 'asc' },
              take: 1
            },
            categoriaMenu: true
          },
          orderBy: [{ categoria: 'asc' }, { nome: 'asc' }]
        })

        risultati = prodotti.map(p => {
          const fornitorePrincipale = p.fornitori[0]
          const prezzoAcquisto = fornitorePrincipale?.costoAcquisto || (p.prezzo * 0.4)
          const fattoreConversione = p.fattoreConversione || 1

          return {
            id: p.id,
            codice: p.codice,
            nome: p.nome,
            descrizione: p.descrizione,
            categoria: p.categoria,
            categoriaMenu: p.categoriaMenu?.nomeDisplay,
            fornitore: fornitorePrincipale?.fornitore.nome,
            codiceFornitore: fornitorePrincipale?.codiceFornitore,
            prezzoAcquisto: Number(prezzoAcquisto),
            iva: Number(p.iva || 22),
            imponibile: Number(p.imponibile || prezzoAcquisto / 1.22),
            unitaMisura: p.unitaMisura,
            quantitaConfezione: Number(p.quantitaConfezione || 1),
            volumeMagazzino: p.volumeMagazzino,
            prezzoVendita: Number(p.prezzo),
            volumeServizio: p.volumeServizio,
            unitaServizio: p.unitaServizio || p.unitaMisura,
            disponibileMenu: p.disponibile,
            tempoPreparazione: p.tempoPreparazione,
            ingredienti: p.ingredienti,
            allergeni: p.allergeni,
            giacenzaAttuale: Number(p.inventario?.giacenzaAttuale || 0),
            giacenzaMinima: Number(p.inventario?.giacenzaMinima || 0),
            puntoRiordino: Number(p.inventario?.giacenzaMinima || 0) * 1.5,
            fattoreConversione: Number(fattoreConversione),
            disponibilita: Math.floor(Number(p.inventario?.giacenzaAttuale || 0) * Number(fattoreConversione)),
            margineUnitario: Number(p.prezzo) - (Number(prezzoAcquisto) / Number(fattoreConversione)),
            marginePercentuale: ((Number(p.prezzo) - (Number(prezzoAcquisto) / Number(fattoreConversione))) / Number(p.prezzo) * 100).toFixed(2),
            valoreGiacenza: Number(p.inventario?.giacenzaAttuale || 0) * Number(prezzoAcquisto),
            daRiordinare: Number(p.inventario?.giacenzaAttuale || 0) <= (Number(p.inventario?.giacenzaMinima || 0) * 1.5)
          }
        })

        if (daRiordinare) {
          risultati = risultati.filter(p => p.daRiordinare)
        }
    }

    return {
      success: true,
      data: risultati,
      totale: risultati.length
    }
  } catch (error) {
    console.error('Errore nel recupero prodotti:', error)
    return {
      success: false,
      error: 'Errore nel recupero dei prodotti'
    }
  }
}

// Registra vendita con conversioni
export async function registraVenditaUnificata(prodottoId: number, quantita: number) {
  const session = await getServerSession(authOptions)
  if (!session) {
    throw new Error('Non autorizzato')
  }

  if (!prodottoId || !quantita || quantita <= 0) {
    return {
      success: false,
      error: 'Dati non validi'
    }
  }

  try {
    await prisma.$executeRaw`
      SELECT registra_vendita_unificata(${prodottoId}::integer, ${quantita}::decimal)
    `

    const prodottoAggiornato = await prisma.prodotto.findUnique({
      where: { id: prodottoId },
      include: { inventario: true }
    })

    revalidatePath('/magazzino')
    revalidatePath('/menu')

    return {
      success: true,
      message: 'Vendita registrata con successo',
      giacenzaAttuale: prodottoAggiornato?.inventario?.giacenzaAttuale || 0
    }
  } catch (error) {
    console.error('Errore registrazione vendita:', error)
    return {
      success: false,
      error: 'Errore nella registrazione della vendita'
    }
  }
}

// Aggiorna viste materializzate
export async function refreshVisteProdotti() {
  const session = await getServerSession(authOptions)
  if (!session || !['ADMIN', 'MANAGER'].includes(session.user.ruolo)) {
    throw new Error('Non autorizzato')
  }

  try {
    await prisma.$executeRaw`SELECT refresh_viste_prodotti()`
    
    revalidatePath('/magazzino')
    revalidatePath('/menu')

    return {
      success: true,
      message: 'Viste prodotti aggiornate con successo',
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    console.error('Errore refresh viste:', error)
    return {
      success: false,
      error: 'Errore nell\'aggiornamento delle viste'
    }
  }
}

// Genera report
export async function generaReportProdotti(tipo: 'riordino' | 'valore-magazzino' | 'margini' | 'rotazione') {
  const session = await getServerSession(authOptions)
  if (!session || !['ADMIN', 'MANAGER'].includes(session.user.ruolo)) {
    throw new Error('Non autorizzato')
  }

  try {
    let report: any

    switch (tipo) {
      case 'riordino':
        const prodottiDaRiordinare = await prisma.$queryRaw`
          SELECT 
            p.id,
            p.codice,
            p.nome,
            p.categoria,
            p.fornitore_nome,
            p.codice_fornitore,
            p.giacenza_attuale,
            p.giacenza_minima,
            p.punto_riordino,
            (p.punto_riordino - p.giacenza_attuale) AS quantita_suggerita,
            p.prezzo_acquisto,
            (p.punto_riordino - p.giacenza_attuale) * p.prezzo_acquisto AS costo_riordino
          FROM vista_prodotti_magazzino p
          WHERE p.da_riordinare = true
          ORDER BY (p.giacenza_attuale / NULLIF(p.giacenza_minima, 0)) ASC
        `

        report = {
          tipo: 'riordino',
          data: new Date().toISOString(),
          totale_prodotti: prodottiDaRiordinare.length,
          costo_totale_stimato: prodottiDaRiordinare.reduce((sum: number, p: any) => 
            sum + (p.costo_riordino || 0), 0
          ),
          prodotti: prodottiDaRiordinare
        }
        break

      case 'valore-magazzino':
        const valorePerCategoria = await prisma.$queryRaw`
          SELECT 
            categoria,
            COUNT(*) AS numero_prodotti,
            SUM(giacenza_attuale) AS totale_pezzi,
            SUM(valore_giacenza) AS valore_totale
          FROM vista_prodotti_magazzino
          WHERE giacenza_attuale > 0
          GROUP BY categoria
          ORDER BY valore_totale DESC
        `

        const valoreTotale = await prisma.$queryRaw`
          SELECT SUM(valore_giacenza) AS valore_totale_magazzino
          FROM vista_prodotti_magazzino
          WHERE giacenza_attuale > 0
        `

        report = {
          tipo: 'valore-magazzino',
          data: new Date().toISOString(),
          valore_totale_magazzino: valoreTotale[0]?.valore_totale_magazzino || 0,
          dettaglio_categorie: valorePerCategoria
        }
        break

      case 'margini':
        const marginiPerCategoria = await prisma.$queryRaw`
          SELECT 
            categoria,
            categoria_menu,
            COUNT(*) AS numero_prodotti,
            AVG(prezzo_vendita)::decimal(10,2) AS prezzo_medio,
            AVG(margine_unitario)::decimal(10,2) AS margine_medio,
            AVG(margine_percentuale)::decimal(5,2) AS margine_percentuale_medio,
            MIN(margine_percentuale)::decimal(5,2) AS margine_min,
            MAX(margine_percentuale)::decimal(5,2) AS margine_max
          FROM vista_prodotti_menu
          GROUP BY categoria, categoria_menu
          ORDER BY margine_percentuale_medio DESC
        `

        report = {
          tipo: 'margini',
          data: new Date().toISOString(),
          margini_per_categoria: marginiPerCategoria
        }
        break

      case 'rotazione':
        const rotazione = await prisma.$queryRaw`
          WITH vendite_mensili AS (
            SELECT 
              m."inventarioId",
              SUM(CASE WHEN m.tipo = 'SCARICO' THEN m.quantita ELSE 0 END) AS quantita_venduta,
              COUNT(CASE WHEN m.tipo = 'SCARICO' THEN 1 END) AS numero_vendite
            FROM "MovimentoInventario" m
            WHERE m."dataMovimento" >= CURRENT_DATE - INTERVAL '30 days'
              AND m.tipo = 'SCARICO'
            GROUP BY m."inventarioId"
          )
          SELECT 
            p.id,
            p.nome,
            p.categoria,
            i."giacenzaAttuale" AS giacenza_attuale,
            COALESCE(v.quantita_venduta, 0) AS venduto_30gg,
            COALESCE(v.numero_vendite, 0) AS num_vendite_30gg,
            CASE 
              WHEN v.quantita_venduta > 0 AND i."giacenzaAttuale" > 0 THEN
                (i."giacenzaAttuale" / (v.quantita_venduta / 30))::decimal(10,1)
              ELSE NULL
            END AS giorni_copertura,
            CASE
              WHEN v.quantita_venduta > 0 THEN 'ALTA'
              WHEN v.numero_vendite > 0 THEN 'MEDIA'
              ELSE 'BASSA'
            END AS rotazione
          FROM "Prodotto" p
          JOIN "Inventario" i ON p.id = i."prodottoId"
          LEFT JOIN vendite_mensili v ON i.id = v."inventarioId"
          WHERE p."isDeleted" = false
            AND i."giacenzaAttuale" > 0
          ORDER BY COALESCE(v.quantita_venduta, 0) DESC
        `

        report = {
          tipo: 'rotazione',
          data: new Date().toISOString(),
          periodo: 'ultimi 30 giorni',
          prodotti: rotazione
        }
        break
    }

    return {
      success: true,
      report
    }
  } catch (error) {
    console.error('Errore generazione report:', error)
    return {
      success: false,
      error: 'Errore nella generazione del report'
    }
  }
}

// Ottieni categorie uniche
export async function getCategorieUniche(vista: 'magazzino' | 'menu' = 'magazzino') {
  const session = await getServerSession(authOptions)
  if (!session) {
    throw new Error('Non autorizzato')
  }

  try {
    if (vista === 'menu') {
      const categorie = await prisma.$queryRaw<{categoria: string}[]>`
        SELECT DISTINCT COALESCE(categoria_menu, categoria) as categoria
        FROM vista_prodotti_menu
        WHERE categoria IS NOT NULL
        ORDER BY categoria
      `
      return categorie.map(c => c.categoria)
    } else {
      const categorie = await prisma.$queryRaw<{categoria: string}[]>`
        SELECT DISTINCT categoria
        FROM vista_prodotti_magazzino
        WHERE categoria IS NOT NULL
        ORDER BY categoria
      `
      return categorie.map(c => c.categoria)
    }
  } catch (error) {
    console.error('Errore recupero categorie:', error)
    return []
  }
}

// Auto-fix wrappers for Decimal serialization - apply the fix automatically
export const getProdottiUnificatiFixed = quickFixDecimals(getProdottiUnificati);
export const registraVenditaUnificataFixed = quickFixDecimals(registraVenditaUnificata);
export const generaReportProdottiFixed = quickFixDecimals(generaReportProdotti);
export const getCategorieUnicheFixed = quickFixDecimals(getCategorieUniche);