"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-multi-tenant";
import { revalidatePath } from "next/cache";
import { notificationManager } from "@/lib/notifications/NotificationManager";
import { sseService } from "@/lib/sse/sse-service";
import { creaScontrinoQueue } from "@/lib/services/scontrino-queue";
import { nanoid } from "nanoid";
import crypto from "crypto";

export async function creaPrePagamento(
  ordinazioneId: string,
  modalita: "POS" | "CONTANTI",
  clienteNome?: string
) {
  try {
    const utente = await getCurrentUser();
    if (!utente) {
      return { success: false, error: "Utente non autenticato" };
    }

    // Verifica permessi (CAMERIERE o superiore)
    if (!["ADMIN", "MANAGER", "CAMERIERE"].includes(utente.ruolo)) {
      return { success: false, error: "Permessi insufficienti" };
    }

    // Recupera l'ordinazione con tutti i dettagli
    const ordinazione = await prisma.ordinazione.findUnique({
      where: { id: ordinazioneId },
      include: {
        RigaOrdinazione: {
          where: { isPagato: false },
          include: {
            Prodotto: {
              select: {
                nome: true,
                prezzo: true
              }
            }
          }
        },
        Tavolo: true,
        User: {
          select: {
            nome: true,
            tenantId: true
          }
        },
        Pagamento: true
      }
    });

    if (!ordinazione) {
      return { success: false, error: "Ordinazione non trovata" };
    }

    // Calcola totale rimanente
    const totaleRighe = ordinazione.RigaOrdinazione.reduce(
      (sum, riga) => sum + (riga.prezzo.toNumber() * riga.quantita), 0
    );
    const totalePagato = ordinazione.Pagamento.reduce(
      (sum, pag) => sum + pag.importo.toNumber(), 0
    );
    const rimanente = totaleRighe - totalePagato;

    if (rimanente <= 0) {
      return { success: false, error: "Ordinazione già pagata" };
    }

    // Prepara i dati per lo scontrino NON FISCALE dettagliato
    const righeScontrino = ordinazione.RigaOrdinazione.map((riga: any) => ({
      prodotto: riga.Prodotto.nome,
      quantita: riga.quantita,
      prezzoUnitario: riga.prezzo.toNumber(),
      totaleRiga: riga.prezzo.toNumber() * riga.quantita
    }));

    const sessionePagamento = crypto.randomUUID();

    // NON stampa automaticamente - invia solo notifica al cassiere
    // Il cassiere dovrà confermare per avviare la stampa dello scontrino non fiscale
    // e poi emettere manualmente lo scontrino fiscale

    // Aggiorna stato ordinazione
    await prisma.ordinazione.update({
      where: { id: ordinazioneId },
      data: {
        stato: "RICHIESTA_CONTO",
        nomeCliente: clienteNome || ordinazione.nomeCliente
      }
    });

    // Notifica alla cassa
    const eventData = {
      orderId: ordinazioneId,
      tableNumber: ordinazione.Tavolo?.numero || undefined,
      orderType: ordinazione.tipo,
      amount: rimanente,
      paymentMethod: modalita,
      customerName: clienteNome || ordinazione.nomeCliente || undefined,
      waiterName: utente.nome,
      timestamp: new Date().toISOString()
    };

    // Notifica specifica per pre-pagamento
    notificationManager.notifyPrePaymentRequested(eventData);

    // Emetti evento SSE
    sseService.emit('prepayment:requested', eventData, {
      tenantId: ordinazione.User?.tenantId,
      broadcast: true
    });

    revalidatePath("/cameriere");
    revalidatePath("/cassa");

    return { 
      success: true, 
      message: `Richiesta inviata al cassiere. Attendere conferma per la stampa degli scontrini.`,
      details: {
        ordinazioneId,
        totale: rimanente,
        modalita,
        sessionePagamento,
        datiScontrino: {
          righe: righeScontrino,
          tavoloNumero: ordinazione.Tavolo?.numero,
          clienteNome: clienteNome || ordinazione.nomeCliente
        }
      }
    };
  } catch (error) {
    console.error("Errore creazione pre-pagamento:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Errore interno del server" 
    };
  }
}