import { NextRequest, NextResponse } from 'next/server';
import { sseService } from '@/lib/sse/sse-service';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth-multi-tenant';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    
    // Find a recent order
    const order = await prisma.ordinazione.findFirst({
      where: {
        stato: { notIn: ['ANNULLATO', 'PAGATO'] }
      },
      include: {
        Tavolo: true,
        RigaOrdinazione: {
          include: {
            Prodotto: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    if (!order) {
      return NextResponse.json({ error: 'No active orders found' }, { status: 404 });
    }
    
    // Emit test event
    const eventData = {
      orderId: order.id,
      orderNumber: order.numero,
      tableNumber: order.Tavolo?.numero || 'Asporto',
      outOfStockItems: order.RigaOrdinazione.slice(0, 1).map(item => ({
        id: item.id,
        productName: item.Prodotto?.nome || 'Test Product',
        quantity: item.quantita
      })),
      timestamp: new Date().toISOString()
    };
    
    console.log('[TEST] Emitting order:esaurito:alert event:', eventData);
    
    // Emit with targetStations for CAMERIERE and PREPARA
    sseService.emit('order:esaurito:alert', eventData, {
      broadcast: true,
      skipRateLimit: true,
      tenantId: user.tenantId,
      targetStations: ['CAMERIERE', 'PREPARA']
    });
    
    return NextResponse.json({
      success: true,
      message: 'Test event emitted',
      eventData
    });
    
  } catch (error) {
    console.error('[TEST] Error:', error);
    return NextResponse.json({ 
      error: 'Failed to emit test event',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}