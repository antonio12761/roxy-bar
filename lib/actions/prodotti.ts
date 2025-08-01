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
            in: ['INSERITO', 'IN_LAVORAZIONE']
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

      // Group by order status for different notifications
      const orderedItems = activeOrdersWithProduct.filter(item => item.stato === 'INSERITO');
      const inPreparationItems = activeOrdersWithProduct.filter(item => item.stato === 'IN_LAVORAZIONE');

      // Emit specific events for affected orders
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
    
    console.log('[Prodotti] Emitting SSE event product:availability:', eventData);
    
    // Emit immediately with broadcast to all clients
    sseService.emit('product:availability', eventData, { 
      broadcast: true, 
      skipRateLimit: true,
      tenantId: user.tenantId,
      queueIfOffline: true
    });
    
    // Also emit with multiple delays to catch reconnecting clients
    const delays = [100, 250, 500, 1000, 2000];
    delays.forEach(delay => {
      setTimeout(() => {
        sseService.emit('product:availability', eventData, { 
          broadcast: true, 
          skipRateLimit: true,
          tenantId: user.tenantId
        });
      }, delay);
    });

    // Revalidate all pages that might show products
    revalidatePath('/cameriere');
    revalidatePath('/cameriere/nuova-ordinazione');
    revalidatePath('/cameriere/tavolo/[id]', 'page');
    revalidatePath('/prepara');
    
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