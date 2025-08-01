"use server";

import { prisma } from "@/lib/db";
import { sseService } from "@/lib/sse/sse-service";

export async function getTavoliLiberi() {
  try {
    const tavoli = await prisma.tavolo.findMany({
      orderBy: { numero: 'asc' }
    });
    
    return tavoli.map(t => ({
      id: t.id,
      numero: t.numero.toString(),
      stato: t.stato,
      zona: t.zona || 'Generale'
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
          in: ['ORDINATO', 'IN_PREPARAZIONE', 'PRONTO']
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
    
    // Trova tutti gli ordini attivi del tavolo di origine
    const ordiniDaSpostare = await prisma.ordinazione.findMany({
      where: {
        tavoloId: sourceTavolo.id,
        stato: {
          in: ['ORDINATO', 'IN_PREPARAZIONE', 'PRONTO']
        }
      }
    });
    
    if (ordiniDaSpostare.length === 0) {
      return { success: false, error: "Nessun ordine attivo da spostare" };
    }
    
    // Esegui l'aggiornamento in una transazione
    await prisma.$transaction(async (tx) => {
      // Sposta tutti gli ordini al nuovo tavolo
      await tx.ordinazione.updateMany({
        where: {
          id: {
            in: ordiniDaSpostare.map(o => o.id)
          }
        },
        data: {
          tavoloId: destTavolo.id
        }
      });
      
      // Aggiorna lo stato dei tavoli
      await tx.tavolo.update({
        where: { id: sourceTavolo.id },
        data: { stato: 'LIBERO' }
      });
      
      await tx.tavolo.update({
        where: { id: destTavolo.id },
        data: { stato: 'OCCUPATO' }
      });
    });
    
    // Invia notifiche SSE
    await sseService.emit('table:updated', {
      tableNumber: sourceTableNumber,
      newStatus: 'LIBERO'
    });
    
    await sseService.emit('table:updated', {
      tableNumber: destinationTableNumber,
      newStatus: 'OCCUPATO'
    });
    
    await sseService.emit('order:table_changed', {
      fromTable: sourceTableNumber,
      toTable: destinationTableNumber,
      ordersCount: ordiniDaSpostare.length
    });
    
    return { 
      success: true, 
      message: `${ordiniDaSpostare.length} ordini spostati con successo` 
    };
  } catch (error) {
    console.error("Error changing table:", error);
    return { success: false, error: "Errore durante lo spostamento degli ordini" };
  }
}