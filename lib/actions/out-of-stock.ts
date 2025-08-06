"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-multi-tenant";
import { revalidatePath } from "next/cache";
import { sseService } from "@/lib/sse/sse-service";
import { serializeDecimalData } from "@/lib/utils/decimal-serializer";
import { nanoid } from "nanoid";
import { Prisma } from "@prisma/client";
import { updateInventarioEsaurito, getInventarioEsauritoMultiplo } from "./inventario-esaurito";

// Non più necessario con le nuove tabelle

export async function splitOrderForOutOfStock(
  orderId: string,
  itemId: string,
  outOfStockQuantity: number
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Non autenticato" };
    }

    const result = await prisma.$transaction(async (tx) => {
      // Get the original order with all items
      const originalOrder = await tx.ordinazione.findUnique({
        where: { id: orderId },
        include: {
          RigaOrdinazione: {
            include: {
              Prodotto: true
            }
          },
          Tavolo: true,
          Cliente: true,
          User: true
        }
      });

      if (!originalOrder) {
        throw new Error('Ordine non trovato');
      }

      // Find the specific item
      const targetItem = originalOrder.RigaOrdinazione.find(r => r.id === itemId);
      if (!targetItem) {
        throw new Error('Prodotto non trovato nell\'ordine');
      }

      // If the entire quantity is out of stock
      if (outOfStockQuantity >= targetItem.quantita) {
        // Create new order for out-of-stock items
        const newOrderId = nanoid();
        const outOfStockOrder = await tx.ordinazione.create({
          data: {
            id: newOrderId,
            tavoloId: originalOrder.tavoloId,
            clienteId: originalOrder.clienteId,
            cameriereId: originalOrder.cameriereId,
            stato: 'ORDINATO_ESAURITO' as any,
            tipo: originalOrder.tipo,
            totale: targetItem.prezzo.mul(targetItem.quantita),
            note: `Prodotti esauriti da ordine #${originalOrder.numero}`,
            nomeCliente: originalOrder.nomeCliente,
            statoPagamento: originalOrder.statoPagamento,
            updatedAt: new Date()
          }
        });

        // Move item to out-of-stock order
        await tx.rigaOrdinazione.update({
          where: { id: itemId },
          data: { 
            ordinazioneId: newOrderId,
            stato: 'ANNULLATO' as any
          }
        });

        // Update original order total
        const remainingItems = await tx.rigaOrdinazione.findMany({
          where: { ordinazioneId: orderId }
        });

        const newTotal = remainingItems.reduce((sum, item) => 
          sum.add(item.prezzo.mul(item.quantita)), 
          new Prisma.Decimal(0)
        );

        await tx.ordinazione.update({
          where: { id: orderId },
          data: { totale: newTotal }
        });

        return {
          originalOrderId: orderId,
          outOfStockOrderId: newOrderId,
          outOfStockOrderNumber: outOfStockOrder.numero
        };
      }

      // Partial out of stock - need to split the item
      const newOrderId = nanoid();
      const remainingQuantity = targetItem.quantita - outOfStockQuantity;

      // Create new order for out-of-stock items
      const outOfStockOrder = await tx.ordinazione.create({
        data: {
          id: newOrderId,
          tavoloId: originalOrder.tavoloId,
          clienteId: originalOrder.clienteId,
          cameriereId: originalOrder.cameriereId,
          stato: 'ORDINATO_ESAURITO' as any,
          tipo: originalOrder.tipo,
          totale: targetItem.prezzo.mul(outOfStockQuantity),
          note: `Prodotti esauriti da ordine #${originalOrder.numero}`,
          nomeCliente: originalOrder.nomeCliente,
          statoPagamento: originalOrder.statoPagamento,
          updatedAt: new Date()
        }
      });

      // Create item in out-of-stock order
      await tx.rigaOrdinazione.create({
        data: {
          id: nanoid(),
          ordinazioneId: newOrderId,
          prodottoId: targetItem.prodottoId,
          quantita: outOfStockQuantity,
          prezzo: targetItem.prezzo,
          stato: 'ANNULLATO' as any,
          postazione: targetItem.postazione,
          note: 'Prodotto esaurito',
          clienteOrdinanteId: targetItem.clienteOrdinanteId,
          clienteBeneficiarioId: targetItem.clienteBeneficiarioId,
          updatedAt: new Date()
        }
      });

      // Update original item quantity
      await tx.rigaOrdinazione.update({
        where: { id: itemId },
        data: { quantita: remainingQuantity }
      });

      // Recalculate original order total
      const updatedItems = await tx.rigaOrdinazione.findMany({
        where: { ordinazioneId: orderId }
      });

      const newTotal = updatedItems.reduce((sum, item) => 
        sum.add(item.prezzo.mul(item.quantita)), 
        new Prisma.Decimal(0)
      );

      await tx.ordinazione.update({
        where: { id: orderId },
        data: { totale: newTotal }
      });

      return {
        originalOrderId: orderId,
        outOfStockOrderId: newOrderId,
        outOfStockOrderNumber: outOfStockOrder.numero
      };
    }, {
      isolationLevel: 'Serializable',
      timeout: 10000
    });

    // Broadcast updates
    sseService.emit('order:out-of-stock', {
      originalOrderId: result.originalOrderId,
      originalOrderNumber: 0, // We don't have this info here
      newOrderId: result.outOfStockOrderId,
      newOrderNumber: result.outOfStockOrderNumber || 0,
      outOfStockProduct: '',
      outOfStockItems: [],
      waiterId: user.id,
      timestamp: new Date().toISOString()
    }, {
      broadcast: true,
      skipRateLimit: true,
      tenantId: user.tenantId
    });

    // Revalidate paths
    revalidatePath('/prepara');
    revalidatePath('/cameriere');

    return {
      success: true,
      message: 'Ordine diviso con successo',
      originalOrderId: result.originalOrderId,
      outOfStockOrderId: result.outOfStockOrderId
    };
  } catch (error) {
    console.error('Error splitting order for out of stock:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Errore durante la divisione dell\'ordine'
    };
  }
}

export async function markItemAsOutOfStock(
  itemId: string,
  quantity: number
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Non autenticato" };
    }

    const item = await prisma.rigaOrdinazione.findUnique({
      where: { id: itemId },
      include: {
        Ordinazione: true,
        Prodotto: true
      }
    });

    if (!item) {
      return {
        success: false,
        error: 'Prodotto non trovato'
      };
    }

    // If quantity is 1 or matches the full quantity, process the entire item
    if (quantity === 1 || quantity >= item.quantita) {
      return await splitOrderForOutOfStock(
        item.ordinazioneId,
        itemId,
        item.quantita
      );
    }

    // Otherwise split the order with partial quantity
    return await splitOrderForOutOfStock(
      item.ordinazioneId,
      itemId,
      quantity
    );
  } catch (error) {
    console.error('Error marking item as out of stock:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Errore durante la segnalazione del prodotto esaurito'
    };
  }
}

export async function markMultipleProductsAsOutOfStock(
  products: Array<{
    productId: number;
    orderItemId: string;
    outOfStockQuantity: number;
    availableQuantity?: number; // Quantità disponibile secondo l'operatore
  }>,
  splitOrder: boolean = true
) {
  console.log('[markMultipleProductsAsOutOfStock] Called with:', { products, splitOrder });
  
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Non autenticato" };
    }

    // Ottieni tutti gli order items
    const orderItems = await prisma.rigaOrdinazione.findMany({
      where: {
        id: { in: products.map(p => p.orderItemId) }
      },
      include: {
        Ordinazione: {
          include: {
            Tavolo: true,
            RigaOrdinazione: {
              include: {
                Prodotto: true
              }
            }
          }
        },
        Prodotto: true
      }
    });

    if (orderItems.length === 0) {
      return { success: false, error: "Nessun prodotto trovato" };
    }

    // Assumiamo che tutti i prodotti siano dello stesso ordine
    const orderId = orderItems[0].ordinazioneId;
    const order = orderItems[0].Ordinazione;
    
    // Ottieni l'inventario attuale per tutti i prodotti
    const productIds = products.map(p => p.productId);
    const inventarioMap = await getInventarioEsauritoMultiplo(productIds);

    // Calcola se ci sono prodotti disponibili rimanenti nell'ordine
    const allOrderItems = order.RigaOrdinazione;
    const outOfStockItemIds = new Set(products.map(p => p.orderItemId));
    const availableItems = allOrderItems.filter(item => {
      if (outOfStockItemIds.has(item.id)) {
        const product = products.find(p => p.orderItemId === item.id);
        return product && product.outOfStockQuantity < item.quantita;
      }
      return true;
    });

    const result = await prisma.$transaction(async (tx) => {
      let outOfStockOrderId: string;
      let originalOrderId: string | null = null;
      let ordineEsauritoId: string;
      
      // Aggiorna l'inventario per ogni prodotto in base alla quantità selezionata come esaurita
      for (const product of products) {
        const item = orderItems.find(i => i.id === product.orderItemId);
        if (!item) continue;
        
        // IMPORTANTE: Quando un prodotto va in esaurito per un ordine specifico,
        // le quantità già ordinate sono preservate per quel tavolo.
        // Impostiamo l'inventario a 0 per impedire nuovi ordini da altri tavoli,
        // ma le quantità già ordinate da questo tavolo sono già state riservate.
        
        console.log(`[Inventory Update] Product ${item.Prodotto.nome}: totale ordinate=${item.quantita}, esaurite=${product.outOfStockQuantity}`);
        console.log(`[Inventory Update] Impostando inventario a 0 per impedire nuovi ordini. Le quantità ordinate da tavolo ${order.Tavolo?.numero} sono preservate.`);
        
        // Imposta l'inventario a 0 per impedire nuovi ordini
        // Le quantità già ordinate da questo tavolo rimangono riservate
        await updateInventarioEsaurito(
          product.productId,
          0,
          `Esaurito durante ordine #${order.numero} - ${item.quantita} unità riservate per tavolo ${order.Tavolo?.numero}`
        );
      }

      if (!splitOrder || availableItems.length === 0) {
        // Blocca l'intero ordine - aggiorna l'ordine esistente
        await tx.ordinazione.update({
          where: { id: orderId },
          data: {
            stato: 'ORDINATO_ESAURITO' as any
          }
        });
        outOfStockOrderId = orderId;
        
        // Crea record OrdineEsaurito per l'ordine bloccato
        const ordineEsaurito = await tx.ordineEsaurito.create({
          data: {
            ordinazioneId: orderId,
            tavoloId: order.tavoloId,
            stato: 'ATTIVO',
            splitOrder: false
          }
        });
        ordineEsauritoId = ordineEsaurito.id;
      } else {
        // Dividi l'ordine - mantieni l'ordine originale e crea uno nuovo per i prodotti esauriti
        originalOrderId = orderId;
        
        // Aggiorna le quantità degli items originali basandosi sull'inventario
        for (const product of products) {
          const item = orderItems.find(i => i.id === product.orderItemId);
          if (!item) continue;
          
          // La quantità da spostare è quella specificata dall'utente nel selector
          const quantitaDaSpostare = product.outOfStockQuantity;
          const quantitaDaMantenere = item.quantita - quantitaDaSpostare;
          
          console.log(`[Split Order] Product ${item.Prodotto.nome}: totale=${item.quantita}, esaurite=${quantitaDaSpostare}, mantenere=${quantitaDaMantenere}`);
          
          if (quantitaDaMantenere > 0) {
            // Aggiorna la quantità nell'ordine originale
            await tx.rigaOrdinazione.update({
              where: { id: product.orderItemId },
              data: { quantita: quantitaDaMantenere }
            });
          } else {
            // Se non possiamo mantenere nulla, elimina dall'ordine originale
            await tx.rigaOrdinazione.delete({
              where: { id: product.orderItemId }
            });
          }
        }

        // Crea un nuovo ordine per i prodotti esauriti
        outOfStockOrderId = nanoid();
        const newOrder = await tx.ordinazione.create({
          data: {
            id: outOfStockOrderId,
            tavoloId: order.tavoloId,
            clienteId: order.clienteId,
            cameriereId: order.cameriereId,
            stato: 'ORDINATO_ESAURITO' as any,
            tipo: order.tipo,
            note: `Ordine diviso da #${order.numero}`,
            nomeCliente: order.nomeCliente,
            statoPagamento: 'NON_PAGATO',
            totale: 0,
            updatedAt: new Date()
          }
        });

        // Crea i nuovi items per i prodotti esauriti
        for (const product of products) {
          const item = orderItems.find(i => i.id === product.orderItemId);
          if (item && product.outOfStockQuantity > 0) {
            await tx.rigaOrdinazione.create({
              data: {
                id: nanoid(),
                ordinazioneId: outOfStockOrderId,
                prodottoId: product.productId,
                quantita: product.outOfStockQuantity,
                prezzo: item.prezzo,
                stato: 'INSERITO',
                postazione: item.postazione,
                note: 'Prodotto esaurito',
                clienteOrdinanteId: item.clienteOrdinanteId,
                clienteBeneficiarioId: item.clienteBeneficiarioId,
                updatedAt: new Date()
              }
            });
          }
        }
        
        // Crea record OrdineEsaurito per il nuovo ordine
        const ordineEsaurito = await tx.ordineEsaurito.create({
          data: {
            ordinazioneId: outOfStockOrderId,
            originalOrdinazioneId: originalOrderId,
            tavoloId: order.tavoloId,
            stato: 'ATTIVO',
            splitOrder: true
          }
        });
        ordineEsauritoId = ordineEsaurito.id;
      }
      
      // Crea record ProdottoEsaurito per ogni prodotto
      for (const product of products) {
        const item = orderItems.find(i => i.id === product.orderItemId);
        if (item) {
          await tx.prodottoEsaurito.create({
            data: {
              ordineEsauritoId: ordineEsauritoId,
              prodottoId: product.productId,
              prodottoNome: item.Prodotto.nome,
              quantitaEsaurita: product.outOfStockQuantity,
              quantitaTotale: item.quantita
            }
          });
        }
      }

      // Recupera l'ordine esaurito con i prodotti per l'evento SSE
      const ordineEsaurito = await tx.ordineEsaurito.findUnique({
        where: { ordinazioneId: outOfStockOrderId },
        include: {
          Ordinazione: {
            include: {
              Tavolo: true
            }
          },
          ProdottiEsauriti: true
        }
      });

      if (ordineEsaurito) {
        // Emetti notifica
        await sseService.emit('order:esaurito:alert', {
          orderId: outOfStockOrderId,
          orderNumber: ordineEsaurito.Ordinazione.numero,
          tableNumber: ordineEsaurito.Ordinazione.Tavolo?.numero || 'N/A',
          products: ordineEsaurito.ProdottiEsauriti.map(p => ({
            name: p.prodottoNome,
            quantity: p.quantitaEsaurita
          })),
          timestamp: new Date().toISOString(),
          needsAttention: true,
          takenBy: null
        }, {
          broadcast: true,
          skipRateLimit: true,
          targetStations: ['CAMERIERE', 'PREPARA'],
          queueIfOffline: true
        });
      }

      return {
        originalOrderId,
        outOfStockOrderId,
        splitOrder
      };
    }, {
      timeout: 10000
    });

    return {
      success: true,
      message: `${products.length} prodotti segnati come esauriti`,
      ...result
    };
  } catch (error) {
    console.error("Errore marking multiple products out of stock:", error);
    return { success: false, error: "Errore nel segnare i prodotti come esauriti" };
  }
}

export async function markProductAsOutOfStockPartial(
  productId: number,
  orderItemId: string,
  outOfStockQuantity: number,
  splitOrder: boolean = true
) {
  console.log('[markProductAsOutOfStockPartial] Called with:', { productId, orderItemId, outOfStockQuantity, splitOrder });
  
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Non autenticato" };
    }

    // Get the specific order item
    const orderItem = await prisma.rigaOrdinazione.findUnique({
      where: { id: orderItemId },
      include: {
        Ordinazione: {
          include: {
            Tavolo: true,
            RigaOrdinazione: {
              include: {
                Prodotto: true
              }
            }
          }
        },
        Prodotto: true
      }
    });

    if (!orderItem) {
      return { success: false, error: "Prodotto non trovato nell'ordine" };
    }

    // Se la quantità esaurita è parziale, dividi l'item
    if (outOfStockQuantity < orderItem.quantita) {
      const remainingQuantity = orderItem.quantita - outOfStockQuantity;
      
      // Controlla se ci sono altri prodotti nell'ordine oltre a questo
      const otherItems = orderItem.Ordinazione.RigaOrdinazione.filter(
        (item: any) => item.id !== orderItemId && item.prodottoId !== productId
      );
      const hasOtherProducts = otherItems.length > 0;
      
      if (!splitOrder && hasOtherProducts) {
        // Se NON si vuole dividere e ci sono altri prodotti, blocca TUTTO l'ordine
        await prisma.$transaction(async (tx) => {
          // Marca l'intero ordine come ORDINATO_ESAURITO
          await tx.ordinazione.update({
            where: { id: orderItem.ordinazioneId },
            data: {
              stato: 'ORDINATO_ESAURITO' as any,
              note: `Ordine bloccato: ${outOfStockQuantity}x ${orderItem.Prodotto?.nome} esaurito`
            }
          });
        });
      } else {
        // Dividi l'ordine normalmente
        await prisma.$transaction(async (tx) => {
          // Aggiorna l'item originale con la quantità rimanente
          await tx.rigaOrdinazione.update({
            where: { id: orderItemId },
            data: { quantita: remainingQuantity }
          });
          
          // Crea un nuovo ordine per la quantità esaurita
          const newOrderId = nanoid();
          const newOrder = await tx.ordinazione.create({
            data: {
              id: newOrderId,
              tavoloId: orderItem.Ordinazione.tavoloId,
              clienteId: orderItem.Ordinazione.clienteId,
              cameriereId: orderItem.Ordinazione.cameriereId,
              stato: 'ORDINATO_ESAURITO' as any,
              tipo: orderItem.Ordinazione.tipo,
              note: `${outOfStockQuantity}x ${orderItem.Prodotto?.nome} esaurito da ordine #${orderItem.Ordinazione.numero}`,
              nomeCliente: orderItem.Ordinazione.nomeCliente,
              statoPagamento: 'NON_PAGATO',
              totale: 0,
              updatedAt: new Date()
            }
          });
          
          // Crea il nuovo item per la quantità esaurita
          await tx.rigaOrdinazione.create({
            data: {
              id: nanoid(),
              ordinazioneId: newOrderId,
              prodottoId: productId,
              quantita: outOfStockQuantity,
              prezzo: orderItem.prezzo,
              stato: 'INSERITO',
              postazione: orderItem.postazione,
              note: 'Prodotto esaurito',
              clienteOrdinanteId: orderItem.clienteOrdinanteId,
              clienteBeneficiarioId: orderItem.clienteBeneficiarioId,
              updatedAt: new Date()
            }
          });
        });
      }
      
      // Se tutta la quantità disponibile è esaurita, marca il prodotto come terminato
      if (outOfStockQuantity >= orderItem.quantita) {
        await prisma.prodotto.update({
          where: { id: productId },
          data: { 
            disponibile: false,
            terminato: true
          }
        });
        
        // Emetti evento di disponibilità prodotto
        sseService.emit('product:availability', {
          productId: productId,
          productName: orderItem.Prodotto?.nome,
          available: false,
          updatedBy: user.nome || 'Sistema',
          timestamp: new Date().toISOString()
        }, { 
          broadcast: true, 
          skipRateLimit: true,
          tenantId: user.tenantId,
          queueIfOffline: true
        });
      }
      
      // Emetti notifiche
      sseService.emit('order:esaurito:alert', {
        orderId: orderItem.ordinazioneId,
        orderNumber: orderItem.Ordinazione.numero,
        tableNumber: orderItem.Ordinazione.Tavolo?.numero || 'N/A',
        products: [{
          name: orderItem.Prodotto?.nome,
          quantity: outOfStockQuantity
        }],
        timestamp: new Date().toISOString(),
        needsAttention: true,
        takenBy: null
      }, {
        broadcast: true,
        skipRateLimit: true,
        targetStations: ['CAMERIERE', 'PREPARA'],
        queueIfOffline: true
      });
      
      return {
        success: true,
        message: `${outOfStockQuantity}x ${orderItem.Prodotto?.nome} segnato come esaurito`
      };
    } else {
      // Se tutta la quantità è esaurita, usa la funzione esistente
      return markProductAsOutOfStock(productId, [orderItemId], splitOrder);
    }
  } catch (error) {
    console.error("Errore marking partial product out of stock:", error);
    return { success: false, error: "Errore nel segnare il prodotto come esaurito" };
  }
}

export async function markProductAsOutOfStock(productId: number, orderItemIds: string[], splitOrder: boolean = true) {
  console.log('[markProductAsOutOfStock] Called with:', { productId, orderItemIds, splitOrder });
  
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Non autenticato" };
    }

    // Store events to emit after transaction
    const eventsToEmit: Array<{ event: string; data: any; options: any }> = [];
    
    const result = await prisma.$transaction(async (tx) => {
      // 1. Get product info without marking it as unavailable permanently
      const product = await tx.prodotto.findUnique({
        where: { id: productId }
      });
      
      if (!product) {
        throw new Error('Prodotto non trovato');
      }

      // 2. Get all affected order items with their orders
      const affectedItems = await tx.rigaOrdinazione.findMany({
        where: {
          id: { in: orderItemIds },
          stato: { 
            notIn: ['ANNULLATO', 'CONSEGNATO'] 
          }
        },
        include: {
          Ordinazione: {
            include: {
              Tavolo: true,
              User: true,
              Cliente: true
            }
          },
          Prodotto: true
        }
      });

      // 3. Group items by order
      const orderGroups = affectedItems.reduce((acc, item) => {
        if (!acc[item.ordinazioneId]) {
          acc[item.ordinazioneId] = {
            order: item.Ordinazione,
            outOfStockItems: [],
            availableItems: []
          };
        }
        acc[item.ordinazioneId].outOfStockItems.push(item);
        return acc;
      }, {} as Record<string, any>);

      // 4. For each order, get all items and split them
      const splitOrders = [];
      for (const [orderId, group] of Object.entries(orderGroups)) {
        // Get all items for this order (excluding already cancelled/delivered ones)
        const allOrderItems = await tx.rigaOrdinazione.findMany({
          where: {
            ordinazioneId: orderId,
            stato: { 
              notIn: ['ANNULLATO', 'CONSEGNATO'] 
            }
          },
          include: {
            Prodotto: true
          }
        });

        // Separate available items from out of stock items
        const outOfStockItemIds = group.outOfStockItems.map((item: any) => item.id);
        const availableItems = allOrderItems.filter(item => !outOfStockItemIds.includes(item.id));
        
        console.log(`[OUT-OF-STOCK] Order ${orderId}: Total items: ${allOrderItems.length}, Available: ${availableItems.length}, Out of stock: ${group.outOfStockItems.length}`);
        console.log(`[OUT-OF-STOCK] Out of stock item IDs:`, outOfStockItemIds);
        console.log(`[OUT-OF-STOCK] All order items:`, allOrderItems.map(item => ({ id: item.id, prodotto: item.Prodotto?.nome })));
        
        if (availableItems.length > 0 && group.outOfStockItems.length > 0) {
          // Caso 1: Ci sono sia prodotti disponibili che esauriti
          
          if (!splitOrder) {
            // Se NON si vuole dividere, blocca TUTTO l'ordine
            console.log(`[OUT-OF-STOCK] Blocking entire order ${orderId} due to out of stock items`);
            
            // Pulisci le note
            let cleanedNotes = group.order.note || '';
            cleanedNotes = cleanedNotes
              .replace(/\s*\|\s*Problema esaurito preso in carico da[^|]*/gi, '')
              .replace(/\s*\|\s*Sostituito con ordine[^|]*/gi, '')
              .replace(/\s*-\s*Tutti i prodotti esauriti[^|]*/gi, '')
              .replace(/\s*-\s*Prodotti esauriti gestiti[^|]*/gi, '')
              .replace(/\s*\|\s*Annullato da[^|]*/gi, '')
              .replace(/Ordine sostitutivo per #\d+[^|]*/gi, '')
              .trim();
            
            // Aggiorna l'intero ordine come ORDINATO_ESAURITO
            const blockedOrder = await tx.ordinazione.update({
              where: { id: orderId },
              data: {
                stato: 'ORDINATO_ESAURITO' as any,
                note: `${cleanedNotes}${cleanedNotes ? ' - ' : ''}Ordine bloccato: alcuni prodotti esauriti`.trim()
              },
              include: {
                Tavolo: true,
                User: true,
                Cliente: true,
                RigaOrdinazione: {
                  include: {
                    Prodotto: true
                  }
                }
              }
            });
            
            splitOrders.push({
              originalOrder: group.order,
              newOrder: blockedOrder,
              outOfStockItems: group.outOfStockItems,
              availableItems: availableItems
            });
            
            // Prepara notifica
            const eventData = {
              orderId: blockedOrder.id,
              orderNumber: blockedOrder.numero,
              tableNumber: blockedOrder.Tavolo?.numero || 'N/A',
              products: group.outOfStockItems.map((item: any) => ({
                name: item.Prodotto.nome,
                quantity: item.quantita
              })),
              timestamp: new Date().toISOString(),
              needsAttention: true,
              takenBy: null,
              blockedCompletely: true // Indica che l'ordine è completamente bloccato
            };
            
            eventsToEmit.push({
              event: 'order:esaurito:alert',
              data: eventData,
              options: {
                broadcast: true,
                skipRateLimit: true,
                tenantId: user.tenantId,
                targetStations: ['CAMERIERE', 'PREPARA'],
                queueIfOffline: true
              }
            });
            
            console.log(`[OUT-OF-STOCK] Entire order #${blockedOrder.numero} blocked`);
            
          } else {
            // Dividi l'ordine come prima
            const newOrderId = nanoid();
            const newOrder = await tx.ordinazione.create({
              data: {
                id: newOrderId,
                tavoloId: group.order.tavoloId,
                clienteId: group.order.clienteId,
                cameriereId: group.order.cameriereId,
                stato: 'ORDINATO_ESAURITO' as any, // Nuovo stato per prodotti esauriti
                tipo: group.order.tipo,
                note: `Prodotti esauriti dall'ordine #${group.order.numero}`,
                nomeCliente: group.order.nomeCliente,
                statoPagamento: 'NON_PAGATO',
                totale: 0,
                updatedAt: new Date()
              },
              include: {
                Tavolo: true,
                User: true,
                Cliente: true
              }
            });

            // Move out of stock items to new order
            await tx.rigaOrdinazione.updateMany({
              where: { 
                id: { in: outOfStockItemIds }
              },
              data: {
                ordinazioneId: newOrderId,
                stato: 'INSERITO'
              }
            });

            splitOrders.push({
              originalOrder: group.order,
              newOrder: newOrder,
              outOfStockItems: group.outOfStockItems,
              availableItems: availableItems
            });
            
            // Prepara i dati per l'evento di notifica anche per ordini divisi
            const eventData = {
              orderId: newOrder.id,
              orderNumber: newOrder.numero,
              tableNumber: newOrder.Tavolo?.numero || 'N/A',
              products: group.outOfStockItems.map((item: any) => ({
                name: item.Prodotto.nome,
                quantity: item.quantita
              })),
              timestamp: new Date().toISOString(),
              needsAttention: true,
              takenBy: null // Nessuno la sta gestendo
            };
            
            // Store event to emit after transaction
            eventsToEmit.push({
              event: 'order:esaurito:alert',
              data: eventData,
              options: {
                broadcast: true,
                skipRateLimit: true,
                tenantId: user.tenantId,
                targetStations: ['CAMERIERE', 'PREPARA'],
                queueIfOffline: true
              }
            });
            
            console.log(`[OUT-OF-STOCK] Alert notification queued for split order #${newOrder.numero}`);
          } // Fine else (split order)
        } else if (availableItems.length === 0 && group.outOfStockItems.length > 0) {
          // Caso 2: TUTTI i prodotti sono esauriti - cambia stato dell'ordine esistente
          console.log(`[OUT-OF-STOCK] All items out of stock for order ${orderId}, updating state to ORDINATO_ESAURITO`);
          
          // Pulisci COMPLETAMENTE le note rimuovendo TUTTE le informazioni di gestione precedente
          let cleanedNotes = group.order.note || '';
          // Rimuovi qualsiasi riferimento a gestioni precedenti
          cleanedNotes = cleanedNotes
            .replace(/\s*\|\s*Problema esaurito preso in carico da[^|]*/gi, '')
            .replace(/\s*\|\s*Sostituito con ordine[^|]*/gi, '')
            .replace(/\s*-\s*Tutti i prodotti esauriti[^|]*/gi, '')
            .replace(/\s*-\s*Prodotti esauriti gestiti[^|]*/gi, '')
            .replace(/\s*\|\s*Annullato da[^|]*/gi, '')
            .replace(/Ordine sostitutivo per #\d+[^|]*/gi, '')
            .trim();
          
          // Se dopo la pulizia rimangono solo spazi o caratteri speciali, pulisci tutto
          if (cleanedNotes.match(/^[\s\-\|]*$/)) {
            cleanedNotes = '';
          }
          
          // Estrai solo le informazioni del cliente se presenti
          const clientMatch = cleanedNotes.match(/Cliente:\s*([^-|]+)/i);
          if (clientMatch && !cleanedNotes.includes('Posti:')) {
            cleanedNotes = clientMatch[0].trim();
          }
          
          const completeOrder = await tx.ordinazione.update({
            where: { id: orderId },
            data: {
              stato: 'ORDINATO_ESAURITO' as any,
              note: `${cleanedNotes}${cleanedNotes ? ' - ' : ''}Tutti i prodotti esauriti`.trim()
            },
            include: {
              Tavolo: true,
              User: true,
              Cliente: true,
              RigaOrdinazione: {
                include: {
                  Prodotto: true
                }
              }
            }
          });

          splitOrders.push({
            originalOrder: group.order,
            newOrder: completeOrder, // Usa l'ordine completo
            outOfStockItems: group.outOfStockItems,
            availableItems: []
          });
          
          console.log(`[OUT-OF-STOCK] Order ${orderId} updated successfully to ORDINATO_ESAURITO`);
          console.log(`[OUT-OF-STOCK] Complete order number:`, completeOrder.numero);
          
          // Prepara i dati per l'evento (da emettere dopo la transazione)
          const eventData = {
            orderId: completeOrder.id,
            orderNumber: completeOrder.numero,
            tableNumber: completeOrder.Tavolo?.numero || 'N/A',
            products: group.outOfStockItems.map((item: any) => ({
              name: item.Prodotto.nome,
              quantity: item.quantita
            })),
            timestamp: new Date().toISOString(),
            needsAttention: true,
            takenBy: null // Nessuno ha ancora preso in carico
          };
          
          // Store event to emit after transaction
          eventsToEmit.push({
            event: 'order:esaurito:alert',
            data: eventData,
            options: {
              broadcast: true,
              skipRateLimit: true,
              tenantId: user.tenantId,
              targetStations: ['CAMERIERE', 'PREPARA'],
              queueIfOffline: true
            }
          });
        }
      }

      console.log(`[OUT-OF-STOCK] Transaction complete. Split orders:`, splitOrders.length);
      splitOrders.forEach(split => {
        console.log(`[OUT-OF-STOCK] Split order:`, {
          originalOrderId: split.originalOrder.id,
          newOrderId: split.newOrder.id,
          newOrderState: split.newOrder.stato,
          availableItems: split.availableItems.length,
          outOfStockItems: split.outOfStockItems.length
        });
      });
      
      return {
        product,
        splitOrders,
        affectedItems
      };
    }, {
      timeout: 10000, // Increase timeout to 10 seconds
      maxWait: 10000  // Maximum time to wait for a slot
    });

    // Emit stored events after transaction completes
    for (const storedEvent of eventsToEmit) {
      console.log(`[OUT-OF-STOCK] Emitting ${storedEvent.event} event`);
      sseService.emit(storedEvent.event as any, storedEvent.data, storedEvent.options);
      
      // Re-emit with delays for reconnecting clients
      if (storedEvent.event === 'order:esaurito:alert') {
        const delays = [500, 1500, 3000];
        delays.forEach(delay => {
          setTimeout(() => {
            console.log(`[OUT-OF-STOCK] Re-emitting ${storedEvent.event} after ${delay}ms`);
            sseService.emit(storedEvent.event as any, storedEvent.data, storedEvent.options);
          }, delay);
        });
      }
    }

    // 5. Emit notifications for each split order
    for (const split of result.splitOrders) {
      // Emit SSE event
      sseService.emit('order:out-of-stock', {
        originalOrderId: split.originalOrder.id,
        originalOrderNumber: split.originalOrder.numero,
        newOrderId: split.newOrder.id,
        newOrderNumber: split.newOrder.numero,
        tableNumber: split.originalOrder.Tavolo?.numero,
        waiterId: split.originalOrder.cameriereId,
        waiterName: split.originalOrder.User?.nome,
        outOfStockProduct: result.product.nome,
        outOfStockItems: split.outOfStockItems.map((item: any) => ({
          id: item.id,
          productName: item.Prodotto.nome,
          quantity: item.quantita
        })),
        timestamp: new Date().toISOString()
      }, {
        broadcast: true,
        skipRateLimit: true,
        tenantId: user.tenantId
      });
      
      // Notification already sent via order:esaurito:alert event above
      // No need for duplicate notification
      // The order:esaurito:alert event is handled by NotificationCenter component
    }

    // 6. Emit general product out of stock notification for these specific orders
    sseService.emit('product:out-of-stock', {
      productId: result.product.id,
      productName: result.product.nome,
      markedBy: user.nome,
      affectedOrdersCount: result.splitOrders.length,
      timestamp: new Date().toISOString()
    }, {
      broadcast: true,
      skipRateLimit: true,
      tenantId: user.tenantId
    });
    
    // Emit temporary unavailability notification
    sseService.emit('product:temporarily-unavailable', {
      productId: result.product.id,
      productName: result.product.nome,
      affectedOrders: result.splitOrders.map((s: any) => s.originalOrder.numero),
      updatedBy: user.nome || 'Sistema',
      timestamp: new Date().toISOString()
    }, {
      broadcast: true,
      skipRateLimit: true,
      tenantId: user.tenantId
    });
    
    // Marca il prodotto come non disponibile
    await prisma.prodotto.update({
      where: { id: productId },
      data: { 
        disponibile: false,
        terminato: true
      }
    });
    
    console.log('[OUT-OF-STOCK] Marking product as unavailable:', productId, result.product.nome);
    
    // Emetti evento SSE con multiple retry come fa il sistema degli ordini
    const eventData = {
      productId: result.product.id,
      productName: result.product.nome,
      available: false,
      updatedBy: user.nome || 'Sistema',
      timestamp: new Date().toISOString()
    };
    
    // Emit immediately with broadcast to all clients
    sseService.emit('product:availability', eventData, { 
      broadcast: true, 
      skipRateLimit: true,
      tenantId: user.tenantId,
      queueIfOffline: true
    });
    
    // Also emit with multiple delays to catch reconnecting clients
    const delays = [100, 250, 500, 1000, 2000];
    delays.forEach(delay => {
      setTimeout(() => {
        sseService.emit('product:availability', eventData, { 
          broadcast: true, 
          skipRateLimit: true,
          tenantId: user.tenantId
        });
      }, delay);
    });

    // Revalidate paths
    revalidatePath('/prepara');
    revalidatePath('/cameriere');
    revalidatePath('/supervisore');

    console.log('[OUT-OF-STOCK] Final success response:', {
      productName: result.product.nome,
      splitOrdersCount: result.splitOrders.length,
      message: `${result.product.nome} segnato come esaurito. ${result.splitOrders.length} ordini divisi.`
    });

    return {
      success: true,
      product: serializeDecimalData(result.product),
      splitOrders: serializeDecimalData(result.splitOrders),
      message: `${result.product.nome} segnato come esaurito. ${result.splitOrders.length} ordini divisi.`
    };
  } catch (error) {
    console.error("Errore marking product out of stock:", error);
    return { success: false, error: "Errore nel segnare il prodotto come esaurito" };
  }
}

export async function reactivateProductAfterOutOfStock(productId: number) {
  "use server";
  
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Non autenticato" };
    }
    
    // Riattiva il prodotto
    const product = await prisma.prodotto.update({
      where: { id: productId },
      data: {
        disponibile: true,
        terminato: false
      }
    });
    
    console.log('[REACTIVATE] Reactivating product:', productId, product.nome);
    
    // Emetti evento SSE con multiple retry
    const eventData = {
      productId: product.id,
      productName: product.nome,
      available: true,
      updatedBy: user.nome || 'Sistema',
      timestamp: new Date().toISOString()
    };
    
    // Emit immediately with broadcast to all clients
    sseService.emit('product:availability', eventData, {
      broadcast: true,
      skipRateLimit: true,
      tenantId: user.tenantId,
      queueIfOffline: true
    });
    
    // Also emit with multiple delays to catch reconnecting clients
    const delays = [100, 250, 500, 1000, 2000];
    delays.forEach(delay => {
      setTimeout(() => {
        sseService.emit('product:availability', eventData, {
          broadcast: true,
          skipRateLimit: true,
          tenantId: user.tenantId
        });
      }, delay);
    });
    
    revalidatePath('/cameriere');
    revalidatePath('/prepara');
    
    return { success: true, product };
  } catch (error) {
    console.error('Errore riattivazione prodotto:', error);
    return { success: false, error: 'Errore nella riattivazione del prodotto' };
  }
}

export async function handleOutOfStockResponse(
  waitingOrderId: string, 
  action: 'cancel' | 'substitute',
  substituteProducts?: Array<{ prodottoId: number; quantita: number; prezzo: number }>
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Non autenticato" };
    }

    if (action === 'cancel') {
      // Cancel the waiting order
      const order = await prisma.ordinazione.update({
        where: { id: waitingOrderId },
        data: { stato: 'ANNULLATO' },
        include: {
          RigaOrdinazione: {
            include: { Prodotto: true }
          },
          Tavolo: true
        }
      });

      // Update all order items to cancelled
      await prisma.rigaOrdinazione.updateMany({
        where: { ordinazioneId: waitingOrderId },
        data: { stato: 'ANNULLATO' }
      });

      // Emit cancellation notification
      sseService.emit('order:cancelled', {
        orderId: order.id,
        orderNumber: order.numero,
        tableNumber: order.Tavolo?.numero ? parseInt(order.Tavolo.numero.toString(), 10) || undefined : undefined,
        reason: 'Prodotti esauriti - Cliente ha annullato',
        timestamp: new Date().toISOString()
      }, {
        broadcast: true,
        skipRateLimit: true,
        tenantId: user.tenantId
      });

      revalidatePath('/prepara');
      revalidatePath('/cameriere');

      return {
        success: true,
        message: "Ordine annullato con successo"
      };
    } else if (action === 'substitute' && substituteProducts) {
      // Get the waiting order
      const order = await prisma.ordinazione.findUnique({
        where: { id: waitingOrderId },
        include: {
          RigaOrdinazione: {
            include: { Prodotto: true }
          }
        }
      });

      if (!order) {
        return { success: false, error: "Ordine non trovato" };
      }

      // Cancel old items
      await prisma.rigaOrdinazione.updateMany({
        where: { ordinazioneId: waitingOrderId },
        data: { stato: 'ANNULLATO' }
      });

      // Add substitute products
      const newItems = await Promise.all(
        substituteProducts.map(product => 
          prisma.rigaOrdinazione.create({
            data: {
              id: nanoid(),
              ordinazioneId: waitingOrderId,
              prodottoId: product.prodottoId,
              quantita: product.quantita,
              prezzo: product.prezzo,
              stato: 'INSERITO',
              postazione: 'PREPARA',
              note: 'Prodotto sostitutivo',
              updatedAt: new Date()
            },
            include: { Prodotto: true }
          })
        )
      );

      // Update order status back to active
      await prisma.ordinazione.update({
        where: { id: waitingOrderId },
        data: { 
          stato: 'ORDINATO',
          note: 'Ordine modificato con prodotti sostitutivi'
        }
      });

      // Emit substitution notification
      sseService.emit('order:substituted', {
        originalOrderId: order.id,
        originalOrderNumber: order.numero,
        newOrderId: waitingOrderId,
        newOrderNumber: order.numero,
        waiterId: user.id,
        waiterName: user.nome,
        outOfStockProduct: 'Multiple',
        outOfStockItems: newItems.map(item => ({
          id: item.id,
          productName: item.Prodotto.nome,
          quantity: item.quantita
        })),
        timestamp: new Date().toISOString()
      }, {
        broadcast: true,
        skipRateLimit: true,
        tenantId: user.tenantId
      });

      revalidatePath('/prepara');
      revalidatePath('/cameriere');

      return {
        success: true,
        message: "Prodotti sostituiti con successo",
        newItems: serializeDecimalData(newItems)
      };
    }

    return { success: false, error: "Azione non valida" };
  } catch (error) {
    console.error("Errore handling out of stock response:", error);
    return { success: false, error: "Errore nella gestione della risposta" };
  }
}

export async function getWaitingOutOfStockOrders() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Non autenticato" };
    }

    const waitingOrders = await prisma.ordinazione.findMany({
      where: {
        stato: 'ORDINATO_ESAURITO' as any
      },
      include: {
        RigaOrdinazione: {
          include: { Prodotto: true }
        },
        Tavolo: true,
        User: true,
        Cliente: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return {
      success: true,
      orders: serializeDecimalData(waitingOrders)
    };
  } catch (error) {
    console.error("Errore loading waiting orders:", error);
    return { success: false, error: "Errore nel caricamento ordini in attesa" };
  }
}