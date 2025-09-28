import { prisma } from "../lib/db";

async function checkTavoliCameriere() {
  console.log("🔍 Controllo ordinamento tavoli come li vede il cameriere...\n");

  try {
    // Recupera i tavoli con la stessa query usata in getTavoli()
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

    // Raggruppa i tavoli per gruppo come fa la pagina cameriere
    const gruppiMap = new Map();
    const gruppiOrdinati = [];
    
    tavoli.forEach((tavolo) => {
      const groupName = tavolo.GruppoTavoli?.nome || tavolo.zona || 'Senza Gruppo';
      
      if (!gruppiMap.has(groupName)) {
        gruppiMap.set(groupName, {
          nome: groupName,
          ordinamento: tavolo.GruppoTavoli?.ordinamento ?? 999,
          tavoli: []
        });
        gruppiOrdinati.push(groupName);
      }
      
      gruppiMap.get(groupName).tavoli.push(tavolo.numero);
    });

    console.log("📱 Ordine gruppi come apparirebbe nel cameriere:");
    console.log("==============================================");
    
    gruppiOrdinati.forEach((nomeGruppo, index) => {
      const gruppo = gruppiMap.get(nomeGruppo);
      console.log(`${index + 1}. ${nomeGruppo} (ordinamento DB: ${gruppo.ordinamento})`);
      console.log(`   Tavoli: ${gruppo.tavoli.join(', ')}`);
      console.log("");
    });

    // Verifica anche direttamente i gruppi
    console.log("\n📊 Controllo diretto gruppi dal DB:");
    console.log("===================================");
    const gruppiDiretti = await prisma.gruppoTavoli.findMany({
      where: { attivo: true },
      orderBy: { ordinamento: 'asc' }
    });
    
    gruppiDiretti.forEach((g, i) => {
      console.log(`${i + 1}. ${g.nome} (ordinamento: ${g.ordinamento})`);
    });

  } catch (error) {
    console.error("❌ Errore:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Esegui lo script
checkTavoliCameriere();