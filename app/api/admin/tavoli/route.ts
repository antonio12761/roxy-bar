import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-multi-tenant";

// GET - Lista tavoli e gruppi
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireAuth();
    
    if (!user) {
      return NextResponse.json({ error }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const includeGroups = searchParams.get('includeGroups') === 'true';
    const groupId = searchParams.get('groupId');
    const search = searchParams.get('search') || '';

    // Build where clause per tavoli
    const where: any = {
      attivo: true
    };

    if (groupId) {
      where.gruppoId = parseInt(groupId);
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
          _count: {
            select: { Tavolo: true }
          }
        },
        orderBy: { ordinamento: 'asc' }
      });
      result.gruppi = gruppi;
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Get tavoli error:', error);
    return NextResponse.json(
      { error: 'Errore nel recupero dei tavoli' },
      { status: 500 }
    );
  }
}

// POST - Crea nuovo tavolo
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireAuth();
    
    if (!user) {
      return NextResponse.json({ error }, { status: 401 });
    }

    const body = await request.json();
    const {
      numero,
      nome,
      zona,
      posti = 4,
      forma = 'QUADRATO',
      gruppoId,
      posizioneX = 0,
      posizioneY = 0,
      ordinamento = 0,
      note
    } = body;

    // Validazione
    if (!numero) {
      return NextResponse.json(
        { error: 'Il numero del tavolo è obbligatorio' },
        { status: 400 }
      );
    }

    // Check numero unique (database handles this with unique constraint)
    const existingTavolo = await prisma.tavolo.findUnique({
      where: { numero }
    });

    if (existingTavolo) {
      return NextResponse.json(
        { error: 'Numero tavolo già esistente' },
        { status: 400 }
      );
    }

    // Create tavolo
    const newTavolo = await prisma.tavolo.create({
      data: {
        numero,
        nome,
        zona,
        posti,
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

    return NextResponse.json({
      success: true,
      tavolo: newTavolo
    });
  } catch (error) {
    console.error('Create tavolo error:', error);
    return NextResponse.json(
      { error: 'Errore nella creazione del tavolo' },
      { status: 500 }
    );
  }
}

// PATCH - Aggiorna tavolo
export async function PATCH(request: NextRequest) {
  try {
    const { user, error } = await requireAuth();
    
    if (!user) {
      return NextResponse.json({ error }, { status: 401 });
    }

    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'ID tavolo richiesto' },
        { status: 400 }
      );
    }

    // Get existing tavolo
    const existingTavolo = await prisma.tavolo.findUnique({
      where: { id }
    });

    if (!existingTavolo) {
      return NextResponse.json(
        { error: 'Tavolo non trovato' },
        { status: 404 }
      );
    }

    // If updating numero, check uniqueness (excluding current table)
    if (updateData.numero && updateData.numero !== existingTavolo.numero) {
      const existingNumero = await prisma.tavolo.findFirst({
        where: { 
          numero: updateData.numero,
          id: { not: id } // Exclude the current table being updated
        }
      });

      if (existingNumero) {
        return NextResponse.json(
          { error: 'Numero tavolo già in uso' },
          { status: 400 }
        );
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

    return NextResponse.json({
      success: true,
      tavolo: updatedTavolo
    });
  } catch (error) {
    console.error('Update tavolo error:', error);
    return NextResponse.json(
      { error: 'Errore nell\'aggiornamento del tavolo' },
      { status: 500 }
    );
  }
}

// DELETE - Elimina tavolo
export async function DELETE(request: NextRequest) {
  try {
    const { user, error } = await requireAuth();
    
    if (!user) {
      return NextResponse.json({ error }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const tavoloId = searchParams.get('id');

    if (!tavoloId) {
      return NextResponse.json(
        { error: 'ID tavolo richiesto' },
        { status: 400 }
      );
    }

    // Check if tavolo has active orders
    const activeOrders = await prisma.ordinazione.findFirst({
      where: {
        tavoloId: parseInt(tavoloId),
        stato: {
          notIn: ['PAGATO', 'ANNULLATO']
        }
      }
    });

    if (activeOrders) {
      return NextResponse.json(
        { error: 'Non puoi eliminare un tavolo con ordinazioni attive' },
        { status: 400 }
      );
    }

    // Soft delete (set inactive and rename to avoid unique constraint)
    const tavolo = await prisma.tavolo.findUnique({
      where: { id: parseInt(tavoloId) }
    });
    
    if (!tavolo) {
      return NextResponse.json(
        { error: 'Tavolo non trovato' },
        { status: 404 }
      );
    }
    
    // Append timestamp to make numero unique when soft deleting
    await prisma.tavolo.update({
      where: { id: parseInt(tavoloId) },
      data: { 
        attivo: false,
        numero: `${tavolo.numero}_DELETED_${Date.now()}`
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Tavolo disattivato con successo'
    });
  } catch (error) {
    console.error('Delete tavolo error:', error);
    return NextResponse.json(
      { error: 'Errore nell\'eliminazione del tavolo' },
      { status: 500 }
    );
  }
}