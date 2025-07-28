import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    // Conta tutte le sessioni
    const totalSessions = await prisma.session.count();
    
    // Conta sessioni attive (non scadute)
    const activeSessions = await prisma.session.count({
      where: {
        expires: {
          gt: new Date()
        }
      }
    });
    
    // Recupera dettagli delle sessioni attive
    const activeSessionDetails = await prisma.session.findMany({
      where: {
        expires: {
          gt: new Date()
        }
      },
      include: {
        user: {
          select: {
            nome: true,
            ruolo: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    // Recupera tutte le sessioni (anche scadute) per debug
    const allSessions = await prisma.session.findMany({
      include: {
        user: {
          select: {
            nome: true,
            ruolo: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10 // Ultime 10 sessioni
    });
    
    return NextResponse.json({
      totalSessions,
      activeSessions,
      activeSessionDetails: activeSessionDetails.map(s => ({
        userId: s.userId,
        userName: s.user.nome,
        userRole: s.user.ruolo,
        expires: s.expires,
        createdAt: s.createdAt,
        isExpired: s.expires < new Date()
      })),
      recentSessions: allSessions.map(s => ({
        userId: s.userId,
        userName: s.user.nome,
        userRole: s.user.ruolo,
        expires: s.expires,
        createdAt: s.createdAt,
        isExpired: s.expires < new Date()
      }))
    });
  } catch (error) {
    console.error("Errore test sessioni:", error);
    return NextResponse.json(
      { error: "Errore nel test delle sessioni", details: error },
      { status: 500 }
    );
  }
}