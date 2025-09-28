import { getTavoli } from "@/lib/actions/ordinazioni/tavoli";
import { prisma } from "@/lib/db";

// Simula un utente cameriere per il test
async function simulateUser() {
  const user = await prisma.user.findFirst({
    where: {
      ruolo: "CAMERIERE",
      attivo: true
    }
  });
  
  if (!user) {
    throw new Error("Nessun cameriere trovato nel database");
  }
  
  // Simula il contesto di autenticazione
  process.env.TEST_USER_ID = user.id;
  return user;
}

async function testCameriereGroupsOrder() {
  try {
    const user = await simulateUser();
    console.log(`\n=== TEST ORDINAMENTO GRUPPI - INTERFACCIA CAMERIERE ===`);
    console.log(`Simulando utente: ${user.email} (${user.ruolo})\n`);
    
    // Chiama la funzione getTavoli usata dall'interfaccia cameriere
    const tavoli = await getTavoli();
    
    // Estrai l'ordine dei gruppi
    const gruppiOrdinati: string[] = [];
    const gruppiVisti = new Set<string>();
    
    tavoli.forEach((tavolo: any) => {
      const nomeGruppo = tavolo.GruppoTavoli?.nome || 'Senza Gruppo';
      if (!gruppiVisti.has(nomeGruppo)) {
        gruppiVisti.add(nomeGruppo);
        gruppiOrdinati.push(nomeGruppo);
      }
    });
    
    console.log("Ordine dei gruppi come appaiono nell'interfaccia cameriere:");
    gruppiOrdinati.forEach((gruppo, index) => {
      console.log(`${index + 1}. ${gruppo}`);
    });
    
    // Confronta con l'ordine nel database
    console.log("\n=== CONFRONTO CON DATABASE ===");
    const gruppiDb = await prisma.gruppoTavoli.findMany({
      where: { attivo: true, visibile: true },
      orderBy: { ordinamento: 'asc' },
      select: { nome: true, ordinamento: true }
    });
    
    console.log("\nOrdine nel database:");
    gruppiDb.forEach((gruppo, index) => {
      console.log(`${index + 1}. ${gruppo.nome} (ordinamento: ${gruppo.ordinamento})`);
    });
    
    // Verifica se l'ordine corrisponde
    const ordineCorretto = gruppiOrdinati.every((gruppo, index) => 
      gruppiDb[index] && gruppo === gruppiDb[index].nome
    );
    
    if (ordineCorretto) {
      console.log("\n✅ L'ordine nell'interfaccia cameriere corrisponde al database!");
    } else {
      console.log("\n❌ L'ordine nell'interfaccia cameriere NON corrisponde al database!");
      console.log("\nPossibili cause:");
      console.log("1. Cache del browser non aggiornata");
      console.log("2. Problema nella query SQL");
      console.log("3. Trasformazione dei dati nel frontend");
    }
    
  } catch (error) {
    console.error("Errore:", error);
  } finally {
    await prisma.$disconnect();
  }
}

testCameriereGroupsOrder();