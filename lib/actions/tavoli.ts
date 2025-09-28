"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-multi-tenant";
import { serializeDecimalData } from "@/lib/utils/decimal-serializer";
import { revalidatePath } from "next/cache";
import { FormaTavolo } from "@prisma/client";

interface GetTavoliOptions {
  includeGroups?: boolean;
  groupId?: number;
  search?: string;
}

export async function getTavoliAdmin(options: GetTavoliOptions = {}) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return { success: false, error: "Non autorizzato" };
    }

    const { includeGroups = false, groupId, search = '' } = options;

    // Build where clause per tavoli
    const where: any = {
      attivo: true
    };

    if (groupId) {
      where.gruppoId = groupId;
    }

    if (search) {
      where.OR = [
        { numero: { contains: search, mode: 'insensitive' } },
        { nome: { contains: search, mode: 'insensitive' } },
        { zona: { contains: search, mode: 'insensitive' } }
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

    let result: any = { tavoli };

    // Get gruppi if requested
    if (includeGroups) {
      const gruppi = await prisma.gruppoTavoli.findMany({
        where: { attivo: true },
        include: {
          Tavolo: {
            where: { attivo: true },
            orderBy: { ordinamento: 'asc' },
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
            }
          },
          _count: {
            select: { Tavolo: true }
          }
        },
        orderBy: { ordinamento: 'asc' }
      });
      result.gruppi = gruppi;
    }

    return serializeDecimalData({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Get tavoli error:', error);
    return {
      success: false,
      error: 'Errore nel recupero dei tavoli'
    };
  }
}

interface CreateTavoloData {
  numero: string;
  nome?: string;
  zona?: string;
  forma?: FormaTavolo;
  gruppoId?: number;
  posizioneX?: number;
  posizioneY?: number;
  ordinamento?: number;
  note?: string;
}

export async function creaTavolo(data: CreateTavoloData) {
  try {
    const user = await getCurrentUser();
    
    if (!user || !["SUPERVISORE", "ADMIN"].includes(user.ruolo)) {
      return { success: false, error: "Non autorizzato" };
    }

    const {
      numero,
      nome,
      zona,
      forma = 'QUADRATO',
      gruppoId,
      posizioneX = 0,
      posizioneY = 0,
      ordinamento = 0,
      note
    } = data;

    // Validazione
    if (!numero) {
      return {
        success: false,
        error: 'Il numero del tavolo è obbligatorio'
      };
    }

    // Check numero unique
    const existingTavolo = await prisma.tavolo.findUnique({
      where: { numero }
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
        numero,
        nome,
        zona,
        forma,
        gruppoId,
        posizioneX,
        posizioneY,
        ordinamento,
        note
      },
      include: {
        GruppoTavoli: true
      }
    });

    // Invalidate cache
    revalidatePath("/dashboard/tavoli");
    revalidatePath("/admin/tavoli");
    revalidatePath("/cameriere");

    return serializeDecimalData({
      success: true,
      data: newTavolo,
      message: "Tavolo creato con successo"
    });
  } catch (error) {
    console.error('Create tavolo error:', error);
    return {
      success: false,
      error: 'Errore nella creazione del tavolo'
    };
  }
}

interface UpdateTavoloData extends Partial<CreateTavoloData> {
  id: number;
}

export async function aggiornaTavolo(data: UpdateTavoloData) {
  try {
    const user = await getCurrentUser();
    
    if (!user || !["SUPERVISORE", "ADMIN"].includes(user.ruolo)) {
      return { success: false, error: "Non autorizzato" };
    }

    const { id, ...updateData } = data;

    if (!id) {
      return {
        success: false,
        error: 'ID tavolo richiesto'
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

    // If updating numero, check uniqueness
    if (updateData.numero && updateData.numero !== existingTavolo.numero) {
      const existingNumero = await prisma.tavolo.findFirst({
        where: { 
          numero: updateData.numero,
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
      data: updateData,
      include: {
        GruppoTavoli: true
      }
    });

    // Invalidate cache
    revalidatePath("/dashboard/tavoli");
    revalidatePath("/admin/tavoli");
    revalidatePath("/cameriere");

    return serializeDecimalData({
      success: true,
      data: updatedTavolo,
      message: "Tavolo aggiornato con successo"
    });
  } catch (error) {
    console.error('Update tavolo error:', error);
    return {
      success: false,
      error: 'Errore nell\'aggiornamento del tavolo'
    };
  }
}

export async function eliminaTavolo(tavoloId: number) {
  try {
    const user = await getCurrentUser();
    
    if (!user || !["SUPERVISORE", "ADMIN"].includes(user.ruolo)) {
      return { success: false, error: "Non autorizzato" };
    }

    if (!tavoloId) {
      return {
        success: false,
        error: 'ID tavolo richiesto'
      };
    }

    // Check if tavolo has active orders
    const activeOrders = await prisma.ordinazione.findFirst({
      where: {
        tavoloId,
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

    // Get tavolo data
    const tavolo = await prisma.tavolo.findUnique({
      where: { id: tavoloId }
    });
    
    if (!tavolo) {
      return {
        success: false,
        error: 'Tavolo non trovato'
      };
    }
    
    // Soft delete (set inactive and rename to avoid unique constraint)
    await prisma.tavolo.update({
      where: { id: tavoloId },
      data: { 
        attivo: false,
        numero: `${tavolo.numero}_DELETED_${Date.now()}`
      }
    });

    // Invalidate cache
    revalidatePath("/dashboard/tavoli");
    revalidatePath("/admin/tavoli");
    revalidatePath("/cameriere");

    return {
      success: true,
      message: 'Tavolo eliminato con successo'
    };
  } catch (error) {
    console.error('Delete tavolo error:', error);
    return {
      success: false,
      error: 'Errore nell\'eliminazione del tavolo'
    };
  }
}

export async function aggiornaVisibilitaTavolo(tavoloId: number, visibile: boolean) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return {
        success: false,
        error: "Non autorizzato"
      };
    }

    await prisma.tavolo.update({
      where: { id: tavoloId },
      data: { visibile }
    });
    
    // Emit SSE event for real-time updates
    const { sseService } = await import('@/lib/sse/sse-service');
    sseService.emit('tables:visibility:update', {
      tavoloId,
      visibile,
      updatedBy: user.name || user.email || 'Admin',
      timestamp: new Date().toISOString()
    }, {
      tenantId: user.tenantId
    });

    revalidatePath("/dashboard");
    revalidatePath("/cameriere");

    return {
      success: true,
      message: `Tavolo ${visibile ? 'reso visibile' : 'nascosto'} con successo`
    };
  } catch (error) {
    console.error('Update tavolo visibility error:', error);
    return {
      success: false,
      error: 'Errore nell\'aggiornamento della visibilità del tavolo'
    };
  }
}