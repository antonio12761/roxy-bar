import { prisma } from "../lib/db";

async function checkGruppiOrdinamento() {
  console.log("🔍 Controllo ordinamento gruppi tavoli...\n");

  try {
    // Recupera tutti i gruppi attivi ordinati per ordinamento
    const gruppi = await prisma.gruppoTavoli.findMany({
      where: { attivo: true },
      orderBy: { ordinamento: 'asc' },
      select: {
        id: true,
        nome: true,
        ordinamento: true,
        _count: {
          select: { Tavolo: true }
        }
      }
    });

    console.log("📊 Gruppi trovati (ordinati per campo 'ordinamento'):");
    console.log("================================================");
    
    gruppi.forEach((gruppo, index) => {
      console.log(`${index + 1}. ${gruppo.nome}`);
      console.log(`   - ID: ${gruppo.id}`);
      console.log(`   - Ordinamento: ${gruppo.ordinamento}`);
      console.log(`   - Numero tavoli: ${gruppo._count.Tavolo}`);
      console.log("");
    });

    // Controlla se ci sono duplicati nell'ordinamento
    const ordinamenti = gruppi.map(g => g.ordinamento);
    const hasDuplicates = ordinamenti.length !== new Set(ordinamenti).size;
    
    if (hasDuplicates) {
      console.log("⚠️  ATTENZIONE: Ci sono valori duplicati nel campo ordinamento!");
      
      const counts = {};
      ordinamenti.forEach(ord => {
        counts[ord] = (counts[ord] || 0) + 1;
      });
      
      Object.entries(counts).forEach(([ord, count]) => {
        if (count > 1) {
          console.log(`   - Ordinamento ${ord}: ${count} gruppi`);
        }
      });
    } else {
      console.log("✅ Nessun duplicato nel campo ordinamento");
    }

    // Mostra anche l'ordine che vedrebbe il cameriere
    console.log("\n📱 Vista Cameriere (come apparirebbe nell'app):");
    console.log("==============================================");
    gruppi.forEach((gruppo, index) => {
      console.log(`${index + 1}. ${gruppo.nome}`);
    });

  } catch (error) {
    console.error("❌ Errore:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Esegui lo script
checkGruppiOrdinamento();