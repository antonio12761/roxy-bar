"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-multi-tenant";
import { revalidatePath } from "next/cache";
import { secureLog } from "@/lib/utils/log-sanitizer";
import { sseService } from "@/lib/sse/sse-service";
import { Decimal } from "@prisma/client/runtime/library";
import { notifyNewOrder, notifyOrderUpdate } from "@/lib/notifications";

interface OrderItem {
  prodotto: {
    id: string;
    nome: string;
    prezzo: number;
    categoria: string;
  };
  quantita: number;
}

export async function submitOrder(
  tableNumber: number,
  items: OrderItem[]
) {
  try {
    // Simula salvataggio nel database
    console.log("📋 Nuovo ordine:", {
      tavolo: tableNumber,
      articoli: items,
      totale: items.reduce((sum, item) => sum + (item.prodotto.prezzo * item.quantita), 0)
    });

    // Invia notifica SSE a cucina/prepara
    notifyNewOrder(tableNumber, items);

    // Simula ID ordine generato
    const orderId = `ORD-${Date.now()}`;
    
    return {
      success: true,
      orderId,
      message: `Ordine inviato per Tavolo ${tableNumber}`
    };

  } catch (error) {
    console.error("Errore invio ordine:", error);
    return {
      success: false,
      error: "Errore durante l'invio dell'ordine"
    };
  }
}

export async function updateOrderStatus(
  orderId: string,
  status: string,
  tableNumber: number
) {
  try {
    console.log("🔄 Aggiornamento ordine:", { orderId, status, tableNumber });

    // Notifica cambio stato
    notifyOrderUpdate(orderId, status, tableNumber);

    return {
      success: true,
      message: `Ordine ${orderId} aggiornato a ${status}`
    };

  } catch (error) {
    console.error("Errore aggiornamento ordine:", error);
    return {
      success: false,
      error: "Errore durante l'aggiornamento dell'ordine"
    };
  }
}

// Simula ordini di test per dimostrare le notifiche
export async function sendTestNotification() {
  const testItems = [
    { prodotto: { id: "1", nome: "Caffè", prezzo: 1.20, categoria: "CAFFETTERIA" }, quantita: 2 },
    { prodotto: { id: "2", nome: "Cornetto", prezzo: 1.50, categoria: "FOOD_SNACKS" }, quantita: 1 }
  ];

  notifyNewOrder(5, testItems);
  
  return { success: true, message: "Notifica di test inviata" };
}

export interface CustomerInformedStatus {
  id: string;
  numero: number;
  customerInformed: boolean;
  customerInformedBy: string | null;
  customerInformedAt: Date | null;
  tavolo: {
    numero: string;
  } | null;
}

export interface OutOfStockOrder {
  id: string;
  numeroOrdine: number;
  timestamp: Date;
  tavolo: string;
  nomeCliente: string | null;
  stato: string;
  outOfStockItems: Array<{
    id: string;
    nome: string;
    quantita: number;
    prezzo: number;
  }>;
  claimedBy?: string;
  claimedAt?: Date;
  totalAmount: number;
}

/**
 * Aggiorna lo stato di "cliente informato" per un ordine
 */
export async function updateCustomerInformedStatus(
  orderId: string,
  informed: boolean = true,
  informedBy?: string,
  informedAt?: Date
) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return { 
        success: false, 
        error: "Non autorizzato" 
      };
    }

    if (!orderId) {
      return {
        success: false,
        error: "ID ordine mancante"
      };
    }

    // Update order with customer informed status
    const updatedOrder = await prisma.ordinazione.update({
      where: { id: orderId },
      data: {
        customerInformed: informed,
        customerInformedBy: informedBy || user.nome || user.id,
        customerInformedAt: informedAt || new Date(),
      },
      include: {
        Tavolo: true,
        RigaOrdinazione: {
          include: {
            Prodotto: true,
          },
        },
      },
    });

    // Log the action
    await prisma.auditLog.create({
      data: {
        id: crypto.randomUUID(),
        action: 'CUSTOMER_INFORMED',
        entityType: 'ORDINAZIONE',
        entityId: orderId,
        tenantId: user.tenantId || 'default',
        userId: user.id,
        metadata: {
          orderId,
          informedBy: updatedOrder.customerInformedBy,
          informedAt: updatedOrder.customerInformedAt,
        },
      },
    });

    // Send SSE event to notify other waiters
    sseService.emit('customer:informed', {
      orderId,
      orderNumber: updatedOrder.numero,
      table: updatedOrder.Tavolo?.numero,
      informedBy: updatedOrder.customerInformedBy,
      informedAt: updatedOrder.customerInformedAt,
    }, {
      broadcast: true,
    });

    // Revalidate pages
    revalidatePath('/cameriere');
    revalidatePath('/prepara');

    return {
      success: true,
      data: updatedOrder,
      message: 'Cliente informato con successo',
    };
  } catch (error) {
    secureLog.error('Error marking customer as informed:', error);
    return { 
      success: false, 
      error: 'Errore nell\'aggiornamento dello stato' 
    };
  }
}

/**
 * Recupera lo stato "cliente informato" di un ordine
 */
export async function getCustomerInformedStatus(orderId: string) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return { 
        success: false, 
        error: "Non autorizzato" 
      };
    }

    if (!orderId) {
      return {
        success: false,
        error: "ID ordine mancante"
      };
    }

    // Get order with customer informed status
    const order = await prisma.ordinazione.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        numero: true,
        customerInformed: true,
        customerInformedBy: true,
        customerInformedAt: true,
        Tavolo: {
          select: {
            numero: true,
          },
        },
      },
    });

    if (!order) {
      return {
        success: false,
        error: "Ordine non trovato"
      };
    }

    return {
      success: true,
      data: order as CustomerInformedStatus,
    };
  } catch (error) {
    secureLog.error('Error fetching customer informed status:', error);
    return { 
      success: false, 
      error: 'Errore nel recupero dello stato' 
    };
  }
}

/**
 * Recupera tutti gli ordini con prodotti esauriti
 */
export async function getOutOfStockOrders() {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return { 
        success: false, 
        error: "Non autorizzato" 
      };
    }

    // Get all orders with out-of-stock items
    const outOfStockOrders = await prisma.ordinazione.findMany({
      where: {
        stato: 'ORDINATO_ESAURITO',
      },
      include: {
        RigaOrdinazione: {
          include: {
            Prodotto: true,
          },
        },
        Tavolo: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Get notification claims for these orders
    const orderIds = outOfStockOrders.map(order => order.id);
    const claims = await prisma.notificationClaim.findMany({
      where: {
        notificationId: {
          in: orderIds,
        },
      },
    });

    // Map claims to orders
    const claimsMap = new Map(claims.map(claim => [claim.notificationId, claim]));

    // Format the response
    const formattedOrders: OutOfStockOrder[] = outOfStockOrders.map(order => {
      const claim = claimsMap.get(order.id);
      const outOfStockItems = order.RigaOrdinazione.filter((item) => item.esaurito);
      
      return {
        id: order.id,
        numeroOrdine: order.numero,
        timestamp: order.createdAt,
        tavolo: order.Tavolo?.numero || 'N/A',
        nomeCliente: order.nomeCliente,
        stato: order.stato,
        outOfStockItems: outOfStockItems.map((item) => ({
          id: item.id,
          nome: item.Prodotto?.nome || item.nomeProdotto,
          quantita: item.quantita,
          prezzo: (item.prezzo as Decimal).toNumber(),
        })),
        claimedBy: claim?.claimedBy,
        claimedAt: claim?.claimedAt,
        totalAmount: order.RigaOrdinazione.reduce((sum, item) => 
          sum + (item.quantita * (item.prezzo as Decimal).toNumber()), 0
        ),
      };
    });

    return {
      success: true,
      data: {
        orders: formattedOrders,
        total: formattedOrders.length,
      }
    };
  } catch (error) {
    secureLog.error('Error fetching out-of-stock orders:', error);
    return { 
      success: false, 
      error: 'Errore nel recupero degli ordini esauriti' 
    };
  }
}

/**
 * Ripristina un ordine con prodotti esauriti
 */
export async function restoreOutOfStockOrder(orderId: string) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return { 
        success: false, 
        error: "Non autorizzato" 
      };
    }

    if (!orderId) {
      return {
        success: false,
        error: "ID ordine mancante"
      };
    }

    // Check if order exists and is in correct state
    const existingOrder = await prisma.ordinazione.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        stato: true,
      }
    });

    if (!existingOrder) {
      return {
        success: false,
        error: "Ordine non trovato"
      };
    }

    if (existingOrder.stato !== 'ORDINATO_ESAURITO') {
      return {
        success: false,
        error: "L'ordine non è in stato ORDINATO_ESAURITO"
      };
    }

    // Restore order to ORDINATO state when stock is available again
    const updatedOrder = await prisma.ordinazione.update({
      where: { id: orderId },
      data: { 
        stato: 'ORDINATO',
      },
    });

    // Update out-of-stock items
    await prisma.rigaOrdinazione.updateMany({
      where: { 
        ordinazioneId: orderId,
        esaurito: true 
      },
      data: { esaurito: false },
    });

    // Log the action
    await prisma.auditLog.create({
      data: {
        id: crypto.randomUUID(),
        action: 'ORDER_RESTORED',
        entityType: 'ORDINAZIONE',
        entityId: orderId,
        tenantId: user.tenantId || 'default',
        userId: user.id,
        metadata: {
          orderId,
          previousState: 'ORDINATO_ESAURITO',
          newState: 'ORDINATO',
        },
      },
    });

    // Send SSE event
    sseService.emit('order:restored', {
      orderId,
      orderNumber: updatedOrder.numero,
      restoredBy: user.nome || user.id,
    }, {
      broadcast: true,
    });

    // Revalidate pages
    revalidatePath('/prepara');
    revalidatePath('/cameriere');
    revalidatePath('/supervisore');

    return {
      success: true,
      data: updatedOrder,
      message: 'Ordine ripristinato con successo'
    };
  } catch (error) {
    secureLog.error('Error restoring out-of-stock order:', error);
    return { 
      success: false, 
      error: 'Errore nel ripristino dell\'ordine' 
    };
  }
}

/**
 * Modifica un ordine con prodotti esauriti
 */
export async function modifyOutOfStockOrder(
  orderId: string,
  itemsToRemove: string[],
  itemsToModify: Array<{ id: string; quantita: number }>
) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return { 
        success: false, 
        error: "Non autorizzato" 
      };
    }

    if (!orderId) {
      return {
        success: false,
        error: "ID ordine mancante"
      };
    }

    // Start transaction
    const result = await prisma.$transaction(async (tx) => {
      // Remove items
      if (itemsToRemove.length > 0) {
        await tx.rigaOrdinazione.deleteMany({
          where: {
            id: { in: itemsToRemove },
            ordinazioneId: orderId,
          }
        });
      }

      // Modify quantities
      for (const item of itemsToModify) {
        await tx.rigaOrdinazione.update({
          where: {
            id: item.id,
            ordinazioneId: orderId,
          },
          data: {
            quantita: item.quantita,
          }
        });
      }

      // Recalculate order total
      const righe = await tx.rigaOrdinazione.findMany({
        where: { ordinazioneId: orderId },
      });

      const newTotal = righe.reduce((sum, riga) => 
        sum + (riga.quantita * (riga.prezzo as Decimal).toNumber()), 0
      );

      // Update order
      const updatedOrder = await tx.ordinazione.update({
        where: { id: orderId },
        data: {
          totale: newTotal,
          stato: righe.length > 0 ? 'ORDINATO' : 'ANNULLATO',
        },
        include: {
          Tavolo: true,
          RigaOrdinazione: {
            include: {
              Prodotto: true,
            }
          }
        }
      });

      return updatedOrder;
    });

    // Log the action
    await prisma.auditLog.create({
      data: {
        id: crypto.randomUUID(),
        action: 'ORDER_MODIFIED',
        entityType: 'ORDINAZIONE',
        entityId: orderId,
        tenantId: user.tenantId || 'default',
        userId: user.id,
        metadata: {
          orderId,
          itemsRemoved: itemsToRemove.length,
          itemsModified: itemsToModify.length,
        },
      },
    });

    // Send SSE event
    sseService.emit('order:modified', {
      orderId,
      orderNumber: result.numero,
      modifiedBy: user.nome || user.id,
    }, {
      broadcast: true,
    });

    // Revalidate pages
    revalidatePath('/prepara');
    revalidatePath('/cameriere');
    revalidatePath('/supervisore');

    return {
      success: true,
      data: result,
      message: 'Ordine modificato con successo'
    };
  } catch (error) {
    secureLog.error('Error modifying out-of-stock order:', error);
    return { 
      success: false, 
      error: 'Errore nella modifica dell\'ordine' 
    };
  }
}

/**
 * Cancella un ordine con prodotti esauriti
 */
export async function cancelOutOfStockOrder(orderId: string, reason?: string) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return { 
        success: false, 
        error: "Non autorizzato" 
      };
    }

    if (!orderId) {
      return {
        success: false,
        error: "ID ordine mancante"
      };
    }

    // Update order status
    const canceledOrder = await prisma.ordinazione.update({
      where: { id: orderId },
      data: {
        stato: 'ANNULLATO',
        note: reason ? `Annullato per: ${reason}` : 'Annullato per prodotti esauriti',
        dataChiusura: new Date(),
      },
      include: {
        Tavolo: true,
      }
    });

    // Log the action
    await prisma.auditLog.create({
      data: {
        id: crypto.randomUUID(),
        action: 'ORDER_CANCELED',
        entityType: 'ORDINAZIONE',
        entityId: orderId,
        tenantId: user.tenantId || 'default',
        userId: user.id,
        metadata: {
          orderId,
          reason: reason || 'Prodotti esauriti',
          canceledBy: user.nome || user.id,
        },
      },
    });

    // Send SSE event
    sseService.emit('order:canceled', {
      orderId,
      orderNumber: canceledOrder.numero,
      table: canceledOrder.Tavolo?.numero,
      canceledBy: user.nome || user.id,
      reason: reason || 'Prodotti esauriti',
    }, {
      broadcast: true,
    });

    // Revalidate pages
    revalidatePath('/prepara');
    revalidatePath('/cameriere');
    revalidatePath('/supervisore');

    return {
      success: true,
      data: canceledOrder,
      message: 'Ordine annullato con successo'
    };
  } catch (error) {
    secureLog.error('Error canceling out-of-stock order:', error);
    return { 
      success: false, 
      error: 'Errore nell\'annullamento dell\'ordine' 
    };
  }
}