#!/usr/bin/env node
const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");

const prisma = new PrismaClient();

async function exportProductsToCSV() {
  try {
    console.log("📦 Exporting products from database...\n");

    // Get all products including deleted ones
    const products = await prisma.prodotto.findMany({
      orderBy: [
        { categoria: 'asc' },
        { nome: 'asc' }
      ]
    });

    console.log(`Found ${products.length} products in database\n`);

    // Prepare CSV header
    const headers = [
      "id",
      "nome",
      "descrizione",
      "prezzo",
      "categoria",
      "disponibile",
      "terminato",
      "destinazione",
      "codice",
      "glutenFree",
      "vegano",
      "vegetariano",
      "isDeleted",
      "createdAt",
      "updatedAt"
    ];

    // Create CSV content
    let csvContent = headers.join(",") + "\n";

    // Add product rows
    products.forEach(product => {
      const row = [
        product.id,
        `"${(product.nome || '').replace(/"/g, '""')}"`, // Escape quotes
        `"${(product.descrizione || '').replace(/"/g, '""')}"`,
        product.prezzo,
        `"${(product.categoria || '').replace(/"/g, '""')}"`,
        product.disponibile,
        product.terminato,
        product.destinazione,
        product.codice || '',
        product.glutenFree,
        product.vegano,
        product.vegetariano,
        product.isDeleted,
        product.createdAt.toISOString(),
        product.updatedAt.toISOString()
      ];
      
      csvContent += row.join(",") + "\n";
    });

    // Save to file
    const fileName = `products_export_${new Date().toISOString().split('T')[0]}.csv`;
    const filePath = path.join(process.cwd(), fileName);
    
    fs.writeFileSync(filePath, csvContent, 'utf8');
    
    console.log(`✅ Export completed successfully!`);
    console.log(`📄 File saved as: ${fileName}`);
    console.log(`📍 Location: ${filePath}`);
    console.log(`\n💡 You can open this file in Excel or any spreadsheet application`);
    console.log(`\n⚠️  Important notes for editing:`);
    console.log(`   - Keep the 'id' column unchanged`);
    console.log(`   - Don't delete the header row`);
    console.log(`   - Keep boolean values as true/false`);
    console.log(`   - Keep dates in ISO format`);
    console.log(`   - Save as CSV when done editing`);

  } catch (error) {
    console.error("❌ Error exporting products:", error);
  } finally {
    await prisma.$disconnect();
  }
}

exportProductsToCSV();