"use server";

import { ContributoService } from "@/lib/services/contributo";
import { TipoContributo } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * Server action per creare ordinazione cross-tavolo
 */
export async function creaOrdinazionePerAltri(
  clienteOrdinanteId: string,
  tavoloBeneficiarioId: number,
  ordinazioneId: string,
  importo: number,
  clienteBeneficiarioId?: string
) {
  try {
    const contributo = await ContributoService.ordinaPerAltri(
      clienteOrdinanteId,
      tavoloBeneficiarioId,
      ordinazioneId,
      importo,
      clienteBeneficiarioId
    );

    // Aggiorna la riga ordinazione con i riferimenti cliente
    await prisma.rigaOrdinazione.updateMany({
      where: { ordinazioneId },
      data: {
        clienteOrdinanteId,
        clienteBeneficiarioId,
      },
    });

    return { success: true, contributo };
  } catch (error) {
    console.error("Errore creazione ordinazione per altri:", error);
    return { success: false, error: "Errore durante la creazione dell'ordinazione" };
  }
}

/**
 * Server action per pagare conto di altri
 */
export async function pagaContoAltri(
  clientePagatoreId: string,
  pagamentoId: string,
  importo: number,
  tavoloId?: number,
  clienteBeneficiarioId?: string
) {
  try {
    const contributo = await ContributoService.pagaPerAltri(
      clientePagatoreId,
      pagamentoId,
      importo,
      tavoloId,
      clienteBeneficiarioId
    );

    // Aggiorna il pagamento con il riferimento cliente
    await prisma.pagamento.update({
      where: { id: pagamentoId },
      data: {
        clientePagatoreId,
        contributoId: contributo.id,
      },
    });

    return { success: true, contributo };
  } catch (error) {
    console.error("Errore pagamento per altri:", error);
    return { success: false, error: "Errore durante il pagamento" };
  }
}

/**
 * Server action per ottenere contributi di un cliente
 */
export async function getContributiCliente(clienteId: string) {
  try {
    const contributi = await ContributoService.getContributiCliente(clienteId);
    return { success: true, data: contributi };
  } catch (error) {
    console.error("Errore recupero contributi:", error);
    return { success: false, error: "Errore durante il recupero dei contributi" };
  }
}

/**
 * Server action per calcolare saldo finale cliente
 */
export async function calcolaSaldoFinaleCliente(clienteId: string) {
  try {
    const saldo = await ContributoService.calcolaSaldoFinale(clienteId);
    return { success: true, data: saldo };
  } catch (error) {
    console.error("Errore calcolo saldo:", error);
    return { success: false, error: "Errore durante il calcolo del saldo" };
  }
}

/**
 * Server action per ottenere lista tavoli con conti aperti
 */
export async function getTavoliConContiAperti() {
  try {
    const tavoli = await prisma.tavolo.findMany({
      where: {
        stato: "OCCUPATO",
        Ordinazione: {
          some: {
            statoPagamento: {
              in: ["NON_PAGATO", "PARZIALMENTE_PAGATO"],
            },
          },
        },
      },
      include: {
        Ordinazione: {
          where: {
            statoPagamento: {
              in: ["NON_PAGATO", "PARZIALMENTE_PAGATO"],
            },
          },
          include: {
            Cliente: true,
            RigaOrdinazione: true,
          },
        },
      },
    });

    return { success: true, data: tavoli };
  } catch (error) {
    console.error("Errore recupero tavoli:", error);
    return { success: false, error: "Errore durante il recupero dei tavoli" };
  }
}

/**
 * Server action per aggiungere prodotto a ordinazione esistente di altro tavolo
 */
export async function aggiungiProdottoAltroTavolo(
  clienteOrdinanteId: string,
  ordinazioneDestinazioneId: string,
  prodottoId: number,
  quantita: number,
  prezzo: number,
  clienteBeneficiarioId?: string,
  note?: string
) {
  try {
    // Crea la riga ordinazione
    const rigaOrdinazione = await prisma.rigaOrdinazione.create({
      data: {
        id: crypto.randomUUID(),
        ordinazioneId: ordinazioneDestinazioneId,
        prodottoId,
        quantita,
        prezzo,
        clienteOrdinanteId,
        clienteBeneficiarioId,
        note,
        stato: "INSERITO",
        postazione: "PREPARA",
        timestampOrdine: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Aggiorna il totale dell'ordinazione
    const importoTotale = prezzo * quantita;
    await prisma.ordinazione.update({
      where: { id: ordinazioneDestinazioneId },
      data: {
        totale: {
          increment: importoTotale,
        },
      },
    });

    // Crea il contributo
    const ordinazione = await prisma.ordinazione.findUnique({
      where: { id: ordinazioneDestinazioneId },
      include: { Tavolo: true },
    });

    if (ordinazione?.tavoloId) {
      const contributo = await ContributoService.ordinaPerAltri(
        clienteOrdinanteId,
        ordinazione.tavoloId,
        ordinazioneDestinazioneId,
        importoTotale,
        clienteBeneficiarioId
      );

      return { success: true, rigaOrdinazione, contributo };
    }

    return { success: true, rigaOrdinazione };
  } catch (error) {
    console.error("Errore aggiunta prodotto altro tavolo:", error);
    return { success: false, error: "Errore durante l'aggiunta del prodotto" };
  }
}