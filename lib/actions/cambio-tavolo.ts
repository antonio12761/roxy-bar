"use server";

import { prisma } from "@/lib/db";
import { sseService } from "@/lib/sse/sse-service";
import { nanoid } from "nanoid";

export async function getTavoliLiberi() {
  try {
    const tavoli = await prisma.tavolo.findMany({
      include: {
        Ordinazione: {
          where: {
            stato: {
              notIn: ['PAGATO', 'ANNULLATO']  // Tutti gli stati tranne pagato e annullato sono considerati attivi
            }
          }
        }
      },
      orderBy: { numero: 'asc' }
    });
    
    return tavoli.map(t => ({
      id: t.id,
      numero: t.numero.toString(),
      stato: t.stato,
      zona: t.zona || 'Generale',
      hasActiveOrders: t.Ordinazione.length > 0
    }));
  } catch (error) {
    console.error("Error fetching tables:", error);
    throw error;
  }
}

export async function getActiveOrdersByTable(tableNumber: string) {
  try {
    const ordinazioni = await prisma.ordinazione.findMany({
      where: {
        Tavolo: {
          numero: tableNumber
        },
        stato: {
          notIn: ['PAGATO', 'ANNULLATO']  // Tutti gli ordini non pagati/annullati
        }
      },
      include: {
        RigaOrdinazione: true,
        User: true,
        Tavolo: true
      }
    });
    
    return ordinazioni.map(o => ({
      id: o.id,
      tavolo: { numero: o.Tavolo?.numero || '' },
      totale: o.totale,
      righe: o.RigaOrdinazione.length,
      dataOra: o.dataApertura.toISOString(),
      cameriere: o.User.nome
    }));
  } catch (error) {
    console.error("Error fetching orders:", error);
    throw error;
  }
}

export async function getOrderDetailsForTable(tableNumber: string) {
  try {
    const ordinazioni = await prisma.ordinazione.findMany({
      where: {
        Tavolo: {
          numero: tableNumber
        },
        stato: {
          notIn: ['PAGATO', 'ANNULLATO']  // Cambiato per includere tutti gli stati attivi
        }
      },
      include: {
        RigaOrdinazione: {
          include: {
            Prodotto: true
          }
        },
        User: true,
        Tavolo: true
      },
      orderBy: {
        dataApertura: 'desc'
      }
    });
    
    // Restituisce i dati nel formato atteso dal componente
    return ordinazioni.map(o => ({
      id: o.id,
      tavolo: { numero: o.Tavolo?.numero || '' },
      totale: o.totale,
      dataApertura: o.dataApertura,
      stato: o.stato,
      User: {
        nome: o.User.nome
      },
      RigaOrdinazione: o.RigaOrdinazione.map(r => ({
        id: r.id,
        quantita: r.quantita,
        prezzo: r.prezzo,
        ordinazioneId: o.id,
        Prodotto: {
          id: r.Prodotto.id,
          nome: r.Prodotto.nome,
          categoria: r.Prodotto.categoria,
          prezzo: r.Prodotto.prezzo
        }
      }))
    }));
  } catch (error) {
    console.error("Error fetching order details:", error);
    throw error;
  }
}

export async function spostaOrdiniSelezionati(
  sourceTableNumber: string, 
  destinationTableNumber: string, 
  orderIds: string[],
  isMerge: boolean = false
) {
  try {
    const sourceTavolo = await prisma.tavolo.findFirst({
      where: { numero: sourceTableNumber }
    });
    
    const destTavolo = await prisma.tavolo.findFirst({
      where: { numero: destinationTableNumber }
    });
    
    if (!sourceTavolo || !destTavolo) {
      return { success: false, error: "Tavolo non trovato" };
    }
    
    const result = await prisma.$transaction(async (tx) => {
      // Sposta gli ordini selezionati
      await tx.ordinazione.updateMany({
        where: {
          id: {
            in: orderIds
          }
        },
        data: {
          tavoloId: destTavolo.id
        }
      });
      
      // Controlla se rimangono ordini attivi sul tavolo di origine
      const ordiniRimasti = await tx.ordinazione.count({
        where: {
          tavoloId: sourceTavolo.id,
          stato: {
            notIn: ['PAGATO', 'ANNULLATO']
          }
        }
      });
      
      // Se non rimangono ordini, libera il tavolo di origine
      if (ordiniRimasti === 0) {
        await tx.tavolo.update({
          where: { id: sourceTavolo.id },
          data: { stato: 'LIBERO' }
        });
      }
      
      // Occupa il tavolo di destinazione
      await tx.tavolo.update({
        where: { id: destTavolo.id },
        data: { stato: 'OCCUPATO' }
      });
      
      return { ordiniRimasti };
    });
    
    // Invia notifiche SSE
    if (result.ordiniRimasti === 0) {
      await sseService.emit('table:updated', {
        tableNumber: sourceTableNumber,
        newStatus: 'LIBERO'
      });
    }
    
    await sseService.emit('table:updated', {
      tableNumber: destinationTableNumber,
      newStatus: 'OCCUPATO'
    });
    
    await sseService.emit('order:table_changed', {
      fromTable: sourceTableNumber,
      toTable: destinationTableNumber,
      ordersCount: orderIds.length
    });
    
    return { 
      success: true, 
      message: isMerge 
        ? `${orderIds.length} ordini fusi nel Tavolo ${destinationTableNumber}` 
        : `${orderIds.length} ordini spostati nel Tavolo ${destinationTableNumber}`,
      ordiniRimasti: result.ordiniRimasti
    };
  } catch (error) {
    console.error("Error moving selected orders:", error);
    return { success: false, error: "Errore durante lo spostamento degli ordini" };
  }
}

export async function spostaProdottiSelezionati(
  sourceTableNumber: string,
  destinationTableNumber: string,
  prodottiDaSpostare: Array<{
    rigaId: string;
    ordinazioneId: string;
    quantita: number;
    prodottoId: number;
    prezzo: number;
  }>,
  userId: string
) {
  try {
    const sourceTavolo = await prisma.tavolo.findFirst({
      where: { numero: sourceTableNumber }
    });
    
    const destTavolo = await prisma.tavolo.findFirst({
      where: { numero: destinationTableNumber }
    });
    
    if (!sourceTavolo || !destTavolo) {
      return { success: false, error: "Tavolo non trovato" };
    }

    const result = await prisma.$transaction(async (tx) => {
      // Crea un nuovo ordine sul tavolo di destinazione con stato CONSEGNATO
      const nuovoOrdine = await tx.ordinazione.create({
        data: {
          id: nanoid(),
          tavoloId: destTavolo.id,
          cameriereId: userId,
          stato: 'CONSEGNATO', // Stato CONSEGNATO così è solo da pagare
          dataApertura: new Date(),
          totale: prodottiDaSpostare.reduce((sum, p) => sum + (p.prezzo * p.quantita), 0),
          note: `Prodotti spostati dal Tavolo ${sourceTableNumber}`,
          updatedAt: new Date()
        }
      });

      // Crea le righe ordine per i prodotti spostati
      for (const prodotto of prodottiDaSpostare) {
        await tx.rigaOrdinazione.create({
          data: {
            id: nanoid(),
            ordinazioneId: nuovoOrdine.id,
            prodottoId: prodotto.prodottoId,
            quantita: prodotto.quantita,
            prezzo: prodotto.prezzo,
            note: `Spostato da ordine ${prodotto.ordinazioneId}`,
            updatedAt: new Date()
          }
        });

        // Rimuovi o riduci la quantità dalla riga originale
        const rigaOriginale = await tx.rigaOrdinazione.findUnique({
          where: { id: prodotto.rigaId }
        });

        if (rigaOriginale) {
          if (rigaOriginale.quantita <= prodotto.quantita) {
            // Se spostiamo tutta la quantità, elimina la riga
            await tx.rigaOrdinazione.delete({
              where: { id: prodotto.rigaId }
            });
          } else {
            // Altrimenti riduci la quantità
            await tx.rigaOrdinazione.update({
              where: { id: prodotto.rigaId },
              data: {
                quantita: rigaOriginale.quantita - prodotto.quantita
              }
            });
          }
        }
      }

      // Aggiorna i totali degli ordini originali
      const ordiniOriginali = [...new Set(prodottiDaSpostare.map(p => p.ordinazioneId))];
      for (const ordineId of ordiniOriginali) {
        const righeRimaste = await tx.rigaOrdinazione.findMany({
          where: { ordinazioneId: ordineId }
        });

        if (righeRimaste.length === 0) {
          // Se non ci sono più righe, annulla l'ordine
          await tx.ordinazione.update({
            where: { id: ordineId },
            data: { stato: 'ANNULLATO' }
          });
        } else {
          // Altrimenti aggiorna il totale
          const nuovoTotale = righeRimaste.reduce((sum, r) => sum + (Number(r.prezzo) * r.quantita), 0);
          await tx.ordinazione.update({
            where: { id: ordineId },
            data: { totale: nuovoTotale }
          });
        }
      }

      // Controlla se il tavolo origine ha ancora ordini attivi
      const ordiniRimasti = await tx.ordinazione.count({
        where: {
          tavoloId: sourceTavolo.id,
          stato: {
            notIn: ['PAGATO', 'ANNULLATO']
          }
        }
      });

      // Aggiorna stati tavoli
      if (ordiniRimasti === 0) {
        await tx.tavolo.update({
          where: { id: sourceTavolo.id },
          data: { stato: 'LIBERO' }
        });
      }

      await tx.tavolo.update({
        where: { id: destTavolo.id },
        data: { stato: 'OCCUPATO' }
      });

      return { nuovoOrdineId: nuovoOrdine.id, ordiniRimasti };
    });

    // Invia notifiche SSE
    if (result.ordiniRimasti === 0) {
      await sseService.emit('table:updated', {
        tableNumber: sourceTableNumber,
        newStatus: 'LIBERO'
      });
    }

    await sseService.emit('table:updated', {
      tableNumber: destinationTableNumber,
      newStatus: 'OCCUPATO'
    });

    await sseService.emit('order:update', {
      orderId: result.nuovoOrdineId,
      status: 'CONSEGNATO' as const,
      timestamp: new Date().toISOString()
    });

    return {
      success: true,
      message: `${prodottiDaSpostare.length} prodotti spostati con successo`,
      nuovoOrdineId: result.nuovoOrdineId
    };
  } catch (error) {
    console.error("Error moving products:", error);
    return { success: false, error: "Errore durante lo spostamento dei prodotti" };
  }
}

export async function cambiaOrdineTavolo(sourceTableNumber: string, destinationTableNumber: string) {
  try {
    // Verifica che i tavoli esistano
    const sourceTavolo = await prisma.tavolo.findFirst({
      where: { numero: sourceTableNumber }
    });
    
    const destTavolo = await prisma.tavolo.findFirst({
      where: { numero: destinationTableNumber }
    });
    
    if (!sourceTavolo || !destTavolo) {
      return { success: false, error: "Tavolo non trovato" };
    }
    
    // Trova tutti gli ordini attivi del tavolo di origine (non pagati/annullati)
    const ordiniDaSpostare = await prisma.ordinazione.findMany({
      where: {
        tavoloId: sourceTavolo.id,
        stato: {
          notIn: ['PAGATO', 'ANNULLATO']
        }
      }
    });
    
    if (ordiniDaSpostare.length === 0) {
      return { success: false, error: "Nessun ordine attivo da spostare" };
    }
    
    // Usa la funzione di spostamento selettivo con tutti gli ordini
    const orderIds = ordiniDaSpostare.map(o => o.id);
    return await spostaOrdiniSelezionati(sourceTableNumber, destinationTableNumber, orderIds, false);
  } catch (error) {
    console.error("Error changing table:", error);
    return { success: false, error: "Errore durante lo spostamento degli ordini" };
  }
}