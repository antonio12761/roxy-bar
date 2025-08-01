"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-multi-tenant";
import { revalidatePath } from "next/cache";

interface ImportProduct {
  name: string;
  description?: string;
  price?: number;
  imageUrl?: string;
  categoryName?: string;
  subcategoryName?: string;
  available?: boolean;
}

interface ImportResult {
  success: boolean;
  processed: number;
  created: number;
  updated: number;
  errors: string[];
}

export async function importProductsFromCSV(csvData: string): Promise<ImportResult> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, processed: 0, created: 0, updated: 0, errors: ["Utente non autenticato"] };
    }

    if (!["ADMIN", "MANAGER"].includes(user.ruolo)) {
      return { success: false, processed: 0, created: 0, updated: 0, errors: ["Permessi insufficienti"] };
    }

    const lines = csvData.trim().split('\n');
    if (lines.length < 2) {
      return { success: false, processed: 0, created: 0, updated: 0, errors: ["File CSV vuoto o senza dati"] };
    }

    // Parse header - supporta sia header formali che file con solo prodotti
    let header: string[] = [];
    let hasHeader = false;
    
    // Prova a capire se la prima riga è un header o un prodotto
    const firstLine = lines[0].toLowerCase();
    if (firstLine.includes('name') || firstLine.includes('nome') || firstLine.includes('description')) {
      // È un header
      header = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      hasHeader = true;
    } else {
      // Non è un header, tratta come lista di prodotti
      header = ['name']; // Assume che sia solo una lista di nomi
      hasHeader = false;
    }
    
    // Se non ha header, verifica che ci siano dati
    if (!hasHeader && lines.length === 0) {
      return { success: false, processed: 0, created: 0, updated: 0, errors: ["File vuoto"] };
    }

    const result: ImportResult = {
      success: true,
      processed: 0,
      created: 0,
      updated: 0,
      errors: []
    };

    // Cache per categorie e sottocategorie
    const categoryCache = new Map<string, number>();
    const subcategoryCache = new Map<string, { id: number, categoryId: number }>();

    // Carica categorie esistenti
    const existingCategories = await prisma.category.findMany({
      include: {
        Subcategory: true
      }
    });

    existingCategories.forEach(cat => {
      categoryCache.set(cat.name.toLowerCase(), cat.id);
      cat.Subcategory.forEach((sub: any) => {
        subcategoryCache.set(`${cat.name.toLowerCase()}_${sub.name.toLowerCase()}`, {
          id: sub.id,
          categoryId: cat.id
        });
      });
    });

    // Processa ogni riga - inizia da 0 se non c'è header, da 1 se c'è header
    const startIndex = hasHeader ? 1 : 0;
    for (let i = startIndex; i < lines.length; i++) {
      try {
        result.processed++;
        const values = parseCSVLine(lines[i]);
        
        if (values.length === 0 || !values[0]?.trim()) {
          continue; // Salta righe vuote
        }

        const productData: ImportProduct = { name: '' };
        
        if (hasHeader) {
          // Mappa i valori secondo l'header
          header.forEach((col, index) => {
            const value = values[index]?.trim().replace(/"/g, '');
            if (!value) return;

            switch (col.toLowerCase()) {
              case 'name':
              case 'nome':
                productData.name = value;
                break;
              case 'description':
              case 'descrizione':
                productData.description = value;
                break;
              case 'price':
              case 'prezzo':
                const price = parseFloat(value);
                if (!isNaN(price)) productData.price = price;
                break;
              case 'imageurl':
              case 'immagine':
                if (value.startsWith('http')) productData.imageUrl = value;
                break;
              case 'categoryname':
              case 'categoria':
                productData.categoryName = value;
                break;
              case 'subcategoryname':
              case 'sottocategoria':
                productData.subcategoryName = value;
                break;
              case 'available':
              case 'disponibile':
                productData.available = ['true', '1', 'si', 'yes', 'vero'].includes(value.toLowerCase());
                break;
            }
          });
        } else {
          // File semplice con solo nomi - ogni riga è un nome prodotto
          const productName = values[0]?.trim().replace(/"/g, '');
          if (productName) {
            productData.name = productName;
            // Imposta valori di default per prodotti senza dettagli
            productData.available = true; // Disponibile by default
            // Prezzo e categoria saranno null/undefined - da compilare in modifica
          }
        }

        if (!productData.name) {
          result.errors.push(`Riga ${i + 1}: Nome prodotto mancante`);
          continue;
        }

        // Gestisci categoria/sottocategoria
        let categoryId: number | undefined;
        let subcategoryId: number | undefined;

        if (productData.subcategoryName && productData.categoryName) {
          // Cerca sottocategoria esistente
          const subKey = `${productData.categoryName.toLowerCase()}_${productData.subcategoryName.toLowerCase()}`;
          let subcategoryInfo = subcategoryCache.get(subKey);

          if (!subcategoryInfo) {
            // Crea categoria se non exists
            let catId = categoryCache.get(productData.categoryName.toLowerCase());
            if (!catId) {
              const newCategory = await prisma.category.create({
                data: {
                  name: productData.categoryName,
                  order: categoryCache.size,
                  createdAt: new Date(),
                  updatedAt: new Date()
                }
              });
              catId = newCategory.id;
              categoryCache.set(productData.categoryName.toLowerCase(), catId);
            }

            // Crea sottocategoria
            const newSubcategory = await prisma.subcategory.create({
              data: {
                name: productData.subcategoryName,
                categoryId: catId,
                order: 0,
                createdAt: new Date(),
                updatedAt: new Date()
              }
            });

            subcategoryInfo = { id: newSubcategory.id, categoryId: catId };
            subcategoryCache.set(subKey, subcategoryInfo);
          }

          subcategoryId = subcategoryInfo.id;
        } else if (productData.categoryName) {
          // Solo categoria
          let catId = categoryCache.get(productData.categoryName.toLowerCase());
          if (!catId) {
            const newCategory = await prisma.category.create({
              data: {
                name: productData.categoryName,
                order: categoryCache.size,
                createdAt: new Date(),
                updatedAt: new Date()
              }
            });
            catId = newCategory.id;
            categoryCache.set(productData.categoryName.toLowerCase(), catId);
          }
          categoryId = catId;
        }

        // Verifica se il prodotto esiste già
        const existingProduct = await prisma.product.findFirst({
          where: {
            name: productData.name
          }
        });

        if (existingProduct) {
          // Aggiorna prodotto esistente solo se ci sono dati da aggiornare
          const updateData: any = {};
          
          if (productData.description !== undefined) updateData.description = productData.description;
          if (productData.price !== undefined) updateData.price = productData.price;
          if (productData.imageUrl !== undefined) updateData.imageUrl = productData.imageUrl;
          if (categoryId !== undefined) updateData.categoryId = categoryId;
          if (subcategoryId !== undefined) updateData.subcategoryId = subcategoryId;
          if (productData.available !== undefined) updateData.available = productData.available;
          
          // Solo aggiorna se ci sono modifiche da fare
          if (Object.keys(updateData).length > 0) {
            await prisma.product.update({
              where: { id: existingProduct.id },
              data: updateData
            });
          }
          result.updated++;
        } else {
          // Crea nuovo prodotto - anche se ha solo il nome
          await prisma.product.create({
            data: {
              name: productData.name,
              description: productData.description || null,
              price: productData.price || null,
              imageUrl: productData.imageUrl || null,
              categoryId: categoryId || null,
              subcategoryId: subcategoryId || null,
              available: productData.available ?? true,
              createdAt: new Date(),
              updatedAt: new Date()
            }
          });
          result.created++;
        }

      } catch (error) {
        result.errors.push(`Riga ${i + 1}: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`);
      }
    }

    revalidatePath("/dashboard/products");
    
    return result;

  } catch (error) {
    console.error("Errore importazione CSV:", error);
    return { 
      success: false, 
      processed: 0, 
      created: 0, 
      updated: 0, 
      errors: [error instanceof Error ? error.message : 'Errore sconosciuto'] 
    };
  }
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current);
  return result;
}

export async function generateCSVTemplate(): Promise<string> {
  const headers = [
    'name',
    'description', 
    'price',
    'imageUrl',
    'categoryName',
    'subcategoryName',
    'available'
  ];

  const exampleRows = [
    [
      'Caffè Espresso',
      'Caffè espresso italiano',
      '1.20',
      '',
      'CAFFETTERIA',
      '',
      'true'
    ],
    [
      'Gin Tonic',
      'Gin tonic con lime',
      '8.00',
      '',
      'APERITIVI',
      'COCKTAILS',
      'true'
    ],
    [
      'Pizza Margherita',
      'Pizza con pomodoro e mozzarella',
      '12.50',
      '',
      'FOOD',
      'PIZZE',
      'true'
    ]
  ];

  const csvContent = [
    '# Template completo con tutte le colonne',
    headers.join(','),
    ...exampleRows.map(row => row.map(cell => `"${cell}"`).join(',')),
    '',
    '# OPPURE - File semplice con solo nomi prodotti (senza header):',
    '# Basta elencare i nomi dei prodotti, uno per riga:',
    '# Caffè Americano',
    '# Cappuccino',
    '# Brioche alla marmellata',
    '# Panino prosciutto',
    '# Acqua naturale'
  ].join('\n');

  return csvContent;
}

export async function generateSimpleTemplate(): Promise<string> {
  const simpleProducts = [
    'Caffè Espresso',
    'Cappuccino',
    'Caffè Americano',
    'Macchiato',
    'Brioche vuota',
    'Brioche alla marmellata',
    'Cornetto alla crema',
    'Panino prosciutto',
    'Panino formaggio',
    'Tramezzino tonno',
    'Acqua naturale',
    'Acqua frizzante',
    'Coca Cola',
    'Aranciata',
    'Birra media'
  ];

  return simpleProducts.join('\n');
}