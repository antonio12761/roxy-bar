import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    console.log("Starting test-tavoli-db...");
    
    // Test semplice: conta tutti i tavoli
    const totalTavoli = await prisma.tavolo.count();
    
    // Conta tavoli attivi
    const tavoliAttivi = await prisma.tavolo.count({
      where: { attivo: true }
    });
    
    // Recupera primi 10 tavoli per vedere la struttura
    const sampleTavoli = await prisma.tavolo.findMany({
      take: 10,
      orderBy: { numero: 'asc' },
      include: {
        ordinazioni: {
          where: {
            stato: {
              in: ['ORDINATO', 'IN_LAVORAZIONE', 'PRONTO']
            }
          },
          take: 1
        }
      }
    });
    
    // Verifica se ci sono tavoli con ordinazioni
    const tavoliConOrdinazioni = await prisma.tavolo.count({
      where: {
        ordinazioni: {
          some: {
            stato: {
              in: ['ORDINATO', 'IN_LAVORAZIONE', 'PRONTO']
            }
          }
        }
      }
    });
    
    return NextResponse.json({
      totalTavoli,
      tavoliAttivi,
      tavoliConOrdinazioni,
      sampleTavoli: sampleTavoli.map(t => ({
        id: t.id,
        numero: t.numero,
        stato: t.stato,
        attivo: t.attivo,
        zona: t.zona,
        posti: t.posti,
        hasOrdinazioni: t.ordinazioni.length > 0
      }))
    });
  } catch (error) {
    console.error("Errore test tavoli:", error);
    return NextResponse.json(
      { error: "Errore nel test dei tavoli", details: error },
      { status: 500 }
    );
  }
}