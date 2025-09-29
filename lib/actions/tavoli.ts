"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-multi-tenant";
import { revalidatePath } from "next/cache";
import { secureLog } from "@/lib/utils/log-sanitizer";

export interface Tavolo {
  id: number;
  numero: string;
  nome: string | null;
  zona: string | null;
  forma: 'QUADRATO' | 'ROTONDO' | 'RETTANGOLARE';
  gruppoId: number | null;
  posizioneX: number;
  posizioneY: number;
  ordinamento: number | null;
  note: string | null;
  attivo: boolean;
  GruppoTavoli?: {
    id: number;
    nome: string;
    colore: string | null;
    icona: string;
  };
  Ordinazione?: Array<{
    id: string;
    numero: number;
    stato: string;
    totale: number;
  }>;
}

export interface TavoliSearchParams {
  includeGroups?: boolean;
  groupId?: number;
  search?: string;
}

/**
 * Recupera tutti i tavoli con filtri opzionali
 */
export async function getTavoli(params?: TavoliSearchParams) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return { 
        success: false, 
        error: "Non autorizzato" 
      };
    }

    // Build where clause
    const where: any = {
      attivo: true
    };

    if (params?.groupId) {
      where.gruppoId = params.groupId;
    }

    if (params?.search) {
      where.OR = [
        { numero: { contains: params.search, mode: 'insensitive' } },
        { nome: { contains: params.search, mode: 'insensitive' } },
        { zona: { contains: params.search, mode: 'insensitive' } }
      ];
    }

    // Get tavoli
    const tavoli = await prisma.tavolo.findMany({
      where,
      include: {
        GruppoTavoli: true,
        Ordinazione: {
          where: {
            stato: {
              notIn: ['PAGATO', 'ANNULLATO']
            }
          },
          select: {
            id: true,
            numero: true,
            stato: true,
            totale: true
          }
        }
      },
      orderBy: [
        { gruppoId: 'asc' },
        { ordinamento: 'asc' },
        { numero: 'asc' }
      ]
    });

    let result: any = { 
      tavoli: tavoli as Tavolo[] 
    };

    // Get gruppi if requested
    if (params?.includeGroups) {
      const gruppi = await prisma.gruppoTavoli.findMany({
        where: { attivo: true },
        include: {
          _count: {
            select: { Tavolo: true }
          }
        },
        orderBy: { ordinamento: 'asc' }
      });
      result.gruppi = gruppi;
    }

    return { 
      success: true, 
      data: result 
    };
  } catch (error) {
    secureLog.error('Get tavoli error:', error);
    return { 
      success: false, 
      error: 'Errore nel recupero dei tavoli' 
    };
  }
}

/**
 * Recupera un singolo tavolo per ID o numero
 */
export async function getTavolo(idOrNumero: number | string) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return { 
        success: false, 
        error: "Non autorizzato" 
      };
    }

    const where = typeof idOrNumero === 'number' 
      ? { id: idOrNumero }
      : { numero: idOrNumero };

    const tavolo = await prisma.tavolo.findFirst({
      where: {
        ...where,
        attivo: true
      },
      include: {
        GruppoTavoli: true,
        Ordinazione: {
          where: {
            stato: {
              notIn: ['PAGATO', 'ANNULLATO']
            }
          },
          include: {
            RigaOrdinazione: {
              include: {
                Prodotto: true
              }
            }
          }
        }
      }
    });

    if (!tavolo) {
      return { 
        success: false, 
        error: 'Tavolo non trovato' 
      };
    }

    return { 
      success: true, 
      data: tavolo 
    };
  } catch (error) {
    secureLog.error('Get tavolo error:', error);
    return { 
      success: false, 
      error: 'Errore nel recupero del tavolo' 
    };
  }
}

/**
 * Crea un nuovo tavolo
 */
export async function createTavolo(data: {
  numero: string;
  nome?: string;
  zona?: string;
  forma?: 'QUADRATO' | 'ROTONDO' | 'RETTANGOLARE';
  gruppoId?: number;
  posizioneX?: number;
  posizioneY?: number;
  ordinamento?: number;
  note?: string;
}) {
  try {
    const user = await getCurrentUser();
    
    if (!user || !["SUPERVISORE", "ADMIN", "MANAGER"].includes(user.ruolo)) {
      return { 
        success: false, 
        error: "Non autorizzato" 
      };
    }

    // Validazione
    if (!data.numero) {
      return { 
        success: false, 
        error: 'Il numero del tavolo è obbligatorio' 
      };
    }

    // Check numero unique
    const existingTavolo = await prisma.tavolo.findUnique({
      where: { numero: data.numero }
    });

    if (existingTavolo) {
      return { 
        success: false, 
        error: 'Numero tavolo già esistente' 
      };
    }

    // Create tavolo
    const newTavolo = await prisma.tavolo.create({
      data: {
        numero: data.numero,
        nome: data.nome || null,
        zona: data.zona || null,
        forma: data.forma || 'QUADRATO',
        gruppoId: data.gruppoId || null,
        posizioneX: data.posizioneX || 0,
        posizioneY: data.posizioneY || 0,
        ordinamento: data.ordinamento || 0,
        note: data.note || null
      },
      include: {
        GruppoTavoli: true
      }
    });

    // Revalida le pagine
    revalidatePath('/admin/tavoli');
    revalidatePath('/cameriere/nuova-ordinazione');

    return {
      success: true,
      data: newTavolo as Tavolo
    };
  } catch (error) {
    secureLog.error('Create tavolo error:', error);
    return { 
      success: false, 
      error: 'Errore nella creazione del tavolo' 
    };
  }
}

/**
 * Aggiorna un tavolo esistente
 */
export async function updateTavolo(
  id: number,
  data: Partial<Omit<Tavolo, 'id' | 'attivo' | 'GruppoTavoli' | 'Ordinazione'>>
) {
  try {
    const user = await getCurrentUser();
    
    if (!user || !["SUPERVISORE", "ADMIN", "MANAGER"].includes(user.ruolo)) {
      return { 
        success: false, 
        error: "Non autorizzato" 
      };
    }

    // Get existing tavolo
    const existingTavolo = await prisma.tavolo.findUnique({
      where: { id }
    });

    if (!existingTavolo) {
      return { 
        success: false, 
        error: 'Tavolo non trovato' 
      };
    }

    // If updating numero, check uniqueness (excluding current table)
    if (data.numero && data.numero !== existingTavolo.numero) {
      const existingNumero = await prisma.tavolo.findFirst({
        where: { 
          numero: data.numero,
          id: { not: id }
        }
      });

      if (existingNumero) {
        return { 
          success: false, 
          error: 'Numero tavolo già in uso' 
        };
      }
    }

    // Update tavolo
    const updatedTavolo = await prisma.tavolo.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date()
      },
      include: {
        GruppoTavoli: true
      }
    });

    // Revalida le pagine
    revalidatePath('/admin/tavoli');
    revalidatePath('/cameriere/nuova-ordinazione');
    revalidatePath(`/cameriere/tavolo/${id}`);

    return {
      success: true,
      data: updatedTavolo as Tavolo
    };
  } catch (error) {
    secureLog.error('Update tavolo error:', error);
    return { 
      success: false, 
      error: 'Errore nell\'aggiornamento del tavolo' 
    };
  }
}

/**
 * Elimina (soft delete) un tavolo
 */
export async function deleteTavolo(id: number) {
  try {
    const user = await getCurrentUser();
    
    if (!user || !["SUPERVISORE", "ADMIN"].includes(user.ruolo)) {
      return { 
        success: false, 
        error: "Non autorizzato" 
      };
    }

    // Check if tavolo has active orders
    const activeOrders = await prisma.ordinazione.findFirst({
      where: {
        tavoloId: id,
        stato: {
          notIn: ['PAGATO', 'ANNULLATO']
        }
      }
    });

    if (activeOrders) {
      return { 
        success: false, 
        error: 'Non puoi eliminare un tavolo con ordinazioni attive' 
      };
    }

    // Get tavolo
    const tavolo = await prisma.tavolo.findUnique({
      where: { id }
    });
    
    if (!tavolo) {
      return { 
        success: false, 
        error: 'Tavolo non trovato' 
      };
    }
    
    // Soft delete: set inactive and rename to avoid unique constraint
    await prisma.tavolo.update({
      where: { id },
      data: { 
        attivo: false,
        numero: `${tavolo.numero}_DELETED_${Date.now()}`,
        updatedAt: new Date()
      }
    });

    // Revalida le pagine
    revalidatePath('/admin/tavoli');
    revalidatePath('/cameriere/nuova-ordinazione');

    return {
      success: true,
      message: 'Tavolo disattivato con successo'
    };
  } catch (error) {
    secureLog.error('Delete tavolo error:', error);
    return { 
      success: false, 
      error: 'Errore nell\'eliminazione del tavolo' 
    };
  }
}

/**
 * Aggiorna l'ordinamento di più tavoli
 */
export async function updateTavoliOrdinamento(
  updates: Array<{ id: number; ordinamento: number }>
) {
  try {
    const user = await getCurrentUser();
    
    if (!user || !["SUPERVISORE", "ADMIN", "MANAGER"].includes(user.ruolo)) {
      return { 
        success: false, 
        error: "Non autorizzato" 
      };
    }

    // Esegui tutti gli aggiornamenti in una transazione
    await prisma.$transaction(
      updates.map(({ id, ordinamento }) =>
        prisma.tavolo.update({
          where: { id },
          data: { 
            ordinamento,
            updatedAt: new Date()
          }
        })
      )
    );

    // Revalida le pagine
    revalidatePath('/admin/tavoli');
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

/**
 * Aggiorna la posizione di più tavoli (per drag & drop)
 */
export async function updateTavoliPosizioni(
  updates: Array<{ id: number; posizioneX: number; posizioneY: number }>
) {
  try {
    const user = await getCurrentUser();
    
    if (!user || !["SUPERVISORE", "ADMIN", "MANAGER"].includes(user.ruolo)) {
      return { 
        success: false, 
        error: "Non autorizzato" 
      };
    }

    // Esegui tutti gli aggiornamenti in una transazione
    await prisma.$transaction(
      updates.map(({ id, posizioneX, posizioneY }) =>
        prisma.tavolo.update({
          where: { id },
          data: { 
            posizioneX,
            posizioneY,
            updatedAt: new Date()
          }
        })
      )
    );

    // Revalida le pagine
    revalidatePath('/admin/tavoli');
    revalidatePath('/cameriere/nuova-ordinazione');

    return { 
      success: true, 
      message: 'Posizioni aggiornate con successo' 
    };
  } catch (error) {
    secureLog.error('Errore nell\'aggiornamento delle posizioni:', error);
    return { 
      success: false, 
      error: 'Errore nell\'aggiornamento delle posizioni' 
    };
  }
}