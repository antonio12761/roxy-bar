import { prisma } from "../lib/db";

async function debugGroupOrdering() {
  try {
    console.log("=== Debug ordinamento gruppi e tavoli ===\n");
    
    // 1. Check group ordering
    const gruppi = await prisma.gruppoTavoli.findMany({
      orderBy: { ordinamento: 'asc' },
      include: {
        _count: {
          select: { Tavolo: true }
        }
      }
    });
    
    console.log("1. Gruppi nel database (ordinati per 'ordinamento'):");
    console.log("------------------------------------------------");
    gruppi.forEach(g => {
      console.log(`   ${g.nome} - ordinamento: ${g.ordinamento} (${g._count.Tavolo} tavoli)`);
    });
    
    // 2. Check how tables are ordered
    console.log("\n2. Come vengono ordinati i tavoli (stessa query di getTavoli):");
    console.log("---------------------------------------------------------------");
    
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
    
    // Extract group order from tables
    const gruppiOrdinati: string[] = [];
    const gruppiVisti = new Set<string>();
    
    tavoli.forEach(tavolo => {
      const nomeGruppo = tavolo.GruppoTavoli?.nome || 'Senza Gruppo';
      if (!gruppiVisti.has(nomeGruppo)) {
        gruppiVisti.add(nomeGruppo);
        gruppiOrdinati.push(nomeGruppo);
      }
    });
    
    console.log("   Ordine gruppi come appaiono nei tavoli:");
    gruppiOrdinati.forEach((g, i) => {
      console.log(`   ${i + 1}. ${g}`);
    });
    
    // 3. Check for any NULL ordinamento values
    console.log("\n3. Controllo valori NULL:");
    console.log("-------------------------");
    
    const gruppiConNullOrdinamento = await prisma.gruppoTavoli.findMany({
      where: {
        ordinamento: null
      }
    });
    
    if (gruppiConNullOrdinamento.length > 0) {
      console.log("   ⚠️  Gruppi con ordinamento NULL:");
      gruppiConNullOrdinamento.forEach(g => {
        console.log(`      - ${g.nome}`);
      });
    } else {
      console.log("   ✅ Nessun gruppo con ordinamento NULL");
    }
    
    // 4. Check for duplicate ordinamento values
    console.log("\n4. Controllo valori duplicati:");
    console.log("------------------------------");
    
    const ordinamentiCount = new Map<number, string[]>();
    gruppi.forEach(g => {
      const ord = g.ordinamento;
      if (!ordinamentiCount.has(ord)) {
        ordinamentiCount.set(ord, []);
      }
      ordinamentiCount.get(ord)?.push(g.nome);
    });
    
    let hasDuplicates = false;
    ordinamentiCount.forEach((gruppiNomi, ord) => {
      if (gruppiNomi.length > 1) {
        hasDuplicates = true;
        console.log(`   ⚠️  Ordinamento ${ord} usato da: ${gruppiNomi.join(', ')}`);
      }
    });
    
    if (!hasDuplicates) {
      console.log("   ✅ Nessun valore di ordinamento duplicato");
    }
    
    console.log("\n✅ Debug completato");
    
  } catch (error) {
    console.error("❌ Errore:", error);
  } finally {
    await prisma.$disconnect();
  }
}

debugGroupOrdering();