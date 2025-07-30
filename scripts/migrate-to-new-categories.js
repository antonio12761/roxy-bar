const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrateCategories() {
  console.log('🔄 Inizio migrazione categorie...');

  try {
    // 1. Crea categorie principali
    const mainCategories = [
      { name: 'Bevande', order: 1 },
      { name: 'Food', order: 2 },
      { name: 'Alcolici', order: 3 },
      { name: 'Birre', order: 4 },
      { name: 'Vini', order: 5 },
      { name: 'Gelati', order: 6 },
      { name: 'Dolci', order: 7 },
      { name: 'Snack', order: 8 },
      { name: 'Bar', order: 9 }
    ];

    console.log('📁 Creazione categorie principali...');
    const createdCategories = {};
    
    for (const cat of mainCategories) {
      // Prima cerca se esiste
      let created = await prisma.category.findFirst({
        where: { name: cat.name }
      });
      
      if (created) {
        // Se esiste, aggiorna
        created = await prisma.category.update({
          where: { id: created.id },
          data: { order: cat.order }
        });
        console.log(`📝 Categoria ${cat.name} aggiornata`);
      } else {
        // Se non esiste, crea
        created = await prisma.category.create({
          data: {
            name: cat.name,
            order: cat.order
          }
        });
        console.log(`✅ Categoria ${cat.name} creata`);
      }
      
      createdCategories[cat.name] = created;
    }

    // 2. Crea sottocategorie
    const subcategories = [
      // Bevande
      { name: 'Soft Drinks', categoryName: 'Bevande', order: 1 },
      { name: 'Succhi', categoryName: 'Bevande', order: 2 },
      { name: 'Energy Drinks', categoryName: 'Bevande', order: 3 },
      { name: 'Acque', categoryName: 'Bevande', order: 4 },
      { name: 'Tè e Tisane', categoryName: 'Bevande', order: 5 },
      
      // Food
      { name: 'Panini', categoryName: 'Food', order: 1 },
      { name: 'Toast', categoryName: 'Food', order: 2 },
      { name: 'Taglieri', categoryName: 'Food', order: 3 },
      
      // Alcolici
      { name: 'Vodka', categoryName: 'Alcolici', order: 1 },
      { name: 'Gin', categoryName: 'Alcolici', order: 2 },
      { name: 'Rum', categoryName: 'Alcolici', order: 3 },
      { name: 'Whisky', categoryName: 'Alcolici', order: 4 },
      { name: 'Amari', categoryName: 'Alcolici', order: 5 },
      { name: 'Liquori', categoryName: 'Alcolici', order: 6 },
      { name: 'Aperitivi', categoryName: 'Alcolici', order: 7 },
      
      // Birre
      { name: 'Birre 33cl', categoryName: 'Birre', order: 1 },
      { name: 'Birre 50cl', categoryName: 'Birre', order: 2 },
      { name: 'Birre 66cl', categoryName: 'Birre', order: 3 },
      { name: 'Birre Spina', categoryName: 'Birre', order: 4 },
      
      // Vini
      { name: 'Vini Bianchi', categoryName: 'Vini', order: 1 },
      { name: 'Vini Rossi', categoryName: 'Vini', order: 2 },
      { name: 'Prosecco', categoryName: 'Vini', order: 3 },
      { name: 'Spumanti', categoryName: 'Vini', order: 4 }
    ];

    console.log('\n📂 Creazione sottocategorie...');
    for (const subcat of subcategories) {
      const category = createdCategories[subcat.categoryName];
      if (category) {
        // Prima cerca se esiste
        let created = await prisma.subcategory.findFirst({
          where: { 
            name: subcat.name,
            categoryId: category.id
          }
        });
        
        if (created) {
          // Se esiste, aggiorna
          await prisma.subcategory.update({
            where: { id: created.id },
            data: { order: subcat.order }
          });
          console.log(`📝 Sottocategoria ${subcat.name} aggiornata in ${subcat.categoryName}`);
        } else {
          // Se non esiste, crea
          await prisma.subcategory.create({
            data: {
              name: subcat.name,
              categoryId: category.id,
              order: subcat.order
            }
          });
          console.log(`✅ Sottocategoria ${subcat.name} creata in ${subcat.categoryName}`);
        }
      }
    }

    // 3. Aggiorna i prodotti con le nuove categorie
    console.log('\n🔄 Aggiornamento prodotti con nuove categorie...');
    const products = await prisma.prodotto.findMany();
    let updatedCount = 0;

    for (const product of products) {
      // Trova la categoria corrispondente
      const category = createdCategories[product.categoria];
      if (category) {
        await prisma.prodotto.update({
          where: { id: product.id },
          data: { categoryId: category.id }
        });
        updatedCount++;
      }
    }

    console.log(`✅ ${updatedCount} prodotti aggiornati con le nuove categorie`);

    // 4. Crea categorie menu per il sistema di ordinazione
    console.log('\n🍽️ Creazione categorie menu...');
    const menuCategories = [
      { nome: 'Bevande', nomeDisplay: '🥤 Bevande', ordine: 1 },
      { nome: 'Birre', nomeDisplay: '🍺 Birre', ordine: 2 },
      { nome: 'Vini', nomeDisplay: '🍷 Vini', ordine: 3 },
      { nome: 'Cocktail', nomeDisplay: '🍹 Cocktail', ordine: 4 },
      { nome: 'Food', nomeDisplay: '🍔 Food', ordine: 5 },
      { nome: 'Dolci', nomeDisplay: '🍰 Dolci', ordine: 6 },
      { nome: 'Gelati', nomeDisplay: '🍦 Gelati', ordine: 7 }
    ];

    for (const menuCat of menuCategories) {
      // Prima cerca se esiste
      let created = await prisma.categoriaMenu.findFirst({
        where: { nome: menuCat.nome }
      });
      
      if (created) {
        // Se esiste, aggiorna
        await prisma.categoriaMenu.update({
          where: { id: created.id },
          data: { 
            nomeDisplay: menuCat.nomeDisplay,
            ordine: menuCat.ordine 
          }
        });
        console.log(`📝 Categoria menu ${menuCat.nomeDisplay} aggiornata`);
      } else {
        // Se non esiste, crea
        await prisma.categoriaMenu.create({
          data: menuCat
        });
        console.log(`✅ Categoria menu ${menuCat.nomeDisplay} creata`);
      }
    }

    console.log('\n✅ Migrazione categorie completata con successo!');

  } catch (error) {
    console.error('❌ Errore durante la migrazione:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

migrateCategories();