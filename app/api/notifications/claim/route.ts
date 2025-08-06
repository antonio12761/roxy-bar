import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { checkAuth } from '@/lib/auth';
import { sseService } from '@/lib/sse/sse-service';

export async function POST(request: NextRequest) {
  try {
    const user = await checkAuth();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Non autorizzato' },
        { status: 401 }
      );
    }

    const { notificationId, userId, userName } = await request.json();

    if (!notificationId) {
      return NextResponse.json(
        { error: 'ID notifica mancante' },
        { status: 400 }
      );
    }

    // Check if notification is already claimed
    const existingClaim = await prisma.notificationClaim.findUnique({
      where: { notificationId },
    });

    if (existingClaim) {
      return NextResponse.json(
        { error: 'Notifica già presa in carico', claimedBy: existingClaim.claimedBy },
        { status: 409 }
      );
    }

    // Create claim record
    const claim = await prisma.notificationClaim.create({
      data: {
        id: crypto.randomUUID(),
        notificationId,
        claimedBy: userName || user.nome || 'Unknown',
        claimedById: userId || user.id,
        claimedAt: new Date(),
      },
    });

    // Log the action
    await prisma.auditLog.create({
      data: {
        id: crypto.randomUUID(),
        action: 'NOTIFICATION_CLAIMED',
        entityType: 'SYSTEM',
        entityId: notificationId,
        tenantId: user.tenantId || 'default',
        userId: user.id,
        metadata: {
          notificationId,
          claimedBy: claim.claimedBy,
        },
      },
    });

    // Emit SSE event to update all connected clients
    sseService.emit('out-of-stock:claimed', {
      notificationId,
      claimedBy: claim.claimedBy,
      claimedAt: claim.claimedAt,
    }, {
      broadcast: true,
    });

    return NextResponse.json({
      success: true,
      claim,
    });
  } catch (error) {
    console.error('Error claiming notification:', error);
    return NextResponse.json(
      { error: 'Errore nel prendere in carico la notifica' },
      { status: 500 }
    );
  }
}