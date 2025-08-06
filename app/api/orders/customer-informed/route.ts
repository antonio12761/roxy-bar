import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { checkAuth } from '@/lib/auth';

export async function PUT(request: NextRequest) {
  try {
    const user = await checkAuth();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Non autorizzato' },
        { status: 401 }
      );
    }

    const { orderId, informed, informedBy, informedAt } = await request.json();

    if (!orderId) {
      return NextResponse.json(
        { error: 'ID ordine mancante' },
        { status: 400 }
      );
    }

    // Update order with customer informed status
    const updatedOrder = await prisma.ordinazione.update({
      where: { id: orderId },
      data: {
        customerInformed: informed ?? true,
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
    const sseManager = (global as any).sseManager;
    if (sseManager) {
      sseManager.broadcast({
        type: 'customer:informed',
        data: {
          orderId,
          orderNumber: updatedOrder.numero,
          table: updatedOrder.Tavolo?.numero,
          informedBy: updatedOrder.customerInformedBy,
          informedAt: updatedOrder.customerInformedAt,
        },
      });
    }

    return NextResponse.json({
      success: true,
      order: updatedOrder,
      message: 'Cliente informato con successo',
    });
  } catch (error) {
    console.error('Error marking customer as informed:', error);
    return NextResponse.json(
      { error: 'Errore nell\'aggiornamento dello stato' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await checkAuth();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Non autorizzato' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');

    if (!orderId) {
      return NextResponse.json(
        { error: 'ID ordine mancante' },
        { status: 400 }
      );
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
      return NextResponse.json(
        { error: 'Ordine non trovato' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      order,
    });
  } catch (error) {
    console.error('Error fetching customer informed status:', error);
    return NextResponse.json(
      { error: 'Errore nel recupero dello stato' },
      { status: 500 }
    );
  }
}