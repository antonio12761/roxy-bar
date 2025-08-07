const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkRicette() {
  try {
    // Controlla le ricette miscelate
    const ricette = await prisma.ricettaMiscelata.findMany({
      include: {
        prodotto: true
      }
    });

    console.log('\n=== RICETTE MISCELATE ===');
    for (const ricetta of ricette) {
      console.log(`\nRicetta: ${ricetta.nome}`);
      console.log(`  - prezzoVendita: €${ricetta.prezzoVendita.toString()}`);
      console.log(`  - margineExtra: €${ricetta.margineExtra.toString()}`);
      console.log(`  - Prodotto associato:`);
      if (ricetta.prodotto) {
        console.log(`    - Nome: ${ricetta.prodotto.nome}`);
        console.log(`    - Prezzo menu: €${ricetta.prodotto.prezzo.toString()}`);
        console.log(`    - Disponibile: ${ricetta.prodotto.disponibile}`);
        console.log(`    - isDeleted: ${ricetta.prodotto.isDeleted}`);
      }
      console.log(`  - Modalità: ${ricetta.margineExtra.toString() === '0' ? 'PREZZO FISSO' : 'PREZZO DINAMICO'}`);
    }

    // Controlla i prodotti miscelati
    const prodottiMiscelati = await prisma.prodotto.findMany({
      where: {
        isMiscelato: true
      }
    });

    console.log('\n=== PRODOTTI MISCELATI NEL MENU ===');
    for (const prod of prodottiMiscelati) {
      console.log(`\n${prod.nome}:`);
      console.log(`  - Prezzo: €${prod.prezzo.toString()}`);
      console.log(`  - Disponibile: ${prod.disponibile}`);
      console.log(`  - isDeleted: ${prod.isDeleted}`);
    }

  } catch (error) {
    console.error('Errore:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkRicette();