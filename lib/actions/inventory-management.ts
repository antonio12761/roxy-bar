"use server";

import { prisma } from "@/lib/db";
import { sseService } from "@/lib/sse/sse-service";

interface UpdateInventoryItem {
  prodottoId: number;
  quantita: number;
}

/**
 * Aggiorna l'inventario disponibile dopo la creazione di un ordine
 * Scala le quantità disponibili in base ai prodotti ordinati
 */
export async function updateInventoryAfterOrder(
  items: UpdateInventoryItem[], 
  ordinazioneId: string,
  userId: string,
  userName: string
) {
  try {
    const results = await prisma.$transaction(async (tx) => {
      const updatedProducts = [];
      const outOfStockProducts = [];

      for (const item of items) {
        // Verifica se esiste già un record in InventarioEsaurito
        let inventario = await tx.inventarioEsaurito.findUnique({
          where: { prodottoId: item.prodottoId }
        });

        if (!inventario) {
          // Se non esiste, cerchiamo in Inventario per la quantità iniziale
          const inventarioBase = await tx.inventario.findUnique({
            where: { prodottoId: item.prodottoId }
          });

          if (inventarioBase && inventarioBase.giacenzaAttuale) {
            // Crea il record in InventarioEsaurito con la quantità iniziale
            inventario = await tx.inventarioEsaurito.create({
              data: {
                prodottoId: item.prodottoId,
                quantitaDisponibile: Math.floor(Number(inventarioBase.giacenzaAttuale)),
                aggiornatoDa: userId,
                aggiornatoDaNome: userName,
                note: "Inizializzazione inventario"
              }
            });
          }
        }

        if (inventario) {
          // Scala la quantità ordinata
          const nuovaQuantita = Math.max(0, inventario.quantitaDisponibile - item.quantita);
          
          const updated = await tx.inventarioEsaurito.update({
            where: { id: inventario.id },
            data: {
              quantitaDisponibile: nuovaQuantita,
              ultimoAggiornamento: new Date(),
              aggiornatoDa: userId,
              aggiornatoDaNome: userName,
              note: `Scalato per ordine ${ordinazioneId}`
            }
          });

          updatedProducts.push({
            prodottoId: item.prodottoId,
            quantitaPrecedente: inventario.quantitaDisponibile,
            quantitaNuova: nuovaQuantita,
            quantitaScalata: item.quantita
          });

          // Se il prodotto è esaurito, lo aggiungiamo alla lista
          if (nuovaQuantita === 0) {
            const prodotto = await tx.prodotto.findUnique({
              where: { id: item.prodottoId },
              select: { nome: true }
            });

            outOfStockProducts.push({
              prodottoId: item.prodottoId,
              nome: prodotto?.nome || "Prodotto sconosciuto"
            });

            // Aggiorna anche il flag terminato nel prodotto
            await tx.prodotto.update({
              where: { id: item.prodottoId },
              data: { terminato: true }
            });
          }
        }
      }

      return { updatedProducts, outOfStockProducts };
    });

    // Emit SSE events per prodotti esauriti
    if (results.outOfStockProducts.length > 0) {
      for (const product of results.outOfStockProducts) {
        sseService.emit('product:out-of-stock', {
          productId: product.prodottoId,
          productName: product.nome,
          markedBy: userName,
          affectedOrdersCount: 0,
          timestamp: new Date().toISOString()
        }, { 
          broadcast: true,
          skipRateLimit: true
        });
      }
    }

    // Emit inventory update event
    if (results.updatedProducts.length > 0) {
      sseService.emit('inventory:updated', {
        productId: results.updatedProducts[0].prodottoId,
        productName: 'Updated Product',
        availableQuantity: results.updatedProducts[0].quantitaNuova,
        updatedBy: userName,
        timestamp: new Date().toISOString()
      }, {
        broadcast: true,
        skipRateLimit: true
      });
    }

    return { success: true, results };
  } catch (error) {
    console.error("[updateInventoryAfterOrder] Errore:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Errore aggiornamento inventario" 
    };
  }
}

/**
 * Ripristina l'inventario quando un ordine viene annullato
 */
export async function restoreInventoryAfterCancellation(
  items: UpdateInventoryItem[],
  ordinazioneId: string,
  userId: string,
  userName: string
) {
  try {
    const results = await prisma.$transaction(async (tx) => {
      const restoredProducts = [];

      for (const item of items) {
        let inventario = await tx.inventarioEsaurito.findUnique({
          where: { prodottoId: item.prodottoId }
        });

        if (inventario) {
          // Ripristina la quantità
          const nuovaQuantita = inventario.quantitaDisponibile + item.quantita;
          
          await tx.inventarioEsaurito.update({
            where: { id: inventario.id },
            data: {
              quantitaDisponibile: nuovaQuantita,
              ultimoAggiornamento: new Date(),
              aggiornatoDa: userId,
              aggiornatoDaNome: userName,
              note: `Ripristinato per annullamento ordine ${ordinazioneId}`
            }
          });

          // Se il prodotto era terminato e ora ha disponibilità, aggiorna il flag
          if (inventario.quantitaDisponibile === 0 && nuovaQuantita > 0) {
            await tx.prodotto.update({
              where: { id: item.prodottoId },
              data: { terminato: false }
            });
          }

          restoredProducts.push({
            prodottoId: item.prodottoId,
            quantitaPrecedente: inventario.quantitaDisponibile,
            quantitaNuova: nuovaQuantita,
            quantitaRipristinata: item.quantita
          });
        }
      }

      return { restoredProducts };
    });

    // Emit inventory restore event
    if (results.restoredProducts.length > 0) {
      sseService.emit('inventory:reset', {
        productId: results.restoredProducts[0].prodottoId,
        productName: 'Restored Product',
        resetBy: userName,
        timestamp: new Date().toISOString()
      }, {
        broadcast: true,
        skipRateLimit: true
      });
    }

    return { success: true, results };
  } catch (error) {
    console.error("[restoreInventoryAfterCancellation] Errore:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Errore ripristino inventario" 
    };
  }
}

/**
 * Verifica la disponibilità di prodotti prima di creare un ordine
 */
export async function checkProductsAvailability(items: UpdateInventoryItem[]) {
  try {
    const unavailableProducts = [];

    for (const item of items) {
      const inventario = await prisma.inventarioEsaurito.findUnique({
        where: { prodottoId: item.prodottoId },
        include: { Prodotto: true }
      });

      if (inventario && inventario.quantitaDisponibile < item.quantita) {
        unavailableProducts.push({
          prodottoId: item.prodottoId,
          nome: inventario.Prodotto.nome,
          quantitaRichiesta: item.quantita,
          quantitaDisponibile: inventario.quantitaDisponibile
        });
      }
    }

    return {
      success: true,
      available: unavailableProducts.length === 0,
      unavailableProducts
    };
  } catch (error) {
    console.error("[checkProductsAvailability] Errore:", error);
    return {
      success: false,
      available: true, // In caso di errore, permettiamo l'ordine
      error: error instanceof Error ? error.message : "Errore verifica disponibilità"
    };
  }
}

/**
 * Aggiorna manualmente la quantità disponibile di un prodotto
 */
export async function updateProductAvailability(
  prodottoId: number,
  quantitaDisponibile: number,
  userId: string,
  userName: string,
  note?: string
) {
  try {
    const inventario = await prisma.inventarioEsaurito.upsert({
      where: { prodottoId },
      create: {
        prodottoId,
        quantitaDisponibile,
        aggiornatoDa: userId,
        aggiornatoDaNome: userName,
        note: note || "Aggiornamento manuale quantità"
      },
      update: {
        quantitaDisponibile,
        ultimoAggiornamento: new Date(),
        aggiornatoDa: userId,
        aggiornatoDaNome: userName,
        note: note || "Aggiornamento manuale quantità"
      }
    });

    // Aggiorna flag terminato nel prodotto
    await prisma.prodotto.update({
      where: { id: prodottoId },
      data: { terminato: quantitaDisponibile === 0 }
    });

    // Emit event
    sseService.emit('inventory:updated', {
      productId: prodottoId,
      productName: 'Product',
      availableQuantity: quantitaDisponibile,
      updatedBy: userName,
      timestamp: new Date().toISOString()
    }, {
      broadcast: true,
      skipRateLimit: true
    });

    return { success: true, inventario };
  } catch (error) {
    console.error("[updateProductAvailability] Errore:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Errore aggiornamento disponibilità"
    };
  }
}