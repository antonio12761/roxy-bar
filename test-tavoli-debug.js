const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugTavoli() {
  console.log('=== DEBUG TAVOLI MARCIAPIEDE ===\n');
  
  // 1. Verifica i tavoli nel database
  console.log('1. TAVOLI NEL DATABASE:');
  const tavoli = await prisma.tavolo.findMany({
    where: {
      OR: [
        { numero: { startsWith: 'M' }},
        { GruppoTavoli: { nome: 'Marciapiede' }}
      ]
    },
    include: {
      GruppoTavoli: true
    }
  });
  
  tavoli.forEach(t => {
    console.log(`  - ID: ${t.id}, Numero: "${t.numero}", Tipo numero: ${typeof t.numero}, Gruppo: ${t.GruppoTavoli?.nome}`);
  });
  
  // 2. Verifica un'ordinazione di esempio per un tavolo M
  console.log('\n2. ORDINAZIONI PER TAVOLI M:');
  const ordinazioni = await prisma.ordinazione.findMany({
    where: {
      Tavolo: {
        numero: { startsWith: 'M' }
      },
      stato: { not: 'PAGATO' }
    },
    include: {
      Tavolo: true
    },
    take: 3
  });
  
  if (ordinazioni.length === 0) {
    console.log('  Nessuna ordinazione attiva per tavoli M');
    
    // Creiamo un'ordinazione di test
    console.log('\n3. CREAZIONE ORDINAZIONE DI TEST:');
    const tavoloM1 = tavoli.find(t => t.numero === 'M1');
    if (tavoloM1) {
      console.log(`  Creando ordinazione per tavolo M1 (ID: ${tavoloM1.id})...`);
      
      // Trova un prodotto di test
      const prodotto = await prisma.prodotto.findFirst({
        where: { disponibile: true }
      });
      
      if (prodotto) {
        const utente = await prisma.user.findFirst({
          where: { ruolo: 'CAMERIERE' }
        });
        
        if (utente) {
          const nuovaOrdinazione = await prisma.ordinazione.create({
            data: {
              numero: Math.floor(Math.random() * 10000),
              tavoloId: tavoloM1.id,
              tipo: 'TAVOLO',
              stato: 'ORDINATO',
              nomeCliente: 'Test Cliente M1',
              totale: prodotto.prezzo,
              userId: utente.id,
              RigaOrdinazione: {
                create: {
                  prodottoId: prodotto.id,
                  quantita: 1,
                  prezzo: prodotto.prezzo,
                  stato: 'INSERITO',
                  postazione: 'PREPARA'
                }
              }
            },
            include: {
              Tavolo: true,
              RigaOrdinazione: {
                include: {
                  Prodotto: true
                }
              }
            }
          });
          
          console.log(`  Ordinazione creata:`);
          console.log(`    - ID: ${nuovaOrdinazione.id}`);
          console.log(`    - Numero: ${nuovaOrdinazione.numero}`);
          console.log(`    - Tavolo ID: ${nuovaOrdinazione.tavoloId}`);
          console.log(`    - Tavolo.numero: "${nuovaOrdinazione.Tavolo?.numero}"`);
          console.log(`    - Tipo Tavolo.numero: ${typeof nuovaOrdinazione.Tavolo?.numero}`);
        }
      }
    }
  } else {
    ordinazioni.forEach(o => {
      console.log(`  - Ordine #${o.numero}:`);
      console.log(`    - Tavolo ID: ${o.tavoloId}`);
      console.log(`    - Tavolo.numero: "${o.Tavolo?.numero}"`);
      console.log(`    - Tipo Tavolo.numero: ${typeof o.Tavolo?.numero}`);
    });
  }
  
  // 4. Simula cosa succederebbe con parseInt
  console.log('\n4. TEST parseInt:');
  const testValues = ['M1', 'M2', '10', '11'];
  testValues.forEach(val => {
    console.log(`  parseInt("${val}") = ${parseInt(val)} (tipo: ${typeof parseInt(val)})`);
  });
}

debugTavoli()
  .catch(console.error)
  .finally(() => prisma.$disconnect());