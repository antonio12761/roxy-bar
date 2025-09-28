import { prisma } from '@/lib/db';
import { ordersSyncService } from '@/lib/services/orders-sync-service';
import { getOrdinazioniAperte } from '@/lib/actions/ordinazioni';

async function debugOrdiniInCorso() {
  console.log('=== Debug Ordini in Corso ===\n');

  try {
    // 1. Conta ordini totali nel DB
    console.log('1. Conteggio ordini nel database:');
    
    const ordiniTotali = await prisma.ordinazione.count();
    console.log(`   Ordini totali: ${ordiniTotali}`);
    
    const statiOrdinazioni = await prisma.ordinazione.groupBy({
      by: ['stato'],
      _count: true
    });
    
    console.log('\n   Ordini per stato:');
    statiOrdinazioni.forEach(s => {
      console.log(`   - ${s.stato}: ${s._count}`);
    });

    // 2. Verifica quali ordini dovrebbero essere "aperti"
    console.log('\n2. Ordini che dovrebbero essere visibili in "Ordini in corso":');
    
    const ordiniAperti = await prisma.ordinazione.findMany({
      where: {
        stato: {
          in: ["ORDINATO", "IN_PREPARAZIONE", "PRONTO", "CONSEGNATO", "ORDINATO_ESAURITO"]
        }
      },
      select: {
        id: true,
        numero: true,
        stato: true,
        nomeCliente: true,
        Tavolo: {
          select: {
            numero: true
          }
        },
        dataApertura: true,
        _count: {
          select: {
            RigaOrdinazione: true
          }
        }
      },
      orderBy: {
        dataApertura: 'desc'
      },
      take: 10
    });
    
    console.log(`\n   Trovati ${ordiniAperti.length} ordini aperti:`);
    ordiniAperti.forEach(o => {
      console.log(`   - Ordine #${o.numero} (${o.stato}) - Tavolo ${o.Tavolo?.numero || 'N/A'} - Cliente: ${o.nomeCliente || 'N/A'} - Righe: ${o._count.RigaOrdinazione}`);
    });

    // 3. Test OrdersSyncService
    console.log('\n3. Test OrdersSyncService:');
    try {
      const syncResult = await ordersSyncService.getOrders();
      console.log(`   OrdersSyncService ritorna ${Array.isArray(syncResult) ? syncResult.length : 0} ordini`);
      
      if (Array.isArray(syncResult) && syncResult.length > 0) {
        console.log('   Primi 3 ordini da sync:');
        syncResult.slice(0, 3).forEach((o: any) => {
          console.log(`   - Ordine #${o.numero} - Stato: ${o.stato}`);
        });
      }
    } catch (syncError) {
      console.error('   Errore OrdersSyncService:', syncError);
    }

    // 4. Test getOrdinazioniAperte
    console.log('\n4. Test getOrdinazioniAperte:');
    try {
      const result = await getOrdinazioniAperte();
      console.log(`   getOrdinazioniAperte ritorna ${Array.isArray(result) ? result.length : 0} ordini`);
      
      if (Array.isArray(result) && result.length > 0) {
        console.log('   Primi 3 ordini:');
        result.slice(0, 3).forEach((o: any) => {
          console.log(`   - Ordine #${o.numero} - Stato: ${o.stato} - Tavolo: ${o.Tavolo?.numero || 'N/A'}`);
        });
      }
    } catch (error) {
      console.error('   Errore getOrdinazioniAperte:', error);
    }

    // 5. Verifica problemi comuni
    console.log('\n5. Verifica problemi comuni:');
    
    // Ordini senza righe
    const ordiniSenzaRighe = await prisma.ordinazione.count({
      where: {
        stato: {
          in: ["ORDINATO", "IN_PREPARAZIONE", "PRONTO"]
        },
        RigaOrdinazione: {
          none: {}
        }
      }
    });
    
    if (ordiniSenzaRighe > 0) {
      console.log(`   ⚠️  Trovati ${ordiniSenzaRighe} ordini aperti senza righe`);
    }

    // Ordini con user null
    const ordiniSenzaUser = await prisma.ordinazione.count({
      where: {
        stato: {
          in: ["ORDINATO", "IN_PREPARAZIONE", "PRONTO"]
        },
        userId: null
      }
    });
    
    if (ordiniSenzaUser > 0) {
      console.log(`   ⚠️  Trovati ${ordiniSenzaUser} ordini aperti senza utente`);
    }

    // 6. Test con un utente specifico
    console.log('\n6. Test con utente specifico:');
    const primoUtente = await prisma.user.findFirst({
      where: {
        ruolo: "CAMERIERE"
      }
    });
    
    if (primoUtente) {
      const ordiniUtente = await prisma.ordinazione.count({
        where: {
          userId: primoUtente.id,
          stato: {
            in: ["ORDINATO", "IN_PREPARAZIONE", "PRONTO"]
          }
        }
      });
      console.log(`   Utente ${primoUtente.nome} ha ${ordiniUtente} ordini aperti`);
    }

  } catch (error) {
    console.error('Errore debug:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Esegui debug
debugOrdiniInCorso()
  .then(() => {
    console.log('\n=== Debug completato ===');
    process.exit(0);
  })
  .catch(error => {
    console.error('Errore:', error);
    process.exit(1);
  });