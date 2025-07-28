import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function syncProductsCategories() {
  console.log('🔄 Iniziando sincronizzazione categorie prodotti...');

  try {
    // 1. Ottieni tutti i prodotti dalla tabella Prodotto
    const prodotti = await prisma.prodotto.findMany({
      where: { isDeleted: false }
    });

    console.log(`📦 Trovati ${prodotti.length} prodotti da sincronizzare`);

    let updatedCount = 0;

    for (const prodotto of prodotti) {
      // Se il prodotto ha già categoryId e subcategoryId, salta
      if (prodotto.categoryId && prodotto.subcategoryId) {
        continue;
      }

      // Estrai categoria e sottocategoria dalla stringa
      if (prodotto.categoria && prodotto.categoria !== 'Senza categoria') {
        const parts = prodotto.categoria.split(' > ').map(p => p.trim());
        const categoryName = parts[0];
        const subcategoryName = parts.length > 1 ? parts[1] : null;

        // Trova la categoria
        const category = await prisma.category.findFirst({
          where: { name: categoryName }
        });

        if (category) {
          let updateData: any = {
            categoryId: category.id
          };

          // Se c'è una sottocategoria, trova anche quella
          if (subcategoryName) {
            const subcategory = await prisma.subcategory.findFirst({
              where: {
                name: subcategoryName,
                categoryId: category.id
              }
            });

            if (subcategory) {
              updateData.subcategoryId = subcategory.id;
              // Se abbiamo la sottocategoria, non serve la categoria
              updateData.categoryId = null;
            }
          }

          // Aggiorna il prodotto
          await prisma.prodotto.update({
            where: { id: prodotto.id },
            data: updateData
          });

          updatedCount++;
          console.log(`✅ Aggiornato: ${prodotto.nome} -> ${categoryName}${subcategoryName ? ' > ' + subcategoryName : ''}`);
        } else {
          console.log(`⚠️  Categoria non trovata per: ${prodotto.nome} (${prodotto.categoria})`);
        }
      }
    }

    console.log(`\n✅ Sincronizzazione completata! ${updatedCount} prodotti aggiornati.`);

    // 2. Verifica lo stato finale
    const prodottiConCategorie = await prisma.prodotto.count({
      where: {
        isDeleted: false,
        OR: [
          { categoryId: { not: null } },
          { subcategoryId: { not: null } }
        ]
      }
    });

    const prodottiSenzaCategorie = await prisma.prodotto.count({
      where: {
        isDeleted: false,
        categoryId: null,
        subcategoryId: null
      }
    });

    console.log('\n📊 Riepilogo:');
    console.log(`   - Prodotti con categorie: ${prodottiConCategorie}`);
    console.log(`   - Prodotti senza categorie: ${prodottiSenzaCategorie}`);

  } catch (error) {
    console.error('❌ Errore durante la sincronizzazione:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Esegui la sincronizzazione
syncProductsCategories()
  .then(() => {
    console.log('\n🎉 Sincronizzazione completata con successo!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Sincronizzazione fallita:', error);
    process.exit(1);
  });