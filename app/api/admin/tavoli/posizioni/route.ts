import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-multi-tenant";

// PATCH - Aggiorna posizioni tavoli (bulk update per drag & drop)
export async function PATCH(request: NextRequest) {
  try {
    const { user, error } = await requireAuth();
    
    if (!user) {
      return NextResponse.json({ error }, { status: 401 });
    }

    const body = await request.json();
    const { updates } = body;

    if (!updates || !Array.isArray(updates)) {
      return NextResponse.json(
        { error: 'Array di aggiornamenti richiesto' },
        { status: 400 }
      );
    }

    // Esegui tutti gli aggiornamenti in una transazione
    const results = await prisma.$transaction(
      updates.map(({ id, posizioneX, posizioneY, gruppoId, ordinamento }) =>
        prisma.tavolo.update({
          where: { id },
          data: {
            posizioneX,
            posizioneY,
            gruppoId,
            ordinamento
          }
        })
      )
    );

    return NextResponse.json({
      success: true,
      updatedCount: results.length
    });
  } catch (error) {
    console.error('Update tavoli positions error:', error);
    return NextResponse.json(
      { error: 'Errore nell\'aggiornamento delle posizioni' },
      { status: 500 }
    );
  }
}