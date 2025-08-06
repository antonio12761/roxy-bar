"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-multi-tenant";
import { sseService } from "@/lib/sse/sse-service";
import { revalidatePath } from "next/cache";

export async function takeChargeOfOutOfStockOrder(orderId: string) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Non autenticato" };
    }

    // Cerca l'ordine esaurito nella nuova tabella
    const ordineEsaurito = await prisma.ordineEsaurito.findUnique({
      where: { ordinazioneId: orderId }
    });

    if (!ordineEsaurito) {
      return { success: false, error: "Ordine esaurito non trovato" };
    }

    // Aggiorna il record OrdineEsaurito con chi ha preso in carico
    await prisma.ordineEsaurito.update({
      where: { ordinazioneId: orderId },
      data: {
        stato: 'IN_GESTIONE',
        handledBy: user.id,
        handledByName: user.nome,
        handledAt: new Date()
      }
    });

    // Recupera l'ordine completo per l'evento SSE
    const order = await prisma.ordinazione.findUnique({
      where: { id: orderId },
      include: {
        Tavolo: true,
        RigaOrdinazione: {
          include: {
            Prodotto: true
          }
        }
      }
    });

    if (!order) {
      return { success: false, error: "Ordine non trovato" };
    }

    // Notifica tutti i camerieri che qualcuno ha preso in carico
    // Aggiungi un piccolo delay per dare tempo alla UI locale di aggiornarsi prima
    setTimeout(() => {
      sseService.emit('order:esaurito:taken', {
        orderId: orderId,
        orderNumber: order.numero,
        tableNumber: order.Tavolo?.numero || 'N/A',
        takenBy: user.nome,
        takenById: user.id,
        timestamp: new Date().toISOString()
      }, {
        broadcast: true,
        skipRateLimit: true,
        tenantId: user.tenantId,
        targetStations: ['CAMERIERE', 'PREPARA'] // Notifica camerieri e prepara
      });
    }, 200); // 200ms di delay per permettere all'UI locale di aggiornarsi

    // Log per debug
    console.log(`[ESAURITO] Order ${orderId} taken charge by ${user.nome}`);

    revalidatePath('/cameriere');
    revalidatePath('/prepara');

    return {
      success: true,
      message: `Hai preso in carico l'ordine #${order.numero}`,
      takenBy: user.nome
    };
  } catch (error) {
    console.error('Errore presa in carico ordine esaurito:', error);
    return {
      success: false,
      error: 'Errore nella presa in carico'
    };
  }
}

export async function releaseOutOfStockOrder(orderId: string) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Non autenticato" };
    }

    // Cerca l'ordine esaurito nella nuova tabella
    const ordineEsaurito = await prisma.ordineEsaurito.findUnique({
      where: { ordinazioneId: orderId },
      include: {
        ProdottiEsauriti: true
      }
    });

    if (!ordineEsaurito) {
      return { success: false, error: "Ordine esaurito non trovato" };
    }

    // Ripristina lo stato ad ATTIVO e rimuovi chi lo gestiva
    await prisma.ordineEsaurito.update({
      where: { ordinazioneId: orderId },
      data: {
        stato: 'ATTIVO',
        handledBy: null,
        handledByName: null,
        handledAt: null
      }
    });

    // Recupera l'ordine completo per l'evento SSE
    const order = await prisma.ordinazione.findUnique({
      where: { id: orderId },
      include: {
        Tavolo: true,
        RigaOrdinazione: {
          include: {
            Prodotto: true
          }
        }
      }
    });

    if (!order) {
      return { success: false, error: "Ordine non trovato" };
    }

    // Riemetti la notifica di allarme esaurito per permettere ad altri di prenderla
    const eventData = {
      orderId: order.id,
      orderNumber: order.numero,
      tableNumber: order.Tavolo?.numero || 'N/A',
      products: order.RigaOrdinazione.map((item: any) => ({
        name: item.Prodotto.nome,
        quantity: item.quantita
      })),
      timestamp: new Date().toISOString(),
      needsAttention: true,
      takenBy: null // Nessuno la sta gestendo ora
    };

    // Emetti l'allarme originale
    sseService.emit('order:esaurito:alert', eventData, {
      broadcast: true,
      skipRateLimit: true,
      targetStations: ['CAMERIERE', 'PREPARA'],
      queueIfOffline: true
    });

    // Riemetti con delays per catturare client che si riconnettono
    const delays = [500, 1500, 3000];
    delays.forEach(delay => {
      setTimeout(() => {
        sseService.emit('order:esaurito:alert', eventData, {
          broadcast: true,
          skipRateLimit: true,
          targetStations: ['CAMERIERE', 'PREPARA'],
          queueIfOffline: true
        });
      }, delay);
    });

    // Notifica anche che è stata rilasciata
    sseService.emit('order:esaurito:released', {
      orderId: orderId,
      orderNumber: order.numero,
      tableNumber: order.Tavolo?.numero || '',
      timestamp: new Date().toISOString()
    }, {
      broadcast: true,
      skipRateLimit: true,
      targetStations: ['CAMERIERE', 'PREPARA']
    });

    revalidatePath('/cameriere');
    revalidatePath('/prepara');

    return {
      success: true,
      message: 'Gestione rilasciata - Altri camerieri possono ora prendere in carico'
    };
  } catch (error) {
    console.error('Errore rilascio ordine esaurito:', error);
    return {
      success: false,
      error: 'Errore nel rilascio'
    };
  }
}