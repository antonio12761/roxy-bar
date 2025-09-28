import { prisma } from "../lib/db";

async function restoreSingleGazebo() {
  try {
    console.log("🔄 Ripristino gruppo Gazebo unico...");
    
    // 1. Trova o crea il gruppo Gazebo
    let gazebo = await prisma.gruppoTavoli.findFirst({
      where: { nome: "Gazebo" }
    });
    
    if (!gazebo) {
      // Se non esiste, lo creiamo
      gazebo = await prisma.gruppoTavoli.create({
        data: {
          nome: "Gazebo",
          ordinamento: 2,
          icona: "Umbrella",
          colore: "#10b981",
          descrizione: "Area gazebo esterna"
        }
      });
      console.log("✅ Creato gruppo Gazebo");
    } else {
      // Se esiste, lo riattiva
      await prisma.gruppoTavoli.update({
        where: { id: gazebo.id },
        data: {
          attivo: true,
          ordinamento: 2,
          icona: "Umbrella",
          colore: "#10b981"
        }
      });
      console.log("✅ Riattivato gruppo Gazebo");
    }
    
    // 2. Trova tutti i tavoli dei sottogruppi gazebo
    const sottogruppiGazebo = await prisma.gruppoTavoli.findMany({
      where: {
        nome: {
          startsWith: "Gazebo "
        }
      }
    });
    
    // 3. Sposta tutti i tavoli nel gruppo Gazebo principale
    for (const sottogruppo of sottogruppiGazebo) {
      await prisma.tavolo.updateMany({
        where: { gruppoId: sottogruppo.id },
        data: { gruppoId: gazebo.id }
      });
      
      // Disattiva il sottogruppo
      await prisma.gruppoTavoli.update({
        where: { id: sottogruppo.id },
        data: { attivo: false }
      });
      
      console.log(`♻️ Migrati tavoli da ${sottogruppo.nome} e disattivato il gruppo`);
    }
    
    // 4. Sistema l'ordinamento degli altri gruppi
    const updates = [
      { nome: "Tavoli dentro", ordinamento: 0 },
      { nome: "Marciapiede", ordinamento: 1 },
      { nome: "Gazebo", ordinamento: 2 },
      { nome: "Piazza", ordinamento: 3 }
    ];
    
    for (const update of updates) {
      await prisma.gruppoTavoli.updateMany({
        where: { nome: update.nome, attivo: true },
        data: { ordinamento: update.ordinamento }
      });
    }
    
    // 5. Mostra il risultato finale
    console.log("\n📊 Ordinamento finale gruppi:");
    const gruppiFinal = await prisma.gruppoTavoli.findMany({
      where: { attivo: true },
      orderBy: { ordinamento: 'asc' },
      include: {
        _count: {
          select: { Tavolo: true }
        }
      }
    });
    
    gruppiFinal.forEach((g, index) => {
      console.log(`${index + 1}. ${g.nome} (ordinamento: ${g.ordinamento}, tavoli: ${g._count.Tavolo})`);
    });
    
    // Mostra i tavoli nel gruppo Gazebo
    const tavoliGazebo = await prisma.tavolo.findMany({
      where: { gruppoId: gazebo.id, attivo: true },
      orderBy: { numero: 'asc' }
    });
    
    console.log(`\n📋 Tavoli in Gazebo: ${tavoliGazebo.map(t => t.numero).join(', ')}`);
    
    console.log("\n✨ Ripristino completato!");
    
  } catch (error) {
    console.error("❌ Errore:", error);
  } finally {
    await prisma.$disconnect();
  }
}

restoreSingleGazebo();