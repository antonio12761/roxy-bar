import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-multi-tenant";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    
    // Permetti lettura a CASSA per stampare con le impostazioni corrette
    if (!user || !["SUPERVISORE", "ADMIN", "CASSA", "CAMERIERE"].includes(user.ruolo)) {
      return NextResponse.json(
        { error: "Non autorizzato" },
        { status: 401 }
      );
    }

    // Recupera le impostazioni attive
    let impostazioni = await prisma.impostazioniScontrino.findFirst({
      where: { attivo: true },
      orderBy: { updatedAt: "desc" }
    });

    // Se non esistono impostazioni, crea quelle di default
    if (!impostazioni) {
      impostazioni = await prisma.impostazioniScontrino.create({
        data: {
          nomeAttivita: "Bar Roxy",
          messaggioRingraziamento: "Grazie per la visita!",
          attivo: true
        }
      });
    }

    return NextResponse.json({ success: true, data: impostazioni });
  } catch (error) {
    console.error("Errore nel recupero impostazioni:", error);
    return NextResponse.json(
      { error: "Errore nel recupero delle impostazioni" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    
    if (!user || (user.ruolo !== "SUPERVISORE" && user.ruolo !== "ADMIN")) {
      return NextResponse.json(
        { error: "Non autorizzato" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { error: "ID impostazioni mancante" },
        { status: 400 }
      );
    }

    // Aggiorna le impostazioni
    const impostazioniAggiornate = await prisma.impostazioniScontrino.update({
      where: { id },
      data: {
        ...updateData,
        modificatoDa: user.id,
        updatedAt: new Date()
      }
    });

    return NextResponse.json({ 
      success: true, 
      data: impostazioniAggiornate,
      message: "Impostazioni aggiornate con successo"
    });
  } catch (error) {
    console.error("Errore nell'aggiornamento impostazioni:", error);
    return NextResponse.json(
      { error: "Errore nell'aggiornamento delle impostazioni" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    
    if (!user || (user.ruolo !== "SUPERVISORE" && user.ruolo !== "ADMIN")) {
      return NextResponse.json(
        { error: "Non autorizzato" },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Disattiva tutte le impostazioni esistenti
    await prisma.impostazioniScontrino.updateMany({
      where: { attivo: true },
      data: { attivo: false }
    });

    // Crea nuove impostazioni
    const nuoveImpostazioni = await prisma.impostazioniScontrino.create({
      data: {
        ...body,
        attivo: true,
        modificatoDa: user.id
      }
    });

    return NextResponse.json({ 
      success: true, 
      data: nuoveImpostazioni,
      message: "Impostazioni create con successo"
    });
  } catch (error) {
    console.error("Errore nella creazione impostazioni:", error);
    return NextResponse.json(
      { error: "Errore nella creazione delle impostazioni" },
      { status: 500 }
    );
  }
}