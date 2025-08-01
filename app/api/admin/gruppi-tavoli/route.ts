import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-multi-tenant";

// GET - Lista gruppi tavoli
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireAuth();
    
    if (!user) {
      return NextResponse.json({ error }, { status: 401 });
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

    return NextResponse.json({ gruppi });
  } catch (error) {
    console.error('Get gruppi tavoli error:', error);
    return NextResponse.json(
      { error: 'Errore nel recupero dei gruppi' },
      { status: 500 }
    );
  }
}

// POST - Crea nuovo gruppo
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireAuth();
    
    if (!user) {
      return NextResponse.json({ error }, { status: 401 });
    }

    const body = await request.json();
    const {
      nome,
      descrizione,
      colore,
      icona = 'Folder',
      ordinamento = 0
    } = body;

    // Validazione
    if (!nome) {
      return NextResponse.json(
        { error: 'Il nome del gruppo è obbligatorio' },
        { status: 400 }
      );
    }

    // Check nome unique
    const existingGruppo = await prisma.gruppoTavoli.findUnique({
      where: { nome }
    });

    if (existingGruppo) {
      return NextResponse.json(
        { error: 'Nome gruppo già esistente' },
        { status: 400 }
      );
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

    return NextResponse.json({
      success: true,
      gruppo: newGruppo
    });
  } catch (error) {
    console.error('Create gruppo error:', error);
    return NextResponse.json(
      { error: 'Errore nella creazione del gruppo' },
      { status: 500 }
    );
  }
}

// PATCH - Aggiorna gruppo
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
        { error: 'ID gruppo richiesto' },
        { status: 400 }
      );
    }

    // Get existing gruppo
    const existingGruppo = await prisma.gruppoTavoli.findUnique({
      where: { id }
    });

    if (!existingGruppo) {
      return NextResponse.json(
        { error: 'Gruppo non trovato' },
        { status: 404 }
      );
    }

    // If updating nome, check uniqueness
    if (updateData.nome && updateData.nome !== existingGruppo.nome) {
      const existingNome = await prisma.gruppoTavoli.findUnique({
        where: { nome: updateData.nome }
      });

      if (existingNome) {
        return NextResponse.json(
          { error: 'Nome gruppo già in uso' },
          { status: 400 }
        );
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

    return NextResponse.json({
      success: true,
      gruppo: updatedGruppo
    });
  } catch (error) {
    console.error('Update gruppo error:', error);
    return NextResponse.json(
      { error: 'Errore nell\'aggiornamento del gruppo' },
      { status: 500 }
    );
  }
}

// DELETE - Elimina gruppo
export async function DELETE(request: NextRequest) {
  try {
    const { user, error } = await requireAuth();
    
    if (!user) {
      return NextResponse.json({ error }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const gruppoId = searchParams.get('id');

    if (!gruppoId) {
      return NextResponse.json(
        { error: 'ID gruppo richiesto' },
        { status: 400 }
      );
    }

    // Check if gruppo has tavoli
    const tavoliCount = await prisma.tavolo.count({
      where: {
        gruppoId: parseInt(gruppoId),
        attivo: true
      }
    });

    if (tavoliCount > 0) {
      return NextResponse.json(
        { error: 'Non puoi eliminare un gruppo che contiene tavoli' },
        { status: 400 }
      );
    }

    // Soft delete (set inactive)
    await prisma.gruppoTavoli.update({
      where: { id: parseInt(gruppoId) },
      data: { attivo: false }
    });

    return NextResponse.json({
      success: true,
      message: 'Gruppo disattivato con successo'
    });
  } catch (error) {
    console.error('Delete gruppo error:', error);
    return NextResponse.json(
      { error: 'Errore nell\'eliminazione del gruppo' },
      { status: 500 }
    );
  }
}