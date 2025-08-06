"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-multi-tenant";
import { revalidatePath } from "next/cache";
import { sseService } from "@/lib/sse/sse-service";
import { serializeDecimalData } from "@/lib/utils/decimal-serializer";

export async function toggleProductAvailability(productId: number, available: boolean) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Non autenticato" };
    }

    const updatedProduct = await prisma.prodotto.update({
      where: { id: productId },
      data: { disponibile: available }
    });

    // If product is now unavailable, check for active orders
    if (!available) {
      // Remove from recent products
      await prisma.prodottoRecente.deleteMany({
        where: { prodottoId: productId }
      });

      // Check for active orders containing this product
      const activeOrdersWithProduct = await prisma.rigaOrdinazione.findMany({
        where: {
          prodottoId: productId,
          stato: {
            in: ['INSERITO', 'IN_LAVORAZIONE', 'PRONTO']
          }
        },
        include: {
          Ordinazione: {
            include: {
              Tavolo: true,
              User: true
            }
          },
          Prodotto: true
        }
      });

      console.log(`[toggleProductAvailability] Found ${activeOrdersWithProduct.length} active orders with product ${productId} (${updatedProduct.nome})`);

      // Group by order status for different notifications
      const orderedItems = activeOrdersWithProduct.filter(item => 
        item.stato === 'INSERITO'
      );
      const inPreparationItems = activeOrdersWithProduct.filter(item => 
        item.stato === 'IN_LAVORAZIONE' || item.stato === 'PRONTO'
      );

      // Emit order:esaurito:alert for each affected order - THIS IS THE KEY EVENT
      const uniqueOrders = new Map();
      activeOrdersWithProduct.forEach(item => {
        if (!uniqueOrders.has(item.ordinazioneId)) {
          uniqueOrders.set(item.ordinazioneId, {
            order: item.Ordinazione,
            items: []
          });
        }
        uniqueOrders.get(item.ordinazioneId).items.push(item);
      });

      // Emit alert for each unique order
      for (const [orderId, data] of uniqueOrders) {
        const { order, items } = data;
        
        console.log(`[toggleProductAvailability] Emitting order:esaurito:alert for order ${order.numero}`);
        
        sseService.emit('order:esaurito:alert', {
          orderId: order.id,
          orderNumber: order.numero,
          tableNumber: order.Tavolo?.numero || 0,
          outOfStockItems: items.map((item: any) => ({
            id: item.id,
            productName: item.Prodotto.nome,
            quantity: item.quantita
          })),
          timestamp: new Date().toISOString()
        }, {
          broadcast: true,
          skipRateLimit: true,
          tenantId: user.tenantId,
          targetStations: ['CAMERIERE', 'PREPARA']
        });
      }

      // Emit specific events for affected orders (keeping backward compatibility)
      if (orderedItems.length > 0) {
        sseService.emit('product:unavailable-in-order', {
          productId: updatedProduct.id,
          productName: updatedProduct.nome,
          affectedOrders: orderedItems.map(item => ({
            orderId: item.ordinazioneId,
            orderNumber: item.Ordinazione!.numero,
            tableNumber: item.Ordinazione!.Tavolo?.numero,
            itemId: item.id,
            quantity: item.quantita,
            status: 'INSERITO'
          })),
          timestamp: new Date().toISOString()
        }, {
          broadcast: true,
          skipRateLimit: true,
          tenantId: user.tenantId
        });
      }

      if (inPreparationItems.length > 0) {
        // Urgent notification for items already in preparation
        sseService.emit('product:unavailable-urgent', {
          productId: updatedProduct.id,
          productName: updatedProduct.nome,
          affectedOrders: inPreparationItems.map(item => ({
            orderId: item.ordinazioneId,
            orderNumber: item.Ordinazione!.numero,
            tableNumber: item.Ordinazione!.Tavolo?.numero,
            itemId: item.id,
            quantity: item.quantita,
            waiterName: item.Ordinazione!.User?.nome,
            status: 'IN_LAVORAZIONE'
          })),
          timestamp: new Date().toISOString()
        }, {
          broadcast: true,
          skipRateLimit: true,
          tenantId: user.tenantId
        });
      }
    }

    // Emit SSE event for product availability change
    const eventData = {
      productId: updatedProduct.id,
      productName: updatedProduct.nome,
      available: available,
      updatedBy: user?.nome || 'Sistema',
      timestamp: new Date().toISOString()
    };
    
    // Emit immediately with broadcast to all clients
    sseService.emit('product:availability', eventData, { 
      broadcast: true, 
      skipRateLimit: true,
      tenantId: user.tenantId,
      queueIfOffline: true
    });
    
    // Emit multiple times with delays to catch reconnecting clients
    // This is the same pattern used for orders that works
    const delays = [100, 250, 500, 1000, 2000];
    delays.forEach(delay => {
      setTimeout(() => {
        sseService.emit('product:availability', eventData, { 
          broadcast: true, 
          skipRateLimit: true,
          tenantId: user.tenantId,
          queueIfOffline: true
        });
      }, delay);
    });

    // Don't revalidate - let SSE handle the updates
    // This prevents SSE disconnections
    // revalidatePath('/cameriere');
    // revalidatePath('/cameriere/nuova-ordinazione');
    // revalidatePath('/cameriere/tavolo/[id]', 'page');
    // revalidatePath('/prepara');
    
    return { 
      success: true, 
      product: serializeDecimalData(updatedProduct),
      message: available ? 'Prodotto reso disponibile' : 'Prodotto segnato come esaurito'
    };
  } catch (error) {
    console.error("Errore aggiornamento disponibilità prodotto:", error);
    return { success: false, error: "Errore nell'aggiornamento della disponibilità" };
  }
}

export async function makeAllProductsAvailable() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Non autenticato" };
    }

    // Aggiorna tutti i prodotti non disponibili a disponibili
    const result = await prisma.prodotto.updateMany({
      where: { 
        disponibile: false
      },
      data: { disponibile: true }
    });

    // Emetti evento SSE per aggiornamento globale
    sseService.emit('products:all-available', {
      timestamp: new Date().toISOString()
    }, {
      broadcast: true,
      skipRateLimit: true,
      tenantId: user.tenantId,
      targetStations: ['CAMERIERE', 'PREPARA', 'CUCINA', 'BAR']
    });

    // Revalida i percorsi necessari
    revalidatePath('/prepara');
    revalidatePath('/cameriere');
    
    return { 
      success: true, 
      count: result.count,
      message: `${result.count} prodotti resi disponibili`
    };
  } catch (error) {
    console.error("Errore nel rendere disponibili tutti i prodotti:", error);
    return { success: false, error: "Errore nell'aggiornamento della disponibilità" };
  }
}