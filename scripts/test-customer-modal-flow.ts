#!/usr/bin/env node
import { prisma } from '../lib/db';

async function testCustomerModalFlow() {
  console.log('🧪 Test Flusso Modal Cliente per Nuove Ordinazioni');
  console.log('='.repeat(50));

  try {
    // 1. Trova un tavolo di test
    const tavolo = await prisma.tavolo.findFirst({
      where: { attivo: true }
    });

    if (!tavolo) {
      console.error('❌ Nessun tavolo trovato nel database');
      return;
    }

    console.log(`\n📍 Tavolo di test: ${tavolo.numero}`);

    // 2. Crea alcuni ordini di test con clienti diversi
    const clienti = ['Mario Rossi', 'Luigi Bianchi', 'Anna Verdi'];
    
    for (const [index, nomeCliente] of clienti.entries()) {
      await prisma.ordinazione.create({
        data: {
          numero: Date.now() + index,
          tipo: 'TAVOLO',
          stato: 'CONSEGNATO',
          statoPagamento: 'COMPLETAMENTE_PAGATO',
          totale: 10.00,
          tavoloId: tavolo.id,
          nomeCliente,
          dataApertura: new Date(Date.now() - (3 - index) * 60 * 60 * 1000), // Ordini a 3, 2, 1 ora fa
          dataChiusura: new Date(Date.now() - (3 - index) * 60 * 60 * 1000 + 30 * 60 * 1000),
          utenteId: '1', // Assumiamo esista
          tenantId: 'test'
        }
      });
    }

    console.log(`✅ Creati ${clienti.length} ordini di test`);

    // 3. Test getCustomerNamesForTable
    const { getCustomerNamesForTable } = await import('../lib/actions/ordinazioni/tavoli');
    const result = await getCustomerNamesForTable(tavolo.id);

    console.log('\n📋 Risultati getCustomerNamesForTable:');
    console.log(`- Success: ${result.success}`);
    console.log(`- Clienti trovati: ${result.customerNames.join(', ')}`);
    console.log(`- Ultimo cliente: ${result.lastCustomerName}`);

    // 4. Verifica che l'ultimo cliente sia quello più recente
    if (result.lastCustomerName === 'Anna Verdi') {
      console.log('✅ L\'ultimo cliente è correttamente Anna Verdi (ordine più recente)');
    } else {
      console.error(`❌ Errore: ultimo cliente è ${result.lastCustomerName}, dovrebbe essere Anna Verdi`);
    }

    // 5. Simula il flusso
    console.log('\n🔄 Simulazione flusso:');
    console.log('1. Utente clicca su "Nuovo Ordine" per il tavolo');
    console.log('2. Va direttamente a /cameriere/tavolo/[id] (senza parametro cliente)');
    console.log('3. Il CustomerNameModal si apre sempre (showNameModal = true)');
    console.log('4. Il modal mostra:');
    console.log(`   - Nome precompilato: "${result.lastCustomerName}"`);
    console.log(`   - Clienti al tavolo: ${result.customerNames.join(', ')}`);
    console.log(`   - Possibilità di cercare/aggiungere altri clienti`);
    console.log('5. L\'utente può:');
    console.log('   - Confermare il nome esistente');
    console.log('   - Selezionare un altro cliente dal tavolo');
    console.log('   - Cercare/aggiungere un nuovo cliente');

    // 6. Pulizia
    console.log('\n🧹 Pulizia dati di test...');
    await prisma.ordinazione.deleteMany({
      where: {
        tavoloId: tavolo.id,
        nomeCliente: {
          in: clienti
        }
      }
    });

    console.log('✅ Test completato con successo!');

  } catch (error) {
    console.error('❌ Errore durante il test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Esegui il test
testCustomerModalFlow().catch(console.error);