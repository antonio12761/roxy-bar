"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-multi-tenant";
import { revalidatePath } from "next/cache";
import { sseService } from "@/lib/sse/sse-service";
import { notificationManager } from "@/lib/notifications/NotificationManager";
import { canRequestCancellation } from "@/lib/middleware/state-validation";
import { nanoid } from "nanoid";

// Helper per autenticazione
async function getAuthenticatedUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Utente non autenticato");
  }
  return user;
}

export interface RichiestaAnnullamentoData {
  ordinazioneId: string;
  motivo: string;
  note?: string;
}

// Crea una richiesta di annullamento per un ordine
export async function creaRichiestaAnnullamento(data: RichiestaAnnullamentoData) {
  try {
    const utente = await getCurrentUser();
    if (!utente) {
      return { success: false, error: "Utente non autenticato" };
    }

    // Verifica che l'ordinazione esista e sia in uno stato che permette annullamento
    const ordinazione = await prisma.ordinazione.findUnique({
      where: { id: data.ordinazioneId },
      include: {
        Tavolo: true,
        User: true
      }
    });

    if (!ordinazione) {
      return { success: false, error: "Ordinazione non trovata" };
    }

    // Verifica se lo stato permette la richiesta di annullamento
    if (!canRequestCancellation(ordinazione.stato)) {
      return { 
        success: false, 
        error: `Non puoi richiedere l'annullamento di un ordine in stato ${ordinazione.stato}` 
      };
    }

    // Crea la richiesta di annullamento
    const richiesta = await prisma.richiestaAnnullamento.create({
      data: {
        id: nanoid(),
        ordinazioneId: data.ordinazioneId,
        richiedenteId: utente.id,
        richiedenteName: utente.nome || utente.id,
        motivo: data.motivo,
        note: data.note,
        statoOrdinazione: ordinazione.stato,
        stato: 'PENDING'
      }
    });

    // Notifica alla stazione di preparazione
    notificationManager.notifyCancellationRequest({
      orderId: ordinazione.id,
      orderNumber: ordinazione.numero,
      tableNumber: ordinazione.Tavolo ? parseInt(ordinazione.Tavolo.numero) : undefined,
      requestedBy: utente.nome || utente.id,
      reason: data.motivo,
      currentStatus: ordinazione.stato
    });

    // Emetti evento SSE
    sseService.emit('order:cancellation-request', {
      requestId: richiesta.id,
      orderId: ordinazione.id,
      tableNumber: ordinazione.Tavolo ? parseInt(ordinazione.Tavolo.numero) : undefined,
      reason: data.motivo,
      requestedBy: utente.nome || utente.id,
      timestamp: new Date().toISOString()
    });

    revalidatePath("/prepara");
    revalidatePath("/supervisore");

    return { 
      success: true, 
      message: "Richiesta di annullamento inviata. In attesa di approvazione.",
      richiestaId: richiesta.id
    };
  } catch (error: any) {
    console.error("Errore creazione richiesta annullamento:", error);
    return { success: false, error: "Errore durante la richiesta di annullamento" };
  }
}

// Approva una richiesta di annullamento
export async function approvaRichiestaAnnullamento(richiestaId: string) {
  try {
    const utente = await getCurrentUser();
    if (!utente) {
      return { success: false, error: "Utente non autenticato" };
    }

    // Solo PREPARA, SUPERVISORE o ADMIN possono approvare
    if (!["PREPARA", "SUPERVISORE", "ADMIN"].includes(utente.ruolo)) {
      return { success: false, error: "Permessi insufficienti" };
    }

    const result = await prisma.$transaction(async (tx) => {
      // Recupera la richiesta
      const richiesta = await tx.richiestaAnnullamento.findUnique({
        where: { id: richiestaId },
        include: {
          Ordinazione: {
            include: {
              Tavolo: true
            }
          }
        }
      });

      if (!richiesta) {
        return { success: false, error: "Richiesta non trovata" };
      }

      if (richiesta.stato !== 'PENDING') {
        return { success: false, error: "Richiesta già elaborata" };
      }

      // Aggiorna lo stato della richiesta
      await tx.richiestaAnnullamento.update({
        where: { id: richiestaId },
        data: {
          stato: 'APPROVED',
          elaboratoDa: utente.nome || utente.id,
          elaboratoAt: new Date()
        }
      });

      // Annulla l'ordinazione
      const ordinazioneAnnullata = await tx.ordinazione.update({
        where: { id: richiesta.ordinazioneId },
        data: { 
          stato: 'ANNULLATO',
          note: richiesta.Ordinazione.note 
            ? `${richiesta.Ordinazione.note} | ANNULLATO: ${richiesta.motivo}`
            : `ANNULLATO: ${richiesta.motivo}`
        }
      });

      // Se c'è un tavolo, liberalo se non ci sono altri ordini attivi
      if (richiesta.Ordinazione.tavoloId) {
        const altriOrdiniAttivi = await tx.ordinazione.count({
          where: {
            tavoloId: richiesta.Ordinazione.tavoloId,
            id: { not: richiesta.ordinazioneId },
            stato: {
              in: ['ORDINATO', 'IN_PREPARAZIONE', 'PRONTO', 'CONSEGNATO']
            }
          }
        });

        if (altriOrdiniAttivi === 0) {
          await tx.tavolo.update({
            where: { id: richiesta.Ordinazione.tavoloId },
            data: { stato: 'LIBERO' }
          });
        }
      }

      return { success: true, ordinazione: ordinazioneAnnullata, richiesta };
    });

    if (result.success && 'ordinazione' in result && result.ordinazione) {
      // Notifica l'annullamento
      notificationManager.notifyOrderCancelled({
        orderId: result.ordinazione.id,
        tableNumber: result.richiesta?.Ordinazione.Tavolo ? parseInt(result.richiesta.Ordinazione.Tavolo.numero) : undefined,
        orderType: result.ordinazione.tipo,
        reason: `Approvato da ${utente.nome || utente.id}`
      });

      // Emetti evento SSE
      sseService.emit('order:cancelled', {
        orderId: result.ordinazione.id,
        tableNumber: result.richiesta?.Ordinazione.Tavolo ? parseInt(result.richiesta.Ordinazione.Tavolo.numero) : undefined,
        approvedBy: utente.nome || utente.id,
        timestamp: new Date().toISOString()
      });

      revalidatePath("/prepara");
      revalidatePath("/cameriere");
      revalidatePath("/supervisore");
    }

    return result;
  } catch (error: any) {
    console.error("Errore approvazione annullamento:", error);
    return { success: false, error: "Errore durante l'approvazione dell'annullamento" };
  }
}

// Rifiuta una richiesta di annullamento
export async function rifiutaRichiestaAnnullamento(richiestaId: string, motivoRifiuto?: string) {
  try {
    const utente = await getCurrentUser();
    if (!utente) {
      return { success: false, error: "Utente non autenticato" };
    }

    // Solo PREPARA, SUPERVISORE o ADMIN possono rifiutare
    if (!["PREPARA", "SUPERVISORE", "ADMIN"].includes(utente.ruolo)) {
      return { success: false, error: "Permessi insufficienti" };
    }

    const richiesta = await prisma.richiestaAnnullamento.update({
      where: { id: richiestaId },
      data: {
        stato: 'REJECTED',
        motivoRifiuto,
        elaboratoDa: utente.nome || utente.id,
        elaboratoAt: new Date()
      },
      include: {
        Ordinazione: {
          include: {
            Tavolo: true
          }
        }
      }
    });

    // Notifica il rifiuto
    sseService.emit('order:cancellation-rejected', {
      requestId: richiestaId,
      orderId: richiesta.ordinazioneId,
      tableNumber: richiesta.Ordinazione.Tavolo ? parseInt(richiesta.Ordinazione.Tavolo.numero) : undefined,
      rejectedBy: utente.nome || utente.id,
      reason: motivoRifiuto,
      timestamp: new Date().toISOString()
    });

    revalidatePath("/prepara");
    revalidatePath("/cameriere");
    revalidatePath("/supervisore");

    return { 
      success: true, 
      message: "Richiesta di annullamento rifiutata" 
    };
  } catch (error: any) {
    console.error("Errore rifiuto annullamento:", error);
    return { success: false, error: "Errore durante il rifiuto dell'annullamento" };
  }
}

// Recupera le richieste di annullamento pendenti
export async function getRichiesteAnnullamentoPendenti() {
  try {
    const utente = await getCurrentUser();
    if (!utente) {
      return { success: false, error: "Utente non autenticato" };
    }

    const richieste = await prisma.richiestaAnnullamento.findMany({
      where: {
        stato: 'PENDING'
      },
      include: {
        Ordinazione: {
          include: {
            Tavolo: true,
            RigaOrdinazione: {
              include: {
                Prodotto: true
              }
            }
          }
        },
        User: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return {
      success: true,
      richieste: richieste.map(r => ({
        ...r,
        prodotti: r.Ordinazione.RigaOrdinazione.map(riga => ({
          nome: riga.Prodotto.nome,
          quantita: riga.quantita,
          stato: riga.stato
        }))
      }))
    };
  } catch (error: any) {
    console.error("Errore recupero richieste:", error);
    return { success: false, error: "Errore nel recupero delle richieste" };
  }
}

// Annulla direttamente un ordine (per utenti PREPARA e SUPERVISORE)
export async function annullaOrdineDiretto(ordinazioneId: string, motivo: string) {
  try {
    const utente = await getCurrentUser();
    if (!utente) {
      return { success: false, error: "Utente non autenticato" };
    }

    // Solo PREPARA, SUPERVISORE o ADMIN possono annullare direttamente
    if (!["PREPARA", "SUPERVISORE", "ADMIN"].includes(utente.ruolo)) {
      return { success: false, error: "Permessi insufficienti per annullare direttamente" };
    }

    const result = await prisma.$transaction(async (tx) => {
      // Recupera l'ordinazione
      const ordinazione = await tx.ordinazione.findUnique({
        where: { id: ordinazioneId }
      });

      if (!ordinazione) {
        return { success: false, error: "Ordinazione non trovata" };
      }

      // Verifica che l'ordine non sia già annullato o pagato
      if (ordinazione.stato === 'ANNULLATO') {
        return { success: false, error: "L'ordine è già stato annullato" };
      }

      if (ordinazione.stato === 'PAGATO') {
        return { success: false, error: "Non puoi annullare un ordine già pagato" };
      }

      // Annulla l'ordinazione
      const ordinazioneAnnullata = await tx.ordinazione.update({
        where: { id: ordinazioneId },
        data: { 
          stato: 'ANNULLATO',
          note: ordinazione.note 
            ? `${ordinazione.note} | ANNULLATO da ${utente.nome || utente.id}: ${motivo}`
            : `ANNULLATO da ${utente.nome || utente.id}: ${motivo}`
        }
      });

      // Se c'è un tavolo, liberalo se non ci sono altri ordini attivi
      if (ordinazione.tavoloId) {
        const altriOrdiniAttivi = await tx.ordinazione.count({
          where: {
            tavoloId: ordinazione.tavoloId,
            id: { not: ordinazioneId },
            stato: {
              in: ['ORDINATO', 'IN_PREPARAZIONE', 'PRONTO', 'CONSEGNATO']
            }
          }
        });

        if (altriOrdiniAttivi === 0) {
          await tx.tavolo.update({
            where: { id: ordinazione.tavoloId },
            data: { stato: 'LIBERO' }
          });
        }
      }

      return { success: true, ordinazione: ordinazioneAnnullata };
    });

    if (result.success && 'ordinazione' in result && result.ordinazione) {
      // Recupera il tavolo per il numero
      let tableNumber: number | undefined;
      if (result.ordinazione.tavoloId) {
        const tavolo = await prisma.tavolo.findUnique({
          where: { id: result.ordinazione.tavoloId }
        });
        if (tavolo) {
          tableNumber = parseInt(tavolo.numero);
        }
      }

      // Notifica l'annullamento
      notificationManager.notifyOrderCancelled({
        orderId: result.ordinazione.id,
        tableNumber,
        orderType: result.ordinazione.tipo,
        reason: `${motivo} (da ${utente.nome || utente.id})`
      });

      // Emetti evento SSE per notificare i camerieri
      sseService.emit('order:cancelled', {
        orderId: result.ordinazione.id,
        orderNumber: result.ordinazione.numero,
        tableNumber,
        cancelledBy: utente.nome || utente.id,
        reason: motivo,
        timestamp: new Date().toISOString()
      });

      revalidatePath("/prepara");
      revalidatePath("/cameriere");
      revalidatePath("/supervisore");
      revalidatePath("/cassa");

      return { 
        success: true, 
        message: `Ordine #${result.ordinazione.numero} annullato con successo`
      };
    }

    return result;
  } catch (error: any) {
    console.error("Errore annullamento diretto:", error);
    return { success: false, error: "Errore durante l'annullamento dell'ordine" };
  }
}