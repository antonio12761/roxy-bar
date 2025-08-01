"use server";

import { prisma } from "@/lib/db";
// import { auth } from "@clerk/nextjs/server"; // Temporarily disabled

export async function getRiepilogoTurno(timeRange: 'oggi' | 'settimana' | 'mese') {
  try {
    // const { userId } = await auth();
    // if (!userId) {
    //   throw new Error("Utente non autenticato");
    // }
    
    // Get current user - temporarily use a placeholder
    const user = await prisma.user.findFirst();
    
    if (!user) {
      throw new Error("Utente non trovato");
    }
    
    // Calculate date range
    const now = new Date();
    let startDate: Date;
    
    switch (timeRange) {
      case 'oggi':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'settimana':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        break;
      case 'mese':
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 1);
        break;
    }
    
    // Get orders for the period
    const ordini = await prisma.ordinazione.findMany({
      where: {
        cameriereId: user.id,
        dataApertura: {
          gte: startDate
        }
      },
      include: {
        RigaOrdinazione: {
          include: {
            Prodotto: true
          }
        },
        Tavolo: true
      }
    }) as any[];
    
    // Calculate statistics
    const ordiniCompletati = ordini.filter(o => o.stato === 'CONSEGNATO').length;
    const ordiniInCorso = ordini.filter(o => ['ATTIVO', 'IN_PREPARAZIONE', 'PRONTO'].includes(o.stato)).length;
    const totaleIncassato = ordini
      .filter(o => o.statoPagamento === 'COMPLETAMENTE_PAGATO')
      .reduce((sum, o) => sum + o.totale.toNumber(), 0);
    const mediaOrdine = ordiniCompletati > 0 ? totaleIncassato / ordiniCompletati : 0;
    
    const tavoliServiti = new Set(ordini.map(o => o.tavoloId).filter(Boolean)).size;
    const prodottiVenduti = ordini.reduce((sum, o) => sum + (o.RigaOrdinazione?.length || 0), 0);
    
    // Calculate average service time (mock data for now)
    const tempoMedioServizio = 25; // minutes
    
    // Get most sold products
    const prodottiMap = new Map<string, { quantita: number; ricavo: number }>();
    ordini.forEach(ordine => {
      if (ordine.RigaOrdinazione) {
        ordine.RigaOrdinazione.forEach((riga: any) => {
        const key = riga.Prodotto.nome;
        const existing = prodottiMap.get(key) || { quantita: 0, ricavo: 0 };
        prodottiMap.set(key, {
          quantita: existing.quantita + riga.quantita,
          ricavo: existing.ricavo + (riga.quantita * riga.prezzo.toNumber())
        });
      });
      }
    });
    
    const prodottiPiuVenduti = Array.from(prodottiMap.entries())
      .map(([nome, data]) => ({ nome, ...data }))
      .sort((a, b) => b.quantita - a.quantita)
      .slice(0, 5);
    
    // Get recent orders
    const ordiniRecenti = ordini
      .filter(o => o.stato === 'CONSEGNATO')
      .sort((a, b) => b.dataApertura.getTime() - a.dataApertura.getTime())
      .slice(0, 10)
      .map(o => ({
        id: o.id,
        tavolo: o.Tavolo?.numero.toString() || 'N/A',
        totale: o.totale.toNumber(),
        stato: o.stato,
        ora: o.dataApertura.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
        prodotti: o.RigaOrdinazione?.length || 0
      }));
    
    // Calculate hourly trend
    const andamentoOrario: { [hour: string]: { ordini: number; ricavo: number } } = {};
    
    ordini.forEach(ordine => {
      const hour = ordine.dataApertura.getHours();
      const hourKey = `${hour}:00`;
      
      if (!andamentoOrario[hourKey]) {
        andamentoOrario[hourKey] = { ordini: 0, ricavo: 0 };
      }
      
      andamentoOrario[hourKey].ordini++;
      if (ordine.statoPagamento === 'COMPLETAMENTE_PAGATO') {
        andamentoOrario[hourKey].ricavo += ordine.totale.toNumber();
      }
    });
    
    const andamentoOrarioArray = Object.entries(andamentoOrario)
      .map(([ora, data]) => ({ ora, ...data }))
      .sort((a, b) => parseInt(a.ora) - parseInt(b.ora));
    
    return {
      statistiche: {
        ordiniCompletati,
        ordiniInCorso,
        totaleIncassato,
        mediaOrdine,
        tavoliServiti,
        prodottiVenduti,
        tempoMedioServizio
      },
      prodottiPiuVenduti,
      ordiniRecenti,
      andamentoOrario: andamentoOrarioArray
    };
  } catch (error) {
    console.error("Error getting shift summary:", error);
    throw error;
  }
}