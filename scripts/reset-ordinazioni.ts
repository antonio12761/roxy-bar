import { prisma } from "../lib/db";

async function resetOrdinazioni() {
  console.log("🗑️  Resetting all ordinazioni...");
  
  try {
    // Prima elimina tutte le righe ordinazione
    const deletedRighe = await prisma.rigaOrdinazione.deleteMany({});
    console.log(`✅ Deleted ${deletedRighe.count} righe ordinazione`);
    
    // Elimina tutti gli ordini esauriti
    const deletedOrdiniEsauriti = await prisma.ordineEsaurito.deleteMany({});
    console.log(`✅ Deleted ${deletedOrdiniEsauriti.count} ordini esauriti`);
    
    // Poi elimina tutte le ordinazioni
    const deletedOrdinazioni = await prisma.ordinazione.deleteMany({});
    console.log(`✅ Deleted ${deletedOrdinazioni.count} ordinazioni`);
    
    // Reset anche i pagamenti se presenti
    const deletedPagamenti = await prisma.pagamento.deleteMany({});
    console.log(`✅ Deleted ${deletedPagamenti.count} pagamenti`);
    
    // Reset stato tavoli - li rende tutti liberi
    const updatedTavoli = await prisma.tavolo.updateMany({
      data: {
        stato: 'LIBERO'
      }
    });
    console.log(`✅ Reset ${updatedTavoli.count} tavoli to free status`);
    
    console.log("✨ Database reset completed successfully!");
  } catch (error) {
    console.error("❌ Error resetting database:", error);
  } finally {
    await prisma.$disconnect();
  }
}

resetOrdinazioni();