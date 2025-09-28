import { prisma } from "../lib/db";

async function fixGroupOrdering() {
  try {
    console.log("=== Sistemazione ordinamento gruppi ===\n");
    
    // Prima rimuoviamo i gruppi Gazebo duplicati
    console.log("1. Rimozione gruppi Gazebo duplicati...");
    
    // Troviamo il gruppo Gazebo principale
    const gazeboMain = await prisma.gruppoTavoli.findFirst({
      where: { nome: "Gazebo" }
    });

    if (gazeboMain) {
      // Spostiamo tutti i tavoli dai sottogruppi al gruppo principale
      const subGroups = await prisma.gruppoTavoli.findMany({
        where: {
          nome: {
            in: ["Gazebo 11-15", "Gazebo 21-25", "Gazebo 31-35"]
          }
        }
      });

      for (const subGroup of subGroups) {
        await prisma.tavolo.updateMany({
          where: { gruppoId: subGroup.id },
          data: { gruppoId: gazeboMain.id }
        });
        
        // Eliminiamo il sottogruppo
        await prisma.gruppoTavoli.delete({
          where: { id: subGroup.id }
        });
        
        console.log(`  - Eliminato gruppo: ${subGroup.nome}`);
      }
    }

    // Eliminiamo anche "Sotto copertura" se esiste
    const sottoCopertura = await prisma.gruppoTavoli.findFirst({
      where: { nome: "Sotto copertura" }
    });
    
    if (sottoCopertura) {
      // Prima spostiamo eventuali tavoli a Gazebo
      if (gazeboMain) {
        await prisma.tavolo.updateMany({
          where: { gruppoId: sottoCopertura.id },
          data: { gruppoId: gazeboMain.id }
        });
      }
      
      await prisma.gruppoTavoli.delete({
        where: { id: sottoCopertura.id }
      });
      console.log("  - Eliminato gruppo: Sotto copertura");
    }

    // Ora aggiorniamo l'ordinamento corretto
    console.log("\n2. Aggiornamento ordinamento gruppi...");
    
    const updates = [
      { nome: "Tavoli dentro", ordinamento: 0 },
      { nome: "Marciapiede", ordinamento: 1 },
      { nome: "Gazebo", ordinamento: 2 },
      { nome: "Piazza", ordinamento: 3 }
    ];

    for (const update of updates) {
      const result = await prisma.gruppoTavoli.updateMany({
        where: { nome: update.nome },
        data: { ordinamento: update.ordinamento }
      });
      console.log(`  - ${update.nome}: ordinamento = ${update.ordinamento} (${result.count} aggiornati)`);
    }

    // Verifichiamo il risultato finale
    console.log("\n3. Verifica ordinamento finale:");
    const finalGroups = await prisma.gruppoTavoli.findMany({
      orderBy: { ordinamento: 'asc' },
      select: {
        nome: true,
        ordinamento: true,
        _count: {
          select: { Tavolo: true }
        }
      }
    });

    finalGroups.forEach(group => {
      console.log(`  - ${group.nome}: ordinamento ${group.ordinamento} (${group._count.Tavolo} tavoli)`);
    });

    console.log("\n✅ Ordinamento sistemato con successo!");
    
  } catch (error) {
    console.error("❌ Errore:", error);
  } finally {
    await prisma.$disconnect();
  }
}

fixGroupOrdering();