"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-multi-tenant";
import { revalidatePath } from "next/cache";
import { secureLog } from "@/lib/utils/log-sanitizer";
import { emitOrderUpdate, emitOrderReady, emitNotification, sseService } from "@/lib/sse/sse-service";

export async function notifyOrderUpdate(
  orderId: string,
  status: string,
  previousStatus?: string,
  updatedBy?: string
) {
  return emitOrderUpdate(orderId, status, previousStatus, updatedBy);
}

export async function notifyOrderReady(
  orderId: string,
  tableNumber: number | undefined,
  readyItems: string[]
) {
  return emitOrderReady(orderId, tableNumber, readyItems);
}

export async function sendNotification(
  title: string,
  message: string,
  priority: 'low' | 'normal' | 'high' | 'urgent' = 'normal',
  targetRoles?: string[],
  requiresAcknowledgment?: boolean
) {
  return emitNotification(title, message, priority, targetRoles, requiresAcknowledgment);
}

export interface NotificationClaim {
  id: string;
  notificationId: string;
  claimedBy: string;
  claimedById: string;
  claimedAt: Date;
}

/**
 * Rivendica una notifica (presa in carico)
 */
export async function claimNotification(
  notificationId: string,
  userId?: string,
  userName?: string
) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return { 
        success: false, 
        error: "Non autorizzato" 
      };
    }

    if (!notificationId) {
      return {
        success: false,
        error: "ID notifica mancante"
      };
    }

    // Check if notification is already claimed
    const existingClaim = await prisma.notificationClaim.findUnique({
      where: { notificationId },
    });

    if (existingClaim) {
      return {
        success: false,
        error: "Notifica già presa in carico",
        data: { claimedBy: existingClaim.claimedBy }
      };
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

    // Revalidate pages
    revalidatePath('/prepara');
    revalidatePath('/cameriere');
    revalidatePath('/supervisore');

    return {
      success: true,
      data: claim as NotificationClaim
    };
  } catch (error) {
    secureLog.error('Error claiming notification:', error);
    return { 
      success: false, 
      error: 'Errore nel prendere in carico la notifica' 
    };
  }
}

/**
 * Rilascia una notifica precedentemente rivendicata
 */
export async function releaseNotificationClaim(notificationId: string) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return { 
        success: false, 
        error: "Non autorizzato" 
      };
    }

    // Find existing claim
    const existingClaim = await prisma.notificationClaim.findUnique({
      where: { notificationId },
    });

    if (!existingClaim) {
      return {
        success: false,
        error: "Notifica non trovata o non rivendicata"
      };
    }

    // Delete claim record
    await prisma.notificationClaim.delete({
      where: { notificationId }
    });

    // Log the action
    await prisma.auditLog.create({
      data: {
        id: crypto.randomUUID(),
        action: 'NOTIFICATION_RELEASED',
        entityType: 'SYSTEM',
        entityId: notificationId,
        tenantId: user.tenantId || 'default',
        userId: user.id,
        metadata: {
          notificationId,
          previouslyClaimedBy: existingClaim.claimedBy,
        },
      },
    });

    // Emit SSE event to update all connected clients
    sseService.emit('out-of-stock:released', {
      notificationId,
      releasedBy: user.nome || 'Unknown',
      releasedAt: new Date(),
    }, {
      broadcast: true,
    });

    // Revalidate pages
    revalidatePath('/prepara');
    revalidatePath('/cameriere');
    revalidatePath('/supervisore');

    return {
      success: true,
      message: 'Notifica rilasciata con successo'
    };
  } catch (error) {
    secureLog.error('Error releasing notification:', error);
    return { 
      success: false, 
      error: 'Errore nel rilasciare la notifica' 
    };
  }
}

/**
 * Recupera tutte le notifiche rivendicate
 */
export async function getClaimedNotifications() {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return { 
        success: false, 
        error: "Non autorizzato" 
      };
    }

    const claims = await prisma.notificationClaim.findMany({
      orderBy: { claimedAt: 'desc' }
    });

    return {
      success: true,
      data: claims as NotificationClaim[]
    };
  } catch (error) {
    secureLog.error('Error getting claimed notifications:', error);
    return { 
      success: false, 
      error: 'Errore nel recupero delle notifiche rivendicate' 
    };
  }
}

/**
 * Recupera i dettagli di una notifica rivendicata
 */
export async function getNotificationClaim(notificationId: string) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return { 
        success: false, 
        error: "Non autorizzato" 
      };
    }

    const claim = await prisma.notificationClaim.findUnique({
      where: { notificationId }
    });

    return {
      success: true,
      data: claim as NotificationClaim | null
    };
  } catch (error) {
    secureLog.error('Error getting notification claim:', error);
    return { 
      success: false, 
      error: 'Errore nel recupero della rivendicazione' 
    };
  }
}