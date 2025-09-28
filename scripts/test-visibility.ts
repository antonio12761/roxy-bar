import { prisma } from "../lib/db";

async function testVisibility() {
  try {
    console.log("=== Test Visibilità Tavoli e Gruppi ===\n");
    
    // 1. Mostra tutti i gruppi e tavoli
    console.log("1. Stato attuale:");
    const gruppi = await prisma.gruppoTavoli.findMany({
      where: { attivo: true },
      include: {
        _count: {
          select: { Tavolo: true }
        }
      },
      orderBy: { ordinamento: 'asc' }
    });
    
    for (const gruppo of gruppi) {
      console.log(`\n${gruppo.nome}:`);
      console.log(`  - Visibile: ${gruppo.visibile === false ? 'NO' : 'SI'}`);
      console.log(`  - Tavoli totali: ${gruppo._count.Tavolo}`);
      
      const tavoli = await prisma.tavolo.findMany({
        where: { 
          gruppoId: gruppo.id,
          attivo: true 
        },
        orderBy: { numero: 'asc' }
      });
      
      const visibili = tavoli.filter(t => t.visibile !== false).length;
      const nascosti = tavoli.filter(t => t.visibile === false).length;
      
      console.log(`  - Tavoli visibili: ${visibili}`);
      console.log(`  - Tavoli nascosti: ${nascosti}`);
      
      if (nascosti > 0) {
        const tavoliNascosti = tavoli.filter(t => t.visibile === false);
        console.log(`    Nascosti: ${tavoliNascosti.map(t => t.numero).join(', ')}`);
      }
    }
    
    // 2. Test nascondere un tavolo
    console.log("\n2. Test nascondere tavolo 15:");
    const tavolo15 = await prisma.tavolo.findFirst({
      where: { numero: '15' }
    });
    
    if (tavolo15) {
      await prisma.tavolo.update({
        where: { id: tavolo15.id },
        data: { visibile: false }
      });
      console.log("   ✅ Tavolo 15 nascosto");
    }
    
    // 3. Test nascondere un gruppo
    console.log("\n3. Test nascondere gruppo Piazza:");
    const gruppoPiazza = await prisma.gruppoTavoli.findFirst({
      where: { nome: 'Piazza' }
    });
    
    if (gruppoPiazza) {
      await prisma.gruppoTavoli.update({
        where: { id: gruppoPiazza.id },
        data: { visibile: false }
      });
      console.log("   ✅ Gruppo Piazza nascosto");
    }
    
    // 4. Verifica query getTavoli (simulata)
    console.log("\n4. Simulazione query getTavoli (solo visibili):");
    const tavoliVisibili = await prisma.tavolo.findMany({
      where: {
        attivo: true,
        visibile: true,
        GruppoTavoli: {
          visibile: true
        }
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
    
    const gruppiVisibili = new Map<string, number>();
    tavoliVisibili.forEach(t => {
      const gruppo = t.GruppoTavoli?.nome || 'Senza Gruppo';
      gruppiVisibili.set(gruppo, (gruppiVisibili.get(gruppo) || 0) + 1);
    });
    
    console.log(`   Totale tavoli visibili: ${tavoliVisibili.length}`);
    console.log("   Gruppi visibili:");
    gruppiVisibili.forEach((count, nome) => {
      console.log(`     - ${nome}: ${count} tavoli`);
    });
    
    // 5. Ripristina visibilità
    console.log("\n5. Ripristino visibilità:");
    
    if (tavolo15) {
      await prisma.tavolo.update({
        where: { id: tavolo15.id },
        data: { visibile: true }
      });
      console.log("   ✅ Tavolo 15 ripristinato");
    }
    
    if (gruppoPiazza) {
      await prisma.gruppoTavoli.update({
        where: { id: gruppoPiazza.id },
        data: { visibile: true }
      });
      console.log("   ✅ Gruppo Piazza ripristinato");
    }
    
    console.log("\n✅ Test completato!");
    
  } catch (error) {
    console.error("❌ Errore:", error);
  } finally {
    await prisma.$disconnect();
  }
}

testVisibility();