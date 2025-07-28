import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  try {
    // Verifica che l'utente corrente sia un supervisore
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.ruolo !== 'SUPERVISORE') {
      return NextResponse.json(
        { error: "Non autorizzato" },
        { status: 403 }
      );
    }

    console.log("[Sync Orders] Avvio sincronizzazione ordini-utenti...");

    // 1. Trova tutti gli utenti con sessioni attive
    const activeUsers = await prisma.user.findMany({
      where: {
        sessioni: {
          some: {
            expires: {
              gt: new Date()
            }
          }
        }
      },
      select: {
        id: true,
        nome: true
      }
    });

    const activeUserIds = activeUsers.map(u => u.id);
    console.log(`[Sync Orders] Utenti attivi: ${activeUserIds.length}`);

    // 2. Trova ordini aperti con camerieri non più attivi
    const orphanedOrders = await prisma.ordinazione.findMany({
      where: {
        stato: {
          in: ["APERTA", "INVIATA", "IN_PREPARAZIONE", "PRONTA"]
        },
        cameriereId: {
          notIn: activeUserIds
        }
      },
      include: {
        cameriere: {
          select: {
            nome: true,
            cognome: true
          }
        },
        tavolo: {
          select: {
            numero: true
          }
        }
      }
    });

    console.log(`[Sync Orders] Trovati ${orphanedOrders.length} ordini orfani`);

    // 3. Report dei problemi trovati
    const issues = orphanedOrders.map(order => ({
      orderId: order.id,
      numeroOrdine: order.numero,
      tavolo: order.tavolo?.numero,
      stato: order.stato,
      cameriere: `${order.cameriere.nome} ${order.cameriere.cognome}`,
      dataApertura: order.dataApertura
    }));

    // 4. Opzionale: chiudi automaticamente ordini molto vecchi (più di 24 ore)
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const veryOldOrders = orphanedOrders.filter(order => 
      order.dataApertura < oneDayAgo
    );

    if (veryOldOrders.length > 0) {
      await prisma.ordinazione.updateMany({
        where: {
          id: {
            in: veryOldOrders.map(o => o.id)
          }
        },
        data: {
          stato: "ANNULLATA",
          note: "Annullato automaticamente - cameriere non più attivo"
        }
      });

      console.log(`[Sync Orders] Annullati ${veryOldOrders.length} ordini vecchi`);
    }

    return NextResponse.json({
      success: true,
      activeUsers: activeUsers.length,
      orphanedOrders: orphanedOrders.length,
      autoClosedOrders: veryOldOrders.length,
      issues: issues,
      message: `Trovati ${orphanedOrders.length} ordini senza cameriere attivo. ${veryOldOrders.length} ordini vecchi sono stati annullati automaticamente.`
    });

  } catch (error) {
    console.error("Errore sincronizzazione ordini:", error);
    return NextResponse.json(
      { error: "Errore durante la sincronizzazione" },
      { status: 500 }
    );
  }
}