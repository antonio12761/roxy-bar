import { prisma } from "../lib/db";

async function checkOrders() {
  try {
    console.log("🔍 Controllo ordinazioni nel database...");
    
    // Controlla tutte le ordinazioni
    const allOrders = await prisma.ordinazione.findMany({
      include: {
        RigaOrdinazione: {
          include: {
            Prodotto: true
          }
        },
        Tavolo: true,
        User: true
      }
    });
    
    console.log(`\n📊 Totale ordinazioni: ${allOrders.length}`);
    
    // Raggruppa per stato
    const byStatus = allOrders.reduce((acc, order) => {
      acc[order.stato] = (acc[order.stato] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log("\n📊 Ordinazioni per stato:");
    Object.entries(byStatus).forEach(([stato, count]) => {
      console.log(`  - ${stato}: ${count}`);
    });
    
    // Mostra ordinazioni attive
    const activeOrders = allOrders.filter(o => 
      ["ORDINATO", "IN_PREPARAZIONE", "PRONTO"].includes(o.stato)
    );
    
    console.log(`\n🔥 Ordinazioni attive: ${activeOrders.length}`);
    
    activeOrders.forEach(order => {
      console.log(`\n📋 Ordine ${order.numero}:`);
      console.log(`  - ID: ${order.id}`);
      console.log(`  - Stato: ${order.stato}`);
      console.log(`  - Tavolo: ${order.Tavolo?.numero || 'N/A'}`);
      console.log(`  - Cameriere: ${order.User?.nome || 'N/A'}`);
      console.log(`  - Data: ${order.dataApertura}`);
      console.log(`  - Totale: €${order.totale}`);
      console.log(`  - Righe ordine: ${order.RigaOrdinazione?.length || 0}`);
      
      if (order.RigaOrdinazione && order.RigaOrdinazione.length > 0) {
        console.log("  - Prodotti:");
        order.RigaOrdinazione.forEach(riga => {
          console.log(`    • ${riga.quantita}x ${riga.Prodotto?.nome || 'Prodotto sconosciuto'} - ${riga.stato}`);
        });
      }
    });
    
    // Controlla la struttura delle righe
    const ordersWithoutRighe = activeOrders.filter(o => !o.RigaOrdinazione || o.RigaOrdinazione.length === 0);
    if (ordersWithoutRighe.length > 0) {
      console.log(`\n⚠️  Ordinazioni attive SENZA righe: ${ordersWithoutRighe.length}`);
      ordersWithoutRighe.forEach(o => {
        console.log(`  - Ordine ${o.numero} (ID: ${o.id})`);
      });
    }
    
  } catch (error) {
    console.error("❌ Errore:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkOrders();