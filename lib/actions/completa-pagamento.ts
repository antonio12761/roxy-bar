"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-multi-tenant";
import { revalidatePath } from "next/cache";
import { sseService } from "@/lib/sse/sse-service";
import { nanoid } from "nanoid";
import { assegnaPuntiPagamento } from "./fidelity";

export async function completaPagamentoCameriere(
  ordinazioneId: string,
  modalita: "POS" | "CONTANTI" | "MISTO",
  importo: number,
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

    // Recupera l'ordinazione
    const ordinazione = await prisma.ordinazione.findUnique({
      where: { id: ordinazioneId },
      include: {
        RigaOrdinazione: {
          where: { isPagato: false }
        },
        Pagamento: true,
        Tavolo: true,
        User: {
          select: {
            tenantId: true
          }
        }
      }
    });

    if (!ordinazione) {
      return { success: false, error: "Ordinazione non trovata" };
    }

    // Verifica che lo stato sia RICHIESTA_CONTO (pre-pagamento già fatto)
    if (ordinazione.stato !== "RICHIESTA_CONTO") {
      return { success: false, error: "Scontrini non ancora stampati. Stampare prima gli scontrini." };
    }

    // Usa transazione per garantire consistenza
    const result = await prisma.$transaction(async (tx) => {
      // Crea il pagamento
      const pagamento = await tx.pagamento.create({
        data: {
          id: nanoid(),
          ordinazioneId,
          importo,
          modalita,
          clienteNome: clienteNome || ordinazione.nomeCliente,
          operatoreId: utente.id,
          righeIds: ordinazione.RigaOrdinazione.map(r => r.id)
        }
      });

      // Marca tutte le righe come pagate
      await tx.rigaOrdinazione.updateMany({
        where: {
          ordinazioneId,
          isPagato: false
        },
        data: {
          isPagato: true,
          pagatoDa: clienteNome || ordinazione.nomeCliente
        }
      });

      // Aggiorna stato ordinazione
      await tx.ordinazione.update({
        where: { id: ordinazioneId },
        data: {
          stato: "PAGATO",
          statoPagamento: "COMPLETAMENTE_PAGATO",
          dataChiusura: new Date()
        }
      });

      // Libera il tavolo se non ci sono altri ordini attivi
      if (ordinazione.tavoloId) {
        const altriOrdiniAttivi = await tx.ordinazione.count({
          where: {
            tavoloId: ordinazione.tavoloId,
            id: { not: ordinazioneId },
            stato: {
              notIn: ["PAGATO", "ANNULLATO"]
            }
          }
        });
        
        if (altriOrdiniAttivi === 0) {
          await tx.tavolo.update({
            where: { id: ordinazione.tavoloId },
            data: { stato: "LIBERO" }
          });
        }
      }

      return { pagamento };
    });

    // Assegna punti fidelity se c'è un cliente associato
    let puntiAssegnati = null;
    if (ordinazione.clienteId && modalita !== "DEBITO") {
      const risultatoPunti = await assegnaPuntiPagamento(
        ordinazioneId,
        ordinazione.clienteId,
        importo
      );
      
      if (risultatoPunti.success) {
        puntiAssegnati = risultatoPunti;
      }
    }

    // Notifica completamento pagamento
    sseService.emit('order:paid', {
      orderId: ordinazioneId,
      tableNumber: ordinazione.Tavolo?.numero || undefined,
      orderType: ordinazione.tipo,
      amount: importo,
      paymentMethod: modalita,
      cashierId: utente.id,
      timestamp: new Date().toISOString(),
      fidelityPoints: puntiAssegnati?.punti || 0
    }, {
      tenantId: ordinazione.User?.tenantId,
      broadcast: true
    });

    revalidatePath("/cameriere");
    revalidatePath("/cassa");

    const messaggioPunti = puntiAssegnati?.punti 
      ? ` (+${puntiAssegnati.punti} punti fidelity)`
      : '';

    return { 
      success: true, 
      message: `Pagamento ${modalita} di €${importo.toFixed(2)} completato${messaggioPunti}`,
      pagamentoId: result.pagamento.id,
      puntiAssegnati: puntiAssegnati?.punti || 0
    };
  } catch (error) {
    console.error("Errore completamento pagamento:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Errore interno del server" 
    };
  }
}