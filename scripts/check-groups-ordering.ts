import { prisma } from "@/lib/db";

async function checkGroupsOrdering() {
  try {
    // Recupera tutti i gruppi attivi
    const gruppi = await prisma.gruppoTavoli.findMany({
      where: { attivo: true },
      orderBy: { ordinamento: 'asc' },
      select: {
        id: true,
        nome: true,
        ordinamento: true,
        visibile: true
      }
    });

    console.log("\n=== ORDINAMENTO GRUPPI TAVOLI ===");
    console.log("Ordine basato sul campo 'ordinamento':\n");
    
    gruppi.forEach((gruppo, index) => {
      console.log(`${index + 1}. ${gruppo.nome}`);
      console.log(`   - ID: ${gruppo.id}`);
      console.log(`   - Ordinamento: ${gruppo.ordinamento}`);
      console.log(`   - Visibile: ${gruppo.visibile}`);
      console.log("");
    });

    // Verifica se ci sono valori duplicati
    const ordinamenti = gruppi.map(g => g.ordinamento);
    const duplicati = ordinamenti.filter((item, index) => ordinamenti.indexOf(item) !== index);
    
    if (duplicati.length > 0) {
      console.log("\n⚠️  ATTENZIONE: Trovati valori di ordinamento duplicati!");
      console.log("Valori duplicati:", [...new Set(duplicati)]);
    }

    // Suggerimento per correggere l'ordinamento
    console.log("\n=== SUGGERIMENTO PER CORREZIONE ===");
    console.log("Per impostare l'ordine desiderato (tavoli dentro, marciapiede, gazebo, piazza):");
    console.log("");
    
    const ordineDesiderato = [
      { nome: "Tavoli Dentro", ordinamento: 1 },
      { nome: "Marciapiede", ordinamento: 2 },
      { nome: "Gazebo", ordinamento: 3 },
      { nome: "Piazza", ordinamento: 4 }
    ];

    ordineDesiderato.forEach(({ nome, ordinamento }) => {
      const gruppo = gruppi.find(g => g.nome.toLowerCase() === nome.toLowerCase());
      if (gruppo) {
        console.log(`UPDATE "GruppoTavoli" SET ordinamento = ${ordinamento} WHERE id = ${gruppo.id}; -- ${gruppo.nome}`);
      }
    });

  } catch (error) {
    console.error("Errore:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkGroupsOrdering();