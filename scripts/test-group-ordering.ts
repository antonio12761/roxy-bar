import { getTavoli } from "../lib/actions/ordinazioni/tavoli";
import { getTavoliAdmin } from "../lib/actions/tavoli";

async function testGroupOrdering() {
  try {
    console.log("=== Test Ordinamento Gruppi ===\n");
    
    // Test cameriere view
    console.log("1. Vista Cameriere (getTavoli):");
    console.log("--------------------------------");
    const tavoliCameriere = await getTavoli();
    
    // Estrai i gruppi unici mantenendo l'ordine
    const gruppiCameriere: string[] = [];
    const gruppiVisti = new Set<string>();
    
    tavoliCameriere.forEach((tavolo: any) => {
      const gruppo = tavolo.GruppoTavoli?.nome || 'Senza Gruppo';
      if (!gruppiVisti.has(gruppo)) {
        gruppiVisti.add(gruppo);
        gruppiCameriere.push(gruppo);
      }
    });
    
    gruppiCameriere.forEach((gruppo, index) => {
      console.log(`${index + 1}. ${gruppo}`);
    });
    
    // Test admin view
    console.log("\n2. Vista Admin (getTavoliAdmin):");
    console.log("--------------------------------");
    const adminResult = await getTavoliAdmin();
    
    if (adminResult.success && adminResult.gruppi) {
      adminResult.gruppi.forEach((gruppo: any, index: number) => {
        console.log(`${index + 1}. ${gruppo.nome} (ordinamento: ${gruppo.ordinamento})`);
      });
    }
    
    console.log("\n✅ Test completato!");
    
  } catch (error) {
    console.error("❌ Errore:", error);
  }
}

testGroupOrdering();