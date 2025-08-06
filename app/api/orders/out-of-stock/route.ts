import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { checkAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await checkAuth();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Non autorizzato' },
        { status: 401 }
      );
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
    const formattedOrders = outOfStockOrders.map(order => {
      const claim = claimsMap.get(order.id);
      const outOfStockItems = order.RigaOrdinazione.filter((item: any) => item.esaurito);
      
      return {
        id: order.id,
        numeroOrdine: order.numero,
        timestamp: order.createdAt,
        tavolo: order.Tavolo?.numero || 'N/A',
        nomeCliente: order.nomeCliente,
        stato: order.stato,
        outOfStockItems: outOfStockItems.map((item: any) => ({
          id: item.id,
          nome: item.Prodotto?.nome || item.nomeProdotto,
          quantita: item.quantita,
          prezzo: item.prezzo,
        })),
        claimedBy: claim?.claimedBy,
        claimedAt: claim?.claimedAt,
        totalAmount: order.RigaOrdinazione.reduce((sum: any, item: any) => 
          sum + (item.quantita * item.prezzo), 0
        ),
      };
    });

    return NextResponse.json({
      success: true,
      orders: formattedOrders,
      total: formattedOrders.length,
    });
  } catch (error) {
    console.error('Error fetching out-of-stock orders:', error);
    return NextResponse.json(
      { error: 'Errore nel recupero degli ordini esauriti' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await checkAuth();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Non autorizzato' },
        { status: 401 }
      );
    }

    const { orderId, action } = await request.json();

    if (!orderId || !action) {
      return NextResponse.json(
        { error: 'Parametri mancanti' },
        { status: 400 }
      );
    }

    if (action === 'restore') {
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

      return NextResponse.json({
        success: true,
        order: updatedOrder,
      });
    }

    return NextResponse.json(
      { error: 'Azione non valida' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error updating out-of-stock order:', error);
    return NextResponse.json(
      { error: 'Errore nell\'aggiornamento dell\'ordine' },
      { status: 500 }
    );
  }
}