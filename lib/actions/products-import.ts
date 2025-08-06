'use server'

import { prisma } from '@/lib/db'
import * as XLSX from 'xlsx'
import { revalidatePath } from 'next/cache'

interface ProdottoExcel {
  PRODOTTO: string
  PREZZO: number
  CATEGORIA: string
}

export async function importProductsFromExcel(fileBuffer: ArrayBuffer) {
  try {
    // Parse Excel file
    const workbook = XLSX.read(fileBuffer, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    
    // Convert to JSON
    const prodottiExcel: ProdottoExcel[] = XLSX.utils.sheet_to_json(worksheet)
    
    // Filter valid rows
    const prodottiValidi = prodottiExcel.filter(p => 
      p.PRODOTTO && 
      p.PREZZO !== undefined && 
      p.PREZZO > 0 && 
      p.CATEGORIA
    )
    
    let prodottiCreati = 0
    let prodottiAggiornati = 0
    let errori = 0
    const errorDetails: string[] = []
    
    // Process each product
    for (const prodExcel of prodottiValidi) {
      try {
        const nomeProdotto = prodExcel.PRODOTTO.trim()
        const categoria = prodExcel.CATEGORIA.trim()
        const prezzo = Number(prodExcel.PREZZO)
        
        // Check if product exists
        const prodottoEsistente = await prisma.prodotto.findFirst({
          where: { 
            nome: nomeProdotto,
            isDeleted: false
          }
        })
        
        if (prodottoEsistente) {
          // Update existing product
          await prisma.prodotto.update({
            where: { id: prodottoEsistente.id },
            data: {
              prezzo: prezzo,
              categoria: categoria,
              updatedAt: new Date()
            }
          })
          prodottiAggiornati++
        } else {
          // Create new product
          await prisma.prodotto.create({
            data: {
              nome: nomeProdotto,
              prezzo: prezzo,
              categoria: categoria,
              disponibile: true,
              isDeleted: false,
              updatedAt: new Date()
            }
          })
          prodottiCreati++
        }
        
      } catch (error) {
        errori++
        errorDetails.push(`Errore per prodotto ${prodExcel.PRODOTTO}: ${error}`)
        console.error(`Errore per prodotto ${prodExcel.PRODOTTO}:`, error)
      }
    }
    
    revalidatePath('/dashboard/products')
    
    return {
      success: true,
      prodottiCreati,
      prodottiAggiornati,
      errori,
      totaleProcessati: prodottiValidi.length,
      errorDetails: errorDetails.length > 0 ? errorDetails : undefined
    }
    
  } catch (error) {
    console.error('Errore durante l\'importazione:', error)
    return {
      success: false,
      error: 'Errore durante l\'importazione del file Excel',
      details: error instanceof Error ? error.message : 'Errore sconosciuto'
    }
  }
}

export async function deleteAllProducts() {
  try {
    // Soft delete all products
    const result = await prisma.prodotto.updateMany({
      where: {
        isDeleted: false
      },
      data: {
        isDeleted: true,
        updatedAt: new Date()
      }
    })
    
    revalidatePath('/dashboard/products')
    
    return {
      success: true,
      deletedCount: result.count,
      message: `${result.count} prodotti eliminati con successo`
    }
  } catch (error) {
    console.error('Errore durante l\'eliminazione dei prodotti:', error)
    return {
      success: false,
      error: 'Errore durante l\'eliminazione dei prodotti',
      details: error instanceof Error ? error.message : 'Errore sconosciuto'
    }
  }
}

export async function getProductsStats() {
  try {
    const totalProducts = await prisma.prodotto.count({
      where: { isDeleted: false }
    })
    
    const productsByCategory = await prisma.prodotto.groupBy({
      by: ['categoria'],
      where: { isDeleted: false },
      _count: {
        id: true
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      }
    })
    
    const availableProducts = await prisma.prodotto.count({
      where: { 
        isDeleted: false,
        disponibile: true
      }
    })
    
    const unavailableProducts = await prisma.prodotto.count({
      where: { 
        isDeleted: false,
        disponibile: false
      }
    })
    
    return {
      success: true,
      totalProducts,
      availableProducts,
      unavailableProducts,
      productsByCategory: productsByCategory.map(cat => ({
        categoria: cat.categoria,
        count: cat._count.id
      }))
    }
  } catch (error) {
    console.error('Errore nel recupero delle statistiche:', error)
    return {
      success: false,
      error: 'Errore nel recupero delle statistiche'
    }
  }
}

export async function getAllProducts() {
  try {
    const products = await prisma.prodotto.findMany({
      where: { isDeleted: false },
      orderBy: [
        { categoria: 'asc' },
        { nome: 'asc' }
      ],
      select: {
        id: true,
        nome: true,
        prezzo: true,
        categoria: true,
        disponibile: true,
        terminato: true,
        postazione: true,
        createdAt: true,
        updatedAt: true,
        requiresGlasses: true
      }
    })
    
    return {
      success: true,
      products
    }
  } catch (error) {
    console.error('Errore nel recupero dei prodotti:', error)
    return {
      success: false,
      error: 'Errore nel recupero dei prodotti',
      products: []
    }
  }
}

export async function markBeersAsRequiringGlasses() {
  try {
    // Update all beers to require glasses
    const result = await prisma.prodotto.updateMany({
      where: {
        isDeleted: false,
        categoria: {
          in: ['Birra', 'Birre', 'BIRRA', 'BIRRE', 'Beer', 'BEER']
        }
      },
      data: {
        requiresGlasses: true,
        updatedAt: new Date()
      }
    })
    
    revalidatePath('/dashboard/products')
    
    return {
      success: true,
      updatedCount: result.count,
      message: `${result.count} birre marcate con bicchiere richiesto`
    }
  } catch (error) {
    console.error('Errore durante l\'aggiornamento delle birre:', error)
    return {
      success: false,
      error: 'Errore durante l\'aggiornamento delle birre',
      details: error instanceof Error ? error.message : 'Errore sconosciuto'
    }
  }
}