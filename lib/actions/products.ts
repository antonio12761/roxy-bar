"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-multi-tenant";
import { revalidatePath } from "next/cache";
import { serializeDecimalData } from "@/lib/utils/decimal-serializer";
import { nanoid } from "nanoid";

// Ottieni tutte le categorie
export async function getCategories() {
  try {
    // Get unique categories from prodotto table
    const categorieFromProdotti = await prisma.prodotto.findMany({
      where: {
        isDeleted: false
      },
      select: {
        categoria: true
      },
      distinct: ['categoria']
    });

    // Parse categories to extract main categories and subcategories
    const categoryMap = new Map<string, { subcategories: Set<string>, count: number }>();
    
    for (const { categoria } of categorieFromProdotti) {
      if (categoria.includes(' > ')) {
        const [mainCat, subCat] = categoria.split(' > ');
        if (!categoryMap.has(mainCat)) {
          categoryMap.set(mainCat, { subcategories: new Set(), count: 0 });
        }
        categoryMap.get(mainCat)!.subcategories.add(subCat);
      } else {
        if (!categoryMap.has(categoria)) {
          categoryMap.set(categoria, { subcategories: new Set(), count: 0 });
        }
      }
    }

    // Count products for each category
    for (const [catName, catData] of categoryMap) {
      const count = await prisma.prodotto.count({
        where: {
          OR: [
            { categoria: catName },
            { categoria: { startsWith: `${catName} > ` } }
          ],
          isDeleted: false
        }
      });
      catData.count = count;
    }

    // Convert to array format expected by the UI
    const categories = Array.from(categoryMap.entries()).map(([name, data], index) => ({
      id: index + 1, // Generate temporary IDs
      name,
      icon: null,
      order: index,
      productsCount: data.count,
      subcategories: Array.from(data.subcategories).map((subName, subIndex) => ({
        id: (index + 1) * 1000 + subIndex, // Generate temporary subcategory IDs
        name: subName,
        order: subIndex,
        categoryId: index + 1,
        productsCount: 0 // We'll calculate this if needed
      }))
    }));

    return categories.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error("Errore recupero categorie:", error);
    return [];
  }
}

// Ottieni sottocategorie di una categoria
export async function getSubcategories(categoryId: number) {
  try {
    const subcategories = await prisma.subcategory.findMany({
      where: { categoryId },
      include: {
        _count: {
          select: {
            Product: true
          }
        }
      },
      orderBy: { order: 'asc' }
    });

    return subcategories.map(sub => ({
      ...sub,
      productsCount: sub._count.Product
    }));
  } catch (error) {
    console.error("Errore recupero sottocategorie:", error);
    return [];
  }
}

// Ottieni prodotti con filtri
export async function getProducts(filters?: {
  categoryId?: number;
  subcategoryId?: number;
  search?: string;
  available?: boolean;
}) {
  try {
    const where: any = {
      isDeleted: false
    };

    // Since we're using temporary IDs for categories, we need to match by name
    if (filters?.categoryId || filters?.subcategoryId) {
      // First get the categories to map IDs to names
      const categories = await getCategories();
      
      if (filters.subcategoryId) {
        // Find the subcategory
        for (const cat of categories) {
          const subcat = cat.subcategories.find(s => s.id === filters.subcategoryId);
          if (subcat) {
            where.categoria = `${cat.name} > ${subcat.name}`;
            break;
          }
        }
      } else if (filters.categoryId) {
        // Find the category
        const category = categories.find(c => c.id === filters.categoryId);
        if (category) {
          where.OR = [
            { categoria: category.name },
            { categoria: { startsWith: `${category.name} > ` } }
          ];
        }
      }
    }

    if (filters?.search) {
      const searchConditions = [
        { nome: { contains: filters.search, mode: 'insensitive' } },
        { descrizione: { contains: filters.search, mode: 'insensitive' } }
      ];
      
      if (where.OR) {
        // Combine with existing OR conditions
        where.AND = [
          { OR: where.OR },
          { OR: searchConditions }
        ];
        delete where.OR;
      } else {
        where.OR = searchConditions;
      }
    }

    if (filters?.available !== undefined) {
      where.disponibile = filters.available;
    }

    const products = await prisma.prodotto.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    // Get categories for mapping
    const categories = await getCategories();

    // Convert to the format expected by the UI
    return products.map(product => {
      let categoryId: number | undefined;
      let subcategoryId: number | undefined;
      let category: any;
      let subcategory: any;

      if (product.categoria.includes(' > ')) {
        const [mainCat, subCat] = product.categoria.split(' > ');
        const mainCategory = categories.find(c => c.name === mainCat);
        if (mainCategory) {
          categoryId = mainCategory.id;
          category = {
            id: mainCategory.id,
            name: mainCategory.name,
            icon: mainCategory.icon,
            order: mainCategory.order,
            productsCount: mainCategory.productsCount,
            subcategories: mainCategory.subcategories
          };
          
          const subCategory = mainCategory.subcategories.find(s => s.name === subCat);
          if (subCategory) {
            subcategoryId = subCategory.id;
            subcategory = {
              ...subCategory,
              category: category
            };
          }
        }
      } else {
        const mainCategory = categories.find(c => c.name === product.categoria);
        if (mainCategory) {
          categoryId = mainCategory.id;
          category = {
            id: mainCategory.id,
            name: mainCategory.name,
            icon: mainCategory.icon,
            order: mainCategory.order,
            productsCount: mainCategory.productsCount,
            subcategories: mainCategory.subcategories
          };
        }
      }

      return {
        id: product.id,
        name: product.nome,
        description: product.descrizione || undefined,
        price: product.prezzo.toNumber(),
        imageUrl: product.immagine || undefined,
        available: product.disponibile,
        requiresGlasses: product.requiresGlasses,
        categoryId,
        subcategoryId,
        category,
        subcategory,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt
      };
    });
  } catch (error) {
    console.error("Errore recupero prodotti:", error);
    return [];
  }
}

// Crea nuovo prodotto
export async function createProduct(data: {
  name: string;
  description?: string;
  price?: number;
  imageUrl?: string;
  categoryId?: number;
  subcategoryId?: number;
  available?: boolean;
  requiresGlasses?: boolean;
}) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Utente non autenticato" };
    }

    // Verifica permessi
    if (!["ADMIN", "MANAGER"].includes(user.ruolo)) {
      return { success: false, error: "Permessi insufficienti" };
    }

    // Validazioni
    if (!data.name.trim()) {
      return { success: false, error: "Nome prodotto obbligatorio" };
    }

    // Get categories to map IDs to names
    const categories = await getCategories();
    let categoryName = "";

    if (data.subcategoryId) {
      // Find the subcategory
      for (const cat of categories) {
        const subcat = cat.subcategories.find(s => s.id === data.subcategoryId);
        if (subcat) {
          categoryName = `${cat.name} > ${subcat.name}`;
          break;
        }
      }
    } else if (data.categoryId) {
      // Find the category
      const category = categories.find(c => c.id === data.categoryId);
      if (category) {
        categoryName = category.name;
      }
    }

    if (!categoryName) {
      return { success: false, error: "Categoria non valida" };
    }

    const product = await prisma.prodotto.create({
      data: {
        nome: data.name.trim(),
        descrizione: data.description?.trim(),
        prezzo: data.price || 0,
        immagine: data.imageUrl?.trim(),
        categoria: categoryName,
        disponibile: data.available ?? true,
        glutenFree: false,
        vegano: false,
        vegetariano: false,
        updatedAt: new Date()
      }
    });

    revalidatePath("/dashboard/products");
    
    // Convert back to the format expected by the UI
    const createdProduct = await getProducts({ search: product.nome });
    const productFormatted = createdProduct.find(p => p.id === product.id);
    
    return { 
      success: true, 
      product: productFormatted || {
        id: product.id,
        name: product.nome,
        description: product.descrizione || undefined,
        price: product.prezzo.toNumber(),
        imageUrl: product.immagine || undefined,
        available: product.disponibile,
        categoryId: data.categoryId,
        subcategoryId: data.subcategoryId
      }
    };
  } catch (error) {
    console.error("Errore creazione prodotto:", error);
    return { success: false, error: "Errore interno del server" };
  }
}

// Aggiorna prodotto
export async function updateProduct(
  id: number, 
  data: {
    name?: string;
    description?: string;
    price?: number;
    imageUrl?: string;
    categoryId?: number;
    subcategoryId?: number;
    available?: boolean;
    requiresGlasses?: boolean;
  }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Utente non autenticato" };
    }

    if (!["ADMIN", "MANAGER"].includes(user.ruolo)) {
      return { success: false, error: "Permessi insufficienti" };
    }

    const updateData: any = {};
    
    if (data.name !== undefined) updateData.nome = data.name.trim();
    if (data.description !== undefined) updateData.descrizione = data.description?.trim();
    if (data.price !== undefined) updateData.prezzo = data.price;
    if (data.imageUrl !== undefined) updateData.immagine = data.imageUrl?.trim();
    if (data.available !== undefined) updateData.disponibile = data.available;
    if (data.requiresGlasses !== undefined) updateData.requiresGlasses = data.requiresGlasses;
    
    // Handle category updates
    if (data.categoryId !== undefined || data.subcategoryId !== undefined) {
      const categories = await getCategories();
      let categoryName = "";

      if (data.subcategoryId) {
        // Find the subcategory
        for (const cat of categories) {
          const subcat = cat.subcategories.find(s => s.id === data.subcategoryId);
          if (subcat) {
            categoryName = `${cat.name} > ${subcat.name}`;
            break;
          }
        }
      } else if (data.categoryId) {
        // Find the category
        const category = categories.find(c => c.id === data.categoryId);
        if (category) {
          categoryName = category.name;
        }
      }

      if (categoryName) {
        updateData.categoria = categoryName;
      }
    }

    const product = await prisma.prodotto.update({
      where: { id },
      data: updateData
    });

    revalidatePath("/dashboard/products");
    
    // Convert back to the format expected by the UI
    const updatedProducts = await getProducts({ search: product.nome });
    const productFormatted = updatedProducts.find(p => p.id === product.id);
    
    return { 
      success: true, 
      product: productFormatted || {
        id: product.id,
        name: product.nome,
        description: product.descrizione || undefined,
        price: product.prezzo.toNumber(),
        imageUrl: product.immagine || undefined,
        available: product.disponibile,
        categoryId: data.categoryId,
        subcategoryId: data.subcategoryId
      }
    };
  } catch (error) {
    console.error("Errore aggiornamento prodotto:", error);
    return { success: false, error: "Errore interno del server" };
  }
}

// Elimina prodotto
export async function deleteProduct(id: number) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Utente non autenticato" };
    }

    if (!["ADMIN", "MANAGER"].includes(user.ruolo)) {
      return { success: false, error: "Permessi insufficienti" };
    }

    // Mark as deleted instead of actually deleting
    await prisma.prodotto.update({
      where: { id },
      data: { isDeleted: true }
    });

    revalidatePath("/dashboard/products");
    
    return { success: true };
  } catch (error) {
    console.error("Errore eliminazione prodotto:", error);
    return { success: false, error: "Errore interno del server" };
  }
}

// Crea nuova categoria
export async function createCategory(data: {
  name: string;
  icon?: string;
  order?: number;
}) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Utente non autenticato" };
    }

    if (!["ADMIN", "MANAGER"].includes(user.ruolo)) {
      return { success: false, error: "Permessi insufficienti" };
    }

    if (!data.name.trim()) {
      return { success: false, error: "Nome categoria obbligatorio" };
    }

    // Check if category already exists
    const existingProduct = await prisma.prodotto.findFirst({
      where: {
        categoria: data.name.trim(),
        isDeleted: false
      }
    });

    if (existingProduct) {
      return { success: false, error: "Categoria già esistente" };
    }

    // Create a placeholder product to make the category visible
    await prisma.prodotto.create({
      data: {
        nome: `_CATEGORIA_PLACEHOLDER_${data.name.trim()}`,
        categoria: data.name.trim(),
        prezzo: 0,
        disponibile: false,
        descrizione: "Placeholder per categoria vuota - non eliminare",
        glutenFree: false,
        vegano: false,
        vegetariano: false,
        updatedAt: new Date()
      }
    });

    revalidatePath("/dashboard/products");
    
    // Get updated categories
    const categories = await getCategories();
    const createdCategory = categories.find(c => c.name === data.name.trim());
    
    return { 
      success: true, 
      category: createdCategory || {
        id: categories.length,
        name: data.name.trim(),
        icon: data.icon || null,
        order: data.order ?? 0,
        productsCount: 0,
        subcategories: []
      }
    };
  } catch (error) {
    console.error("Errore creazione categoria:", error);
    return { success: false, error: "Errore interno del server" };
  }
}

// Crea nuova sottocategoria
export async function createSubcategory(data: {
  name: string;
  categoryId: number;
  order?: number;
}) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Utente non autenticato" };
    }

    if (!["ADMIN", "MANAGER"].includes(user.ruolo)) {
      return { success: false, error: "Permessi insufficienti" };
    }

    if (!data.name.trim()) {
      return { success: false, error: "Nome sottocategoria obbligatorio" };
    }

    // Get categories to find the parent category name
    const categories = await getCategories();
    const parentCategory = categories.find(c => c.id === data.categoryId);
    
    if (!parentCategory) {
      return { success: false, error: "Categoria padre non trovata" };
    }

    const fullCategoryName = `${parentCategory.name} > ${data.name.trim()}`;

    // Check if subcategory already exists
    const existingProduct = await prisma.prodotto.findFirst({
      where: {
        categoria: fullCategoryName,
        isDeleted: false
      }
    });

    if (existingProduct) {
      return { success: false, error: "Sottocategoria già esistente" };
    }

    // Create a placeholder product to make the subcategory visible
    await prisma.prodotto.create({
      data: {
        nome: `_CATEGORIA_PLACEHOLDER_${fullCategoryName}`,
        categoria: fullCategoryName,
        prezzo: 0,
        disponibile: false,
        descrizione: "Placeholder per categoria vuota - non eliminare",
        glutenFree: false,
        vegano: false,
        vegetariano: false,
        updatedAt: new Date()
      }
    });

    revalidatePath("/dashboard/products");
    
    // Get updated categories
    const updatedCategories = await getCategories();
    const updatedParentCategory = updatedCategories.find(c => c.id === data.categoryId);
    const createdSubcategory = updatedParentCategory?.subcategories.find(s => s.name === data.name.trim());
    
    return { 
      success: true, 
      subcategory: createdSubcategory || {
        id: (data.categoryId * 1000) + (updatedParentCategory?.subcategories.length || 0),
        name: data.name.trim(),
        order: data.order ?? 0,
        categoryId: data.categoryId,
        productsCount: 0,
        category: parentCategory
      }
    };
  } catch (error) {
    console.error("Errore creazione sottocategoria:", error);
    return { success: false, error: "Errore interno del server" };
  }
}

// Export prodotti in formato CSV (Server Action)
export async function exportProductsCSV() {
  try {
    const user = await getCurrentUser();
    if (!user || !["ADMIN", "MANAGER"].includes(user.ruolo)) {
      return { success: false, error: "Non autorizzato" };
    }

    // Get all products
    const products = await prisma.prodotto.findMany({
      orderBy: [
        { categoria: 'asc' },
        { nome: 'asc' }
      ]
    });

    // Prepare CSV header
    const headers = [
      "id",
      "nome",
      "descrizione", 
      "prezzo",
      "categoria",
      "disponibile",
      "terminato",
      "postazione",
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

    // Add product rows with proper serialization
    const serializedProducts = serializeDecimalData(products);
    serializedProducts.forEach(product => {
      const row = [
        product.id,
        `"${(product.nome || '').replace(/"/g, '""')}"`, // Escape quotes
        `"${(product.descrizione || '').replace(/"/g, '""')}"`,
        product.prezzo,
        `"${(product.categoria || '').replace(/"/g, '""')}"`,
        product.disponibile,
        product.terminato,
        product.postazione,
        product.codice || '',
        product.glutenFree,
        product.vegano,
        product.vegetariano,
        product.isDeleted,
        product.createdAt,
        product.updatedAt
      ];
      
      csvContent += row.join(",") + "\n";
    });

    const fileName = `products_export_${new Date().toISOString().split('T')[0]}.csv`;
    
    return { 
      success: true, 
      csvContent,
      fileName,
      contentType: 'text/csv; charset=utf-8'
    };

  } catch (error) {
    console.error("Export error:", error);
    return { success: false, error: "Errore durante l'esportazione" };
  }
}

// Helper function per parsare CSV
async function parseCSVLine(line: string): Promise<string[]> {
  const result: string[] = [];
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

// Import prodotti da CSV (Server Action)
export async function importProductsCSV(formData: FormData) {
  try {
    const user = await getCurrentUser();
    if (!user || !["ADMIN", "MANAGER"].includes(user.ruolo)) {
      return { success: false, error: "Non autorizzato" };
    }

    const file = formData.get('file') as File;
    
    if (!file) {
      return { success: false, error: "Nessun file fornito" };
    }

    const content = await file.text();
    const lines = content.split('\n').filter(line => line.trim());

    if (lines.length < 2) {
      return { success: false, error: "Il file CSV deve contenere almeno un header e una riga di dati" };
    }

    const headers = await parseCSVLine(lines[0]);
    let updatedCount = 0;
    let createdCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Process each line
    for (let i = 1; i < lines.length; i++) {
      try {
        const values = await parseCSVLine(lines[i]);
        const product: any = {};

        // Map values to product object
        headers.forEach((header, index) => {
          let value: any = values[index];
          
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
              postazione: product.postazione,
              codice: product.codice,
              glutenFree: product.glutenFree,
              vegano: product.vegano,
              vegetariano: product.vegetariano,
              isDeleted: product.isDeleted
            }
          });
          updatedCount++;
        } else {
          // Create new product (with generated id)
          const { id, createdAt, updatedAt, ...createData } = product;
          await prisma.prodotto.create({
            data: {
              ...createData,
              id: Math.floor(Math.random() * 1000000000) + Date.now() // Generate numeric id
            }
          });
          createdCount++;
        }

      } catch (error: any) {
        errorCount++;
        errors.push(`Riga ${i + 1}: ${error.message}`);
      }
    }

    revalidatePath("/dashboard/products");
    revalidatePath("/dashboard/categorie");

    return {
      success: true,
      updated: updatedCount,
      created: createdCount,
      errors: errorCount,
      errorDetails: errors.slice(0, 10) // Show max 10 errors
    };

  } catch (error) {
    console.error("Import error:", error);
    return { success: false, error: "Errore durante l'importazione" };
  }
}