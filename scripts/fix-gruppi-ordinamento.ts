import { prisma } from "../lib/db";

async function fixGruppiOrdinamento() {
  try {
    console.log("🔧 Controllo ordinamento gruppi tavoli...");
    
    // Recupera tutti i gruppi attivi
    const gruppi = await prisma.gruppoTavoli.findMany({
      where: { attivo: true },
      orderBy: { ordinamento: 'asc' }
    });
    
    console.log("\n📊 Stato attuale:");
    gruppi.forEach(g => {
      console.log(`- ${g.nome}: ordinamento = ${g.ordinamento}`);
    });
    
    // Definisci l'ordine corretto
    const ordineCorretto = [
      "Tavoli dentro",
      "Marciapiede", 
      "Sotto copertura",
      "Piazza"
    ];
    
    console.log("\n🔄 Aggiorno ordinamento secondo:", ordineCorretto);
    
    // Aggiorna ordinamento
    for (let i = 0; i < ordineCorretto.length; i++) {
      const nomeGruppo = ordineCorretto[i];
      const gruppo = gruppi.find(g => g.nome === nomeGruppo);
      
      if (gruppo && gruppo.ordinamento !== i) {
        await prisma.gruppoTavoli.update({
          where: { id: gruppo.id },
          data: { ordinamento: i }
        });
        console.log(`✅ Aggiornato ${nomeGruppo}: ordinamento = ${i}`);
      }
    }
    
    // Verifica finale
    console.log("\n📊 Stato finale:");
    const gruppiFinal = await prisma.gruppoTavoli.findMany({
      where: { attivo: true },
      orderBy: { ordinamento: 'asc' }
    });
    
    gruppiFinal.forEach((g, index) => {
      console.log(`${index + 1}. ${g.nome} (ordinamento: ${g.ordinamento})`);
    });
    
    console.log("\n✨ Ordinamento sistemato!");
    
  } catch (error) {
    console.error("❌ Errore:", error);
  } finally {
    await prisma.$disconnect();
  }
}

fixGruppiOrdinamento();