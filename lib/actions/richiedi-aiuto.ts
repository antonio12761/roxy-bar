"use server";

import { sseService, emitSSE } from "@/lib/sse/sse-service";
import { getCurrentUser } from "@/lib/auth-multi-tenant";
import { prisma } from "@/lib/db";

interface HelpRequest {
  tipo: 'URGENTE' | 'NORMALE' | 'BASSA_PRIORITA';
  destinatari: ('CAMERIERI' | 'CUCINA' | 'TUTTI')[];
  tavolo?: string;
  messaggio: string;
}

export async function inviaRichiestaAiuto(request: HelpRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { success: false, error: "Utente non autenticato" };
    }
    const userId = currentUser.id;
    
    // Get the current user's name
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    if (!user) {
      return { success: false, error: "Utente non trovato" };
    }
    
    // Prepare notification data
    const notificationData = {
      tipo: request.tipo,
      messaggio: request.messaggio,
      tavolo: request.tavolo || null,
      mittente: user.nome,
      timestamp: new Date().toISOString()
    };
    
    // Send notifications based on recipients
    if (request.destinatari.includes('TUTTI')) {
      // Send to all connected clients
      await emitSSE('help:requested', {
        ...notificationData,
        destinatari: 'TUTTI'
      });
    } else {
      // Send to specific groups
      if (request.destinatari.includes('CAMERIERI')) {
        await emitSSE('help:requested:camerieri', {
          ...notificationData,
          destinatari: 'CAMERIERI'
        });
      }
      
      if (request.destinatari.includes('CUCINA')) {
        await emitSSE('help:requested:cucina', {
          ...notificationData,
          destinatari: 'CUCINA'
        });
      }
    }
    
    // Log the help request in database (optional)
    await prisma.$executeRaw`
      INSERT INTO notifiche_aiuto (mittente_id, tipo, messaggio, tavolo, destinatari, created_at)
      VALUES (${user.id}, ${request.tipo}, ${request.messaggio}, ${request.tavolo}, ${request.destinatari.join(',')}, NOW())
    `.catch(() => {
      // Ignore if table doesn't exist
      console.log("Notifiche aiuto table not found, skipping log");
    });
    
    return { 
      success: true, 
      message: "Richiesta di aiuto inviata con successo" 
    };
  } catch (error) {
    console.error("Error sending help request:", error);
    return { success: false, error: "Errore nell'invio della richiesta di aiuto" };
  }
}