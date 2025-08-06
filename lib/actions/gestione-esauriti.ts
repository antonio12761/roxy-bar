"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-multi-tenant";
import { sseService } from "@/lib/sse/sse-service";

export async function getTablesWithOutOfStockOrders() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Non autenticato" };
    }

    // Trova tutti gli ordini esauriti attivi dalla nuova tabella
    const ordiniEsauriti = await prisma.ordineEsaurito.findMany({
      where: {
        stato: {
          in: ['ATTIVO', 'IN_GESTIONE']
        }
      },
      include: {
        Ordinazione: {
          include: {
            Tavolo: true,
            User: true,
            RigaOrdinazione: {
              include: {
                Prodotto: true
              }
            }
          }
        },
        ProdottiEsauriti: true
      }
    });

    // Serializza i Decimal
    const serializedOrders = ordiniEsauriti.map(ordineEsaurito => ({
      ...ordineEsaurito.Ordinazione,
      totale: ordineEsaurito.Ordinazione.totale.toString(),
      RigaOrdinazione: ordineEsaurito.Ordinazione.RigaOrdinazione.map(item => ({
        ...item,
        prezzo: item.prezzo.toString(),
        Prodotto: item.Prodotto ? {
          ...item.Prodotto,
          prezzo: item.Prodotto.prezzo.toString()
        } : null
      })),
      handledBy: ordineEsaurito.handledByName,
      handledAt: ordineEsaurito.handledAt
    }));

    // Raggruppa per tavolo
    const tableMap = new Map();
    serializedOrders.forEach(order => {
      if (order.Tavolo) {
        const tableId = order.Tavolo.id;
        if (!tableMap.has(tableId)) {
          tableMap.set(tableId, {
            table: order.Tavolo,
            orders: [],
            handledBy: null
          });
        }
        tableMap.get(tableId).orders.push(order);
        
        // Se qualcuno sta gestendo, lo prendiamo dal campo handledBy
        if (order.handledBy) {
          tableMap.get(tableId).handledBy = order.handledBy;
        }
      }
    });

    return {
      success: true,
      tables: Array.from(tableMap.values())
    };
  } catch (error) {
    console.error('Errore recupero tavoli con ordini esauriti:', error);
    return { success: false, error: 'Errore nel recupero dati' };
  }
}

export async function getOutOfStockOrderDetails(orderId: string) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Non autenticato" };
    }

    if (!orderId) {
      return { success: false, error: "ID ordine non fornito" };
    }

    // Cerca prima nella tabella OrdineEsaurito
    const ordineEsaurito = await prisma.ordineEsaurito.findUnique({
      where: {
        ordinazioneId: orderId
      },
      include: {
        Ordinazione: {
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
        },
        ProdottiEsauriti: true
      }
    });

    if (!ordineEsaurito) {
      // Se non è nella tabella OrdineEsaurito, cerca direttamente nell'Ordinazione
      const order = await prisma.ordinazione.findUnique({
        where: { 
          id: orderId
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

      if (!order) {
        return { success: false, error: "Ordine non trovato" };
      }

      // Ordine esaurito senza record nella nuova tabella (vecchio sistema)
      // Usa la logica precedente per compatibilità
      const serializedOrder = {
        ...order,
        totale: order.totale.toString(),
        RigaOrdinazione: order.RigaOrdinazione.map(item => ({
          ...item,
          prezzo: item.prezzo.toString(),
          Prodotto: item.Prodotto ? {
            ...item.Prodotto,
            prezzo: item.Prodotto.prezzo.toString()
          } : null
        }))
      };

      return {
        success: true,
        order: serializedOrder,
        availableProducts: [],
        unavailableProducts: serializedOrder.RigaOrdinazione,
        handledBy: order.note?.match(/preso in carico da ([^|]+)/)?.[1]?.trim()
      };
    }

    const order = ordineEsaurito.Ordinazione;
    const availableProducts = [];
    const unavailableProducts = [];

    console.log('[getOutOfStockOrderDetails] OrdineEsaurito:', {
      id: ordineEsaurito.id,
      splitOrder: ordineEsaurito.splitOrder,
      originalOrdinazioneId: ordineEsaurito.originalOrdinazioneId,
      prodottiEsauriti: ordineEsaurito.ProdottiEsauriti.length,
      righeOrdinazione: order.RigaOrdinazione.length
    });

    // Se è un ordine diviso, ottieni l'ordine originale
    if (ordineEsaurito.splitOrder && ordineEsaurito.originalOrdinazioneId) {
      const originalOrder = await prisma.ordinazione.findUnique({
        where: {
          id: ordineEsaurito.originalOrdinazioneId
        },
        include: {
          RigaOrdinazione: {
            include: {
              Prodotto: true
            }
          }
        }
      });

      if (originalOrder) {
        // Aggiungi i prodotti disponibili dall'ordine originale
        for (const item of originalOrder.RigaOrdinazione) {
          if (item.Prodotto && item.stato !== 'ANNULLATO') {
            const product = await prisma.prodotto.findUnique({
              where: { id: item.Prodotto.id }
            });
            
            if (product?.disponibile) {
              const serializedItem = {
                ...item,
                prezzo: item.prezzo.toString(),
                Prodotto: item.Prodotto ? {
                  ...item.Prodotto,
                  prezzo: item.Prodotto.prezzo.toString()
                } : null
              };
              availableProducts.push(serializedItem);
            }
          }
        }
      }
    }

    // Aggiungi i prodotti esauriti dalla tabella ProdottoEsaurito
    for (const prodEsaurito of ordineEsaurito.ProdottiEsauriti) {
      // Trova il prodotto corrispondente nell'ordine
      const orderItem = order.RigaOrdinazione.find(
        item => item.prodottoId === prodEsaurito.prodottoId
      );

      if (orderItem && orderItem.Prodotto) {
        const serializedItem = {
          ...orderItem,
          prezzo: orderItem.prezzo.toString(),
          quantita: prodEsaurito.quantitaEsaurita,
          Prodotto: {
            ...orderItem.Prodotto,
            prezzo: orderItem.Prodotto.prezzo.toString()
          }
        };
        unavailableProducts.push(serializedItem);

        // Se la quantità esaurita è minore della quantità totale, 
        // aggiungi la differenza come disponibile
        if (prodEsaurito.quantitaEsaurita < prodEsaurito.quantitaTotale) {
          const availableQuantity = prodEsaurito.quantitaTotale - prodEsaurito.quantitaEsaurita;
          const availableItem = {
            ...orderItem,
            prezzo: orderItem.prezzo.toString(),
            quantita: availableQuantity,
            Prodotto: {
              ...orderItem.Prodotto,
              prezzo: orderItem.Prodotto.prezzo.toString()
            }
          };
          availableProducts.push(availableItem);
        }
      }
    }

    console.log('[getOutOfStockOrderDetails] Available products:', availableProducts.length);
    console.log('[getOutOfStockOrderDetails] Unavailable products:', unavailableProducts.length);
    console.log('[getOutOfStockOrderDetails] Available products details:', availableProducts);
    console.log('[getOutOfStockOrderDetails] Unavailable products details:', unavailableProducts);

    const serializedOrder = {
      ...order,
      totale: order.totale.toString(),
      RigaOrdinazione: order.RigaOrdinazione.map(item => ({
        ...item,
        prezzo: item.prezzo.toString(),
        Prodotto: item.Prodotto ? {
          ...item.Prodotto,
          prezzo: item.Prodotto.prezzo.toString()
        } : null
      }))
    };

    return {
      success: true,
      order: serializedOrder,
      availableProducts,
      unavailableProducts,
      handledBy: ordineEsaurito.handledByName || null
    };
  } catch (error) {
    console.error('Errore recupero dettagli ordine esaurito:', error);
    return { success: false, error: 'Errore nel recupero dati' };
  }
}

export async function modifyOutOfStockOrder(orderId: string, newItems: Array<{
  prodottoId: number;
  quantita: number;
  note?: string;
}>) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Non autenticato" };
    }

    const result = await prisma.$transaction(async (tx) => {
      // Cerca l'ordine esaurito nella nuova tabella
      const ordineEsaurito = await tx.ordineEsaurito.findUnique({
        where: { ordinazioneId: orderId }
      });
      
      console.log(`[modifyOutOfStockOrder] Inizio modifica ordine ${orderId}`);
      console.log(`[modifyOutOfStockOrder] OrdineEsaurito trovato:`, ordineEsaurito ? `ID: ${ordineEsaurito.id}, Stato: ${ordineEsaurito.stato}` : 'Non trovato');

      // Recupera ordine originale
      const originalOrder = await tx.ordinazione.findUnique({
        where: { id: orderId },
        include: {
          Tavolo: true,
          RigaOrdinazione: {
            include: {
              Prodotto: true
            }
          }
        }
      });

      if (!originalOrder) {
        throw new Error('Ordine non trovato');
      }
      
      console.log(`[modifyOutOfStockOrder] Ordine originale stato: ${originalOrder.stato}`);
      console.log(`[modifyOutOfStockOrder] Tavolo: ${originalOrder.Tavolo?.numero || 'N/A'}`);
      console.log(`[modifyOutOfStockOrder] Creazione ordine sostitutivo con ${newItems.length} prodotti`);

      // Pulisci COMPLETAMENTE le note originali da TUTTE le informazioni di gestione precedente
      let cleanedOriginalNotes = originalOrder.note || '';
      cleanedOriginalNotes = cleanedOriginalNotes
        .replace(/\s*\|\s*Problema esaurito preso in carico da[^|]*/gi, '')
        .replace(/\s*\|\s*Sostituito con ordine[^|]*/gi, '')
        .replace(/\s*-\s*Tutti i prodotti esauriti[^|]*/gi, '')
        .replace(/\s*-\s*Prodotti esauriti gestiti[^|]*/gi, '')
        .replace(/\s*\|\s*Annullato da[^|]*/gi, '')
        .replace(/Ordine sostitutivo per #\d+[^|]*/gi, '')
        .trim();
      
      // Se dopo la pulizia rimangono solo spazi o caratteri speciali, pulisci tutto
      if (cleanedOriginalNotes.match(/^[\s\-\|]*$/)) {
        cleanedOriginalNotes = '';
      }
      
      // Estrai solo le informazioni essenziali del cliente
      const clientMatch = cleanedOriginalNotes.match(/Cliente:\s*([^-|]+)/i);
      if (clientMatch) {
        cleanedOriginalNotes = clientMatch[0].trim();
      }
      
      // Crea nuovo ordine sostitutivo
      const newOrder = await tx.ordinazione.create({
        data: {
          id: `order_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
          tavoloId: originalOrder.tavoloId,
          clienteId: originalOrder.clienteId,
          cameriereId: user.id,
          stato: 'ORDINATO',
          tipo: originalOrder.tipo,
          note: cleanedOriginalNotes ? `${cleanedOriginalNotes}` : `Cliente: ${originalOrder.nomeCliente || 'N/D'}`,
          nomeCliente: originalOrder.nomeCliente,
          statoPagamento: 'NON_PAGATO',
          totale: 0,
          updatedAt: new Date()
        }
      });

      // Aggiungi nuovi items
      let totale = 0;
      for (const item of newItems) {
        const prodotto = await tx.prodotto.findUnique({
          where: { id: item.prodottoId }
        });
        
        if (!prodotto) continue;
        
        await tx.rigaOrdinazione.create({
          data: {
            id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
            ordinazioneId: newOrder.id,
            prodottoId: item.prodottoId,
            quantita: item.quantita,
            prezzo: prodotto.prezzo,
            stato: 'INSERITO',
            note: item.note,
            updatedAt: new Date()
          }
        });
        
        totale += Number(prodotto.prezzo) * item.quantita;
      }

      // Aggiorna totale
      await tx.ordinazione.update({
        where: { id: newOrder.id },
        data: { totale }
      });

      // Marca l'ordine originale come ANNULLATO così va in cronologia
      // Importante: cambiamo stato da ORDINATO_ESAURITO a ANNULLATO
      await tx.ordinazione.update({
        where: { id: orderId },
        data: {
          stato: 'ANNULLATO',
          note: `${originalOrder.note || ''} | Sostituito con ordine #${newOrder.numero} - Prodotti esauriti gestiti`,
          updatedAt: new Date()
        }
      });
      
      // Marca anche tutte le righe dell'ordine originale come ANNULLATO
      await tx.rigaOrdinazione.updateMany({
        where: { ordinazioneId: orderId },
        data: { stato: 'ANNULLATO' }
      });

      // Aggiorna il record OrdineEsaurito come RISOLTO se esiste
      if (ordineEsaurito) {
        await tx.ordineEsaurito.update({
          where: { ordinazioneId: orderId },
          data: {
            stato: 'RISOLTO',
            resolvedBy: user.id,
            resolvedByName: user.nome,
            resolvedAt: new Date()
          }
        });
        console.log(`[modifyOutOfStockOrder] OrdineEsaurito ${ordineEsaurito.id} marcato come RISOLTO`);
      } else {
        console.log(`[modifyOutOfStockOrder] Nessun record OrdineEsaurito trovato per orderId: ${orderId}`);
      }
      
      console.log(`[modifyOutOfStockOrder] Ordine originale ${orderId} marcato come ANNULLATO`);
      console.log(`[modifyOutOfStockOrder] Nuovo ordine sostitutivo creato: ${newOrder.id}`);

      return { originalOrder, newOrder };
    });

    // Notifica cambio per il nuovo ordine
    sseService.emit('order:update', {
      orderId: result.newOrder.id,
      status: 'APERTO',
      previousStatus: 'ORDINATO',
      updatedBy: user.nome,
      timestamp: new Date().toISOString()
    }, {
      broadcast: true,
      skipRateLimit: true
    });
    
    // Notifica che l'ordine esaurito è stato risolto
    await sseService.emit('order:esaurito:resolved', {
      originalOrderId: orderId,
      originalOrderNumber: result.originalOrder.numero,
      newOrderId: result.newOrder.id,
      newOrderNumber: result.newOrder.numero,
      tableNumber: result.originalOrder.Tavolo?.numero || 'N/A',
      resolvedBy: user.nome,
      timestamp: new Date().toISOString()
    }, {
      broadcast: true,
      skipRateLimit: true,
      targetStations: ['CAMERIERE', 'PREPARA']
    });
    
    console.log(`[modifyOutOfStockOrder] Ordine esaurito ${orderId} completamente risolto`);
    console.log(`[modifyOutOfStockOrder] Nuovo ordine ${result.newOrder.id} creato con successo`);

    return {
      success: true,
      newOrderId: result.newOrder.id,
      message: 'Ordine modificato con successo'
    };
  } catch (error) {
    console.error('Errore modifica ordine esaurito:', error);
    return { success: false, error: 'Errore nella modifica' };
  }
}

export async function cancelOutOfStockOrder(orderId: string) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Non autenticato" };
    }

    // Prima recupera l'ordine per ottenere i dati del tavolo e i prodotti
    const order = await prisma.ordinazione.findUnique({
      where: { id: orderId },
      include: {
        Tavolo: true,
        RigaOrdinazione: {
          include: {
            Prodotto: true
          }
        }
      }
    });

    if (!order) {
      return { success: false, error: "Ordine non trovato" };
    }
    
    // Importa la funzione per aggiornare l'inventario
    const { updateInventarioEsaurito } = await import('./inventario-esaurito');

    // Marca l'ordine come ANNULLATO invece di eliminarlo
    await prisma.$transaction(async (tx) => {
      // Prima di annullare, ripristina le quantità nell'inventario
      // Se l'ordine era ORDINATO_ESAURITO, significa che queste quantità erano considerate "riservate"
      if (order.stato === 'ORDINATO_ESAURITO') {
        for (const item of order.RigaOrdinazione) {
          if (item.prodottoId && item.stato !== 'ANNULLATO') {
            // Recupera l'inventario attuale
            const inventarioAttuale = await tx.inventarioEsaurito.findUnique({
              where: { prodottoId: item.prodottoId }
            });
            
            if (inventarioAttuale) {
              // Ripristina le quantità (le aggiungiamo di nuovo come disponibili)
              const nuovaQuantita = inventarioAttuale.quantitaDisponibile + item.quantita;
              await updateInventarioEsaurito(
                item.prodottoId,
                nuovaQuantita,
                `Ripristinate ${item.quantita} unità da annullamento ordine #${order.numero}`
              );
              
              console.log(`[Inventario] Ripristinate ${item.quantita} unità di ${item.Prodotto?.nome} (totale: ${nuovaQuantita})`);
            }
          }
        }
      }
      // Marca tutte le righe come ANNULLATO
      await tx.rigaOrdinazione.updateMany({
        where: { ordinazioneId: orderId },
        data: { stato: 'ANNULLATO' }
      });
      
      // Marca l'ordine come ANNULLATO con nota esplicativa
      await tx.ordinazione.update({
        where: { id: orderId },
        data: {
          stato: 'ANNULLATO' as any,
          note: `${order.note || ''} | Annullato da ${user.nome} - Prodotti esauriti non gestiti`
        }
      });

      // Aggiorna il record OrdineEsaurito come ANNULLATO se esiste
      const ordineEsaurito = await tx.ordineEsaurito.findUnique({
        where: { ordinazioneId: orderId }
      });
      
      if (ordineEsaurito) {
        await tx.ordineEsaurito.update({
          where: { ordinazioneId: orderId },
          data: {
            stato: 'ANNULLATO',
            resolvedBy: user.id,
            resolvedByName: user.nome,
            resolvedAt: new Date()
          }
        });
      }
    });

    // Notifica annullamento
    sseService.emit('order:cancelled', {
      orderId: orderId,
      tableNumber: order.Tavolo?.numero ? Number(order.Tavolo.numero) : undefined,
      orderType: order.tipo,
      reason: 'Prodotti esauriti - Ordine annullato',
      approvedBy: user.nome,
      timestamp: new Date().toISOString()
    }, {
      broadcast: true,
      skipRateLimit: true
    });
    
    // Notifica specifica per ordine esaurito annullato
    sseService.emit('order:esaurito:cancelled', {
      orderId: orderId,
      orderNumber: order.numero,
      tableNumber: order.Tavolo?.numero || 'N/A',
      cancelledBy: user.nome,
      timestamp: new Date().toISOString()
    }, {
      broadcast: true,
      skipRateLimit: true,
      targetStations: ['CAMERIERE', 'PREPARA']
    });

    return {
      success: true,
      message: 'Ordine esaurito annullato'
    };
  } catch (error) {
    console.error('Errore annullamento ordine esaurito:', error);
    return { success: false, error: 'Errore nell\'annullamento' };
  }
}