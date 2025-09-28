import { getUnifiedGruppiTavoli, getUnifiedTavoliList } from '@/lib/actions/unified-tavoli-reader';

async function testUnifiedReader() {
  console.log('=== Test Unified Reader ===\n');

  try {
    // Test 1: Get gruppi con tavoli (visibili)
    console.log('Test 1: Gruppi e tavoli visibili');
    const resultVisible = await getUnifiedGruppiTavoli(false);
    
    if (resultVisible.success) {
      console.log(`✓ Trovati ${resultVisible.gruppi.length} gruppi visibili`);
      resultVisible.gruppi.forEach(gruppo => {
        console.log(`  - ${gruppo.nome} (ord=${gruppo.ordinamento}): ${gruppo.tavoli.length} tavoli`);
        gruppo.tavoli.slice(0, 3).forEach(tavolo => {
          console.log(`    * Tavolo ${tavolo.numero} (ord=${tavolo.ordinamento})`);
        });
      });
    } else {
      console.error('✗ Errore:', resultVisible.error);
    }

    console.log('\n---\n');

    // Test 2: Get tutti i gruppi (inclusi invisibili)
    console.log('Test 2: Tutti i gruppi (inclusi invisibili)');
    const resultAll = await getUnifiedGruppiTavoli(true);
    
    if (resultAll.success) {
      console.log(`✓ Trovati ${resultAll.gruppi.length} gruppi totali`);
    } else {
      console.error('✗ Errore:', resultAll.error);
    }

    console.log('\n---\n');

    // Test 3: Get lista tavoli flat
    console.log('Test 3: Lista tavoli flat');
    const tavoliList = await getUnifiedTavoliList(false);
    
    console.log(`✓ Trovati ${tavoliList.length} tavoli`);
    console.log('Ordine tavoli:');
    tavoliList.slice(0, 10).forEach(tavolo => {
      console.log(`  - ${tavolo.gruppoNome} / Tavolo ${tavolo.numero} (gruppo ord=${tavolo.gruppoOrdinamento}, tavolo ord=${tavolo.ordinamento})`);
    });

  } catch (error) {
    console.error('Errore test:', error);
  }
}

// Esegui test
testUnifiedReader()
  .then(() => {
    console.log('\n=== Test completato ===');
    process.exit(0);
  })
  .catch(error => {
    console.error('Errore:', error);
    process.exit(1);
  });