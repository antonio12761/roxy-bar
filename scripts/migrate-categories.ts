import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateCategories() {
  console.log('🚀 Iniziando migrazione categorie...');

  try {
    // 1. Ottieni tutti i prodotti dalla tabella Prodotto
    const prodotti = await prisma.prodotto.findMany({
      where: { 
        isDeleted: false 
      },
      orderBy: { categoria: 'asc' }
    });

    console.log(`📦 Trovati ${prodotti.length} prodotti da migrare`);

    // 2. Estrai categorie uniche dai prodotti
    const categorieMap = new Map<string, Set<string>>();
    
    prodotti.forEach(prodotto => {
      if (prodotto.categoria) {
        const parts = prodotto.categoria.split(' > ').map(p => p.trim());
        const mainCategory = parts[0];
        const subCategory = parts.length > 1 ? parts[1] : null;
        
        if (!categorieMap.has(mainCategory)) {
          categorieMap.set(mainCategory, new Set());
        }
        
        if (subCategory) {
          categorieMap.get(mainCategory)!.add(subCategory);
        }
      }
    });

    console.log(`📂 Trovate ${categorieMap.size} categorie principali`);

    // 3. Crea le categorie principali
    const categoryIdMap = new Map<string, number>();
    let categoryOrder = 0;

    for (const [categoryName, subcategories] of categorieMap) {
      // Controlla se la categoria esiste già
      let category = await prisma.category.findFirst({
        where: { name: categoryName }
      });

      if (!category) {
        // Determina l'icona in base al nome
        let icon = 'folder';
        if (categoryName.toLowerCase().includes('distillati') || 
            categoryName.toLowerCase().includes('liquori')) {
          icon = 'wine';
        } else if (categoryName.toLowerCase().includes('birr')) {
          icon = 'beer';
        } else if (categoryName.toLowerCase().includes('cocktail')) {
          icon = 'martini';
        } else if (categoryName.toLowerCase().includes('caff')) {
          icon = 'coffee';
        } else if (categoryName.toLowerCase().includes('bevande') || 
                   categoryName.toLowerCase().includes('bibite')) {
          icon = 'glass-water';
        } else if (categoryName.toLowerCase().includes('gelat')) {
          icon = 'ice-cream';
        } else if (categoryName.toLowerCase().includes('panin')) {
          icon = 'sandwich';
        }

        category = await prisma.category.create({
          data: {
            name: categoryName,
            icon: icon,
            order: categoryOrder++
          }
        });
        console.log(`✅ Creata categoria: ${categoryName}`);
      }

      categoryIdMap.set(categoryName, category.id);

      // 4. Crea le sottocategorie
      let subcategoryOrder = 0;
      const subcategoryIdMap = new Map<string, number>();

      for (const subcategoryName of subcategories) {
        let subcategory = await prisma.subcategory.findFirst({
          where: { 
            name: subcategoryName,
            categoryId: category.id
          }
        });

        if (!subcategory) {
          subcategory = await prisma.subcategory.create({
            data: {
              name: subcategoryName,
              categoryId: category.id,
              order: subcategoryOrder++
            }
          });
          console.log(`  ✅ Creata sottocategoria: ${subcategoryName} in ${categoryName}`);
        }

        subcategoryIdMap.set(`${categoryName}>${subcategoryName}`, subcategory.id);
      }
    }

    // 5. Migra i prodotti alla nuova tabella Product
    console.log('\n📦 Migrando prodotti...');
    let migratedCount = 0;

    for (const prodotto of prodotti) {
      // Controlla se il prodotto è già stato migrato
      const existingProduct = await prisma.product.findFirst({
        where: { 
          name: prodotto.nome,
          price: prodotto.prezzo
        }
      });

      if (existingProduct) {
        console.log(`⏭️  Prodotto già migrato: ${prodotto.nome}`);
        continue;
      }

      // Determina categoria e sottocategoria
      let categoryId: number | null = null;
      let subcategoryId: number | null = null;

      if (prodotto.categoria) {
        const parts = prodotto.categoria.split(' > ').map(p => p.trim());
        const mainCategory = parts[0];
        const subCategory = parts.length > 1 ? parts[1] : null;

        categoryId = categoryIdMap.get(mainCategory) || null;
        
        if (subCategory && categoryId) {
          const subcategoryKey = `${mainCategory}>${subCategory}`;
          const subcategory = await prisma.subcategory.findFirst({
            where: {
              name: subCategory,
              categoryId: categoryId
            }
          });
          subcategoryId = subcategory?.id || null;
        }
      }

      // Crea il nuovo prodotto
      await prisma.product.create({
        data: {
          name: prodotto.nome,
          description: prodotto.descrizione,
          price: prodotto.prezzo,
          imageUrl: prodotto.immagine,
          available: prodotto.disponibile && !prodotto.terminato,
          categoryId: categoryId,
          subcategoryId: subcategoryId
        }
      });

      migratedCount++;
      if (migratedCount % 10 === 0) {
        console.log(`  ✅ Migrati ${migratedCount} prodotti...`);
      }
    }

    console.log(`\n✅ Migrazione completata! ${migratedCount} prodotti migrati.`);

    // 6. Mostra riepilogo
    const totalCategories = await prisma.category.count();
    const totalSubcategories = await prisma.subcategory.count();
    const totalProducts = await prisma.product.count();

    console.log('\n📊 Riepilogo finale:');
    console.log(`   - Categorie: ${totalCategories}`);
    console.log(`   - Sottocategorie: ${totalSubcategories}`);
    console.log(`   - Prodotti: ${totalProducts}`);

  } catch (error) {
    console.error('❌ Errore durante la migrazione:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Esegui la migrazione
migrateCategories()
  .then(() => {
    console.log('\n🎉 Migrazione completata con successo!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migrazione fallita:', error);
    process.exit(1);
  });