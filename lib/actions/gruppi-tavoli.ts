"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-multi-tenant";
import { revalidatePath } from "next/cache";
import { secureLog } from "@/lib/utils/log-sanitizer";

export interface GruppoTavoli {
  id: number;
  nome: string;
  descrizione: string | null;
  colore: string | null;
  icona: string;
  ordinamento: number;
  attivo: boolean;
  _count?: {
    Tavolo: number;
  };
  Tavolo?: Array<{
    id: number;
    numero: string;
    nome: string;
    ordinamento: number | null;
  }>;
}

/**
 * Recupera tutti i gruppi tavoli attivi
 */
export async function getGruppiTavoli() {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return { 
        success: false, 
        error: "Non autorizzato" 
      };
    }

    const gruppi = await prisma.gruppoTavoli.findMany({
      where: { attivo: true },
      include: {
        Tavolo: {
          where: { attivo: true },
          orderBy: { ordinamento: 'asc' }
        },
        _count: {
          select: { Tavolo: true }
        }
      },
      orderBy: { ordinamento: 'asc' }
    });

    return { 
      success: true, 
      data: gruppi as GruppoTavoli[] 
    };
  } catch (error) {
    secureLog.error('Get gruppi tavoli error:', error);
    return { 
      success: false, 
      error: 'Errore nel recupero dei gruppi' 
    };
  }
}

/**
 * Crea un nuovo gruppo tavoli
 */
export async function createGruppoTavoli(data: {
  nome: string;
  descrizione?: string;
  colore?: string;
  icona?: string;
  ordinamento?: number;
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
    if (!data.nome) {
      return { 
        success: false, 
        error: 'Il nome del gruppo è obbligatorio' 
      };
    }

    // Check nome unique
    const existingGruppo = await prisma.gruppoTavoli.findUnique({
      where: { nome: data.nome }
    });

    if (existingGruppo) {
      return { 
        success: false, 
        error: 'Nome gruppo già esistente' 
      };
    }

    // Create gruppo
    const newGruppo = await prisma.gruppoTavoli.create({
      data: {
        nome: data.nome,
        descrizione: data.descrizione || null,
        colore: data.colore || null,
        icona: data.icona || 'Folder',
        ordinamento: data.ordinamento || 0
      }
    });

    // Revalida le pagine
    revalidatePath('/admin/gruppi-tavoli');
    revalidatePath('/cameriere/nuova-ordinazione');

    return {
      success: true,
      data: newGruppo as GruppoTavoli
    };
  } catch (error) {
    secureLog.error('Create gruppo error:', error);
    return { 
      success: false, 
      error: 'Errore nella creazione del gruppo' 
    };
  }
}

/**
 * Aggiorna un gruppo tavoli
 */
export async function updateGruppoTavoli(
  id: number,
  data: Partial<Omit<GruppoTavoli, 'id' | 'attivo' | '_count' | 'Tavolo'>>
) {
  try {
    const user = await getCurrentUser();
    
    if (!user || !["SUPERVISORE", "ADMIN", "MANAGER"].includes(user.ruolo)) {
      return { 
        success: false, 
        error: "Non autorizzato" 
      };
    }

    // Get existing gruppo
    const existingGruppo = await prisma.gruppoTavoli.findUnique({
      where: { id }
    });

    if (!existingGruppo) {
      return { 
        success: false, 
        error: 'Gruppo non trovato' 
      };
    }

    // If updating nome, check uniqueness
    if (data.nome && data.nome !== existingGruppo.nome) {
      const existingNome = await prisma.gruppoTavoli.findUnique({
        where: { nome: data.nome }
      });

      if (existingNome) {
        return { 
          success: false, 
          error: 'Nome gruppo già in uso' 
        };
      }
    }

    // Update gruppo
    const updatedGruppo = await prisma.gruppoTavoli.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date()
      },
      include: {
        _count: {
          select: { Tavolo: true }
        }
      }
    });

    // Revalida le pagine
    revalidatePath('/admin/gruppi-tavoli');
    revalidatePath('/cameriere/nuova-ordinazione');

    return {
      success: true,
      data: updatedGruppo as GruppoTavoli
    };
  } catch (error) {
    secureLog.error('Update gruppo error:', error);
    return { 
      success: false, 
      error: 'Errore nell\'aggiornamento del gruppo' 
    };
  }
}

/**
 * Elimina (soft delete) un gruppo tavoli
 */
export async function deleteGruppoTavoli(id: number) {
  try {
    const user = await getCurrentUser();
    
    if (!user || !["SUPERVISORE", "ADMIN"].includes(user.ruolo)) {
      return { 
        success: false, 
        error: "Non autorizzato" 
      };
    }

    // Check if gruppo has tavoli
    const tavoliCount = await prisma.tavolo.count({
      where: {
        gruppoId: id,
        attivo: true
      }
    });

    if (tavoliCount > 0) {
      return { 
        success: false, 
        error: `Non puoi eliminare un gruppo che contiene ${tavoliCount} tavoli attivi` 
      };
    }

    // Soft delete (set inactive)
    await prisma.gruppoTavoli.update({
      where: { id },
      data: { 
        attivo: false,
        updatedAt: new Date()
      }
    });

    // Revalida le pagine
    revalidatePath('/admin/gruppi-tavoli');
    revalidatePath('/cameriere/nuova-ordinazione');

    return {
      success: true,
      message: 'Gruppo disattivato con successo'
    };
  } catch (error) {
    secureLog.error('Delete gruppo error:', error);
    return { 
      success: false, 
      error: 'Errore nell\'eliminazione del gruppo' 
    };
  }
}

/**
 * Aggiorna l'ordinamento di più gruppi
 */
export async function updateGruppiOrdinamento(
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
        prisma.gruppoTavoli.update({
          where: { id },
          data: { 
            ordinamento,
            updatedAt: new Date()
          }
        })
      )
    );

    // Revalida le pagine
    revalidatePath('/admin/gruppi-tavoli');
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
 * Assegna tavoli a un gruppo
 */
export async function assignTavoliToGruppo(
  gruppoId: number,
  tavoliIds: number[]
) {
  try {
    const user = await getCurrentUser();
    
    if (!user || !["SUPERVISORE", "ADMIN", "MANAGER"].includes(user.ruolo)) {
      return { 
        success: false, 
        error: "Non autorizzato" 
      };
    }

    // Verifica che il gruppo esista
    const gruppo = await prisma.gruppoTavoli.findUnique({
      where: { id: gruppoId, attivo: true }
    });

    if (!gruppo) {
      return { 
        success: false, 
        error: 'Gruppo non trovato' 
      };
    }

    // Aggiorna i tavoli
    await prisma.tavolo.updateMany({
      where: { 
        id: { in: tavoliIds },
        attivo: true
      },
      data: { 
        gruppoId,
        updatedAt: new Date()
      }
    });

    // Revalida le pagine
    revalidatePath('/admin/gruppi-tavoli');
    revalidatePath('/admin/tavoli');
    revalidatePath('/cameriere/nuova-ordinazione');

    return { 
      success: true, 
      message: `${tavoliIds.length} tavoli assegnati al gruppo ${gruppo.nome}` 
    };
  } catch (error) {
    secureLog.error('Errore nell\'assegnazione tavoli:', error);
    return { 
      success: false, 
      error: 'Errore nell\'assegnazione dei tavoli' 
    };
  }
}