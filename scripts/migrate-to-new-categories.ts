import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface OldProduct {
  id: number;
  nome: string;
  descrizione: string | null;
  prezzo: number;
  categoria: string;
  disponibile: boolean;
  immagine: string | null;
  createdAt: Date;
  updatedAt: Date;
}

async function migrateData() {
  console.log("🚀 Iniziando migrazione dati alla nuova struttura categorie...");

  try {
    // 1. Recupera tutti i prodotti esistenti
    const oldProducts = await prisma.$queryRaw<OldProduct[]>`
      SELECT id, nome, descrizione, prezzo, categoria, disponibile, immagine, "createdAt", "updatedAt"
      FROM "Prodotto" 
      WHERE "isDeleted" = false
    `;

    console.log(`📦 Trovati ${oldProducts.length} prodotti da migrare`);

    // 2. Analizza le categorie esistenti per creare la struttura gerarchica
    const categoryMap = new Map<string, { main: string; sub?: string }>();
    
    oldProducts.forEach(product => {
      const categoria = product.categoria;
      if (categoria.includes(' > ')) {
        // Sottocategoria: "APERITIVI > Gin"
        const [main, sub] = categoria.split(' > ');
        categoryMap.set(categoria, { main: main.trim(), sub: sub.trim() });
      } else {
        // Categoria principale
        categoryMap.set(categoria, { main: categoria.trim() });
      }
    });

    console.log(`🏷️ Trovate ${categoryMap.size} categorie da creare`);

    // 3. Crea le categorie principali
    const mainCategories = [...new Set(Array.from(categoryMap.values()).map(c => c.main))];
    const categoryRecords = new Map<string, number>();
    
    for (let i = 0; i < mainCategories.length; i++) {
      const mainCat = mainCategories[i];
      
      // Determina l'icona basata sul nome della categoria
      let icon = '📦'; // default
      if (mainCat.includes('CAFFET')) icon = '☕';
      else if (mainCat.includes('APERIT')) icon = '🍸';
      else if (mainCat.includes('DISTILL')) icon = '🥃';
      else if (mainCat.includes('VINI') || mainCat.includes('WINE')) icon = '🍷';
      else if (mainCat.includes('BIRR')) icon = '🍺';
      else if (mainCat.includes('FOOD') || mainCat.includes('CIBO')) icon = '🍽️';
      else if (mainCat.includes('DOLCI') || mainCat.includes('DESSERT')) icon = '🍰';
      else if (mainCat.includes('SNACK')) icon = '🥨';

      const category = await prisma.category.create({
        data: {
          name: mainCat,
          order: i,
          icon: icon
        }
      });
      
      categoryRecords.set(mainCat, category.id);
      console.log(`✅ Creata categoria: ${mainCat} (${icon})`);
    }

    // 4. Crea le sottocategorie
    const subcategoryRecords = new Map<string, number>();
    
    for (const [fullPath, { main, sub }] of categoryMap.entries()) {
      if (sub) {
        const categoryId = categoryRecords.get(main);
        if (categoryId) {
          const subcategory = await prisma.subcategory.create({
            data: {
              name: sub,
              categoryId: categoryId,
              order: 0
            }
          });
          
          subcategoryRecords.set(fullPath, subcategory.id);
          console.log(`✅ Creata sottocategoria: ${main} > ${sub}`);
        }
      }
    }

    // 5. Migra i prodotti
    let migratedCount = 0;
    
    for (const oldProduct of oldProducts) {
      const categoryInfo = categoryMap.get(oldProduct.categoria);
      if (!categoryInfo) continue;

      let categoryId: number | null = null;
      let subcategoryId: number | null = null;

      if (categoryInfo.sub) {
        // Ha sottocategoria
        subcategoryId = subcategoryRecords.get(oldProduct.categoria) || null;
      } else {
        // Solo categoria principale
        categoryId = categoryRecords.get(categoryInfo.main) || null;
      }

      const newProduct = await prisma.product.create({
        data: {
          name: oldProduct.nome,
          description: oldProduct.descrizione,
          price: oldProduct.prezzo,
          imageUrl: oldProduct.immagine,
          available: oldProduct.disponibile,
          categoryId: categoryId,
          subcategoryId: subcategoryId,
          createdAt: oldProduct.createdAt,
          updatedAt: oldProduct.updatedAt
        }
      });

      // Collega le righe ordinazione esistenti al nuovo prodotto
      await prisma.rigaOrdinazione.updateMany({
        where: { prodottoId: oldProduct.id },
        data: { newProductId: newProduct.id }
      });

      migratedCount++;
      
      if (migratedCount % 10 === 0) {
        console.log(`📦 Migrati ${migratedCount}/${oldProducts.length} prodotti...`);
      }
    }

    console.log(`✅ Migrazione completata!`);
    console.log(`📊 Statistiche:`);
    console.log(`   - Categorie create: ${mainCategories.length}`);
    console.log(`   - Sottocategorie create: ${subcategoryRecords.size}`);
    console.log(`   - Prodotti migrati: ${migratedCount}`);

  } catch (error) {
    console.error("❌ Errore durante la migrazione:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Esegui la migrazione se chiamato direttamente
if (require.main === module) {
  migrateData()
    .then(() => {
      console.log("🎉 Migrazione completata con successo!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 Errore fatale:", error);
      process.exit(1);
    });
}

export { migrateData };