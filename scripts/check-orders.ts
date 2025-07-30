import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🔍 Controllo ordinazioni nel database...\n");

  // Conta ordinazioni per stato
  const countByStato = await prisma.ordinazione.groupBy({
    by: ['stato'],
    _count: true
  });

  console.log("📊 Ordinazioni per stato:");
  countByStato.forEach(({ stato, _count }) => {
    console.log(`   ${stato}: ${_count}`);
  });

  // Ordinazioni recenti
  const ordinazioniRecenti = await prisma.ordinazione.findMany({
    take: 5,
    orderBy: {
      dataApertura: 'asc'
    },
    include: {
      tavolo: true,
      cameriere: {
        select: {
          nome: true
        }
      },
      righe: {
        include: {
          prodotto: {
            select: {
              nome: true
            }
          }
        }
      }
    }
  });

  console.log("\n📋 Ultime 5 ordinazioni:");
  ordinazioniRecenti.forEach(ord => {
    console.log(`\n🆔 Ordine #${ord.numero}`);
    console.log(`   Stato: ${ord.stato}`);
    console.log(`   Pagamento: ${ord.statoPagamento}`);
    console.log(`   Tavolo: ${ord.tavolo ? ord.tavolo.numero : 'N/A'}`);
    console.log(`   Cameriere: ${ord.cameriere.nome}`);
    console.log(`   Totale: €${ord.totale}`);
    console.log(`   Data: ${ord.dataApertura.toLocaleString()}`);
    console.log(`   Prodotti:`);
    ord.righe.forEach(riga => {
      console.log(`     - ${riga.prodotto.nome} x${riga.quantita} (${riga.stato})`);
    });
  });

  // Tavoli occupati
  const tavoliOccupati = await prisma.tavolo.count({
    where: {
      stato: "OCCUPATO"
    }
  });

  console.log(`\n🪑 Tavoli occupati: ${tavoliOccupati}`);
}

main()
  .catch((e) => {
    console.error("❌ Errore:", e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });