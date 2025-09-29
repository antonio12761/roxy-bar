"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-multi-tenant";
import { serializeDecimalData } from "@/lib/utils/decimal-serializer";
import { generaScontrino } from "./cassa";
import { sseManager } from "@/lib/sse/sse-manager";
import { Decimal } from "@prisma/client/runtime/library";
import { nanoid } from "nanoid";
import { assegnaPuntiPagamento } from "./fidelity";

interface DirectReceiptItem {
  prodottoId: string;
  quantita: number;
  prezzo: number;
}

interface DirectReceiptData {
  items: DirectReceiptItem[];
  modalitaPagamento: "CONTANTI" | "CARTA" | "DEBITO";
  totale: number;
  clienteNome?: string;
  clienteId?: string;
}

export async function creaSconsintrinoDiretto(data: DirectReceiptData) {
  try {
    const user = await getCurrentUser();
    if (!user || user.ruolo !== "CASSA") {
      return { success: false, error: "Non autorizzato" };
    }

    const result = await prisma.$transaction(async (tx) => {
      // Create a virtual order for the receipt
      const ordinazione = await tx.ordinazione.create({
        data: {
          id: `direct_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          cameriereId: user.id,
          stato: "PAGATO",
          statoPagamento: "COMPLETAMENTE_PAGATO",
          note: "Scontrino diretto - Cassa - Tavolo 0",
          nomeCliente: data.clienteNome || "Scontrino Diretto",
          updatedAt: new Date()
        }
      });

      // Create order items
      const orderItems = await Promise.all(
        data.items.map(item =>
          tx.rigaOrdinazione.create({
            data: {
              id: `riga_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              ordinazioneId: ordinazione.id,
              prodottoId: parseInt(item.prodottoId),
              quantita: item.quantita,
              prezzo: new Decimal(item.prezzo),
              stato: "CONSEGNATO",
              updatedAt: new Date()
            },
            include: {
              Prodotto: {
                select: {
                  nome: true,
                  categoria: true
                }
              }
            }
          })
        )
      );

      // Create payment record or debt based on payment method
      let pagamento = null;
      let debito = null;

      if (data.modalitaPagamento === "DEBITO") {
        // Create debt if customer ID is provided
        if (!data.clienteId) {
          throw new Error("Cliente richiesto per creare un debito");
        }

        // Check if customer exists
        const cliente = await tx.cliente.findUnique({
          where: { id: data.clienteId }
        });

        if (!cliente) {
          throw new Error("Cliente non trovato");
        }

        // Create debt
        debito = await tx.debito.create({
          data: {
            id: nanoid(),
            clienteId: data.clienteId,
            ordinazioneId: ordinazione.id,
            importo: new Decimal(data.totale),
            importoPagato: new Decimal(0),
            stato: "APERTO",
            note: `Debito da scontrino diretto - ${new Date().toLocaleString('it-IT')}`,
            operatoreId: user.id,
            dataCreazione: new Date()
          },
          include: {
            Cliente: true
          }
        });

        // Update order status to PAGATO (via debt)
        await tx.ordinazione.update({
          where: { id: ordinazione.id },
          data: {
            stato: "PAGATO",
            statoPagamento: "COMPLETAMENTE_PAGATO",
            dataChiusura: new Date(),
            note: `Pagato con debito - ${cliente.nome}`
          }
        });
      } else {
        // Create regular payment
        pagamento = await tx.pagamento.create({
          data: {
            id: `pag_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            ordinazioneId: ordinazione.id,
            importo: new Decimal(data.totale),
            modalita: data.modalitaPagamento === "CARTA" ? "POS" : data.modalitaPagamento,
            righeIds: [],
            operatoreId: user.id
          }
        });
      }

      // Generate receipt
      const scontrinoResult = await generaScontrino(ordinazione.id);

      return {
        ordinazione,
        pagamento,
        debito,
        scontrino: scontrinoResult
      };
    });

    // Assegna punti fidelity se c'è un cliente e non è un debito
    let puntiAssegnati = null;
    if (data.clienteId && data.modalitaPagamento !== "DEBITO") {
      const risultatoPunti = await assegnaPuntiPagamento(
        result.ordinazione.id,
        data.clienteId,
        data.totale
      );
      
      if (risultatoPunti.success) {
        puntiAssegnati = risultatoPunti;
      }
    }

    // Send SSE notification
    if (data.modalitaPagamento === "DEBITO") {
        // Send debt created notification
        sseManager.sendToTenant(user.tenantId, {
          event: "debt:created",
          data: {
            debitoId: debito!.id,
            clienteId: data.clienteId,
            clienteName: debito!.Cliente.nome,
            amount: data.totale,
            orderId: ordinazione.id,
            timestamp: new Date().toISOString()
          }
        });
      } else {
        // Send payment completed notification
        sseManager.sendToTenant(user.tenantId, {
          event: "payment:completed",
          data: {
            ordinazioneId: result.ordinazione.id,
            numeroTavolo: 0,
            totale: data.totale,
            modalita: data.modalitaPagamento === "CARTA" ? "POS" : data.modalitaPagamento,
            isDirect: true,
            timestamp: new Date().toISOString(),
            fidelityPoints: puntiAssegnati?.punti || 0
          }
        });
      }

    return {
      success: true,
      data: serializeDecimalData(result),
      puntiAssegnati: puntiAssegnati?.punti || 0,
      messaggioPunti: puntiAssegnati?.message
    };
  } catch (error: any) {
    console.error("Errore creazione scontrino diretto:", error);
    return {
      success: false,
      error: error.message || "Errore nella creazione dello scontrino"
    };
  }
}