"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-multi-tenant";
import { revalidatePath } from "next/cache";
import { sseService } from "@/lib/sse/sse-service";
import { nanoid } from "nanoid";

export async function annullaPagamentoOrdine(ordinazioneId: string, motivo?: string) {
  try {
    const utente = await getCurrentUser();
    if (!utente) {
      return { success: false, error: "Utente non autenticato" };
    }

    // Verifica permessi (solo CASSA, MANAGER o ADMIN possono annullare pagamenti)
    if (!["ADMIN", "MANAGER", "CASSA"].includes(utente.ruolo)) {
      return { success: false, error: "Permessi insufficienti per annullare pagamenti" };
    }

    // Recupera l'ordinazione con tutti i dettagli
    const ordinazione = await prisma.ordinazione.findUnique({
      where: { id: ordinazioneId },
      include: {
        RigaOrdinazione: true,
        Pagamento: true,
        Tavolo: true,
        User: {
          select: {
            nome: true,
            tenantId: true
          }
        }
      }
    });

    if (!ordinazione) {
      return { success: false, error: "Ordinazione non trovata" };
    }

    // Verifica che l'ordinazione sia effettivamente pagata
    if (ordinazione.stato !== "PAGATO" && ordinazione.statoPagamento !== "COMPLETAMENTE_PAGATO") {
      return { success: false, error: "L'ordinazione non risulta pagata" };
    }

    // Transazione atomica per garantire consistenza
    const result = await prisma.$transaction(async (tx) => {
      // Crea record audit trail per tutti i pagamenti che verranno eliminati
      const pagamentiDaEliminare = await tx.pagamento.findMany({
        where: { ordinazioneId }
      });

      for (const pag of pagamentiDaEliminare) {
        await tx.paymentHistory.create({
          data: {
            id: nanoid(),
            pagamentoId: pag.id,
            ordinazioneId: ordinazioneId,
            action: 'REVERSE',
            importo: pag.importo,
            modalita: pag.modalita,
            operatoreId: utente.id,
            operatoreNome: utente.nome,
            previousState: { stato: 'COMPLETAMENTE_PAGATO' },
            newState: { stato: 'NON_PAGATO' },
            metadata: {
              motivo: motivo || "Non specificato",
              reversalReason: "Annullamento completo pagamento",
              reversedAt: new Date().toISOString(),
              reversedBy: utente.nome
            },
            motivo: motivo || "Annullamento completo pagamento"
          }
        });
      }

      // 1. Elimina tutti i pagamenti associati
      await tx.pagamento.deleteMany({
        where: { ordinazioneId }
      });

      // 2. Resetta lo stato di pagamento delle righe
      await tx.rigaOrdinazione.updateMany({
        where: { ordinazioneId },
        data: {
          isPagato: false,
          pagatoDa: null
        }
      });

      // 3. Aggiorna lo stato dell'ordinazione
      const ordinazioneAggiornata = await tx.ordinazione.update({
        where: { id: ordinazioneId },
        data: {
          stato: "CONSEGNATO", // Torna allo stato precedente al pagamento
          statoPagamento: "NON_PAGATO",
          dataChiusura: null
        }
      });

      // Log dell'annullamento (potrebbe essere salvato in un sistema di logging esterno)

      return ordinazioneAggiornata;
    });

    // Invia evento SSE per aggiornamento stato
    const tenantId = ordinazione.User?.tenantId;
    if (tenantId) {
      sseService.emit('payment:cancelled', {
        ordinazioneId,
        numero: ordinazione.numero,
        tavolo: ordinazione.Tavolo?.numero || 'Asporto',
        operatore: utente.nome || utente.username,
        motivo: motivo || "Non specificato",
        timestamp: new Date().toISOString()
      }, {
        tenantId,
        broadcast: true
      });

      // Invia anche evento di aggiornamento ordine
      sseService.emit('order:update', {
        orderId: ordinazioneId,
        status: 'CONSEGNATO',
        previousStatus: 'PAGATO',
        timestamp: new Date().toISOString()
      }, {
        tenantId,
        broadcast: true
      });
    }

    // Revalida i percorsi
    revalidatePath('/cassa');
    revalidatePath('/cameriere');
    revalidatePath('/supervisore');

    return {
      success: true,
      data: {
        ordinazioneId,
        numero: ordinazione.numero,
        message: `Pagamento ordine #${ordinazione.numero} annullato con successo`
      }
    };
  } catch (error) {
    console.error("Errore in annullaPagamentoOrdine:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Errore durante l'annullamento del pagamento" 
    };
  }
}

// Funzione per annullare pagamenti parziali specifici
export async function annullaPagamentoParziale(
  ordinazioneId: string, 
  pagamentoId: string,
  motivo?: string
) {
  try {
    const utente = await getCurrentUser();
    if (!utente) {
      return { success: false, error: "Utente non autenticato" };
    }

    // Verifica permessi
    if (!["ADMIN", "MANAGER", "CASSA"].includes(utente.ruolo)) {
      return { success: false, error: "Permessi insufficienti" };
    }

    // Recupera il pagamento e l'ordinazione
    const pagamento = await prisma.pagamento.findUnique({
      where: { id: pagamentoId },
      include: {
        Ordinazione: {
          include: {
            RigaOrdinazione: true,
            Pagamento: true,
            Tavolo: true,
            User: {
              select: {
                tenantId: true
              }
            }
          }
        }
      }
    });

    if (!pagamento) {
      return { success: false, error: "Pagamento non trovato" };
    }

    if (pagamento.ordinazioneId !== ordinazioneId) {
      return { success: false, error: "Pagamento non associato all'ordinazione" };
    }

    const ordinazione = pagamento.Ordinazione;

    // Transazione atomica
    const result = await prisma.$transaction(async (tx) => {
      // Crea record audit trail per il pagamento annullato
      await tx.paymentHistory.create({
        data: {
          id: nanoid(),
          pagamentoId: pagamentoId,
          ordinazioneId: ordinazioneId,
          action: 'REVERSE',
          importo: pagamento.importo,
          modalita: pagamento.modalita,
          operatoreId: utente.id,
          operatoreNome: utente.nome,
          previousState: { statoPagamento: ordinazione.statoPagamento },
          newState: { statoPagamento: 'PARZIALMENTE_PAGATO' }, // Verrà aggiornato dopo
          metadata: {
            motivo: motivo || "Non specificato",
            reversalReason: "Annullamento pagamento parziale",
            reversedAt: new Date().toISOString(),
            reversedBy: utente.nome,
            righeAnnullate: pagamento.righeIds
          },
          motivo: motivo || "Annullamento pagamento parziale"
        }
      });

      // 1. Elimina il pagamento specifico
      await tx.pagamento.delete({
        where: { id: pagamentoId }
      });

      // 2. Aggiorna lo stato delle righe pagate da questo pagamento
      const righeData = pagamento.righeIds as any;
      let righeIds: string[] = [];
      
      if (Array.isArray(righeData)) {
        righeIds = righeData;
      } else if (righeData?.righeIds) {
        righeIds = righeData.righeIds;
      }

      // Verifica se ci sono altri pagamenti per queste righe
      for (const rigaId of righeIds) {
        const altriPagamenti = await tx.pagamento.findMany({
          where: {
            ordinazioneId,
            id: { not: pagamentoId }
          }
        });

        let altroPagamento = false;
        for (const altroPag of altriPagamenti) {
          const altreRighe = altroPag.righeIds as any;
          if (Array.isArray(altreRighe) && altreRighe.includes(rigaId)) {
            altroPagamento = true;
            break;
          } else if (altreRighe?.righeIds?.includes(rigaId)) {
            altroPagamento = true;
            break;
          }
        }

        // Se non ci sono altri pagamenti per questa riga, resettala
        if (!altroPagamento) {
          await tx.rigaOrdinazione.update({
            where: { id: rigaId },
            data: {
              isPagato: false,
              pagatoDa: null
            }
          });
        }
      }

      // 3. Ricalcola lo stato pagamento dell'ordinazione
      const pagamentiRimanenti = await tx.pagamento.findMany({
        where: { ordinazioneId }
      });

      const totalePagato = pagamentiRimanenti.reduce((sum, p) => 
        sum + p.importo.toNumber(), 0
      );

      const totaleOrdine = ordinazione.RigaOrdinazione.reduce((sum, riga) => 
        sum + (riga.prezzo.toNumber() * riga.quantita), 0
      );

      let nuovoStatoPagamento;
      let nuovoStato = ordinazione.stato;

      if (totalePagato === 0) {
        nuovoStatoPagamento = "NON_PAGATO";
        if (ordinazione.stato === "PAGATO") {
          nuovoStato = "CONSEGNATO";
        }
      } else if (totalePagato < totaleOrdine) {
        nuovoStatoPagamento = "PARZIALMENTE_PAGATO";
        if (ordinazione.stato === "PAGATO") {
          nuovoStato = "CONSEGNATO";
        }
      } else {
        nuovoStatoPagamento = "COMPLETAMENTE_PAGATO";
      }

      // 4. Aggiorna l'ordinazione
      const updateData: any = {
        statoPagamento: nuovoStatoPagamento
      };

      if (nuovoStato !== ordinazione.stato) {
        updateData.stato = nuovoStato;
      }

      if (nuovoStatoPagamento !== "COMPLETAMENTE_PAGATO") {
        updateData.dataChiusura = null;
      }

      const ordinazioneAggiornata = await tx.ordinazione.update({
        where: { id: ordinazioneId },
        data: updateData
      });

      // Log dell'operazione (potrebbe essere salvato in un sistema di logging esterno)

      return {
        ordinazione: ordinazioneAggiornata,
        importoAnnullato: pagamento.importo.toNumber()
      };
    });

    // Invia eventi SSE
    const tenantId = ordinazione.User?.tenantId;
    if (tenantId) {
      sseService.emit('payment:partial-cancelled', {
        ordinazioneId,
        pagamentoId,
        numero: ordinazione.numero,
        tavolo: ordinazione.Tavolo?.numero || 'Asporto',
        importoAnnullato: pagamento.importo.toNumber(),
        clienteNome: pagamento.clienteNome,
        operatore: utente.nome || utente.username,
        motivo: motivo || "Non specificato",
        timestamp: new Date().toISOString()
      }, {
        tenantId,
        broadcast: true
      });
    }

    // Revalida percorsi
    revalidatePath('/cassa');
    revalidatePath('/cameriere');

    return {
      success: true,
      data: {
        ordinazioneId,
        pagamentoId,
        importoAnnullato: result.importoAnnullato,
        nuovoStatoPagamento: result.ordinazione.statoPagamento,
        message: `Annullato pagamento di €${result.importoAnnullato.toFixed(2)}`
      }
    };
  } catch (error) {
    console.error("Errore in annullaPagamentoParziale:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Errore durante l'annullamento" 
    };
  }
}