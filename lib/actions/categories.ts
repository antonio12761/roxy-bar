"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

// Types
export type Category = {
  id: number;
  name: string;
  icon?: string | null;
  order: number;
  createdAt: Date;
  updatedAt: Date;
  subcategories?: Subcategory[];
  _count?: {
    products: number;
    subcategories: number;
  };
};

export type Subcategory = {
  id: number;
  name: string;
  order: number;
  categoryId: number;
  createdAt: Date;
  updatedAt: Date;
  category?: Category;
  _count?: {
    products: number;
  };
};

// Category Actions
export async function getCategories() {
  try {
    const categories = await prisma.category.findMany({
      include: {
        subcategories: {
          orderBy: { order: 'asc' },
          include: {
            _count: {
              select: { products: true }
            }
          }
        },
        _count: {
          select: { 
            products: true,
            subcategories: true 
          }
        }
      },
      orderBy: { order: 'asc' }
    });
    
    return categories;
  } catch (error) {
    console.error("Errore recupero categorie:", error);
    throw new Error("Impossibile recuperare le categorie");
  }
}

export async function getCategoryById(id: number) {
  try {
    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        subcategories: {
          orderBy: { order: 'asc' },
          include: {
            _count: {
              select: { products: true }
            }
          }
        },
        _count: {
          select: { 
            products: true,
            subcategories: true 
          }
        }
      }
    });
    
    return category;
  } catch (error) {
    console.error("Errore recupero categoria:", error);
    throw new Error("Impossibile recuperare la categoria");
  }
}

export async function createCategory(data: {
  name: string;
  icon?: string;
  order?: number;
}) {
  try {
    const category = await prisma.category.create({
      data: {
        name: data.name,
        icon: data.icon || null,
        order: data.order || 0,
      },
      include: {
        _count: {
          select: { 
            products: true,
            subcategories: true 
          }
        }
      }
    });
    
    revalidatePath('/dashboard/categories');
    revalidatePath('/dashboard/products');
    revalidatePath('/dashboard/products-table');
    
    return category;
  } catch (error) {
    console.error("Errore creazione categoria:", error);
    throw new Error("Impossibile creare la categoria");
  }
}

export async function updateCategory(
  id: number, 
  data: {
    name?: string;
    icon?: string;
    order?: number;
  }
) {
  try {
    const category = await prisma.category.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.icon !== undefined && { icon: data.icon }),
        ...(data.order !== undefined && { order: data.order }),
      },
      include: {
        _count: {
          select: { 
            products: true,
            subcategories: true 
          }
        }
      }
    });
    
    revalidatePath('/dashboard/categories');
    revalidatePath('/dashboard/products');
    revalidatePath('/dashboard/products-table');
    
    return category;
  } catch (error) {
    console.error("Errore aggiornamento categoria:", error);
    throw new Error("Impossibile aggiornare la categoria");
  }
}

export async function deleteCategory(id: number) {
  try {
    // Check if category has products or subcategories
    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: { 
            products: true,
            subcategories: true 
          }
        }
      }
    });
    
    if (!category) {
      throw new Error("Categoria non trovata");
    }
    
    if (category._count.products > 0) {
      throw new Error("Impossibile eliminare una categoria con prodotti associati");
    }
    
    if (category._count.subcategories > 0) {
      throw new Error("Impossibile eliminare una categoria con sottocategorie associate");
    }
    
    await prisma.category.delete({
      where: { id }
    });
    
    revalidatePath('/dashboard/categories');
    revalidatePath('/dashboard/products');
    revalidatePath('/dashboard/products-table');
    
    return { success: true };
  } catch (error) {
    console.error("Errore eliminazione categoria:", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Impossibile eliminare la categoria");
  }
}

// Subcategory Actions
export async function getSubcategories(categoryId?: number) {
  try {
    const where: Prisma.SubcategoryWhereInput = {};
    if (categoryId) {
      where.categoryId = categoryId;
    }
    
    const subcategories = await prisma.subcategory.findMany({
      where,
      include: {
        category: true,
        _count: {
          select: { products: true }
        }
      },
      orderBy: [
        { categoryId: 'asc' },
        { order: 'asc' }
      ]
    });
    
    return subcategories;
  } catch (error) {
    console.error("Errore recupero sottocategorie:", error);
    throw new Error("Impossibile recuperare le sottocategorie");
  }
}

export async function createSubcategory(data: {
  name: string;
  categoryId: number;
  order?: number;
}) {
  try {
    const subcategory = await prisma.subcategory.create({
      data: {
        name: data.name,
        categoryId: data.categoryId,
        order: data.order || 0,
      },
      include: {
        category: true,
        _count: {
          select: { products: true }
        }
      }
    });
    
    revalidatePath('/dashboard/categories');
    revalidatePath('/dashboard/products');
    revalidatePath('/dashboard/products-table');
    
    return subcategory;
  } catch (error) {
    console.error("Errore creazione sottocategoria:", error);
    throw new Error("Impossibile creare la sottocategoria");
  }
}

export async function updateSubcategory(
  id: number,
  data: {
    name?: string;
    categoryId?: number;
    order?: number;
  }
) {
  try {
    const subcategory = await prisma.subcategory.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
        ...(data.order !== undefined && { order: data.order }),
      },
      include: {
        category: true,
        _count: {
          select: { products: true }
        }
      }
    });
    
    revalidatePath('/dashboard/categories');
    revalidatePath('/dashboard/products');
    revalidatePath('/dashboard/products-table');
    
    return subcategory;
  } catch (error) {
    console.error("Errore aggiornamento sottocategoria:", error);
    throw new Error("Impossibile aggiornare la sottocategoria");
  }
}

export async function deleteSubcategory(id: number) {
  try {
    // Check if subcategory has products
    const subcategory = await prisma.subcategory.findUnique({
      where: { id },
      include: {
        _count: {
          select: { products: true }
        }
      }
    });
    
    if (!subcategory) {
      throw new Error("Sottocategoria non trovata");
    }
    
    if (subcategory._count.products > 0) {
      throw new Error("Impossibile eliminare una sottocategoria con prodotti associati");
    }
    
    await prisma.subcategory.delete({
      where: { id }
    });
    
    revalidatePath('/dashboard/categories');
    revalidatePath('/dashboard/products');
    revalidatePath('/dashboard/products-table');
    
    return { success: true };
  } catch (error) {
    console.error("Errore eliminazione sottocategoria:", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Impossibile eliminare la sottocategoria");
  }
}

// Utility Actions
export async function reorderCategories(updates: { id: number; order: number }[]) {
  try {
    await prisma.$transaction(
      updates.map(update => 
        prisma.category.update({
          where: { id: update.id },
          data: { order: update.order }
        })
      )
    );
    
    revalidatePath('/dashboard/categories');
    revalidatePath('/dashboard/products');
    revalidatePath('/dashboard/products-table');
    
    return { success: true };
  } catch (error) {
    console.error("Errore riordino categorie:", error);
    throw new Error("Impossibile riordinare le categorie");
  }
}

export async function reorderSubcategories(updates: { id: number; order: number }[]) {
  try {
    await prisma.$transaction(
      updates.map(update => 
        prisma.subcategory.update({
          where: { id: update.id },
          data: { order: update.order }
        })
      )
    );
    
    revalidatePath('/dashboard/categories');
    revalidatePath('/dashboard/products');
    revalidatePath('/dashboard/products-table');
    
    return { success: true };
  } catch (error) {
    console.error("Errore riordino sottocategorie:", error);
    throw new Error("Impossibile riordinare le sottocategorie");
  }
}

// Move products between categories
export async function moveProductsToCategory(
  productIds: number[],
  categoryId: number,
  subcategoryId?: number
) {
  try {
    await prisma.product.updateMany({
      where: {
        id: { in: productIds }
      },
      data: {
        categoryId,
        subcategoryId: subcategoryId || null
      }
    });
    
    revalidatePath('/dashboard/categories');
    revalidatePath('/dashboard/products');
    revalidatePath('/dashboard/products-table');
    
    return { success: true };
  } catch (error) {
    console.error("Errore spostamento prodotti:", error);
    throw new Error("Impossibile spostare i prodotti");
  }
}