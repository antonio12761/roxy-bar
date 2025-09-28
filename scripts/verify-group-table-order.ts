import { prisma } from "../lib/db";

async function verifyGroupTableOrder() {
  try {
    console.log("=== Verifica Ordinamento Completo ===\n");
    
    // Get all tables with groups, ordered as they would be in the app
    const tavoli = await prisma.tavolo.findMany({
      where: {
        attivo: true
      },
      include: {
        GruppoTavoli: true
      },
      orderBy: [
        { GruppoTavoli: { ordinamento: 'asc' } },
        { ordinamento: 'asc' },
        { numero: 'asc' }
      ]
    });

    // Group tables by their group
    const gruppi = new Map<string, any[]>();
    const ordineGruppi: string[] = [];
    
    tavoli.forEach(tavolo => {
      const nomeGruppo = tavolo.GruppoTavoli?.nome || 'Senza Gruppo';
      
      if (!gruppi.has(nomeGruppo)) {
        gruppi.set(nomeGruppo, []);
        ordineGruppi.push(nomeGruppo);
      }
      
      gruppi.get(nomeGruppo)?.push(tavolo);
    });

    console.log("Ordine dei gruppi come appaiono:");
    console.log("--------------------------------");
    ordineGruppi.forEach((gruppo, index) => {
      const tavoliGruppo = gruppi.get(gruppo) || [];
      const gruppoInfo = tavoliGruppo[0]?.GruppoTavoli;
      console.log(`${index + 1}. ${gruppo} (ordinamento: ${gruppoInfo?.ordinamento ?? 'N/A'}) - ${tavoliGruppo.length} tavoli`);
    });

    // Verifica ordine previsto
    const ordineAtteso = ["Tavoli dentro", "Marciapiede", "Gazebo", "Piazza"];
    console.log("\n✅ Ordine atteso:", ordineAtteso.join(" → "));
    console.log("📍 Ordine attuale:", ordineGruppi.join(" → "));
    
    const isCorrect = ordineGruppi.join(" → ") === ordineAtteso.join(" → ");
    console.log(isCorrect ? "\n✅ L'ordine è CORRETTO!" : "\n❌ L'ordine NON è corretto!");

    // Mostra dettagli Gazebo
    console.log("\n=== Dettagli Tavoli Gazebo ===");
    const tavoliGazebo = gruppi.get("Gazebo") || [];
    if (tavoliGazebo.length > 0) {
      console.log(`Totale tavoli Gazebo: ${tavoliGazebo.length}`);
      
      const ranges = [
        { label: "11-15", min: 11, max: 15 },
        { label: "21-25", min: 21, max: 25 },
        { label: "31-35", min: 31, max: 35 }
      ];
      
      ranges.forEach(range => {
        const tavoliRange = tavoliGazebo.filter(t => {
          const num = parseInt(t.numero);
          return num >= range.min && num <= range.max;
        });
        console.log(`  - Tavoli ${range.label}: ${tavoliRange.map(t => t.numero).sort((a, b) => parseInt(a) - parseInt(b)).join(", ")}`);
      });
    }
    
  } catch (error) {
    console.error("❌ Errore:", error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyGroupTableOrder();