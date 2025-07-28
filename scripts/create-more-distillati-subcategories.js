#!/usr/bin/env node
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function createMoreDistillatiSubcategories() {
  const subcategories = ['Cognac', 'Brandy', 'Grappa'];
  const parentCategory = 'DISTILLATI';
  
  console.log(`\n📦 Creating additional subcategories for ${parentCategory}...\n`);

  for (const subcategory of subcategories) {
    const fullPath = `${parentCategory} > ${subcategory}`;
    
    try {
      // Check if subcategory already exists
      const existing = await prisma.prodotto.findFirst({
        where: {
          categoria: fullPath
        }
      });

      if (existing) {
        console.log(`⚠️  ${fullPath} already exists`);
        continue;
      }

      // Create placeholder product for the subcategory
      await prisma.prodotto.create({
        data: {
          nome: `_CATEGORIA_PLACEHOLDER_${fullPath}`,
          categoria: fullPath,
          prezzo: 0,
          disponibile: false,
          isDeleted: true,
          descrizione: "Placeholder per categoria vuota - non eliminare",
          destinazione: "BAR",
          terminato: false,
          glutenFree: false,
          vegano: false,
          vegetariano: false
        }
      });

      console.log(`✅ Created subcategory: ${fullPath}`);
    } catch (error) {
      console.error(`❌ Error creating ${fullPath}:`, error.message);
    }
  }

  console.log("\n🎉 Subcategory creation completed!");
}

createMoreDistillatiSubcategories()
  .catch(console.error)
  .finally(() => prisma.$disconnect());