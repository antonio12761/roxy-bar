"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-multi-tenant";
import { revalidatePath } from "next/cache";
import { creaScontrinoQueue } from "@/lib/services/scontrino-queue";
import { sseService } from "@/lib/sse/sse-service";
import crypto from "crypto";

export async function confermaStampaScontrini(
  ordinazioneId: string,
  modalitaPagamento: "POS" | "CONTANTI" | "MISTO",
  datiScontrino: {
    righe: any[];
    totale: number;
    tavoloNumero?: string;
    clienteNome?: string;
    cameriereNome?: string;
  }
) {
  try {
    const utente = await getCurrentUser();
    if (!utente) {
      return { success: false, error: "Utente non autenticato" };
    }

    // Verifica permessi (CASSA o superiore)
    if (!["ADMIN", "MANAGER", "CASSA"].includes(utente.ruolo)) {
      return { success: false, error: "Permessi insufficienti" };
    }

    const sessionePagamento = crypto.randomUUID();

    // Stampa scontrino NON FISCALE con dettaglio completo
    await creaScontrinoQueue("NON_FISCALE", {
      tavoloNumero: datiScontrino.tavoloNumero,
      clienteNome: datiScontrino.clienteNome,
      cameriereNome: datiScontrino.cameriereNome,
      righe: datiScontrino.righe,
      totale: datiScontrino.totale,
      modalitaPagamento,
      ordinazioneIds: [ordinazioneId],
      pagamentoIds: [],
      sessionePagamento
    }, "URGENTE"); // Priorità urgente per stampa immediata

    // Notifica al cameriere che gli scontrini sono pronti
    sseService.emit('receipt:ready', {
      ordinazioneId,
      modalitaPagamento,
      totale: datiScontrino.totale,
      timestamp: new Date().toISOString()
    }, {
      tenantId: utente.tenantId,
      broadcast: true
    });

    revalidatePath("/cassa");
    revalidatePath("/cameriere");

    return { 
      success: true, 
      message: "Scontrino non fiscale stampato. Emettere ora lo scontrino fiscale.",
      sessionePagamento
    };
  } catch (error) {
    console.error("Errore conferma stampa scontrini:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Errore interno del server" 
    };
  }
}