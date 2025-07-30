"use server";

import { prisma } from "@/lib/db";
import { notificationManager } from "@/lib/notifications/NotificationManager";
import { sseService } from "@/lib/sse/sse-service";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";

/**
 * Sincronizza le notifiche per tutti gli stati delle ordinazioni
 * Assicura che ogni stato abbia le notifiche corrette
 */
export async function syncOrderNotifications() {
  try {
    const utente = await getCurrentUser();
    if (!utente || utente.ruolo !== "SUPERVISORE") {
      return { success: false, error: "Solo i supervisori possono sincronizzare le notifiche" };
    }

    console.log("🔄 Inizio sincronizzazione notifiche ordini...");

    // Recupera tutte le ordinazioni non completate
    const ordinazioni = await prisma.ordinazione.findMany({
      where: {
        stato: {
          notIn: ["PAGATO", "ANNULLATO"]
        }
      },
      include: {
        tavolo: true,
        cameriere: true,
        righe: {
          include: {
            prodotto: true
          }
        }
      }
    });

    console.log(`📋 Trovate ${ordinazioni.length} ordinazioni da sincronizzare`);

    let notificheSincronizzate = 0;

    for (const ordinazione of ordinazioni) {
      // Emetti notifica basata sullo stato corrente
      switch (ordinazione.stato) {
        case "ORDINATO":
          // Notifica nuovo ordine
          notificationManager.notifyOrderCreated({
            orderId: ordinazione.id,
            tableNumber: ordinazione.tavolo ? parseInt(ordinazione.tavolo.numero) : undefined,
            orderType: ordinazione.tipo,
            waiterName: ordinazione.cameriere?.nome,
            items: ordinazione.righe.map(r => ({
              nome: r.prodotto.nome,
              quantita: r.quantita,
              postazione: r.prodotto.postazione || "PREPARA"
            }))
          });
          
          sseService.emit('order:new', {
            orderId: ordinazione.id,
            tableNumber: ordinazione.tavolo ? parseInt(ordinazione.tavolo.numero) : undefined,
            customerName: ordinazione.nomeCliente || undefined,
            items: ordinazione.righe.map(r => ({
              id: r.id,
              productName: r.prodotto.nome,
              quantity: r.quantita,
              destination: r.postazione
            })),
            totalAmount: Number(ordinazione.totale),
            timestamp: new Date().toISOString()
          });
          
          notificheSincronizzate++;
          break;

        case "IN_PREPARAZIONE":
          // Notifica ordine inviato in cucina
          notificationManager.notifyOrderUpdated({
            orderId: ordinazione.id,
            tableNumber: ordinazione.tavolo ? parseInt(ordinazione.tavolo.numero) : undefined,
            orderType: ordinazione.tipo,
            status: "IN_PREPARAZIONE",
            changes: [{
              field: 'stato',
              oldValue: 'ORDINATO',
              newValue: 'IN_PREPARAZIONE'
            }]
          });
          
          sseService.emit('order:status-change', {
            orderId: ordinazione.id,
            oldStatus: 'ORDINATO',
            newStatus: 'IN_PREPARAZIONE',
            tableNumber: ordinazione.tavolo ? parseInt(ordinazione.tavolo.numero) : undefined,
            timestamp: new Date().toISOString()
          });
          
          notificheSincronizzate++;
          break;

        case "IN_PREPARAZIONE":
          // Notifica ordine in preparazione
          notificationManager.notifyOrderUpdated({
            orderId: ordinazione.id,
            tableNumber: ordinazione.tavolo ? parseInt(ordinazione.tavolo.numero) : undefined,
            orderType: ordinazione.tipo,
            status: "IN_PREPARAZIONE",
            changes: [{
              field: 'stato',
              oldValue: 'IN_PREPARAZIONE',
              newValue: 'IN_PREPARAZIONE'
            }]
          });
          
          sseService.emit('order:status-change', {
            orderId: ordinazione.id,
            oldStatus: 'IN_PREPARAZIONE',
            newStatus: 'IN_PREPARAZIONE',
            tableNumber: ordinazione.tavolo ? parseInt(ordinazione.tavolo.numero) : undefined,
            timestamp: new Date().toISOString()
          });
          
          notificheSincronizzate++;
          break;

        case "PRONTO":
          // Notifica ordine pronto
          notificationManager.notifyOrderReady({
            orderId: ordinazione.id,
            tableNumber: ordinazione.tavolo ? parseInt(ordinazione.tavolo.numero) : undefined,
            orderType: ordinazione.tipo,
            items: ordinazione.righe.map(r => ({
              nome: r.prodotto.nome,
              quantita: r.quantita,
              postazione: r.prodotto.postazione || "PREPARA"
            }))
          });
          
          sseService.emit('order:ready', {
            orderId: ordinazione.id,
            tableNumber: ordinazione.tavolo ? parseInt(ordinazione.tavolo.numero) : undefined,
            readyItems: ordinazione.righe.filter(r => r.stato === 'PRONTO').map(r => r.id),
            timestamp: new Date().toISOString()
          });
          
          notificheSincronizzate++;
          break;

        case "CONSEGNATO":
          // Notifica ordine consegnato
          notificationManager.notifyOrderDelivered({
            orderId: ordinazione.id,
            tableNumber: ordinazione.tavolo ? parseInt(ordinazione.tavolo.numero) : undefined,
            orderType: ordinazione.tipo,
            amount: parseFloat(ordinazione.totale.toString())
          });
          
          sseService.emit('order:delivered', {
            orderId: ordinazione.id,
            tableNumber: ordinazione.tavolo ? parseInt(ordinazione.tavolo.numero) : undefined,
            deliveredBy: ordinazione.cameriere?.nome,
            timestamp: new Date().toISOString()
          });
          
          notificheSincronizzate++;
          break;

        case "RICHIESTA_CONTO":
          // Notifica richiesta conto
          notificationManager.notifyPaymentRequested({
            orderId: ordinazione.id,
            tableNumber: ordinazione.tavolo ? parseInt(ordinazione.tavolo.numero) : undefined,
            orderType: ordinazione.tipo,
            amount: parseFloat(ordinazione.totale.toString()),
            customerName: ordinazione.nomeCliente || undefined
          });
          
          sseService.emit('notification:reminder', {
            orderId: ordinazione.id,
            tableNumber: ordinazione.tavolo ? parseInt(ordinazione.tavolo.numero) : undefined,
            type: 'payment',
            message: `Richiesta conto per ${ordinazione.tipo} ${ordinazione.tavolo ? `Tavolo ${ordinazione.tavolo.numero}` : ''} - €${ordinazione.totale}`
          });
          
          notificheSincronizzate++;
          break;
      }

      // Piccolo delay per evitare di sovraccaricare il sistema
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Revalida tutti i percorsi
    revalidatePath("/prepara");
    revalidatePath("/gestione-ordini");
    revalidatePath("/cameriere");
    revalidatePath("/cassa");
    revalidatePath("/supervisore");

    console.log(`✅ Sincronizzazione completata: ${notificheSincronizzate} notifiche inviate`);

    return {
      success: true,
      message: `Sincronizzate ${notificheSincronizzate} notifiche per ${ordinazioni.length} ordinazioni`
    };

  } catch (error) {
    console.error("❌ Errore durante la sincronizzazione:", error);
    return {
      success: false,
      error: "Errore durante la sincronizzazione delle notifiche"
    };
  }
}

/**
 * Verifica lo stato delle notifiche per un'ordinazione specifica
 */
export async function checkOrderNotificationStatus(ordinazioneId: string) {
  try {
    const utente = await getCurrentUser();
    if (!utente) {
      return { success: false, error: "Utente non autenticato" };
    }

    const ordinazione = await prisma.ordinazione.findUnique({
      where: { id: ordinazioneId },
      include: {
        tavolo: true,
        cameriere: true,
        righe: {
          include: {
            prodotto: true
          }
        }
      }
    });

    if (!ordinazione) {
      return { success: false, error: "Ordinazione non trovata" };
    }

    // Verifica quali notifiche dovrebbero essere state inviate
    const expectedNotifications = [];
    
    if (["ORDINATO", "IN_PREPARAZIONE", "IN_PREPARAZIONE", "PRONTO", "CONSEGNATO", "PAGATO"].includes(ordinazione.stato)) {
      expectedNotifications.push({
        stato: ordinazione.stato,
        tipo: getNotificationTypeForState(ordinazione.stato),
        destinatari: getTargetRolesForState(ordinazione.stato)
      });
    }

    return {
      success: true,
      ordinazione: {
        id: ordinazione.id,
        stato: ordinazione.stato,
        tavolo: ordinazione.tavolo?.numero,
        tipo: ordinazione.tipo
      },
      expectedNotifications
    };

  } catch (error) {
    console.error("Errore verifica stato notifiche:", error);
    return {
      success: false,
      error: "Errore durante la verifica delle notifiche"
    };
  }
}

/**
 * Helper per mappare lo stato al tipo di notifica
 */
function getNotificationTypeForState(stato: string): string {
  const stateToNotification: { [key: string]: string } = {
    "ORDINATO": "order_created",
    "IN_PREPARAZIONE": "order_in_preparation",
    "PRONTO": "order_ready",
    "CONSEGNATO": "order_delivered",
    "RICHIESTA_CONTO": "order_payment_requested",
    "PAGATO": "order_paid"
  };
  return stateToNotification[stato] || "order_updated";
}

/**
 * Helper per mappare lo stato ai ruoli destinatari
 */
function getTargetRolesForState(stato: string): string[] {
  const stateToRoles: { [key: string]: string[] } = {
    "ORDINATO": ["PREPARA", "CUCINA", "CAMERIERE", "SUPERVISORE"],
    "IN_PREPARAZIONE": ["PREPARA", "CUCINA", "CAMERIERE", "SUPERVISORE"],
    "PRONTO": ["CAMERIERE", "SUPERVISORE"],
    "CONSEGNATO": ["CASSA", "SUPERVISORE"],
    "PAGATO": ["CAMERIERE", "SUPERVISORE"]
  };
  return stateToRoles[stato] || ["SUPERVISORE"];
}