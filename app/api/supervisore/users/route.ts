import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    console.log("[API Supervisore Users] Recupero utenti...");
    
    // Recupera tutti gli utenti con informazioni sullo stato online
    const users = await prisma.user.findMany({
      where: {
        attivo: true,
      },
      include: {
        Session: {
          where: {
            expires: {
              gt: new Date() // Solo sessioni non scadute
            }
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 1
        }
      },
      orderBy: {
        nome: 'asc'
      }
    });

    console.log(`[API Supervisore Users] Trovati ${users.length} utenti`);
    
    // Determina lo stato online basandosi sulle sessioni attive
    const usersWithStatus = users.map(user => {
      const hasActiveSession = user.Session.length > 0;
      const lastSession = user.Session[0];
      
      console.log(`[API Supervisore Users] ${user.nome} - Sessioni attive: ${user.Session.length}, Online: ${hasActiveSession}`);
      
      return {
        id: user.id,
        nome: user.nome,
        ruolo: user.ruolo,
        online: hasActiveSession,
        bloccato: user.bloccato || false,
        lastActivity: lastSession?.createdAt || user.ultimoAccesso,
        currentTable: null // Questo potrebbe essere implementato in futuro
      };
    });

    return NextResponse.json(usersWithStatus);
  } catch (error: any) {
    console.error("Errore recupero utenti:", error);
    return NextResponse.json(
      { error: "Errore nel recupero degli utenti" },
      { status: 500 }
    );
  }
}