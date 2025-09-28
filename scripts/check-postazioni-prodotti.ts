#!/usr/bin/env node
import { prisma } from '../lib/db';

async function checkPostazioniProdotti() {
  console.log('🔍 Verifica Postazioni Prodotti');
  console.log('='.repeat(50));

  try {
    // 1. Conta prodotti per postazione
    const prodotti = await prisma.prodotto.findMany({
      where: {
        disponibile: true
      },
      select: {
        id: true,
        nome: true,
        categoria: true,
        postazione: true
      }
    });

    console.log(`\n📊 Totale prodotti attivi: ${prodotti.length}`);

    // 2. Raggruppa per postazione
    const perPostazione = prodotti.reduce((acc, p) => {
      const post = p.postazione || 'NON_DEFINITA';
      acc[post] = (acc[post] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('\n📍 Prodotti per postazione:');
    Object.entries(perPostazione).forEach(([postazione, count]) => {
      console.log(`   - ${postazione}: ${count} prodotti`);
    });

    // 3. Verifica prodotti senza postazione
    const senzaPostazione = prodotti.filter(p => !p.postazione);
    if (senzaPostazione.length > 0) {
      console.log(`\n⚠️  ${senzaPostazione.length} prodotti SENZA postazione:`);
      senzaPostazione.slice(0, 10).forEach(p => {
        console.log(`   - ${p.nome} (${p.categoria})`);
      });
      if (senzaPostazione.length > 10) {
        console.log(`   ... e altri ${senzaPostazione.length - 10}`);
      }
    }

    // 4. Mostra alcuni esempi per categoria
    console.log('\n📋 Esempi per categoria:');
    const categorie = [...new Set(prodotti.map(p => p.categoria))].filter(Boolean);
    
    for (const categoria of categorie.slice(0, 5)) {
      const prodCat = prodotti.filter(p => p.categoria === categoria).slice(0, 3);
      console.log(`\n   ${categoria}:`);
      prodCat.forEach(p => {
        console.log(`   - ${p.nome} → ${p.postazione || 'NON_DEFINITA'}`);
      });
    }

    // 5. Suggerimenti
    console.log('\n\n💡 Nota importante:');
    console.log('Se molti prodotti non hanno postazione definita, gli ordini');
    console.log('andranno sempre a PREPARA di default, anche se dovrebbero');
    console.log('andare a CUCINA o BANCO.');
    console.log('\nPer risolvere:');
    console.log('1. Aggiorna le postazioni dei prodotti nel database');
    console.log('2. O assicurati che i prodotti siano configurati correttamente');

  } catch (error) {
    console.error('❌ Errore:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPostazioniProdotti().catch(console.error);