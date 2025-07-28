import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkProducts() {
  console.log('🔍 Controllo prodotti nel database...\n');

  try {
    // 1. Conta prodotti nella tabella Prodotto
    const prodottiCount = await prisma.prodotto.count({
      where: { isDeleted: false }
    });
    console.log(`📦 Tabella Prodotto: ${prodottiCount} prodotti attivi`);

    // 2. Conta prodotti nella tabella Product
    const productsCount = await prisma.product.count();
    console.log(`📦 Tabella Product: ${productsCount} prodotti`);

    // 3. Conta categorie
    const categoriesCount = await prisma.category.count();
    console.log(`📂 Categorie: ${categoriesCount}`);

    // 4. Conta sottocategorie
    const subcategoriesCount = await prisma.subcategory.count();
    console.log(`📁 Sottocategorie: ${subcategoriesCount}`);

    // 5. Mostra alcuni prodotti di esempio
    console.log('\n📋 Primi 5 prodotti dalla tabella Prodotto:');
    const sampleProdotti = await prisma.prodotto.findMany({
      where: { isDeleted: false },
      take: 5,
      include: {
        category: true,
        subcategory: true
      }
    });

    sampleProdotti.forEach(p => {
      console.log(`- ${p.nome} (€${p.prezzo}) - Cat: ${p.category?.name || p.categoria} ${p.subcategory ? '> ' + p.subcategory.name : ''}`);
    });

    // 6. Verifica prodotti con categorie relazionate
    const prodottiConRelazioni = await prisma.prodotto.count({
      where: {
        isDeleted: false,
        OR: [
          { categoryId: { not: null } },
          { subcategoryId: { not: null } }
        ]
      }
    });
    console.log(`\n✅ Prodotti con relazioni categoria: ${prodottiConRelazioni}`);

    // 7. Verifica prodotti senza categorie
    const prodottiSenzaCategorie = await prisma.prodotto.count({
      where: {
        isDeleted: false,
        categoria: 'Senza categoria'
      }
    });
    console.log(`⚠️  Prodotti senza categoria: ${prodottiSenzaCategorie}`);

  } catch (error) {
    console.error('❌ Errore durante il controllo:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkProducts();