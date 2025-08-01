import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    // Per ora simulo le richieste di scontrino
    // In un sistema reale, queste potrebbero essere memorizzate in una tabella dedicata
    const ordinazioniConsegnate = await prisma.ordinazione.findMany({
      where: {
        stato: "CONSEGNATO",
        // Filtra solo quelle che potrebbero aver bisogno di scontrino
        dataChiusura: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Ultime 24 ore
        }
      },
      include: {
        Tavolo: {
          select: {
            numero: true
          }
        },
        User: {
          select: {
            nome: true
          }
        },
        Pagamento: {
          select: {
            importo: true,
            modalita: true,
            timestamp: true
          }
        }
      },
      orderBy: {
        dataChiusura: 'desc'
      },
      take: 20
    });

    // Simula richieste di scontrino basate sui pagamenti recenti
    const richiesteSimulate = ordinazioniConsegnate
      .filter(ord => ord.Pagamento.length > 0) // Solo ordini pagati
      .map(ord => {
        const ultimoPagamento = ord.Pagamento[ord.Pagamento.length - 1];
        const importoTotale = ord.Pagamento.reduce((sum: number, pag: any) => sum + pag.importo.toNumber(), 0);
        
        return {
          id: `req-${ord.id}`,
          orderId: ord.id,
          tavolo: ord.Tavolo,
          tipo: ord.tipo,
          richiedente: ord.User?.nome || "Sistema",
          importo: importoTotale,
          dataRichiesta: ultimoPagamento.timestamp,
          stato: Math.random() > 0.7 ? "PENDING" : Math.random() > 0.5 ? "PROCESSING" : "COMPLETED"
        };
      })
      .filter(req => req.stato === "PENDING" || req.stato === "PROCESSING"); // Solo quelle da processare

    return NextResponse.json(richiesteSimulate);
  } catch (error) {
    console.error("Errore API receipt-requests:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}