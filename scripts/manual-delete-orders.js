// Script per eliminare manualmente tutti gli ordini rispettando i vincoli di foreign key
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function deleteAllOrders() {
  console.log('===== INIZIO ELIMINAZIONE MANUALE ORDINI =====');
  
  try {
    // 1. Prima conta quanti record ci sono
    const counts = {
      ordinazioni: await prisma.ordinazione.count(),
      pagamenti: await prisma.pagamento.count(),
      paymentHistory: await prisma.paymentHistory.count(),
      righe: await prisma.rigaOrdinazione.count(),
      debiti: await prisma.debito.count(),
      pagamentiDebito: await prisma.pagamentoDebito.count(),
      movimenti: await prisma.movimentoContoScalare.count(),
      ordiniEsauriti: await prisma.ordineEsaurito.count()
    };
    
    console.log('Record presenti:', counts);
    
    // 2. Elimina PaymentHistory uno per uno
    console.log('\n--- Eliminazione PaymentHistory ---');
    const allPaymentHistory = await prisma.paymentHistory.findMany();
    for (const ph of allPaymentHistory) {
      try {
        await prisma.paymentHistory.delete({ where: { id: ph.id } });
        console.log(`✓ Eliminato PaymentHistory ${ph.id}`);
      } catch (e) {
        console.log(`✗ Errore eliminazione PaymentHistory ${ph.id}:`, e.message);
      }
    }
    
    // 3. Elimina MovimentoContoScalare
    console.log('\n--- Eliminazione MovimentoContoScalare ---');
    const allMovimenti = await prisma.movimentoContoScalare.findMany();
    for (const mov of allMovimenti) {
      try {
        await prisma.movimentoContoScalare.delete({ where: { id: mov.id } });
        console.log(`✓ Eliminato MovimentoContoScalare ${mov.id}`);
      } catch (e) {
        console.log(`✗ Errore eliminazione MovimentoContoScalare ${mov.id}:`, e.message);
      }
    }
    
    // 4. Elimina PagamentoDebito
    console.log('\n--- Eliminazione PagamentoDebito ---');
    const allPagamentiDebito = await prisma.pagamentoDebito.findMany();
    for (const pd of allPagamentiDebito) {
      try {
        await prisma.pagamentoDebito.delete({ where: { id: pd.id } });
        console.log(`✓ Eliminato PagamentoDebito ${pd.id}`);
      } catch (e) {
        console.log(`✗ Errore eliminazione PagamentoDebito ${pd.id}:`, e.message);
      }
    }
    
    // 5. Elimina Pagamenti
    console.log('\n--- Eliminazione Pagamenti ---');
    const allPagamenti = await prisma.pagamento.findMany();
    for (const pag of allPagamenti) {
      try {
        await prisma.pagamento.delete({ where: { id: pag.id } });
        console.log(`✓ Eliminato Pagamento ${pag.id}`);
      } catch (e) {
        console.log(`✗ Errore eliminazione Pagamento ${pag.id}:`, e.message);
      }
    }
    
    // 6. Elimina Debiti
    console.log('\n--- Eliminazione Debiti ---');
    const allDebiti = await prisma.debito.findMany();
    for (const deb of allDebiti) {
      try {
        await prisma.debito.delete({ where: { id: deb.id } });
        console.log(`✓ Eliminato Debito ${deb.id}`);
      } catch (e) {
        console.log(`✗ Errore eliminazione Debito ${deb.id}:`, e.message);
      }
    }
    
    // 7. Elimina OrdineEsaurito
    console.log('\n--- Eliminazione OrdiniEsauriti ---');
    const allOrdiniEsauriti = await prisma.ordineEsaurito.findMany();
    for (const oe of allOrdiniEsauriti) {
      try {
        await prisma.ordineEsaurito.delete({ where: { id: oe.id } });
        console.log(`✓ Eliminato OrdineEsaurito ${oe.id}`);
      } catch (e) {
        console.log(`✗ Errore eliminazione OrdineEsaurito ${oe.id}:`, e.message);
      }
    }
    
    // 8. Elimina RigaOrdinazione
    console.log('\n--- Eliminazione RigheOrdinazione ---');
    const allRighe = await prisma.rigaOrdinazione.findMany();
    for (const riga of allRighe) {
      try {
        await prisma.rigaOrdinazione.delete({ where: { id: riga.id } });
        console.log(`✓ Eliminata RigaOrdinazione ${riga.id}`);
      } catch (e) {
        console.log(`✗ Errore eliminazione RigaOrdinazione ${riga.id}:`, e.message);
      }
    }
    
    // 9. Elimina Ordinazioni
    console.log('\n--- Eliminazione Ordinazioni ---');
    const allOrdinazioni = await prisma.ordinazione.findMany();
    for (const ord of allOrdinazioni) {
      try {
        await prisma.ordinazione.delete({ where: { id: ord.id } });
        console.log(`✓ Eliminata Ordinazione ${ord.id} (numero: ${ord.numero})`);
      } catch (e) {
        console.log(`✗ Errore eliminazione Ordinazione ${ord.id}:`, e.message);
      }
    }
    
    // 10. Reset Tavoli
    console.log('\n--- Reset Tavoli ---');
    const updatedTavoli = await prisma.tavolo.updateMany({
      where: { stato: 'OCCUPATO' },
      data: { stato: 'LIBERO' }
    });
    console.log(`✓ Resettati ${updatedTavoli.count} tavoli`);
    
    // Verifica finale
    console.log('\n--- VERIFICA FINALE ---');
    const finalCounts = {
      ordinazioni: await prisma.ordinazione.count(),
      pagamenti: await prisma.pagamento.count(),
      paymentHistory: await prisma.paymentHistory.count(),
      righe: await prisma.rigaOrdinazione.count(),
      debiti: await prisma.debito.count(),
      pagamentiDebito: await prisma.pagamentoDebito.count(),
      movimenti: await prisma.movimentoContoScalare.count(),
      ordiniEsauriti: await prisma.ordineEsaurito.count(),
      tavoliOccupati: await prisma.tavolo.count({ where: { stato: 'OCCUPATO' } })
    };
    
    console.log('Record rimanenti:', finalCounts);
    
    const success = Object.values(finalCounts).every(count => count === 0);
    if (success) {
      console.log('\n✅ ELIMINAZIONE COMPLETATA CON SUCCESSO!');
    } else {
      console.log('\n⚠️ ATTENZIONE: Alcuni record non sono stati eliminati');
    }
    
  } catch (error) {
    console.error('\n❌ ERRORE FATALE:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Esegui lo script
deleteAllOrders().then(() => {
  console.log('\n===== FINE ELIMINAZIONE MANUALE ORDINI =====');
  process.exit(0);
}).catch((e) => {
  console.error('Errore script:', e);
  process.exit(1);
});