import { prisma } from '@/lib/db';

async function debugStatoPagamento() {
  console.log('=== Debug Stato Pagamento Ordini ===\n');

  try {
    // Verifica ordini con stato pagamento
    const ordiniConStatoPagamento = await prisma.ordinazione.findMany({
      where: {
        stato: {
          in: ["ORDINATO", "IN_PREPARAZIONE", "PRONTO", "CONSEGNATO"]
        }
      },
      select: {
        id: true,
        numero: true,
        stato: true,
        statoPagamento: true,
        totale: true,
        nomeCliente: true,
        Tavolo: {
          select: {
            numero: true
          }
        },
        _count: {
          select: {
            RigaOrdinazione: true
          }
        }
      },
      orderBy: {
        numero: 'desc'
      }
    });

    console.log(`Trovati ${ordiniConStatoPagamento.length} ordini:\n`);
    
    ordiniConStatoPagamento.forEach(o => {
      console.log(`Ordine #${o.numero}:`);
      console.log(`  - Stato: ${o.stato}`);
      console.log(`  - Stato Pagamento: ${o.statoPagamento}`);
      console.log(`  - Tavolo: ${o.Tavolo?.numero || 'N/A'}`);
      console.log(`  - Cliente: ${o.nomeCliente || 'N/A'}`);
      console.log(`  - Totale: €${o.totale}`);
      console.log(`  - Righe: ${o._count.RigaOrdinazione}`);
      console.log('');
    });

    // Conta per stato pagamento
    const conteggioStatoPagamento = await prisma.ordinazione.groupBy({
      by: ['statoPagamento'],
      where: {
        stato: {
          in: ["ORDINATO", "IN_PREPARAZIONE", "PRONTO", "CONSEGNATO"]
        }
      },
      _count: true
    });

    console.log('\nRiepilogo per stato pagamento:');
    conteggioStatoPagamento.forEach(s => {
      console.log(`  - ${s.statoPagamento}: ${s._count} ordini`);
    });

    // Ordini che dovrebbero apparire in "ordini in corso"
    console.log('\n\nOrdini che DOVREBBERO apparire in "Ordini in corso":');
    const ordiniDaMostrare = ordiniConStatoPagamento.filter(o => 
      o.statoPagamento !== 'COMPLETAMENTE_PAGATO'
    );
    
    console.log(`${ordiniDaMostrare.length} ordini non completamente pagati`);
    ordiniDaMostrare.forEach(o => {
      console.log(`  - Ordine #${o.numero} (${o.stato}) - Pagamento: ${o.statoPagamento}`);
    });

  } catch (error) {
    console.error('Errore debug:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Esegui debug
debugStatoPagamento()
  .then(() => {
    console.log('\n=== Debug completato ===');
    process.exit(0);
  })
  .catch(error => {
    console.error('Errore:', error);
    process.exit(1);
  });