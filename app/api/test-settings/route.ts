import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    // Recupera TUTTE le impostazioni attive
    const impostazioni = await prisma.impostazioniScontrino.findFirst({
      where: { attivo: true },
      orderBy: { updatedAt: "desc" }
    });

    return NextResponse.json({ 
      success: true, 
      impostazioni,
      message: "Queste sono le ESATTE impostazioni nel database"
    });
  } catch (error) {
    console.error("Errore:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}