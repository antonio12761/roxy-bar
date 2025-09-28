import { prisma } from "../lib/db";

async function setupGazeboGroups() {
  try {
    console.log("🏗️ Configurazione gruppi Gazebo...");
    
    // 1. Prima rinomina "Sotto copertura" in "Gazebo"
    const sottoCopertura = await prisma.gruppoTavoli.findFirst({
      where: { nome: "Sotto copertura", attivo: true }
    });
    
    if (sottoCopertura) {
      // Sposta i tavoli esistenti in un gruppo temporaneo
      const tavoliSottoCopertura = await prisma.tavolo.findMany({
        where: { gruppoId: sottoCopertura.id, attivo: true }
      });
      
      console.log(`📦 Trovati ${tavoliSottoCopertura.length} tavoli in "Sotto copertura"`);
      
      // Disattiva il vecchio gruppo
      await prisma.gruppoTavoli.update({
        where: { id: sottoCopertura.id },
        data: { attivo: false }
      });
      console.log("✅ Disattivato gruppo 'Sotto copertura'");
    }
    
    // 2. Crea i 3 gruppi Gazebo
    const gruppiGazebo = [
      { nome: "Gazebo 11-15", ordinamento: 2, icona: "Umbrella", colore: "#10b981" },
      { nome: "Gazebo 21-25", ordinamento: 3, icona: "Umbrella", colore: "#3b82f6" },
      { nome: "Gazebo 31-35", ordinamento: 4, icona: "Umbrella", colore: "#8b5cf6" }
    ];
    
    // 3. Sposta "Piazza" più in basso nell'ordinamento
    const piazza = await prisma.gruppoTavoli.findFirst({
      where: { nome: "Piazza", attivo: true }
    });
    
    if (piazza) {
      await prisma.gruppoTavoli.update({
        where: { id: piazza.id },
        data: { ordinamento: 5 }
      });
      console.log("✅ Aggiornato ordinamento Piazza a 5");
    }
    
    // 4. Crea i nuovi gruppi
    for (const gruppo of gruppiGazebo) {
      const existing = await prisma.gruppoTavoli.findFirst({
        where: { nome: gruppo.nome }
      });
      
      if (existing) {
        // Se esiste già, lo riattiva e aggiorna
        await prisma.gruppoTavoli.update({
          where: { id: existing.id },
          data: {
            attivo: true,
            ordinamento: gruppo.ordinamento,
            icona: gruppo.icona,
            colore: gruppo.colore,
            descrizione: `Tavoli ${gruppo.nome.split(" ")[1]}`
          }
        });
        console.log(`♻️ Riattivato gruppo: ${gruppo.nome}`);
      } else {
        // Altrimenti lo crea
        await prisma.gruppoTavoli.create({
          data: {
            nome: gruppo.nome,
            ordinamento: gruppo.ordinamento,
            icona: gruppo.icona,
            colore: gruppo.colore,
            descrizione: `Tavoli ${gruppo.nome.split(" ")[1]}`
          }
        });
        console.log(`✅ Creato gruppo: ${gruppo.nome}`);
      }
    }
    
    // 5. Sposta i tavoli nei gruppi corretti
    if (sottoCopertura) {
      const tavoliDaSpostare = await prisma.tavolo.findMany({
        where: { gruppoId: sottoCopertura.id }
      });
      
      for (const tavolo of tavoliDaSpostare) {
        const numeroTavolo = parseInt(tavolo.numero);
        let nuovoGruppoNome = "";
        
        if (numeroTavolo >= 11 && numeroTavolo <= 15) {
          nuovoGruppoNome = "Gazebo 11-15";
        } else if (numeroTavolo >= 21 && numeroTavolo <= 25) {
          nuovoGruppoNome = "Gazebo 21-25";
        } else if (numeroTavolo >= 31 && numeroTavolo <= 35) {
          nuovoGruppoNome = "Gazebo 31-35";
        }
        
        if (nuovoGruppoNome) {
          const nuovoGruppo = await prisma.gruppoTavoli.findFirst({
            where: { nome: nuovoGruppoNome, attivo: true }
          });
          
          if (nuovoGruppo) {
            await prisma.tavolo.update({
              where: { id: tavolo.id },
              data: { gruppoId: nuovoGruppo.id }
            });
            console.log(`➡️ Spostato tavolo ${tavolo.numero} in ${nuovoGruppoNome}`);
          }
        }
      }
    }
    
    // 6. Mostra il risultato finale
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
    
    console.log("\n✨ Configurazione gazebo completata!");
    
  } catch (error) {
    console.error("❌ Errore:", error);
  } finally {
    await prisma.$disconnect();
  }
}

setupGazeboGroups();