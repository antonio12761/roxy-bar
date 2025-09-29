"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-multi-tenant";
import { revalidatePath } from "next/cache";
import { secureLog } from "@/lib/utils/log-sanitizer";

export interface CategoriaMenu {
  id: string;
  nome: string;
  nomeDisplay: string | null;
  emoji: string | null;
  coloreHex: string | null;
  ordinamento: number | null;
  attiva: boolean;
}

/**
 * Recupera tutte le categorie menu
 */
export async function getCategorie() {
  try {
    const categorie = await prisma.categoriaMenu.findMany({
      orderBy: [
        { ordinamento: 'asc' },
        { nome: 'asc' }
      ],
      select: {
        id: true,
        nome: true,
        nomeDisplay: true,
        emoji: true,
        coloreHex: true,
        ordinamento: true,
        attiva: true
      }
    });

    return { 
      success: true, 
      data: categorie as CategoriaMenu[] 
    };
  } catch (error) {
    secureLog.error('Errore nel caricamento delle categorie:', error);
    return { 
      success: false, 
      error: 'Errore nel caricamento delle categorie' 
    };
  }
}

/**
 * Crea una nuova categoria menu
 */
export async function createCategoria(data: {
  nome: string;
  nomeDisplay?: string;
  emoji?: string;
  coloreHex?: string;
}) {
  try {
    const user = await getCurrentUser();
    
    if (!user || !["SUPERVISORE", "ADMIN"].includes(user.ruolo)) {
      return { 
        success: false, 
        error: "Non autorizzato" 
      };
    }

    const categoria = await prisma.categoriaMenu.create({
      data: {
        nome: data.nome,
        nomeDisplay: data.nomeDisplay || null,
        emoji: data.emoji || null,
        coloreHex: data.coloreHex || null,
        updatedAt: new Date()
      }
    });

    // Revalida le pagine che mostrano categorie
    revalidatePath('/dashboard/categorie');
    revalidatePath('/cameriere/nuova-ordinazione');
    revalidatePath('/dashboard/products');

    return { 
      success: true, 
      data: categoria as CategoriaMenu 
    };
  } catch (error) {
    secureLog.error('Errore nella creazione della categoria:', error);
    return { 
      success: false, 
      error: 'Errore nella creazione della categoria' 
    };
  }
}

/**
 * Aggiorna una categoria esistente
 */
export async function updateCategoria(
  id: string,
  data: Partial<Omit<CategoriaMenu, 'id'>>
) {
  try {
    const user = await getCurrentUser();
    
    if (!user || !["SUPERVISORE", "ADMIN"].includes(user.ruolo)) {
      return { 
        success: false, 
        error: "Non autorizzato" 
      };
    }

    const categoria = await prisma.categoriaMenu.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date()
      }
    });

    // Revalida le pagine
    revalidatePath('/dashboard/categorie');
    revalidatePath('/cameriere/nuova-ordinazione');
    revalidatePath('/dashboard/products');

    return { 
      success: true, 
      data: categoria as CategoriaMenu 
    };
  } catch (error) {
    secureLog.error('Errore nell\'aggiornamento della categoria:', error);
    return { 
      success: false, 
      error: 'Errore nell\'aggiornamento della categoria' 
    };
  }
}

/**
 * Elimina una categoria
 */
export async function deleteCategoria(id: string) {
  try {
    const user = await getCurrentUser();
    
    if (!user || !["SUPERVISORE", "ADMIN"].includes(user.ruolo)) {
      return { 
        success: false, 
        error: "Non autorizzato" 
      };
    }

    // Verifica che non ci siano prodotti associati
    const prodottiCount = await prisma.prodotto.count({
      where: { categoriaMenuId: id }
    });

    if (prodottiCount > 0) {
      return { 
        success: false, 
        error: `Impossibile eliminare: ci sono ${prodottiCount} prodotti associati a questa categoria` 
      };
    }

    await prisma.categoriaMenu.delete({
      where: { id }
    });

    // Revalida le pagine
    revalidatePath('/dashboard/categorie');
    revalidatePath('/cameriere/nuova-ordinazione');
    revalidatePath('/dashboard/products');

    return { 
      success: true, 
      message: 'Categoria eliminata con successo' 
    };
  } catch (error) {
    secureLog.error('Errore nell\'eliminazione della categoria:', error);
    return { 
      success: false, 
      error: 'Errore nell\'eliminazione della categoria' 
    };
  }
}

/**
 * Aggiorna l'ordinamento di più categorie
 */
export async function updateCategorieOrdinamento(
  updates: Array<{ id: string; ordinamento: number }>
) {
  try {
    const user = await getCurrentUser();
    
    if (!user || !["SUPERVISORE", "ADMIN"].includes(user.ruolo)) {
      return { 
        success: false, 
        error: "Non autorizzato" 
      };
    }

    // Esegui tutti gli aggiornamenti in una transazione
    await prisma.$transaction(
      updates.map(({ id, ordinamento }) =>
        prisma.categoriaMenu.update({
          where: { id },
          data: { 
            ordinamento,
            updatedAt: new Date()
          }
        })
      )
    );

    // Revalida le pagine
    revalidatePath('/dashboard/categorie');
    revalidatePath('/cameriere/nuova-ordinazione');

    return { 
      success: true, 
      message: 'Ordinamento aggiornato con successo' 
    };
  } catch (error) {
    secureLog.error('Errore nell\'aggiornamento dell\'ordinamento:', error);
    return { 
      success: false, 
      error: 'Errore nell\'aggiornamento dell\'ordinamento' 
    };
  }
}