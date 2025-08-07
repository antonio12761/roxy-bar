"use server";

import { prisma } from "@/lib/db";
import { broadcast } from "@/lib/notifications";
import { sseService } from "@/lib/sse/sse-service";

export async function sincronizzaOrdiniTraStazioni() {
  try {
    const ordinazioni = await prisma.ordinazione.findMany({
      where: {
        stato: {
          in: ["ORDINATO", "IN_PREPARAZIONE", "PRONTO"]
        }
      },
      include: {
        Tavolo: true,
        RigaOrdinazione: {
          where: {
            stato: {
              not: "CONSEGNATO"
            }
          },
          include: {
            Prodotto: true
          }
        }
      },
      orderBy: {
        dataApertura: 'asc'
      }
    });

    const ordiniPerPostazione = {
      PREPARA: [] as any[],
      CUCINA: [] as any[],
      BANCO: [] as any[]
    };

    ordinazioni.forEach(ord => {
      ord.RigaOrdinazione.forEach((riga: any) => {
        const key = riga.postazione as keyof typeof ordiniPerPostazione;
        if (ordiniPerPostazione[key]) {
          ordiniPerPostazione[key].push({
            ordineId: ord.id,
            tavoloNumero: ord.Tavolo?.numero,
            rigaId: riga.id,
            prodotto: riga.Prodotto.nome,
            quantita: riga.quantita,
            stato: riga.stato,
            timestampOrdine: riga.timestampOrdine
          });
        }
      });
    });

    Object.entries(ordiniPerPostazione).forEach(([postazione, ordini]) => {
      if (ordini.length > 0) {
        broadcast({
          type: "station_sync",
          message: `Sincronizzazione ordini per ${postazione}`,
          data: {
            postazione,
            ordini,
            timestamp: new Date().toISOString(),
            syncVersion: Date.now()
          },
          targetRoles: [postazione]
        });
      }
    });

    return { 
      success: true, 
      message: "Sincronizzazione completata",
      ordiniSincronizzati: ordinazioni.length
    };
  } catch (error: any) {
    console.error("Errore sincronizzazione:", error.message);
    return { success: false, error: "Errore durante la sincronizzazione" };
  }
}

export async function forzaRefreshStazioni() {
  try {
    broadcast({
      type: "force_refresh",
      message: "Aggiornamento forzato di tutte le stazioni",
      data: {
        timestamp: new Date().toISOString(),
        syncVersion: Date.now()
      },
      targetRoles: ["CAMERIERE", "PREPARA", "CUCINA", "CASSA"]
    });

    return { success: true, message: "Refresh forzato inviato a tutte le stazioni" };
  } catch (error: any) {
    console.error("Errore refresh:", error.message);
    return { success: false, error: "Errore durante il refresh forzato" };
  }
}

export async function sollecitaOrdinePronto(ordinazioneId: string) {
  try {
    const utente = await prisma.user.findFirst();
    if (!utente) {
      return { success: false, error: "Utente non autenticato" };
    }

    const ordinazione = await prisma.ordinazione.findUnique({
      where: { id: ordinazioneId },
      include: {
        Tavolo: true,
        User: true
      }
    });

    if (!ordinazione) {
      return { success: false, error: "Ordinazione non trovata" };
    }

    if (ordinazione.stato !== 'PRONTO') {
      return { success: false, error: "L'ordinazione non è ancora pronta" };
    }

    broadcast({
      type: "order_reminder",
      message: `⏰ Sollecito ritiro ordine: ${ordinazione.tipo} ${ordinazione.Tavolo ? `Tavolo ${ordinazione.Tavolo.numero}` : ''} - Ordine pronto`,
      data: {
        orderId: ordinazione.id,
        tableNumber: ordinazione.Tavolo?.numero,
        orderType: ordinazione.tipo
      },
      targetRoles: ["CAMERIERE", "SUPERVISORE"]
    });

    sseService.emit('notification:reminder', {
      orderId: ordinazione.id,
      tableNumber: ordinazione.Tavolo?.numero || undefined,
      type: 'pickup',
      message: `Sollecito per ordine ${ordinazione.tipo} ${ordinazione.Tavolo ? `Tavolo ${ordinazione.Tavolo.numero}` : ''}`
    });

    return { success: true, message: "Sollecito inviato" };
  } catch (error: any) {
    console.error("Errore sollecito:", error.message);
    return { success: false, error: "Errore durante l'invio del sollecito" };
  }
}