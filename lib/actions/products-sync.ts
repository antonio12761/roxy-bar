"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

// Sincronizza un prodotto da Product a Prodotto
async function syncProductToProdotto(productId: number) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      Category: true,
      Subcategory: true
    }
  });

  if (!product) return null;

  // Costruisci la stringa categoria
  let categoriaString = '';
  if (product.Category) {
    categoriaString = product.Category.name;
    if (product.Subcategory) {
      categoriaString += ` > ${product.Subcategory.name}`;
    }
  }

  // Cerca se esiste già un prodotto con lo stesso nome
  const existingProdotto = await prisma.prodotto.findFirst({
    where: {
      nome: product.name,
      isDeleted: false
    }
  });

  if (existingProdotto) {
    // Aggiorna il prodotto esistente
    return await prisma.prodotto.update({
      where: { id: existingProdotto.id },
      data: {
        descrizione: product.description,
        prezzo: product.price || 0,
        immagine: product.imageUrl,
        disponibile: product.available,
        categoria: categoriaString || 'Senza categoria',
        categoryId: product.categoryId,
        subcategoryId: product.subcategoryId
      }
    });
  } else {
    // Crea un nuovo prodotto
    return await prisma.prodotto.create({
      data: {
        nome: product.name,
        descrizione: product.description || null,
        prezzo: product.price || 0,
        immagine: product.imageUrl || null,
        disponibile: product.available,
        categoria: categoriaString || 'Senza categoria',
        glutenFree: false,
        vegano: false,
        vegetariano: false,
        updatedAt: new Date()
      }
    });
  }
}

// Sincronizza un prodotto da Prodotto a Product
async function syncProdottoToProduct(prodottoId: number) {
  const prodotto = await prisma.prodotto.findUnique({
    where: { id: prodottoId },
    include: {
      Category: true,
      Subcategory: true
    }
  });

  if (!prodotto || prodotto.isDeleted) return null;

  // Cerca se esiste già un product con lo stesso nome
  const existingProduct = await prisma.product.findFirst({
    where: {
      name: prodotto.nome
    }
  });

  if (existingProduct) {
    // Aggiorna il product esistente
    return await prisma.product.update({
      where: { id: existingProduct.id },
      data: {
        description: prodotto.descrizione,
        price: prodotto.prezzo,
        imageUrl: prodotto.immagine,
        available: prodotto.disponibile,
        categoryId: prodotto.categoryId,
        subcategoryId: prodotto.subcategoryId
      }
    });
  } else {
    // Crea un nuovo product
    return await prisma.product.create({
      data: {
        name: prodotto.nome,
        description: prodotto.descrizione,
        price: prodotto.prezzo,
        imageUrl: prodotto.immagine,
        available: prodotto.disponibile,
        categoryId: prodotto.categoryId,
        subcategoryId: prodotto.subcategoryId,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
  }
}

// Ottieni tutti i prodotti dalla tabella Prodotto con categorie
export async function getProdottiWithCategories() {
  try {
    const prodotti = await prisma.prodotto.findMany({
      where: { isDeleted: false },
      include: {
        Category: true,
        Subcategory: true
      },
      orderBy: { nome: 'asc' }
    });

    return prodotti;
  } catch (error) {
    console.error("Errore recupero prodotti:", error);
    return [];
  }
}

// Crea prodotto sincronizzato
export async function createProdottoSync(data: {
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  available?: boolean;
  categoryId?: number;
  subcategoryId?: number;
}) {
  try {
    // Costruisci la stringa categoria
    let categoriaString = 'Senza categoria';
    if (data.categoryId) {
      const category = await prisma.category.findUnique({
        where: { id: data.categoryId }
      });
      if (category) {
        categoriaString = category.name;
      }
    }
    if (data.subcategoryId) {
      const subcategory = await prisma.subcategory.findUnique({
        where: { id: data.subcategoryId },
        include: { Category: true }
      });
      if (subcategory) {
        categoriaString = `${subcategory.Category.name} > ${subcategory.name}`;
      }
    }

    // Crea nella tabella Prodotto
    const prodotto = await prisma.prodotto.create({
      data: {
        nome: data.name,
        descrizione: data.description || null,
        prezzo: data.price,
        immagine: data.imageUrl || null,
        disponibile: data.available ?? true,
        categoria: categoriaString,
        glutenFree: false,
        vegano: false,
        vegetariano: false,
        updatedAt: new Date()
      }
    });

    // Crea anche nella tabella Product
    const product = await prisma.product.create({
      data: {
        name: data.name,
        description: data.description,
        price: data.price,
        imageUrl: data.imageUrl,
        available: data.available ?? true,
        categoryId: data.categoryId,
        subcategoryId: data.subcategoryId,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    revalidatePath('/dashboard/products');
    revalidatePath('/dashboard/products-table');
    
    return { prodotto, product };
  } catch (error) {
    console.error("Errore creazione prodotto sincronizzato:", error);
    throw new Error("Impossibile creare il prodotto");
  }
}

// Aggiorna prodotto sincronizzato
export async function updateProdottoSync(
  prodottoId: number,
  data: {
    name?: string;
    description?: string;
    price?: number;
    imageUrl?: string;
    available?: boolean;
    categoryId?: number;
    subcategoryId?: number;
  }
) {
  try {
    // Trova il prodotto
    const prodotto = await prisma.prodotto.findUnique({
      where: { id: prodottoId }
    });

    if (!prodotto) {
      throw new Error("Prodotto non trovato");
    }

    // Costruisci la stringa categoria se cambiano le categorie
    let categoriaString = prodotto.categoria;
    if (data.categoryId !== undefined || data.subcategoryId !== undefined) {
      if (data.subcategoryId) {
        const subcategory = await prisma.subcategory.findUnique({
          where: { id: data.subcategoryId },
          include: { Category: true }
        });
        if (subcategory) {
          categoriaString = `${subcategory.Category.name} > ${subcategory.name}`;
        }
      } else if (data.categoryId) {
        const category = await prisma.category.findUnique({
          where: { id: data.categoryId }
        });
        if (category) {
          categoriaString = category.name;
        }
      } else {
        categoriaString = 'Senza categoria';
      }
    }

    // Aggiorna nella tabella Prodotto
    const updatedProdotto = await prisma.prodotto.update({
      where: { id: prodottoId },
      data: {
        ...(data.name !== undefined && { nome: data.name }),
        ...(data.description !== undefined && { descrizione: data.description }),
        ...(data.price !== undefined && { prezzo: data.price }),
        ...(data.imageUrl !== undefined && { immagine: data.imageUrl }),
        ...(data.available !== undefined && { disponibile: data.available }),
        categoria: categoriaString,
        ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
        ...(data.subcategoryId !== undefined && { subcategoryId: data.subcategoryId })
      }
    });

    // Trova e aggiorna anche nella tabella Product
    const product = await prisma.product.findFirst({
      where: { name: prodotto.nome }
    });

    if (product) {
      await prisma.product.update({
        where: { id: product.id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.price !== undefined && { price: data.price }),
          ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl }),
          ...(data.available !== undefined && { available: data.available }),
          ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
          ...(data.subcategoryId !== undefined && { subcategoryId: data.subcategoryId })
        }
      });
    }

    revalidatePath('/dashboard/products');
    revalidatePath('/dashboard/products-table');
    
    return updatedProdotto;
  } catch (error) {
    console.error("Errore aggiornamento prodotto sincronizzato:", error);
    throw new Error("Impossibile aggiornare il prodotto");
  }
}

// Elimina prodotto sincronizzato
export async function deleteProdottoSync(prodottoId: number) {
  try {
    // Trova il prodotto
    const prodotto = await prisma.prodotto.findUnique({
      where: { id: prodottoId }
    });

    if (!prodotto) {
      throw new Error("Prodotto non trovato");
    }

    // Soft delete nella tabella Prodotto
    await prisma.prodotto.update({
      where: { id: prodottoId },
      data: { isDeleted: true }
    });

    // Elimina dalla tabella Product se esiste
    const product = await prisma.product.findFirst({
      where: { name: prodotto.nome }
    });

    if (product) {
      await prisma.product.delete({
        where: { id: product.id }
      });
    }

    revalidatePath('/dashboard/products');
    revalidatePath('/dashboard/products-table');
    
    return { success: true };
  } catch (error) {
    console.error("Errore eliminazione prodotto sincronizzato:", error);
    throw new Error("Impossibile eliminare il prodotto");
  }
}

// Sincronizza tutti i prodotti esistenti
export async function syncAllProducts() {
  try {
    console.log("🔄 Inizio sincronizzazione prodotti...");
    
    // 1. Sincronizza da Product a Prodotto
    const products = await prisma.product.findMany({
      include: {
        Category: true,
        Subcategory: true
      }
    });

    for (const product of products) {
      await syncProductToProdotto(product.id);
    }

    console.log(`✅ Sincronizzati ${products.length} prodotti da Product a Prodotto`);

    // 2. Sincronizza da Prodotto a Product (solo quelli senza match)
    const prodotti = await prisma.prodotto.findMany({
      where: { isDeleted: false },
      include: {
        Category: true,
        Subcategory: true
      }
    });

    let syncedFromProdotto = 0;
    for (const prodotto of prodotti) {
      const existingProduct = await prisma.product.findFirst({
        where: { name: prodotto.nome }
      });

      if (!existingProduct) {
        await syncProdottoToProduct(prodotto.id);
        syncedFromProdotto++;
      }
    }

    console.log(`✅ Sincronizzati ${syncedFromProdotto} nuovi prodotti da Prodotto a Product`);

    revalidatePath('/dashboard/products');
    revalidatePath('/dashboard/products-table');

    return {
      success: true,
      message: `Sincronizzazione completata: ${products.length + syncedFromProdotto} prodotti sincronizzati`
    };
  } catch (error) {
    console.error("❌ Errore sincronizzazione prodotti:", error);
    return {
      success: false,
      error: "Errore durante la sincronizzazione"
    };
  }
}