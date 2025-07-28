"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { serializeDecimalData } from "@/lib/utils/decimal-serializer";

// Ottieni tutte le categorie
export async function getCategories() {
  try {
    const categories = await prisma.category.findMany({
      include: {
        subcategories: {
          orderBy: { order: 'asc' }
        },
        _count: {
          select: {
            products: true
          }
        }
      },
      orderBy: { order: 'asc' }
    });

    return categories.map(category => ({
      ...category,
      productsCount: category._count.products
    }));
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
            products: true
          }
        }
      },
      orderBy: { order: 'asc' }
    });

    return subcategories.map(sub => ({
      ...sub,
      productsCount: sub._count.products
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
    const where: any = {};

    if (filters?.categoryId) {
      where.categoryId = filters.categoryId;
    }
    
    if (filters?.subcategoryId) {
      where.subcategoryId = filters.subcategoryId;
    }

    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } }
      ];
    }

    if (filters?.available !== undefined) {
      where.available = filters.available;
    }

    const products = await prisma.prodotto.findMany({
      where,
      include: {
        category: true,
        subcategory: {
          include: {
            category: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Serializza Decimal per il client e mappa i nomi dei campi
    return products.map(product => ({
      id: product.id,
      name: product.nome,
      description: product.descrizione || undefined,
      price: product.prezzo ? product.prezzo.toNumber() : undefined,
      imageUrl: product.immagine || undefined,
      available: product.disponibile,
      categoryId: product.categoryId || undefined,
      subcategoryId: product.subcategoryId || undefined,
      category: product.category ? {
        ...product.category,
        icon: product.category.icon || undefined,
        productsCount: 0, // This would need to be calculated separately
        subcategories: [] // This would need to be fetched separately
      } : undefined,
      subcategory: product.subcategory ? {
        ...product.subcategory,
        productsCount: 0, // This would need to be calculated separately
        category: product.subcategory.category ? {
          ...product.subcategory.category,
          icon: product.subcategory.category.icon || undefined,
          productsCount: 0,
          subcategories: []
        } : undefined
      } : undefined
    }));
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

    // Se è specificata una sottocategoria, non serve la categoria
    if (data.subcategoryId && data.categoryId) {
      data.categoryId = undefined;
    }

    const product = await prisma.prodotto.create({
      data: {
        nome: data.name.trim(),
        descrizione: data.description?.trim(),
        prezzo: data.price || 0,
        immagine: data.imageUrl?.trim(),
        categoria: "Generale", // Campo obbligatorio nella tabella Prodotto
        categoryId: data.categoryId,
        subcategoryId: data.subcategoryId,
        disponibile: data.available ?? true
      },
      include: {
        category: true,
        subcategory: {
          include: {
            category: true
          }
        }
      }
    });

    revalidatePath("/dashboard/products");
    
    return { 
      success: true, 
      product: {
        id: product.id,
        name: product.nome,
        description: product.descrizione || undefined,
        price: product.prezzo ? product.prezzo.toNumber() : undefined,
        imageUrl: product.immagine || undefined,
        available: product.disponibile,
        categoryId: product.categoryId || undefined,
        subcategoryId: product.subcategoryId || undefined,
        category: product.category ? {
          ...product.category,
          icon: product.category.icon || undefined,
          productsCount: 0,
          subcategories: []
        } : undefined,
        subcategory: product.subcategory ? {
          ...product.subcategory,
          productsCount: 0,
          category: product.subcategory.category ? {
            ...product.subcategory.category,
            icon: product.subcategory.category.icon || undefined,
            productsCount: 0,
            subcategories: []
          } : undefined
        } : undefined
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
    
    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.description !== undefined) updateData.description = data.description?.trim();
    if (data.price !== undefined) updateData.price = data.price;
    if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl?.trim();
    if (data.available !== undefined) updateData.available = data.available;
    
    // Gestione categoria/sottocategoria
    if (data.subcategoryId !== undefined) {
      updateData.subcategoryId = data.subcategoryId;
      updateData.categoryId = null; // Reset categoria se si specifica sottocategoria
    } else if (data.categoryId !== undefined) {
      updateData.categoryId = data.categoryId;
      updateData.subcategoryId = null; // Reset sottocategoria se si specifica categoria
    }

    const product = await prisma.prodotto.update({
      where: { id },
      data: updateData,
      include: {
        category: true,
        subcategory: {
          include: {
            category: true
          }
        }
      }
    });

    revalidatePath("/dashboard/products");
    
    return { 
      success: true, 
      product: {
        id: product.id,
        name: product.nome,
        description: product.descrizione || undefined,
        price: product.prezzo ? product.prezzo.toNumber() : undefined,
        imageUrl: product.immagine || undefined,
        available: product.disponibile,
        categoryId: product.categoryId || undefined,
        subcategoryId: product.subcategoryId || undefined,
        category: product.category ? {
          ...product.category,
          icon: product.category.icon || undefined,
          productsCount: 0,
          subcategories: []
        } : undefined,
        subcategory: product.subcategory ? {
          ...product.subcategory,
          productsCount: 0,
          category: product.subcategory.category ? {
            ...product.subcategory.category,
            icon: product.subcategory.category.icon || undefined,
            productsCount: 0,
            subcategories: []
          } : undefined
        } : undefined
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

    await prisma.prodotto.delete({
      where: { id }
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

    const category = await prisma.category.create({
      data: {
        name: data.name.trim(),
        icon: data.icon?.trim(),
        order: data.order ?? 0
      }
    });

    revalidatePath("/dashboard/products");
    
    return { success: true, category };
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

    const subcategory = await prisma.subcategory.create({
      data: {
        name: data.name.trim(),
        categoryId: data.categoryId,
        order: data.order ?? 0
      },
      include: {
        category: true
      }
    });

    revalidatePath("/dashboard/products");
    
    return { success: true, subcategory };
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
        product.destinazione,
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
              destinazione: product.destinazione,
              codice: product.codice,
              glutenFree: product.glutenFree,
              vegano: product.vegano,
              vegetariano: product.vegetariano,
              isDeleted: product.isDeleted
            }
          });
          updatedCount++;
        } else {
          // Create new product (without specifying id)
          const { id, createdAt, updatedAt, ...createData } = product;
          await prisma.prodotto.create({
            data: createData
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