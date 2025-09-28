#!/usr/bin/env node
import { prisma } from '../lib/db';

async function checkOrdiniNonArrivati() {
  console.log('🔍 Controllo Ordini Non Arrivati a PREPARA');
  console.log('='.repeat(60));

  try {
    // 1. Ordini degli ultimi 30 minuti
    const trentaMinutiFa = new Date(Date.now() - 30 * 60 * 1000);
    
    const ordiniRecenti = await prisma.ordinazione.findMany({
      where: {
        dataApertura: {
          gte: trentaMinutiFa
        }
      },
      include: {
        Tavolo: true,
        Utente: true,
        RigaOrdinazione: {
          include: {
            Prodotto: true
          }
        }
      },
      orderBy: {
        dataApertura: 'desc'
      }
    });

    console.log(`\n📊 Trovati ${ordiniRecenti.length} ordini negli ultimi 30 minuti`);

    // 2. Analizza ogni ordine
    for (const ordine of ordiniRecenti) {
      console.log(`\n${'─'.repeat(50)}`);
      console.log(`📦 Ordine #${ordine.numero}`);
      console.log(`   ID: ${ordine.id}`);
      console.log(`   Stato: ${ordine.stato}`);
      console.log(`   Creato: ${ordine.dataApertura.toLocaleString('it-IT')}`);
      console.log(`   Tavolo: ${ordine.Tavolo?.numero || 'N/A'} (ID: ${ordine.tavoloId})`);
      console.log(`   Cliente: ${ordine.nomeCliente || 'N/A'}`);
      console.log(`   Cameriere: ${ordine.Utente?.nome || 'N/A'}`);
      console.log(`   Totale: €${ordine.totale}`);
      
      // Controlla le righe ordine
      console.log(`\n   📋 Prodotti (${ordine.RigaOrdinazione.length}):`);
      let hasPrepara = false;
      let hasCucina = false;
      
      for (const riga of ordine.RigaOrdinazione) {
        console.log(`      - ${riga.nomeProdotto} x${riga.quantita} (${riga.postazione}) - Stato: ${riga.stato}`);
        if (riga.postazione === 'PREPARA' || riga.postazione === 'BANCO') hasPrepara = true;
        if (riga.postazione === 'CUCINA') hasCucina = true;
      }
      
      // Analisi destinazione
      console.log(`\n   🎯 Destinazioni:`);
      console.log(`      - PREPARA/BANCO: ${hasPrepara ? '✅ SÌ' : '❌ NO'}`);
      console.log(`      - CUCINA: ${hasCucina ? '✅ SÌ' : '❌ NO'}`);
      
      // Possibili problemi
      if (ordine.RigaOrdinazione.length === 0) {
        console.log(`\n   ⚠️  PROBLEMA: Ordine senza prodotti!`);
      }
      
      if (!hasPrepara && !hasCucina) {
        console.log(`\n   ⚠️  PROBLEMA: Nessuna destinazione valida!`);
      }
      
      if (ordine.stato === 'ORDINATO' && hasPrepara) {
        const minutiPassati = Math.floor((Date.now() - ordine.dataApertura.getTime()) / 60000);
        if (minutiPassati > 5) {
          console.log(`\n   ⚠️  ATTENZIONE: Ordine in stato ORDINATO da ${minutiPassati} minuti!`);
        }
      }
    }

    // 3. Cerca ordini senza righe
    console.log(`\n\n${'='.repeat(60)}`);
    console.log('🚨 Controllo Ordini Anomali\n');
    
    const ordiniSenzaRighe = await prisma.ordinazione.findMany({
      where: {
        dataApertura: {
          gte: trentaMinutiFa
        },
        RigaOrdinazione: {
          none: {}
        }
      }
    });
    
    if (ordiniSenzaRighe.length > 0) {
      console.log(`❌ Trovati ${ordiniSenzaRighe.length} ordini SENZA PRODOTTI:`);
      ordiniSenzaRighe.forEach(o => {
        console.log(`   - Ordine #${o.numero} (ID: ${o.id}) del ${o.dataApertura.toLocaleString('it-IT')}`);
      });
    } else {
      console.log('✅ Nessun ordine senza prodotti');
    }

    // 4. Statistiche
    console.log(`\n\n${'='.repeat(60)}`);
    console.log('📈 Statistiche Ordini (ultimi 30 min)\n');
    
    const stats = {
      totale: ordiniRecenti.length,
      conPrepara: ordiniRecenti.filter(o => 
        o.RigaOrdinazione.some(r => r.postazione === 'PREPARA' || r.postazione === 'BANCO')
      ).length,
      soloOrdinato: ordiniRecenti.filter(o => o.stato === 'ORDINATO').length,
      inPreparazione: ordiniRecenti.filter(o => o.stato === 'IN_PREPARAZIONE').length,
      pronti: ordiniRecenti.filter(o => o.stato === 'PRONTO').length,
      consegnati: ordiniRecenti.filter(o => o.stato === 'CONSEGNATO').length
    };
    
    console.log(`Totale ordini: ${stats.totale}`);
    console.log(`Con prodotti per PREPARA: ${stats.conPrepara}`);
    console.log(`\nPer stato:`);
    console.log(`- ORDINATO: ${stats.soloOrdinato}`);
    console.log(`- IN_PREPARAZIONE: ${stats.inPreparazione}`);
    console.log(`- PRONTO: ${stats.pronti}`);
    console.log(`- CONSEGNATO: ${stats.consegnati}`);

    // 5. Suggerimenti
    console.log(`\n\n${'='.repeat(60)}`);
    console.log('💡 Suggerimenti per Debug:\n');
    console.log('1. Se vedi ordini in stato ORDINATO da molto tempo:');
    console.log('   → Potrebbe non essere arrivato l\'evento SSE a PREPARA');
    console.log('\n2. Se vedi ordini senza prodotti:');
    console.log('   → L\'utente ha inviato un ordine vuoto');
    console.log('\n3. Se non vedi ordini recenti:');
    console.log('   → Gli ordini non vengono salvati nel database');
    console.log('\n4. Controlla i log del server per:');
    console.log('   → [creaOrdinazione] per conferma salvataggio');
    console.log('   → [SSE Route] per conferma eventi inviati');
    console.log('   → "order:new" per eventi di nuovo ordine');

  } catch (error) {
    console.error('❌ Errore:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkOrdiniNonArrivati().catch(console.error);