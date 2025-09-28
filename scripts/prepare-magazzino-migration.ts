// Script per preparare la migrazione del sistema magazzino-bar
// Questo script:
// 1. Verifica i dati esistenti
// 2. Crea le ubicazioni di default
// 3. Migra l'inventario esistente al nuovo sistema

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function prepareMigration() {
  console.log('=== Preparazione Migrazione Sistema Magazzino-Bar ===\n');
  
  try {
    // 1. Analisi situazione attuale
    console.log('1. Analisi dati esistenti...');
    
    const prodotti = await prisma.prodotto.count({ where: { isDeleted: false } });
    const inventario = await prisma.inventario.count();
    const ordiniFornitore = await prisma.ordineFornitore.count();
    const movimenti = await prisma.movimentoInventario.count();
    
    console.log(`   - Prodotti attivi: ${prodotti}`);
    console.log(`   - Prodotti in inventario: ${inventario}`);
    console.log(`   - Ordini fornitore: ${ordiniFornitore}`);
    console.log(`   - Movimenti inventario: ${movimenti}`);
    
    // 2. Piano di migrazione
    console.log('\n2. Piano di migrazione:');
    console.log('   a) Aggiungere nuovi modelli al schema Prisma');
    console.log('   b) Creare migration con: npx prisma migrate dev --name add-magazzino-bar-system');
    console.log('   c) Eseguire questo script per popolare dati iniziali');
    console.log('   d) Migrare inventario esistente alle nuove ubicazioni');
    
    // 3. Dati da creare dopo la migration
    console.log('\n3. Ubicazioni da creare:');
    const ubicazioniDefault = [
      { codice: 'MAG-01', nome: 'Magazzino Centrale', tipo: 'MAGAZZINO' },
      { codice: 'BAR-01', nome: 'Bar Principale', tipo: 'BAR' },
      { codice: 'CUC-01', nome: 'Cucina', tipo: 'CUCINA' },
      { codice: 'CANT-01', nome: 'Cantina Vini', tipo: 'CANTINA' }
    ];
    
    ubicazioniDefault.forEach(u => {
      console.log(`   - ${u.codice}: ${u.nome} (${u.tipo})`);
    });
    
    // 4. Verifica prodotti che necessitano configurazione
    console.log('\n4. Prodotti da configurare per magazzino:');
    
    const prodottiDaConfigurare = await prisma.prodotto.findMany({
      where: { isDeleted: false },
      include: { Inventario: true },
      take: 10
    });
    
    console.log('   Esempi di configurazione necessaria:');
    prodottiDaConfigurare.forEach(p => {
      let unitaAcquisto = 'pz';
      let pezziPerUnita = 1;
      
      // Logica esempio per determinare unità acquisto
      if (p.categoria?.toLowerCase().includes('birr')) {
        unitaAcquisto = 'cartone';
        pezziPerUnita = 24;
      } else if (p.categoria?.toLowerCase().includes('vino')) {
        unitaAcquisto = 'cassa';
        pezziPerUnita = 6;
      } else if (p.nome?.toLowerCase().includes('caffè')) {
        unitaAcquisto = 'kg';
        pezziPerUnita = 1;
      }
      
      console.log(`   - ${p.nome}: ${unitaAcquisto} (${pezziPerUnita} pz/unità)`);
    });
    
    // 5. Stima impatto migrazione
    console.log('\n5. Impatto migrazione:');
    
    if (inventario > 0) {
      console.log(`   ⚠️  ${inventario} giacenze da migrare al nuovo sistema`);
      console.log('   ⚠️  I movimenti esistenti verranno mantenuti per storico');
      console.log('   ✓  Le giacenze attuali verranno assegnate al BAR di default');
      console.log('   ✓  Il magazzino partirà vuoto (da caricare con prime fatture)');
    } else {
      console.log('   ✓  Nessun inventario esistente da migrare');
    }
    
    // 6. Next steps
    console.log('\n6. Prossimi passi:');
    console.log('   1. Copiare i modelli da schema-extension-magazzino-bar.prisma');
    console.log('   2. Aggiungerli a prisma/schema.prisma');
    console.log('   3. Aggiornare relazioni nei modelli esistenti');
    console.log('   4. Eseguire: npx prisma migrate dev --name add-magazzino-bar-system');
    console.log('   5. Eseguire: npm run migrate:magazzino-data');
    
    // 7. Genera script SQL per controllo
    console.log('\n7. Query di verifica post-migrazione:');
    console.log(`
-- Verifica ubicazioni create
SELECT id, codice, nome, tipo FROM "Ubicazione";

-- Verifica giacenze migrate
SELECT 
  u.nome as ubicazione,
  p.nome as prodotto,
  gu.giacenza_attuale,
  gu.unita_misura
FROM "GiacenzaUbicazione" gu
JOIN "Ubicazione" u ON u.id = gu.ubicazione_id
JOIN "Prodotto" p ON p.id = gu.prodotto_id
LIMIT 10;

-- Conta distinte create
SELECT stato, COUNT(*) 
FROM "DistintaPrelievo" 
GROUP BY stato;
    `);
    
  } catch (error) {
    console.error('Errore:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Esegui analisi
prepareMigration();