"use server";

import { prisma } from "@/lib/db";
// import { sendSSEUpdate } from "@/lib/sse-manager"; // Temporarily disabled

interface PersonaSplit {
  id: string;
  nome: string;
  items: Array<{
    rigaId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  totale: number;
}

export async function getOrdinazioniDaDividere() {
  try {
    const ordinazioni = await prisma.ordinazione.findMany({
      where: {
        stato: 'CONSEGNATO',
        statoPagamento: 'NON_PAGATO',
        Tavolo: {
          isNot: null
        }
      },
      include: {
        Tavolo: true,
        RigaOrdinazione: {
          include: {
            Prodotto: true
          }
        },
        User: true
      }
    });
    
    return ordinazioni.map(o => ({
      id: o.id,
      tavolo: o.Tavolo ? { numero: o.Tavolo.numero.toString() } : null,
      totale: o.totale,
      righe: o.RigaOrdinazione.map((r: any) => ({
        id: r.id,
        prodotto: { nome: r.Prodotto.nome },
        quantita: r.quantita,
        prezzo: r.prezzo,
        isPagato: false // RigaOrdinazione non ha isPagato
      })),
      cameriere: { nome: o.User.nome },
      dataOra: o.dataApertura.toISOString()
    }));
  } catch (error) {
    console.error("Error fetching orders to split:", error);
    throw error;
  }
}

export async function dividiConto(tableNumber: string, persone: PersonaSplit[]) {
  try {
    // Verifica che ci siano persone
    if (persone.length === 0) {
      return { success: false, error: "Nessuna persona specificata" };
    }
    
    // Verifica che tutti abbiano items
    if (persone.some(p => p.items.length === 0)) {
      return { success: false, error: "Ogni persona deve avere almeno un prodotto" };
    }
    
    // Trova tutte le ordinazioni del tavolo
    const tavolo = await prisma.tavolo.findFirst({
      where: { numero: tableNumber }
    });
    
    if (!tavolo) {
      return { success: false, error: "Tavolo non trovato" };
    }
    
    const ordinazioni = await prisma.ordinazione.findMany({
      where: {
        tavoloId: tavolo.id,
        stato: 'CONSEGNATO',
        statoPagamento: 'NON_PAGATO'
      },
      include: {
        RigaOrdinazione: true
      }
    });
    
    if (ordinazioni.length === 0) {
      return { success: false, error: "Nessun ordine da dividere" };
    }
    
    // Crea una mappa delle righe per ID
    const righeMap = new Map();
    ordinazioni.forEach(o => {
      o.RigaOrdinazione.forEach((r: any) => {
        righeMap.set(r.id, { ...r, ordinazioneId: o.id });
      });
    });
    
    // Esegui la divisione in una transazione
    await prisma.$transaction(async (tx) => {
      // Per ogni persona, crea una nuova ordinazione con i suoi items
      for (const persona of persone) {
        if (persona.items.length === 0) continue;
        
        // Trova l'ordinazione originale del primo item (per copiare i dati base)
        const primaRiga = righeMap.get(persona.items[0].rigaId);
        const ordinazioneOriginale = ordinazioni.find(o => o.id === primaRiga.ordinazioneId);
        
        if (!ordinazioneOriginale) continue;
        
        // Crea nuova ordinazione per questa persona
        const nuovaOrdinazione = await tx.ordinazione.create({
          data: {
            id: `ord_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            tavoloId: tavolo.id,
            cameriereId: ordinazioneOriginale.cameriereId,
            tipo: ordinazioneOriginale.tipo,
            stato: 'CONSEGNATO',
            statoPagamento: 'NON_PAGATO',
            totale: persona.totale,
            dataApertura: new Date(),
            nomeCliente: persona.nome,
            note: `Conto diviso - ${persona.nome}`,
            updatedAt: new Date()
          }
        });
        
        // Crea le righe per questa persona
        for (const item of persona.items) {
          const rigaOriginale = righeMap.get(item.rigaId);
          if (!rigaOriginale) continue;
          
          await tx.rigaOrdinazione.create({
            data: {
              id: `riga_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              ordinazioneId: nuovaOrdinazione.id,
              prodottoId: rigaOriginale.prodottoId,
              quantita: item.quantity,
              prezzo: rigaOriginale.prezzo,
              stato: 'CONSEGNATO',
              postazione: rigaOriginale.postazione,
              note: rigaOriginale.note,
              updatedAt: new Date()
            }
          });
        }
      }
      
      // Marca le ordinazioni originali come "divise" aggiungendo una nota
      for (const ordinazione of ordinazioni) {
        await tx.ordinazione.update({
          where: { id: ordinazione.id },
          data: {
            statoPagamento: 'COMPLETAMENTE_PAGATO',
            note: `${ordinazione.note || ''} [CONTO DIVISO]`.trim()
          }
        });
      }
    });
    
    // Invia notifiche SSE
    // await sendSSEUpdate('bill:split', {
    //   tableNumber,
    //   peopleCount: persone.length,
    //   totalAmount: persone.reduce((sum, p) => sum + p.totale, 0)
    // });
    
    return { 
      success: true, 
      message: `Conto diviso tra ${persone.length} persone` 
    };
  } catch (error) {
    console.error("Error splitting bill:", error);
    return { success: false, error: "Errore durante la divisione del conto" };
  }
}