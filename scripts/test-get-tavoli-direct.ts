import { prisma } from "../lib/db";

async function testGetTavoliDirect() {
  try {
    console.log("=== Test diretto query getTavoli ===\n");
    
    // Replica esatta della query di getTavoli
    const tavoli = await prisma.tavolo.findMany({
      where: {
        attivo: true
      },
      include: {
        GruppoTavoli: true,
        Ordinazione: {
          where: {
            stato: {
              in: ["ORDINATO", "IN_PREPARAZIONE", "PRONTO"]
            }
          },
          select: {
            nomeCliente: true,
            note: true
          },
          orderBy: {
            dataApertura: 'asc'
          },
          take: 1
        }
      },
      orderBy: [
        { GruppoTavoli: { ordinamento: 'asc' } },
        { ordinamento: 'asc' },
        { numero: 'asc' }
      ]
    });
    
    console.log(`Totale tavoli trovati: ${tavoli.length}`);
    console.log("\nOrdine dei gruppi come appaiono:");
    console.log("--------------------------------");
    
    const gruppiInOrdine: string[] = [];
    const gruppiVisti = new Set<string>();
    
    tavoli.forEach(tavolo => {
      const nomeGruppo = tavolo.GruppoTavoli?.nome || 'Senza Gruppo';
      if (!gruppiVisti.has(nomeGruppo)) {
        gruppiVisti.add(nomeGruppo);
        gruppiInOrdine.push(nomeGruppo);
      }
    });
    
    gruppiInOrdine.forEach((gruppo, index) => {
      const gruppoInfo = tavoli.find(t => (t.GruppoTavoli?.nome || 'Senza Gruppo') === gruppo)?.GruppoTavoli;
      console.log(`${index + 1}. ${gruppo} (ordinamento: ${gruppoInfo?.ordinamento ?? 'N/A'})`);
    });
    
    // Mostra anche i primi 5 tavoli per debug
    console.log("\nPrimi 5 tavoli nell'ordine ricevuto:");
    console.log("------------------------------------");
    tavoli.slice(0, 5).forEach(tavolo => {
      console.log(`- Tavolo ${tavolo.numero} - Gruppo: ${tavolo.GruppoTavoli?.nome || 'Senza'} (ord: ${tavolo.GruppoTavoli?.ordinamento})`);
    });
    
  } catch (error) {
    console.error("❌ Errore:", error);
  } finally {
    await prisma.$disconnect();
  }
}

testGetTavoliDirect();