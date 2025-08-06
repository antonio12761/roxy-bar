"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-multi-tenant";
import { sseService } from "@/lib/sse/sse-service";

/**
 * Aggiorna la quantità disponibile di un prodotto nell'inventario esaurito
 */
export async function updateInventarioEsaurito(
  prodottoId: number,
  quantitaDisponibile: number,
  note?: string
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Non autenticato" };
    }

    // Upsert: crea se non esiste, aggiorna se esiste
    const inventario = await prisma.inventarioEsaurito.upsert({
      where: {
        prodottoId
      },
      update: {
        quantitaDisponibile,
        ultimoAggiornamento: new Date(),
        aggiornatoDa: user.id,
        aggiornatoDaNome: user.nome,
        note
      },
      create: {
        prodottoId,
        quantitaDisponibile,
        aggiornatoDa: user.id,
        aggiornatoDaNome: user.nome,
        note
      },
      include: {
        Prodotto: true
      }
    });
    
    // Se la quantità è 0, marca il prodotto come non disponibile
    if (quantitaDisponibile === 0) {
      await prisma.prodotto.update({
        where: { id: prodottoId },
        data: { 
          disponibile: false,
          terminato: true 
        }
      });
      console.log(`[Inventario] Prodotto ${inventario.Prodotto.nome} marcato come NON DISPONIBILE (quantità: 0)`);
    } else if (quantitaDisponibile > 0) {
      // Se la quantità è > 0, assicurati che il prodotto sia disponibile
      const prodotto = await prisma.prodotto.findUnique({
        where: { id: prodottoId }
      });
      
      if (prodotto && (!prodotto.disponibile || prodotto.terminato)) {
        await prisma.prodotto.update({
          where: { id: prodottoId },
          data: { 
            disponibile: true,
            terminato: false 
          }
        });
        console.log(`[Inventario] Prodotto ${inventario.Prodotto.nome} marcato come DISPONIBILE (quantità: ${quantitaDisponibile})`);
      }
    }

    // Notifica tutti i camerieri dell'aggiornamento inventario
    await sseService.emit('inventory:updated', {
      productId: prodottoId,
      productName: inventario.Prodotto.nome,
      availableQuantity: quantitaDisponibile,
      updatedBy: user.nome,
      timestamp: new Date().toISOString()
    }, {
      broadcast: true,
      skipRateLimit: true,
      targetStations: ['CAMERIERE', 'PREPARA']
    });
    
    // Se la disponibilità è cambiata, notifica anche questo
    if (quantitaDisponibile === 0) {
      await sseService.emit('product:availability', {
        productId: prodottoId,
        productName: inventario.Prodotto.nome,
        available: false,
        updatedBy: user.nome,
        timestamp: new Date().toISOString()
      }, {
        broadcast: true,
        skipRateLimit: true
      });
    } else if (quantitaDisponibile > 0) {
      // Notifica che il prodotto è tornato disponibile se prima non lo era
      const prodotto = await prisma.prodotto.findUnique({
        where: { id: prodottoId }
      });
      
      if (prodotto && (!prodotto.disponibile || prodotto.terminato)) {
        await sseService.emit('product:availability', {
          productId: prodottoId,
          productName: inventario.Prodotto.nome,
          available: true,
          updatedBy: user.nome,
          timestamp: new Date().toISOString()
        }, {
          broadcast: true,
          skipRateLimit: true
        });
      }
    }

    return {
      success: true,
      inventario
    };
  } catch (error) {
    console.error('Errore aggiornamento inventario esaurito:', error);
    return {
      success: false,
      error: 'Errore aggiornamento inventario'
    };
  }
}

/**
 * Ottiene la quantità disponibile di un prodotto
 */
export async function getQuantitaDisponibile(prodottoId: number) {
  try {
    const inventario = await prisma.inventarioEsaurito.findUnique({
      where: {
        prodottoId
      }
    });

    // Se non c'è record nell'inventario esaurito, assumiamo che sia completamente disponibile
    // Restituiamo null per indicare che non c'è limite
    return inventario?.quantitaDisponibile ?? null;
  } catch (error) {
    console.error('Errore recupero quantità disponibile:', error);
    return null;
  }
}

/**
 * Ottiene l'inventario esaurito per multipli prodotti
 */
export async function getInventarioEsauritoMultiplo(prodottiIds: number[]) {
  try {
    const inventari = await prisma.inventarioEsaurito.findMany({
      where: {
        prodottoId: {
          in: prodottiIds
        }
      }
    });

    // Crea una mappa per accesso rapido
    const inventarioMap = new Map<number, number>();
    inventari.forEach(inv => {
      inventarioMap.set(inv.prodottoId, inv.quantitaDisponibile);
    });

    return inventarioMap;
  } catch (error) {
    console.error('Errore recupero inventario multiplo:', error);
    return new Map<number, number>();
  }
}

/**
 * Resetta l'inventario esaurito per un prodotto (lo rimuove dal tracking)
 */
export async function resetInventarioEsaurito(prodottoId: number) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Non autenticato" };
    }

    // Trova il prodotto per il nome
    const prodotto = await prisma.prodotto.findUnique({
      where: { id: prodottoId }
    });

    // Elimina il record dell'inventario esaurito
    await prisma.inventarioEsaurito.deleteMany({
      where: {
        prodottoId
      }
    });
    
    // Ripristina la disponibilità del prodotto
    if (prodotto) {
      await prisma.prodotto.update({
        where: { id: prodottoId },
        data: {
          disponibile: true,
          terminato: false
        }
      });
      
      console.log(`[Inventario] Prodotto ${prodotto.nome} ripristinato come DISPONIBILE (inventario resettato)`);
    }

    // Notifica che il prodotto è tornato completamente disponibile
    if (prodotto) {
      await sseService.emit('inventory:reset', {
        productId: prodottoId,
        productName: prodotto.nome,
        resetBy: user.nome,
        timestamp: new Date().toISOString()
      }, {
        broadcast: true,
        skipRateLimit: true,
        targetStations: ['CAMERIERE', 'PREPARA']
      });
      
      // Notifica anche il cambio di disponibilità
      await sseService.emit('product:availability', {
        productId: prodottoId,
        productName: prodotto.nome,
        available: true,
        updatedBy: user.nome,
        timestamp: new Date().toISOString()
      }, {
        broadcast: true,
        skipRateLimit: true
      });
    }

    return {
      success: true,
      message: 'Inventario resettato'
    };
  } catch (error) {
    console.error('Errore reset inventario esaurito:', error);
    return {
      success: false,
      error: 'Errore reset inventario'
    };
  }
}

/**
 * Ottiene tutti i prodotti con inventario limitato
 */
export async function getProdottiConInventarioLimitato() {
  try {
    const inventari = await prisma.inventarioEsaurito.findMany({
      include: {
        Prodotto: true
      },
      orderBy: {
        ultimoAggiornamento: 'desc'
      }
    });

    return {
      success: true,
      inventari: inventari.map(inv => ({
        prodottoId: inv.prodottoId,
        prodottoNome: inv.Prodotto.nome,
        quantitaDisponibile: inv.quantitaDisponibile,
        ultimoAggiornamento: inv.ultimoAggiornamento,
        aggiornatoDa: inv.aggiornatoDaNome,
        note: inv.note
      }))
    };
  } catch (error) {
    console.error('Errore recupero prodotti con inventario limitato:', error);
    return {
      success: false,
      error: 'Errore recupero inventario',
      inventari: []
    };
  }
}

/**
 * Verifica e riserva le quantità richieste per un ordine
 * Questa funzione deve essere chiamata all'interno di una transazione
 */
export async function verificaERiservaQuantita(
  prodotti: Array<{ prodottoId: number; quantita: number }>,
  tx: any // Prisma transaction client
) {
  const risultati = {
    success: true,
    prodottiNonDisponibili: [] as Array<{
      prodottoId: number;
      nomeProdotto: string;
      quantitaRichiesta: number;
      quantitaDisponibile: number;
    }>,
    riserve: [] as Array<{
      prodottoId: number;
      quantitaRiservata: number;
    }>
  };

  for (const item of prodotti) {
    // Verifica se esiste un record nell'inventario esaurito
    const inventario = await tx.inventarioEsaurito.findUnique({
      where: { prodottoId: item.prodottoId },
      include: { Prodotto: true }
    });

    // Se non c'è inventario esaurito, il prodotto è considerato illimitato
    if (!inventario) {
      risultati.riserve.push({
        prodottoId: item.prodottoId,
        quantitaRiservata: item.quantita
      });
      continue;
    }

    // Verifica disponibilità
    if (inventario.quantitaDisponibile < item.quantita) {
      risultati.success = false;
      risultati.prodottiNonDisponibili.push({
        prodottoId: item.prodottoId,
        nomeProdotto: inventario.Prodotto.nome,
        quantitaRichiesta: item.quantita,
        quantitaDisponibile: inventario.quantitaDisponibile
      });
    } else {
      // Riserva la quantità aggiornando l'inventario
      await tx.inventarioEsaurito.update({
        where: { prodottoId: item.prodottoId },
        data: {
          quantitaDisponibile: inventario.quantitaDisponibile - item.quantita,
          ultimoAggiornamento: new Date()
        }
      });

      risultati.riserve.push({
        prodottoId: item.prodottoId,
        quantitaRiservata: item.quantita
      });

      // Se la quantità arriva a 0, marca il prodotto come non disponibile
      if (inventario.quantitaDisponibile - item.quantita === 0) {
        await tx.prodotto.update({
          where: { id: item.prodottoId },
          data: {
            disponibile: false,
            terminato: true
          }
        });
      }
    }
  }

  return risultati;
}

/**
 * Rilascia le quantità riservate quando un ordine viene annullato
 * Questa funzione deve essere chiamata all'interno di una transazione
 */
export async function rilasciaQuantitaRiservate(
  prodotti: Array<{ prodottoId: number; quantita: number }>,
  tx: any // Prisma transaction client
) {
  for (const item of prodotti) {
    // Verifica se esiste un record nell'inventario esaurito
    const inventario = await tx.inventarioEsaurito.findUnique({
      where: { prodottoId: item.prodottoId }
    });

    if (inventario) {
      // Ripristina la quantità
      const nuovaQuantita = inventario.quantitaDisponibile + item.quantita;
      
      await tx.inventarioEsaurito.update({
        where: { prodottoId: item.prodottoId },
        data: {
          quantitaDisponibile: nuovaQuantita,
          ultimoAggiornamento: new Date()
        }
      });

      // Se il prodotto era esaurito e ora ha disponibilità, aggiorna lo stato
      if (inventario.quantitaDisponibile === 0 && nuovaQuantita > 0) {
        await tx.prodotto.update({
          where: { id: item.prodottoId },
          data: {
            disponibile: true,
            terminato: false
          }
        });
      }
    }
  }
}

/**
 * Ottiene la quantità riservata da ordini esistenti per un prodotto
 */
export async function getQuantitaRiservata(prodottoId: number) {
  try {
    // Somma le quantità ordinate per questo prodotto in ordini non ancora completati
    const quantitaRiservata = await prisma.rigaOrdinazione.aggregate({
      where: {
        prodottoId,
        Ordinazione: {
          stato: {
            in: ['ORDINATO', 'IN_PREPARAZIONE', 'PRONTO', 'CONSEGNATO']
          }
        }
      },
      _sum: {
        quantita: true
      }
    });

    return quantitaRiservata._sum?.quantita || 0;
  } catch (error) {
    console.error('Errore calcolo quantità riservata:', error);
    return 0;
  }
}