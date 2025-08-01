import { prisma } from "@/lib/db";

async function checkDeliveredOrders() {
  console.log("🔍 Controllo ordini consegnati nel database...\n");
  
  try {
    // Conta tutti gli ordini per stato
    const countByStato = await prisma.ordinazione.groupBy({
      by: ['stato'],
      _count: true
    });
    
    console.log("📊 Conteggio ordini per stato:");
    countByStato.forEach(item => {
      console.log(`  - ${item.stato}: ${item._count} ordini`);
    });
    
    // Verifica ordini CONSEGNATO
    const ordiniConsegnati = await prisma.ordinazione.findMany({
      where: {
        stato: "CONSEGNATO"
      },
      include: {
        Tavolo: true,
        User: true
      }
    });
    
    console.log(`\n📦 Dettagli ordini CONSEGNATI (${ordiniConsegnati.length} totali):`);
    ordiniConsegnati.forEach(ord => {
      console.log(`  - Ordine #${ord.numero}:`);
      console.log(`    • Tavolo: ${ord.Tavolo?.numero || ord.tipo}`);
      console.log(`    • Cameriere: ${ord.User?.nome}`);
      console.log(`    • Stato pagamento: ${ord.statoPagamento}`);
      console.log(`    • Totale: €${ord.totale}`);
      console.log(`    • Data consegna: ${ord.updatedAt}`);
    });
    
    // Verifica ordini CONSEGNATI non completamente pagati
    const ordiniDaPagare = await prisma.ordinazione.findMany({
      where: {
        stato: {
          in: ["CONSEGNATO", "RICHIESTA_CONTO"]
        },
        statoPagamento: {
          not: "COMPLETAMENTE_PAGATO"
        }
      },
      include: {
        Tavolo: true,
        User: true,
        Pagamento: true
      }
    });
    
    console.log(`\n💰 Ordini consegnati DA PAGARE (${ordiniDaPagare.length} totali):`);
    ordiniDaPagare.forEach(ord => {
      const totalePagamenti = ord.Pagamento.reduce((sum, pag) => sum + pag.importo.toNumber(), 0);
      console.log(`  - Ordine #${ord.numero}:`);
      console.log(`    • Tavolo: ${ord.Tavolo?.numero || ord.tipo}`);
      console.log(`    • Stato: ${ord.stato}`);
      console.log(`    • Stato pagamento: ${ord.statoPagamento}`);
      console.log(`    • Totale: €${ord.totale}`);
      console.log(`    • Pagato: €${totalePagamenti}`);
      console.log(`    • Rimanente: €${ord.totale.toNumber() - totalePagamenti}`);
    });
    
  } catch (error) {
    console.error("❌ Errore durante il controllo:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDeliveredOrders();