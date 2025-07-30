const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function loadProducts() {
  try {
    console.log('🔄 Caricamento prodotti in corso...');
    
    // Leggi il file SQL
    const sqlFile = path.join(__dirname, '..', 'insert_products.sql');
    const sqlContent = fs.readFileSync(sqlFile, 'utf8');
    
    // Prima controlla se ci sono già prodotti
    const existingCount = await prisma.prodotto.count();
    if (existingCount > 0) {
      console.log(`⚠️  Ci sono già ${existingCount} prodotti nel database.`);
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      const answer = await new Promise(resolve => {
        readline.question('Vuoi continuare comunque? (y/n): ', resolve);
      });
      readline.close();
      
      if (answer.toLowerCase() !== 'y') {
        console.log('❌ Operazione annullata');
        process.exit(0);
      }
    }
    
    // Trova tutti gli INSERT INTO statements
    const insertRegex = /INSERT INTO "Prodotto"[^;]+;/g;
    const statements = sqlContent.match(insertRegex) || [];
    
    console.log(`📊 Trovati ${statements.length} gruppi di INSERT da eseguire`);
    
    if (statements.length === 0) {
      console.log('❌ Nessun INSERT trovato nel file SQL');
      process.exit(1);
    }
    
    // Esegui ogni statement separatamente
    let successCount = 0;
    for (let i = 0; i < statements.length; i++) {
      try {
        await prisma.$executeRawUnsafe(statements[i]);
        successCount++;
        console.log(`✅ Gruppo ${i + 1}/${statements.length} caricato`);
      } catch (error) {
        console.log(`⚠️  Gruppo ${i + 1}/${statements.length} - Errore: ${error.message}`);
        // Continua con il prossimo gruppo
      }
    }
    
    // Conta i prodotti
    const finalCount = await prisma.prodotto.count();
    const newProducts = finalCount - existingCount;
    
    console.log(`\n✅ Caricamento completato!`);
    console.log(`📊 Prodotti caricati con successo: ${successCount}/${statements.length} gruppi`);
    console.log(`📊 Nuovi prodotti aggiunti: ${newProducts}`);
    console.log(`📊 Totale prodotti nel database: ${finalCount}`);
    
  } catch (error) {
    console.error('❌ Errore generale:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

loadProducts();