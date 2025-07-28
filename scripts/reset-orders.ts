import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetOrders() {
  try {
    console.log('🔄 Azzeramento ordinazioni in corso...\n');

    // 1. Elimina tutti i pagamenti
    const deletedPagamenti = await prisma.pagamento.deleteMany({});
    console.log(`✅ Eliminati ${deletedPagamenti.count} pagamenti`);

    // 2. Elimina tutti i prodotti in pagamento
    const deletedProdottiInPagamento = await prisma.prodottiInPagamento.deleteMany({});
    console.log(`✅ Eliminati ${deletedProdottiInPagamento.count} prodotti in pagamento`);

    // 3. Elimina tutte le richieste di pagamento
    const deletedRichiestePagamento = await prisma.richiestaPagemento.deleteMany({});
    console.log(`✅ Eliminate ${deletedRichiestePagamento.count} richieste di pagamento`);

    // 4. Elimina tutte le righe di ordinazione
    const deletedRighe = await prisma.rigaOrdinazione.deleteMany({});
    console.log(`✅ Eliminate ${deletedRighe.count} righe di ordinazione`);

    // 5. Elimina tutte le ordinazioni
    const deletedOrdinazioni = await prisma.ordinazione.deleteMany({});
    console.log(`✅ Eliminate ${deletedOrdinazioni.count} ordinazioni`);

    // 6. Libera tutti i tavoli
    const updatedTavoli = await prisma.tavolo.updateMany({
      where: {
        stato: {
          in: ['OCCUPATO', 'RISERVATO']
        }
      },
      data: {
        stato: 'LIBERO'
      }
    });
    console.log(`✅ Liberati ${updatedTavoli.count} tavoli`);

    // 7. Elimina tutte le notifiche
    const deletedNotifiche = await prisma.notifica.deleteMany({});
    console.log(`✅ Eliminate ${deletedNotifiche.count} notifiche`);

    // 8. Elimina tutte le notifiche di pagamento
    const deletedNotifichePagamento = await prisma.notificaPagamento.deleteMany({});
    console.log(`✅ Eliminate ${deletedNotifichePagamento.count} notifiche di pagamento`);

    console.log('\n🎉 Azzeramento completato! Tutti gli ordini sono stati eliminati.');
    console.log('📋 Stato finale:');
    console.log('   - Ordinazioni: 0');
    console.log('   - Righe ordinazione: 0');
    console.log('   - Pagamenti: 0');
    console.log('   - Tavoli: tutti liberi');
    console.log('   - Notifiche: 0');

  } catch (error) {
    console.error('❌ Errore durante l\'azzeramento:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Chiedi conferma prima di procedere
console.log('⚠️  ATTENZIONE: Questo script eliminerà TUTTE le ordinazioni, pagamenti e libererà tutti i tavoli!');
console.log('   Questo non può essere annullato.');
console.log('   Premi Ctrl+C per annullare, oppure aspetta 5 secondi per continuare...\n');

setTimeout(() => {
  resetOrders();
}, 5000);