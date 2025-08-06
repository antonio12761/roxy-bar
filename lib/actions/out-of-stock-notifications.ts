'use server';

import { prisma } from '@/lib/db';
import { sseService } from '@/lib/sse/sse-service';
import { getCurrentUser } from '@/lib/auth-multi-tenant';
import { nanoid } from 'nanoid';

export interface OutOfStockNotificationData {
  id: string;
  orderId: string;
  orderNumber: number;
  itemId: string;
  itemName: string;
  quantity: number;
  table: string;
  customerName: string;
  timestamp: Date;
  claimedBy?: string;
  claimedAt?: Date;
}

export async function emitOutOfStockNotification(
  orderId: string,
  itemId: string,
  itemName: string,
  quantity: number,
  table: string,
  customerName: string
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Non autenticato" };
    }

    // Create notification data
    const notification: OutOfStockNotificationData = {
      id: `osn_${Date.now()}_${nanoid(9)}`,
      orderId,
      orderNumber: 0, // Will be populated from order
      itemId,
      itemName,
      quantity,
      table,
      customerName,
      timestamp: new Date(),
    };

    // Get order number
    const order = await prisma.ordinazione.findUnique({
      where: { id: orderId },
      select: { numero: true }
    });
    
    if (order) {
      notification.orderNumber = order.numero;
    }

    // Emit SSE event to all connected waiters
    sseService.emit('out-of-stock:notification', notification, {
      broadcast: true,
      skipRateLimit: true,
      tenantId: user.tenantId
    });

    // Store the notification in database
    await prisma.notifica.create({
      data: {
        id: notification.id,
        tipo: 'SISTEMA' as any,
        titolo: 'Prodotto Esaurito',
        messaggio: `${itemName} (x${quantity}) esaurito per Tavolo ${table}`,
        destinazione: 'CAMERIERI',
        ordinazioneId: orderId,
        rigaId: itemId,
        data: JSON.stringify(notification)
      },
    });

    return { success: true, notificationId: notification.id };
  } catch (error) {
    console.error('Error emitting out-of-stock notification:', error);
    return { success: false, error: 'Failed to emit notification' };
  }
}

export async function claimOutOfStockNotification(
  notificationId: string,
  claimerName: string
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Non autenticato" };
    }

    // Update notification in database
    const notification = await prisma.notifica.findUnique({
      where: { id: notificationId }
    });

    if (!notification) {
      return { success: false, error: 'Notifica non trovata' };
    }

    // Parse the notification data
    const data = JSON.parse(notification.data || '{}') as OutOfStockNotificationData;
    
    // Check if already claimed
    if (data.claimedBy) {
      return { success: false, error: `Già gestito da ${data.claimedBy}` };
    }

    // Update with claim info
    data.claimedBy = claimerName;
    data.claimedAt = new Date();

    // Update notification in database
    await prisma.notifica.update({
      where: { id: notificationId },
      data: {
        letta: true,
        data: JSON.stringify(data)
      }
    });

    // Emit SSE event to notify all waiters that this has been claimed
    sseService.emit('out-of-stock:claimed', {
      notificationId,
      claimedBy: claimerName,
      claimedAt: data.claimedAt
    }, {
      broadcast: true,
      skipRateLimit: true,
      tenantId: user.tenantId
    });

    return { success: true, message: 'Notifica presa in carico' };
  } catch (error) {
    console.error('Error claiming out-of-stock notification:', error);
    return { success: false, error: 'Errore nella presa in carico' };
  }
}

export async function getUnclaimedOutOfStockNotifications() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Non autenticato", notifications: [] };
    }

    // Get unclaimed notifications from last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    const notifications = await prisma.notifica.findMany({
      where: {
        tipo: 'SISTEMA' as any,
        destinazione: 'CAMERIERI',
        createdAt: { gte: fiveMinutesAgo },
        letta: false
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Parse and filter for unclaimed out-of-stock notifications
    const unclaimedNotifications = notifications
      .map(n => {
        try {
          const data = JSON.parse(n.data || '{}') as OutOfStockNotificationData;
          return data.claimedBy ? null : data;
        } catch {
          return null;
        }
      })
      .filter(Boolean) as OutOfStockNotificationData[];

    return {
      success: true,
      notifications: unclaimedNotifications
    };
  } catch (error) {
    console.error('Error fetching unclaimed notifications:', error);
    return {
      success: false,
      error: 'Errore nel recupero delle notifiche',
      notifications: []
    };
  }
}

export async function getOutOfStockOrders(waiterId?: string) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Non autenticato", orders: [] };
    }

    const whereClause: any = {
      stato: 'ORDINATO_ESAURITO' as any,
    };

    if (waiterId) {
      whereClause.cameriereId = waiterId;
    }

    const orders = await prisma.ordinazione.findMany({
      where: whereClause,
      include: {
        RigaOrdinazione: {
          include: {
            Prodotto: true,
          }
        },
        Tavolo: true,
        User: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return {
      success: true,
      orders: orders.map(order => ({
        id: order.id,
        numeroOrdine: order.numero,
        timestamp: order.createdAt,
        tavolo: order.Tavolo?.numero || 'N/A',
        nomeCliente: order.nomeCliente,
        cameriere: order.User?.nome || 'N/A',
        outOfStockItems: order.RigaOrdinazione.map(item => ({
          id: item.id,
          nome: item.Prodotto?.nome || 'Prodotto',
          quantita: item.quantita,
          prezzo: item.prezzo,
        })),
        hasNotificationClaim: false,
      })),
    };
  } catch (error) {
    console.error('Error fetching out-of-stock orders:', error);
    return {
      success: false,
      error: 'Failed to fetch out-of-stock orders',
      orders: [],
    };
  }
}