import { prisma } from "../lib/db";

async function checkGroupOrder() {
  try {
    // Get all groups ordered by ordinamento
    const groups = await prisma.gruppoTavoli.findMany({
      orderBy: {
        ordinamento: 'asc'
      },
      select: {
        id: true,
        nome: true,
        ordinamento: true
      }
    });

    console.log("=== Ordinamento Gruppi Tavoli ===\n");
    console.log("Ordine attuale nel database:");
    console.log("--------------------------------");
    
    groups.forEach((group, index) => {
      console.log(`${index + 1}. ${group.nome} (ordinamento: ${group.ordinamento})`);
    });

    console.log("\n--------------------------------");
    console.log(`Totale gruppi: ${groups.length}`);
    
  } catch (error) {
    console.error("Errore:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkGroupOrder();