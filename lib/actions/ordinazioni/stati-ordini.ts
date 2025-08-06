"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-multi-tenant";
import { revalidatePath } from "next/cache";
import { notificationManager } from "@/lib/notifications/NotificationManager";
import { sseService } from "@/lib/sse/sse-service";
import { SSEEventMap } from "@/lib/sse/sse-events";
import { serializeDecimalData } from "@/lib/utils/decimal-serializer";
import { ordersCache } from "@/lib/cache/orders-cache";
import { ordersSyncService } from "@/lib/services/orders-sync-service";
import { getStationCache } from "@/lib/cache/station-cache";
import { StationType } from "@/lib/sse/station-filters";
import { getStatiSuccessivi } from "@/lib/middleware/state-validation";
import type { StatoOrdinazione, StatoRiga } from "./types";

export async function aggiornaStatoOrdinazione(
  ordinazioneId: string,
  nuovoStato: StatoOrdinazione
) {
  try {
    const utente = await getCurrentUser();
    if (!utente) {
      return { success: false, error: "Utente non autenticato" };
    }

    const ordinazioneCorrente = await prisma.ordinazione.findUnique({
      where: { id: ordinazioneId },
      select: { stato: true }
    });

    if (!ordinazioneCorrente) {
      return { success: false, error: "Ordinazione non trovata" };
    }
    
    let ordinazione;
    try {
      ordinazione = await prisma.ordinazione.update({
        where: { id: ordinazioneId },
        data: { stato: nuovoStato },
        include: {
          Tavolo: true
        }
      });
    } catch (error: any) {
      if (error.name === 'TransizioneStatoError') {
        return { 
          success: false, 
          error: `Non puoi cambiare lo stato da ${ordinazioneCorrente.stato} a ${nuovoStato}. Transizione non consentita.`,
          statoAttuale: ordinazioneCorrente.stato,
          transizioniPermesse: getStatiSuccessivi(ordinazioneCorrente.stato as any)
        };
      }
      throw error;
    }

    switch (nuovoStato) {
      case "ORDINATO":
        notificationManager.notifyOrderUpdated({
          orderId: ordinazione.id,
          tableNumber: ordinazione.Tavolo ? parseInt(ordinazione.Tavolo.numero) : undefined,
          orderType: ordinazione.tipo,
          status: nuovoStato,
          changes: [{
            field: 'stato',
            oldValue: ordinazioneCorrente.stato,
            newValue: nuovoStato
          }]
        });
        break;
      
      case "IN_PREPARAZIONE":
        notificationManager.notifyOrderUpdated({
          orderId: ordinazione.id,
          tableNumber: ordinazione.Tavolo ? parseInt(ordinazione.Tavolo.numero) : undefined,
          orderType: ordinazione.tipo,
          status: nuovoStato,
          changes: [{
            field: 'stato',
            oldValue: ordinazioneCorrente.stato,
            newValue: nuovoStato
          }]
        });
        break;
      
      case "PRONTO":
        notificationManager.notifyOrderReady({
          orderId: ordinazione.id,
          tableNumber: ordinazione.Tavolo ? parseInt(ordinazione.Tavolo.numero) : undefined,
          orderType: ordinazione.tipo
        });
        break;
      
      case "CONSEGNATO":
        notificationManager.notifyOrderDelivered({
          orderId: ordinazione.id,
          tableNumber: ordinazione.Tavolo ? parseInt(ordinazione.Tavolo.numero) : undefined,
          orderType: ordinazione.tipo,
          amount: parseFloat(ordinazione.totale.toString())
        });
        break;
      
      case "PAGATO":
        notificationManager.notifyOrderPaid({
          orderId: ordinazione.id,
          tableNumber: ordinazione.Tavolo ? parseInt(ordinazione.Tavolo.numero) : undefined,
          orderType: ordinazione.tipo,
          amount: parseFloat(ordinazione.totale.toString())
        });
        break;
      
      case "ANNULLATO":
        notificationManager.notifyOrderCancelled({
          orderId: ordinazione.id,
          tableNumber: ordinazione.Tavolo ? parseInt(ordinazione.Tavolo.numero) : undefined,
          orderType: ordinazione.tipo,
          reason: "Annullata dall'utente"
        });
        break;
    }

    const sseEventMap: { [key: string]: keyof SSEEventMap } = {
      "ORDINATO": "order:new",
      "IN_PREPARAZIONE": "order:in-preparation",
      "PRONTO": "order:ready",
      "CONSEGNATO": "order:delivered",
      "RICHIESTA_CONTO": "order:status-change",
      "PAGATO": "order:paid",
      "ANNULLATO": "order:cancelled"
    };

    const sseEvent = sseEventMap[nuovoStato] || 'order:status-change';
    
    let eventData: any = {
      orderId: ordinazione.id,
      orderNumber: ordinazione.numero,
      oldStatus: ordinazioneCorrente.stato,
      newStatus: nuovoStato,
      tableNumber: ordinazione.Tavolo ? parseInt(ordinazione.Tavolo.numero) : undefined,
      timestamp: new Date().toISOString()
    };
    
    if (nuovoStato === "CONSEGNATO") {
      eventData = {
        orderId: ordinazione.id,
        orderNumber: ordinazione.numero,
        tableNumber: ordinazione.Tavolo ? parseInt(ordinazione.Tavolo.numero) : undefined,
        deliveredBy: utente.nome,
        timestamp: new Date().toISOString()
      };
    }
    
    sseService.emit(sseEvent as keyof SSEEventMap, eventData, {
      broadcast: true,
      skipRateLimit: true,
      tenantId: utente.tenantId,
      queueIfOffline: true
    });
    
    const delays = [100, 250, 500, 1000, 2000];
    delays.forEach(delay => {
      setTimeout(() => {
        sseService.emit(sseEvent as keyof SSEEventMap, eventData, {
          broadcast: true,
          skipRateLimit: true,
          tenantId: utente.tenantId
        });
      }, delay);
    });

    revalidatePath("/prepara");
    revalidatePath("/gestione-ordini");
    revalidatePath("/cameriere");
    revalidatePath("/cameriere/conti");
    revalidatePath("/cameriere/ordini-in-corso");
    revalidatePath("/cassa");
    revalidatePath("/supervisore");

    return { success: true, ordinazione: serializeDecimalData(ordinazione) };
  } catch (error: any) {
    console.error("Errore aggiornamento stato:", error.message);
    return { success: false, error: "Errore interno del server" };
  }
}

export async function aggiornaStatoRiga(
  rigaId: string, 
  nuovoStato: StatoRiga
) {
  try {
    const utente = await getCurrentUser();
    if (!utente) {
      return { success: false, error: "Utente non autenticato" };
    }

    const result = await prisma.$transaction(async (tx) => {
      const rigaCorrente = await tx.rigaOrdinazione.findUnique({
        where: { id: rigaId },
        include: {
          Ordinazione: {
            include: {
              Tavolo: true
            }
          },
          Prodotto: true
        }
      });

      if (!rigaCorrente) {
        return { success: false, error: "Riga ordinazione non trovata" };
      }

      const riga = await tx.rigaOrdinazione.update({
        where: { id: rigaId },
        data: {
          stato: nuovoStato,
          timestampInizio: nuovoStato === "IN_LAVORAZIONE" ? new Date() : rigaCorrente.timestampInizio,
          timestampPronto: nuovoStato === "PRONTO" ? new Date() : rigaCorrente.timestampPronto,
          timestampConsegna: nuovoStato === "CONSEGNATO" ? new Date() : rigaCorrente.timestampConsegna,
        },
        include: {
          Ordinazione: {
            include: {
              Tavolo: true
            }
          },
          Prodotto: true
        }
      });

      return { success: true, riga: serializeDecimalData(riga) };
    }, {
      timeout: 10000, // 10 secondi
      maxWait: 5000   // Massimo tempo di attesa per acquisire il lock
    });

    if (!result.success) {
      return result;
    }

    if (result.riga) {
      ordersSyncService.updateItemStatus(
        result.riga.ordinazioneId, 
        result.riga.id, 
        nuovoStato
      );
      
      const prepCache = getStationCache(StationType.PREPARA);
      const cameriereCache = getStationCache(StationType.CAMERIERE);
      
      prepCache.clear(`order:${result.riga.ordinazioneId}`);
      cameriereCache.clear(`order:${result.riga.ordinazioneId}`);
    }

    if (result.riga) {
      const tableNumber = result.riga.Ordinazione.Tavolo ? parseInt(result.riga.Ordinazione.Tavolo.numero) : undefined;
      
      notificationManager.notifyItemStatusChange(
        result.riga.Ordinazione.id,
        result.riga.id,
        nuovoStato,
        result.riga.Prodotto.nome,
        tableNumber
      );
      
      sseService.emit('order:item:update', {
        itemId: result.riga.id,
        orderId: result.riga.Ordinazione.id,
        status: nuovoStato as 'INSERITO' | 'IN_LAVORAZIONE' | 'PRONTO' | 'CONSEGNATO',
        previousStatus: result.riga.stato,
        timestamp: new Date().toISOString()
      });
    }

    revalidatePath("/prepara");
    revalidatePath("/cucina");
    revalidatePath("/cameriere");
    revalidatePath("/supervisore");

    return result;
  } catch (error: any) {
    console.error("Errore aggiornamento riga:", error.message);
    return { success: false, error: "Errore interno del server" };
  }
}

export async function completaTuttiGliItems(ordinazioneId: string) {
  try {
    const utente = await getCurrentUser();
    if (!utente) {
      return { success: false, error: "Utente non autenticato" };
    }

    const result = await prisma.$transaction(async (tx) => {
      const ordinazione = await tx.ordinazione.findUnique({
        where: { id: ordinazioneId },
        include: {
          RigaOrdinazione: true,
          Tavolo: true
        }
      });

      if (!ordinazione) {
        return { success: false, error: "Ordinazione non trovata" };
      }

      if (ordinazione.stato === 'PRONTO' || ordinazione.stato === 'CONSEGNATO') {
        console.log(`[completaTuttiGliItems] Ordine ${ordinazioneId} già in stato ${ordinazione.stato}, skip aggiornamento`);
        return { success: true, ordinazione, skipped: true };
      }

      const itemsAggiornati = await tx.rigaOrdinazione.updateMany({
        where: {
          ordinazioneId: ordinazioneId,
          stato: {
            notIn: ['PRONTO', 'CONSEGNATO', 'ANNULLATO']
          }
        },
        data: {
          stato: 'PRONTO',
          timestampInizio: new Date(),
          timestampPronto: new Date()
        }
      });

      if (itemsAggiornati.count > 0 || ordinazione.stato !== ('PRONTO' as any)) {
        const ordinazioneDaAggiornare = await tx.ordinazione.findFirst({
          where: { 
            id: ordinazioneId,
            stato: { notIn: ['PRONTO', 'CONSEGNATO'] }
          }
        });

        if (ordinazioneDaAggiornare) {
          const ordinazioneAggiornata = await tx.ordinazione.update({
            where: { id: ordinazioneId },
            data: { stato: 'PRONTO' },
            include: { Tavolo: true }
          });
          return { success: true, ordinazione: ordinazioneAggiornata };
        }
      }

      return { success: true, ordinazione, noChanges: true };
    }, {
      isolationLevel: 'Serializable',
      timeout: 15000, // Aumentato a 15 secondi
      maxWait: 5000    // Massimo tempo di attesa per acquisire il lock
    });

    if (!result.success) {
      return result;
    }

    if (result.ordinazione) {
      notificationManager.notifyOrderReady({
        orderId: result.ordinazione.id,
        tableNumber: result.ordinazione.tavoloId && result.ordinazione.Tavolo ? parseInt(result.ordinazione.Tavolo.numero) : undefined,
        orderType: result.ordinazione.tipo
      });

      sseService.emit('order:ready', {
        orderId: result.ordinazione.id,
        orderNumber: result.ordinazione.numero,
        tableNumber: result.ordinazione.tavoloId && result.ordinazione.Tavolo ? parseInt(result.ordinazione.Tavolo.numero) : undefined,
        readyItems: [],
        timestamp: new Date().toISOString()
      });
    }

    ordersCache.remove(ordinazioneId);
    await ordersSyncService.syncOrder(ordinazioneId);

    revalidatePath("/prepara");
    revalidatePath("/cameriere");
    revalidatePath("/supervisore");

    return { success: true, message: "Tutti gli items sono stati completati" };
  } catch (error: any) {
    console.error("Errore completamento items:", error.message, error);
    
    if (error.code === 'P2002') {
      return { success: false, error: "Conflitto di aggiornamento. Riprova tra qualche istante." };
    }
    
    if (error.code === 'P2025') {
      return { success: false, error: "Ordine non trovato o già aggiornato." };
    }
    
    if (error.message?.includes('timeout')) {
      return { success: false, error: "Operazione scaduta. Riprova." };
    }
    
    return { success: false, error: error.message || "Errore durante il completamento degli items" };
  }
}

export async function segnaOrdineRitirato(ordinazioneId: string) {
  try {
    const utente = await getCurrentUser();
    if (!utente) {
      return { success: false, error: "Utente non autenticato" };
    }

    const result = await prisma.$transaction(async (tx) => {
      const ordinazione = await tx.ordinazione.findUnique({
        where: { id: ordinazioneId },
        include: {
          Tavolo: true,
          RigaOrdinazione: true
        }
      });

      if (!ordinazione) {
        return { success: false, error: "Ordinazione non trovata" };
      }

      if (ordinazione.stato !== 'PRONTO') {
        const tuttiPronti = ordinazione.RigaOrdinazione.every(
          riga => riga.stato === 'PRONTO' || riga.stato === 'CONSEGNATO' || riga.stato === 'ANNULLATO'
        );
        
        if (tuttiPronti) {
          await tx.ordinazione.update({
            where: { id: ordinazioneId },
            data: { stato: 'PRONTO' }
          });
        } else {
          return { success: false, error: "L'ordinazione non è pronta per il ritiro" };
        }
      }

      console.log(`🔄 Aggiornamento ordine ${ordinazioneId}: stato=${ordinazione.stato} -> CONSEGNATO, statoPagamento=${ordinazione.statoPagamento}`);
      
      const ordinazioneAggiornata = await tx.ordinazione.update({
        where: { id: ordinazioneId },
        data: {
          stato: 'CONSEGNATO',
          dataChiusura: new Date()
        }
      });

      await tx.rigaOrdinazione.updateMany({
        where: { 
          ordinazioneId: ordinazioneId,
          stato: { not: 'CONSEGNATO' }
        },
        data: {
          stato: 'CONSEGNATO',
          timestampConsegna: new Date()
        }
      });

      return { success: true, ordinazione: ordinazioneAggiornata };
    }, {
      timeout: 15000, // Aumentato a 15 secondi
      maxWait: 5000   // Massimo tempo di attesa per acquisire il lock
    });

    if (!result.success) {
      return result;
    }

    const ordinazione = await prisma.ordinazione.findUnique({
      where: { id: ordinazioneId },
      include: { Tavolo: true }
    });

    if (ordinazione) {
      notificationManager.notifyOrderDelivered({
        orderId: ordinazione.id,
        tableNumber: ordinazione.Tavolo ? parseInt(ordinazione.Tavolo.numero) : undefined,
        orderType: ordinazione.tipo,
        amount: parseFloat(ordinazione.totale.toString())
      });

      const eventData = {
        orderId: ordinazione.id,
        orderNumber: ordinazione.numero,
        tableNumber: ordinazione.Tavolo ? parseInt(ordinazione.Tavolo.numero) : undefined,
        deliveredBy: utente.nome,
        timestamp: new Date().toISOString()
      };
      
      sseService.emit('order:delivered', eventData, {
        tenantId: utente.tenantId,
        broadcast: true,
        queueIfOffline: true
      });
      
      const delays = [100, 500, 1000];
      delays.forEach(delay => {
        setTimeout(() => {
          sseService.emit('order:delivered', eventData, {
            tenantId: utente.tenantId,
            broadcast: true
          });
        }, delay);
      });
    }

    ordersCache.remove(ordinazioneId);
    await ordersSyncService.syncOrder(ordinazioneId);
    
    revalidatePath("/prepara");
    revalidatePath("/cameriere");
    revalidatePath("/cassa");
    revalidatePath("/supervisore");

    return { success: true, message: "Ordine segnato come ritirato" };
  } catch (error: any) {
    console.error("Errore ritiro ordine:", error.message);
    return { success: false, error: "Errore durante il ritiro dell'ordine" };
  }
}

export async function getOrdinazioniPerStato() {
  try {
    const ordinazioni = await prisma.ordinazione.findMany({
      where: {
        stato: {
          in: ['PRONTO', 'CONSEGNATO', 'RICHIESTA_CONTO', 'PAGATO']
        }
      },
      include: {
        RigaOrdinazione: {
          include: {
            Prodotto: true
          }
        },
        Tavolo: true,
        User: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return ordinazioni;
  } catch (error: any) {
    console.error("Errore recupero ordinazioni:", error.message);
    return [];
  }
}