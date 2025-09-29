"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-multi-tenant";
import { revalidatePath } from "next/cache";
import { secureLog } from "@/lib/utils/log-sanitizer";

export interface ProdottoInventario {
  id: number;
  nome: string;
  categoria: string;
  quantitaDisponibile: number;
  terminato: boolean;
  ultimoAggiornamento?: Date | null;
}

/**
 * Recupera l'inventario di tutti i prodotti disponibili
 */
export async function getInventarioProdotti() {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return { 
        success: false, 
        error: "Non autorizzato" 
      };
    }

    // Recupera tutti i prodotti con le loro quantità disponibili
    const prodotti = await prisma.prodotto.findMany({
      where: {
        disponibile: true,
        isDeleted: false
      },
      include: {
        InventarioEsaurito: true
      },
      orderBy: [
        { categoria: 'asc' },
        { nome: 'asc' }
      ]
    });

    const prodottiConInventario: ProdottoInventario[] = prodotti.map(p => ({
      id: p.id,
      nome: p.nome,
      categoria: p.categoria,
      quantitaDisponibile: p.InventarioEsaurito?.quantitaDisponibile ?? 999,
      terminato: p.terminato,
      ultimoAggiornamento: p.InventarioEsaurito?.ultimoAggiornamento
    }));

    return { 
      success: true, 
      data: prodottiConInventario 
    };
  } catch (error) {
    secureLog.error('Get inventario error:', error);
    return { 
      success: false, 
      error: 'Errore recupero inventario' 
    };
  }
}

/**
 * Aggiorna la quantità disponibile di un prodotto
 */
export async function updateQuantitaProdotto(
  prodottoId: number, 
  quantitaDisponibile: number
) {
  try {
    const user = await getCurrentUser();
    
    if (!user || !["SUPERVISORE", "ADMIN", "MANAGER", "CASSA"].includes(user.ruolo)) {
      return { 
        success: false, 
        error: "Non autorizzato" 
      };
    }

    // Validazione quantità
    if (quantitaDisponibile < 0) {
      return {
        success: false,
        error: "La quantità non può essere negativa"
      };
    }

    // Verifica che il prodotto esista
    const prodotto = await prisma.prodotto.findUnique({
      where: { id: prodottoId },
      include: {
        InventarioEsaurito: true
      }
    });

    if (!prodotto) {
      return {
        success: false,
        error: "Prodotto non trovato"
      };
    }

    // Update o create inventario esaurito
    let inventarioEsaurito;
    if (prodotto.InventarioEsaurito) {
      // Update existing
      inventarioEsaurito = await prisma.inventarioEsaurito.update({
        where: { prodottoId },
        data: {
          quantitaDisponibile,
          ultimoAggiornamento: new Date()
        }
      });
    } else {
      // Create new
      inventarioEsaurito = await prisma.inventarioEsaurito.create({
        data: {
          prodottoId,
          quantitaDisponibile,
          ultimoAggiornamento: new Date()
        }
      });
    }

    // Update prodotto.terminato based on quantity
    const isTerminato = quantitaDisponibile === 0;
    if (prodotto.terminato !== isTerminato) {
      await prisma.prodotto.update({
        where: { id: prodottoId },
        data: { terminato: isTerminato }
      });
    }

    // Revalida le pagine
    revalidatePath('/supervisore/inventario');
    revalidatePath('/prepara');
    revalidatePath('/cameriere/nuova-ordinazione');

    return {
      success: true,
      data: {
        prodottoId,
        quantitaDisponibile,
        terminato: isTerminato,
        ultimoAggiornamento: inventarioEsaurito.ultimoAggiornamento
      }
    };
  } catch (error) {
    secureLog.error('Update quantità prodotto error:', error);
    return { 
      success: false, 
      error: 'Errore aggiornamento quantità' 
    };
  }
}

/**
 * Reset inventario esaurito per un prodotto
 */
export async function resetInventarioProdotto(prodottoId: number) {
  try {
    const user = await getCurrentUser();
    
    if (!user || !["SUPERVISORE", "ADMIN"].includes(user.ruolo)) {
      return { 
        success: false, 
        error: "Non autorizzato" 
      };
    }

    // Delete inventario esaurito record
    await prisma.inventarioEsaurito.deleteMany({
      where: { prodottoId }
    });

    // Reset prodotto.terminato
    await prisma.prodotto.update({
      where: { id: prodottoId },
      data: { terminato: false }
    });

    // Revalida le pagine
    revalidatePath('/supervisore/inventario');
    revalidatePath('/prepara');
    revalidatePath('/cameriere/nuova-ordinazione');

    return {
      success: true,
      message: 'Inventario resettato con successo'
    };
  } catch (error) {
    secureLog.error('Reset inventario error:', error);
    return { 
      success: false, 
      error: 'Errore reset inventario' 
    };
  }
}

/**
 * Aggiorna in batch le quantità di più prodotti
 */
export async function updateQuantitaProdottiBatch(
  updates: Array<{ prodottoId: number; quantitaDisponibile: number }>
) {
  try {
    const user = await getCurrentUser();
    
    if (!user || !["SUPERVISORE", "ADMIN", "MANAGER"].includes(user.ruolo)) {
      return { 
        success: false, 
        error: "Non autorizzato" 
      };
    }

    // Validazione
    for (const update of updates) {
      if (update.quantitaDisponibile < 0) {
        return {
          success: false,
          error: "Le quantità non possono essere negative"
        };
      }
    }

    // Esegui tutti gli aggiornamenti in una transazione
    await prisma.$transaction(async (tx) => {
      for (const { prodottoId, quantitaDisponibile } of updates) {
        // Check if inventario exists
        const existing = await tx.inventarioEsaurito.findUnique({
          where: { prodottoId }
        });

        if (existing) {
          // Update existing
          await tx.inventarioEsaurito.update({
            where: { prodottoId },
            data: {
              quantitaDisponibile,
              ultimoAggiornamento: new Date()
            }
          });
        } else {
          // Create new
          await tx.inventarioEsaurito.create({
            data: {
              prodottoId,
              quantitaDisponibile,
              ultimoAggiornamento: new Date()
            }
          });
        }

        // Update prodotto.terminato
        const isTerminato = quantitaDisponibile === 0;
        await tx.prodotto.update({
          where: { id: prodottoId },
          data: { terminato: isTerminato }
        });
      }
    });

    // Revalida le pagine
    revalidatePath('/supervisore/inventario');
    revalidatePath('/prepara');
    revalidatePath('/cameriere/nuova-ordinazione');

    return {
      success: true,
      message: `Aggiornate ${updates.length} quantità con successo`
    };
  } catch (error) {
    secureLog.error('Update batch quantità error:', error);
    return { 
      success: false, 
      error: 'Errore aggiornamento quantità batch' 
    };
  }
}

/**
 * Recupera lo storico inventario per un prodotto
 */
export async function getStoricoInventarioProdotto(prodottoId: number) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return { 
        success: false, 
        error: "Non autorizzato" 
      };
    }

    // Per ora restituiamo solo l'inventario corrente
    // In futuro potremmo implementare uno storico completo
    const inventario = await prisma.inventarioEsaurito.findUnique({
      where: { prodottoId },
      include: {
        Prodotto: {
          select: {
            nome: true,
            categoria: true
          }
        }
      }
    });

    if (!inventario) {
      return {
        success: true,
        data: {
          prodotto: null,
          storico: []
        }
      };
    }

    return {
      success: true,
      data: {
        prodotto: inventario.Prodotto,
        corrente: {
          quantitaDisponibile: inventario.quantitaDisponibile,
          ultimoAggiornamento: inventario.ultimoAggiornamento
        },
        storico: [] // Per ora vuoto, in futuro potremmo tracciare lo storico
      }
    };
  } catch (error) {
    secureLog.error('Get storico inventario error:', error);
    return { 
      success: false, 
      error: 'Errore recupero storico inventario' 
    };
  }
}