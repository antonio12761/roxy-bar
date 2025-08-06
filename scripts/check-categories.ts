import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkCategories() {
  console.log('🔍 Controllando le categorie nel database...');
  
  try {
    // Controlla le categorie nella nuova tabella Category
    const categories = await prisma.category.findMany({
      include: {
        Subcategory: true,
        _count: {
          select: { 
            Product: true,
            Subcategory: true 
          }
        }
      },
      orderBy: { order: 'asc' }
    });

    console.log(`📂 Trovate ${categories.length} categorie nella tabella Category:`);
    
    if (categories.length === 0) {
      console.log('❌ Nessuna categoria trovata nella tabella Category');
    } else {
      categories.forEach((cat, index) => {
        console.log(`  ${index + 1}. ${cat.name} (${cat.icon || 'no icon'})`);
        console.log(`     - Prodotti: ${cat._count.Product}`);
        console.log(`     - Sottocategorie: ${cat._count.Subcategory}`);
        if (cat.Subcategory.length > 0) {
          cat.Subcategory.forEach((sub, subIndex) => {
            console.log(`       ${subIndex + 1}. ${sub.name}`);
          });
        }
        console.log('');
      });
    }

    // Controlla anche le categorie nella tabella Prodotto (sistema legacy)
    const allProdotti = await prisma.prodotto.findMany({
      where: { 
        isDeleted: false
      },
      select: { categoria: true }
    });
    
    // Filtra le categorie non null e ottieni valori unici
    const categorieSet = new Set<string>();
    allProdotti.forEach(p => {
      if (p.categoria) {
        categorieSet.add(p.categoria);
      }
    });

    const categorieProdotto = Array.from(categorieSet);
    
    console.log(`📦 Trovate ${categorieProdotto.length} categorie uniche nella tabella Prodotto (legacy):`);
    categorieProdotto.forEach((cat, index) => {
      console.log(`  ${index + 1}. ${cat}`);
    });

    // Controlla i prodotti nella nuova tabella Product
    const products = await prisma.product.findMany({
      include: {
        Category: true,
        Subcategory: true
      }
    });

    console.log(`\n🛍️ Trovati ${products.length} prodotti nella nuova tabella Product`);

    // Riepilogo finale
    console.log('\n📊 Riepilogo:');
    console.log(`- Categorie (nuova tabella): ${categories.length}`);
    console.log(`- Sottocategorie (nuova tabella): ${categories.reduce((sum, cat) => sum + cat._count.Subcategory, 0)}`);
    console.log(`- Prodotti (nuova tabella): ${products.length}`);
    console.log(`- Categorie legacy (tabella Prodotto): ${categorieProdotto.length}`);

    if (categories.length === 0 && categorieProdotto.length > 0) {
      console.log('\n⚠️  ATTENZIONE: Hai categorie legacy ma nessuna categoria nella nuova tabella.');
      console.log('   Considera di eseguire lo script di migrazione delle categorie.');
    }

    return {
      newCategories: categories.length,
      legacyCategories: categorieProdotto.length,
      products: products.length,
      needsMigration: categories.length === 0 && categorieProdotto.length > 0
    };

  } catch (error) {
    console.error('❌ Errore durante il controllo delle categorie:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Esegui il controllo
checkCategories()
  .then((result) => {
    console.log('\n✅ Controllo completato!');
    if (result.needsMigration) {
      console.log('\n💡 Suggerimento: Esegui `npm run migrate:categories` per migrare le categorie legacy.');
    }
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Controllo fallito:', error);
    process.exit(1);
  });