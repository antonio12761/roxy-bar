import { prisma } from '@/lib/db';
import { getCustomerNamesForTable } from '@/lib/actions/ordinazioni/tavoli';

async function debugCustomerNames() {
  console.log('=== Debug Customer Names per Tavolo ===\n');

  try {
    // Prendi tutti i tavoli
    const tavoli = await prisma.tavolo.findMany({
      where: { attivo: true },
      orderBy: { numero: 'asc' }
    });

    for (const tavolo of tavoli.slice(0, 5)) { // Test sui primi 5 tavoli
      console.log(`\n--- Tavolo ${tavolo.numero} (ID: ${tavolo.id}) ---`);
      
      // Conta ordini attivi
      const ordiniAttivi = await prisma.ordinazione.findMany({
        where: {
          tavoloId: tavolo.id,
          stato: {
            in: ["ORDINATO", "IN_PREPARAZIONE", "PRONTO", "CONSEGNATO"]
          },
          statoPagamento: {
            not: "COMPLETAMENTE_PAGATO"
          }
        },
        select: {
          id: true,
          numero: true,
          stato: true,
          statoPagamento: true,
          nomeCliente: true,
          dataApertura: true
        }
      });

      console.log(`Ordini attivi trovati: ${ordiniAttivi.length}`);
      
      if (ordiniAttivi.length > 0) {
        ordiniAttivi.forEach(ordine => {
          console.log(`  - Ordine #${ordine.numero}: ${ordine.stato} - Pagamento: ${ordine.statoPagamento} - Cliente: ${ordine.nomeCliente || 'N/A'}`);
        });
      }

      // Chiama la funzione per vedere cosa ritorna
      const result = await getCustomerNamesForTable(tavolo.id);
      console.log(`\ngetCustomerNamesForTable ritorna:`);
      console.log(`  - success: ${result.success}`);
      console.log(`  - customerNames: [${result.customerNames.join(', ')}]`);
      console.log(`  - lastCustomerName: "${result.lastCustomerName}"`);

      // Verifica anche ordini delle ultime 24h per confronto
      const ordini24h = await prisma.ordinazione.count({
        where: {
          tavoloId: tavolo.id,
          dataApertura: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        }
      });
      console.log(`\nOrdini totali ultime 24h: ${ordini24h}`);
    }

  } catch (error) {
    console.error('Errore debug:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Esegui debug
debugCustomerNames()
  .then(() => {
    console.log('\n=== Debug completato ===');
    process.exit(0);
  })
  .catch(error => {
    console.error('Errore:', error);
    process.exit(1);
  });