import { prisma } from '@/lib/db';

async function debugTavoloFilter(numeroTavolo?: string) {
  console.log('=== Debug Filtro Tavolo ===\n');
  
  const tavoloFilter = numeroTavolo || 'M1'; // Default test con M1
  console.log(`Testing con tavolo: "${tavoloFilter}"\n`);

  try {
    // 1. Verifica se il tavolo esiste
    console.log('1. Verifica tavolo nel database:');
    const tavolo = await prisma.tavolo.findFirst({
      where: {
        numero: tavoloFilter
      }
    });
    
    if (tavolo) {
      console.log(`   ✓ Tavolo trovato: ID=${tavolo.id}, Numero="${tavolo.numero}"`);
    } else {
      console.log(`   ✗ Tavolo "${tavoloFilter}" NON trovato!`);
      
      // Mostra tavoli esistenti
      const tavoliEsistenti = await prisma.tavolo.findMany({
        select: { numero: true },
        orderBy: { numero: 'asc' }
      });
      console.log('\n   Tavoli esistenti:');
      tavoliEsistenti.forEach(t => console.log(`     - "${t.numero}"`));
    }

    // 2. Verifica ordini per questo tavolo
    console.log('\n2. Ordini del tavolo:');
    const ordiniTavolo = await prisma.ordinazione.findMany({
      where: {
        Tavolo: {
          numero: tavoloFilter
        }
      },
      select: {
        id: true,
        numero: true,
        stato: true,
        Tavolo: {
          select: {
            numero: true
          }
        }
      }
    });
    
    console.log(`   Trovati ${ordiniTavolo.length} ordini per tavolo "${tavoloFilter}"`);
    ordiniTavolo.forEach(o => {
      console.log(`   - Ordine #${o.numero} (${o.stato}) - Tavolo: "${o.Tavolo?.numero}"`);
    });

    // 3. Test confronto stringhe
    console.log('\n3. Test confronto stringhe:');
    console.log(`   Filtro: "${tavoloFilter}" (tipo: ${typeof tavoloFilter})`);
    if (tavolo) {
      console.log(`   Tavolo.numero: "${tavolo.numero}" (tipo: ${typeof tavolo.numero})`);
      console.log(`   Confronto esatto: ${tavoloFilter === tavolo.numero}`);
      console.log(`   Confronto trim: ${tavoloFilter.trim() === tavolo.numero.trim()}`);
    }

    // 4. Ordini senza filtro
    console.log('\n4. Tutti gli ordini (primi 5):');
    const tuttiOrdini = await prisma.ordinazione.findMany({
      select: {
        numero: true,
        stato: true,
        Tavolo: {
          select: {
            numero: true
          }
        }
      },
      take: 5
    });
    
    tuttiOrdini.forEach(o => {
      console.log(`   - Ordine #${o.numero} - Tavolo: "${o.Tavolo?.numero || 'NULL'}"`);
    });

  } catch (error) {
    console.error('Errore debug:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Test con parametro da command line
const tavoloTest = process.argv[2];
debugTavoloFilter(tavoloTest)
  .then(() => {
    console.log('\n=== Debug completato ===');
    process.exit(0);
  })
  .catch(error => {
    console.error('Errore:', error);
    process.exit(1);
  });