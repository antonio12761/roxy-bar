"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-multi-tenant";
import { serializeDecimalData } from "@/lib/utils/decimal-serializer";
import { revalidatePath } from "next/cache";

export async function getGruppiTavoli() {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      console.error('getGruppiTavoli: Utente non autenticato');
      return { success: false, error: "Non autorizzato" };
    }
    
    console.log('getGruppiTavoli: Utente autenticato:', user.email);

    const gruppi = await prisma.gruppoTavoli.findMany({
      where: { attivo: true },
      include: {
        Tavolo: {
          where: { attivo: true },
          orderBy: { ordinamento: 'asc' },
          include: {
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
          }
        },
        _count: {
          select: { Tavolo: true }
        }
      },
      orderBy: { ordinamento: 'asc' }
    });
    
    console.log('getGruppiTavoli: Trovati gruppi:', gruppi.length);

    return serializeDecimalData({
      success: true,
      gruppi
    });
  } catch (error) {
    console.error('Get gruppi tavoli error:', error);
    return {
      success: false,
      error: 'Errore nel recupero dei gruppi'
    };
  }
}

interface CreateGruppoData {
  nome: string;
  descrizione?: string;
  colore?: string;
  icona?: string;
  ordinamento?: number;
}

export async function creaGruppoTavoli(data: CreateGruppoData) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return { success: false, error: "Non autorizzato" };
    }

    const {
      nome,
      descrizione,
      colore,
      icona = 'Folder',
      ordinamento = 0
    } = data;

    // Validazione
    if (!nome) {
      return { success: false, error: 'Il nome del gruppo è obbligatorio' };
    }

    // Check nome unique
    const existingGruppo = await prisma.gruppoTavoli.findUnique({
      where: { nome }
    });

    if (existingGruppo) {
      return { success: false, error: 'Nome gruppo già esistente' };
    }

    // Create gruppo
    const newGruppo = await prisma.gruppoTavoli.create({
      data: {
        nome,
        descrizione,
        colore,
        icona,
        ordinamento
      }
    });

    revalidatePath('/dashboard/tavoli');

    return {
      success: true,
      message: 'Gruppo creato con successo',
      gruppo: newGruppo
    };
  } catch (error) {
    console.error('Create gruppo error:', error);
    return {
      success: false,
      error: 'Errore nella creazione del gruppo'
    };
  }
}

interface UpdateGruppoData {
  id: number;
  nome?: string;
  descrizione?: string;
  colore?: string;
  icona?: string;
  ordinamento?: number;
}

export async function aggiornaGruppoTavoli(data: UpdateGruppoData) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return { success: false, error: "Non autorizzato" };
    }

    const { id, ...updateData } = data;

    if (!id) {
      return { success: false, error: 'ID gruppo richiesto' };
    }

    // Get existing gruppo
    const existingGruppo = await prisma.gruppoTavoli.findUnique({
      where: { id }
    });

    if (!existingGruppo) {
      return { success: false, error: 'Gruppo non trovato' };
    }

    // If updating nome, check uniqueness
    if (updateData.nome && updateData.nome !== existingGruppo.nome) {
      const existingNome = await prisma.gruppoTavoli.findUnique({
        where: { nome: updateData.nome }
      });

      if (existingNome) {
        return { success: false, error: 'Nome gruppo già in uso' };
      }
    }

    // Update gruppo
    const updatedGruppo = await prisma.gruppoTavoli.update({
      where: { id },
      data: updateData,
      include: {
        _count: {
          select: { Tavolo: true }
        }
      }
    });

    revalidatePath('/dashboard/tavoli');

    return {
      success: true,
      message: 'Gruppo aggiornato con successo',
      gruppo: updatedGruppo
    };
  } catch (error) {
    console.error('Update gruppo error:', error);
    return {
      success: false,
      error: 'Errore nell\'aggiornamento del gruppo'
    };
  }
}

export async function eliminaGruppoTavoli(id: number) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return { success: false, error: "Non autorizzato" };
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
        error: 'Non puoi eliminare un gruppo che contiene tavoli' 
      };
    }

    // Soft delete (set inactive)
    await prisma.gruppoTavoli.update({
      where: { id },
      data: { attivo: false }
    });

    revalidatePath('/dashboard/tavoli');

    return {
      success: true,
      message: 'Gruppo disattivato con successo'
    };
  } catch (error) {
    console.error('Delete gruppo error:', error);
    return {
      success: false,
      error: 'Errore nell\'eliminazione del gruppo'
    };
  }
}

export async function aggiornaOrdineGruppi(gruppi: Array<{ id: number; ordinamento: number }>) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return { success: false, error: "Non autorizzato" };
    }

    // Aggiorna ordinamento per ogni gruppo
    const updates = gruppi.map(gruppo => 
      prisma.gruppoTavoli.update({
        where: { id: gruppo.id },
        data: { ordinamento: gruppo.ordinamento }
      })
    );
    
    await Promise.all(updates);
    
    // Recupera i gruppi aggiornati per l'evento SSE
    const gruppiAggiornati = await prisma.gruppoTavoli.findMany({
      where: { attivo: true },
      orderBy: { ordinamento: 'asc' },
      select: { id: true, nome: true, ordinamento: true }
    });
    
    // Invia evento SSE
    const { sseService } = await import('@/lib/sse/sse-service');
    sseService.emit('groups:reordered', {
      groups: gruppiAggiornati,
      updatedBy: user.name || user.email || 'Admin',
      timestamp: new Date().toISOString()
    }, {
      tenantId: user.tenantId
    });
    
    revalidatePath('/dashboard/tavoli');
    revalidatePath('/cameriere/nuova-ordinazione');
    
    return {
      success: true,
      message: 'Ordine aggiornato con successo'
    };
  } catch (error) {
    console.error('Update order error:', error);
    return {
      success: false,
      error: 'Errore nell\'aggiornamento dell\'ordine'
    };
  }
}

export async function aggiornaVisibilitaGruppo(gruppoId: number, visibile: boolean) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return {
        success: false,
        error: "Non autorizzato"
      };
    }

    await prisma.gruppoTavoli.update({
      where: { id: gruppoId },
      data: { visibile }
    });

    // Emit SSE event for real-time updates
    const { sseService } = await import('@/lib/sse/sse-service');
    sseService.emit('groups:visibility:update', {
      gruppoId,
      visibile,
      updatedBy: user.name || user.email || 'Admin',
      timestamp: new Date().toISOString()
    }, {
      tenantId: user.tenantId
    });

    revalidatePath('/dashboard/tavoli');
    revalidatePath('/cameriere');

    return {
      success: true,
      message: `Gruppo ${visibile ? 'reso visibile' : 'nascosto'} con successo`
    };
  } catch (error) {
    console.error('Update gruppo visibility error:', error);
    return {
      success: false,
      error: 'Errore nell\'aggiornamento della visibilità del gruppo'
    };
  }
}