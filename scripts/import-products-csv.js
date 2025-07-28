#!/usr/bin/env node
const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");
const readline = require("readline");

const prisma = new PrismaClient();

async function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  // Don't forget last field
  result.push(current);
  
  return result;
}

async function importProductsFromCSV(fileName) {
  try {
    const filePath = path.join(process.cwd(), fileName);
    
    if (!fs.existsSync(filePath)) {
      console.error(`❌ File not found: ${filePath}`);
      console.log(`\n💡 Make sure the CSV file is in the project root directory`);
      return;
    }

    console.log(`📦 Importing products from ${fileName}...\n`);

    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    let isFirstLine = true;
    let headers = [];
    let updatedCount = 0;
    let createdCount = 0;
    let errorCount = 0;

    for await (const line of rl) {
      if (isFirstLine) {
        headers = await parseCSVLine(line);
        isFirstLine = false;
        continue;
      }

      try {
        const values = await parseCSVLine(line);
        const product = {};

        // Map values to product object
        headers.forEach((header, index) => {
          let value = values[index];
          
          // Convert string boolean values
          if (['disponibile', 'terminato', 'glutenFree', 'vegano', 'vegetariano', 'isDeleted'].includes(header)) {
            value = value === 'true' || value === 'TRUE' || value === '1';
          }
          // Convert numeric values
          else if (['id', 'prezzo', 'codice'].includes(header)) {
            value = value ? Number(value) : (header === 'codice' ? null : 0);
          }
          // Convert dates
          else if (['createdAt', 'updatedAt'].includes(header)) {
            value = new Date(value);
          }
          
          product[header] = value;
        });

        // Skip placeholder products
        if (product.nome && product.nome.startsWith('_CATEGORIA_PLACEHOLDER_')) {
          continue;
        }

        // Check if product exists
        const existing = await prisma.prodotto.findUnique({
          where: { id: product.id }
        });

        if (existing) {
          // Update existing product
          await prisma.prodotto.update({
            where: { id: product.id },
            data: {
              nome: product.nome,
              descrizione: product.descrizione,
              prezzo: product.prezzo,
              categoria: product.categoria,
              disponibile: product.disponibile,
              terminato: product.terminato,
              destinazione: product.destinazione,
              codice: product.codice,
              glutenFree: product.glutenFree,
              vegano: product.vegano,
              vegetariano: product.vegetariano,
              isDeleted: product.isDeleted
            }
          });
          updatedCount++;
          process.stdout.write(`\r✅ Updated: ${updatedCount} | 🆕 Created: ${createdCount} | ❌ Errors: ${errorCount}`);
        } else {
          // Create new product (without specifying id)
          const { id, createdAt, updatedAt, ...createData } = product;
          await prisma.prodotto.create({
            data: createData
          });
          createdCount++;
          process.stdout.write(`\r✅ Updated: ${updatedCount} | 🆕 Created: ${createdCount} | ❌ Errors: ${errorCount}`);
        }

      } catch (error) {
        errorCount++;
        console.error(`\n❌ Error processing line: ${error.message}`);
      }
    }

    console.log(`\n\n🎉 Import completed!`);
    console.log(`   ✅ Updated: ${updatedCount} products`);
    console.log(`   🆕 Created: ${createdCount} products`);
    console.log(`   ❌ Errors: ${errorCount}`);

  } catch (error) {
    console.error("❌ Error importing products:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Get filename from command line argument
const fileName = process.argv[2];

if (!fileName) {
  console.log("Usage: node scripts/import-products-csv.js <filename.csv>");
  console.log("Example: node scripts/import-products-csv.js products_export_2025-07-25.csv");
} else {
  importProductsFromCSV(fileName);
}