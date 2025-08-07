"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-multi-tenant";
import { serializeDecimalData } from "@/lib/utils/decimal-serializer";
import { generaScontrino } from "./cassa";
import { sseManager } from "@/lib/sse/sse-manager";
import { Decimal } from "@prisma/client/runtime/library";

interface DirectReceiptItem {
  prodottoId: string;
  quantita: number;
  prezzo: number;
}

interface DirectReceiptData {
  items: DirectReceiptItem[];
  modalitaPagamento: "CONTANTI" | "CARTA";
  totale: number;
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
          nomeCliente: "Scontrino Diretto",
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

      // Create payment record
      const pagamento = await tx.pagamento.create({
        data: {
          id: `pag_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          ordinazioneId: ordinazione.id,
          importo: new Decimal(data.totale),
          modalita: data.modalitaPagamento === "CARTA" ? "POS" : data.modalitaPagamento,
          righeIds: [],
          operatoreId: user.id
        }
      });

      // Generate receipt
      const scontrinoResult = await generaScontrino(ordinazione.id);

      // Send SSE notification
      sseManager.sendToTenant(user.tenantId, {
        event: "payment:completed",
        data: {
          ordinazioneId: ordinazione.id,
          numeroTavolo: 0,
          totale: data.totale,
          modalita: data.modalitaPagamento === "CARTA" ? "POS" : data.modalitaPagamento,
          isDirect: true,
          timestamp: new Date().toISOString()
        }
      });

      return {
        ordinazione,
        pagamento,
        scontrino: scontrinoResult
      };
    });

    return {
      success: true,
      data: serializeDecimalData(result)
    };
  } catch (error: any) {
    console.error("Errore creazione scontrino diretto:", error);
    return {
      success: false,
      error: error.message || "Errore nella creazione dello scontrino"
    };
  }
}