"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-multi-tenant";
import { Decimal } from "@prisma/client/runtime/library";
import { revalidatePath } from "next/cache";
import { serializeDecimalData } from "@/lib/utils/decimal-serializer";
import { nanoid } from "nanoid";

/**
 * Calcola i punti in base all'importo: 1 punto ogni €2 (arrotondamento per difetto)
 */
export function calcolaPunti(importo: number): number {
  return Math.floor(importo / 2);
}

/**
 * Assegna punti per un pagamento completato
 */
export async function assegnaPuntiPagamento(
  ordinazioneId: string,
  clienteId: string,
  importoPagato: number
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Utente non autenticato" };
    }

    const puntiDaAssegnare = calcolaPunti(importoPagato);
    
    // Se non ci sono punti da assegnare, esci
    if (puntiDaAssegnare === 0) {
      return { 
        success: true, 
        punti: 0,
        message: "Importo insufficiente per generare punti (minimo €2)"
      };
    }

    const result = await prisma.$transaction(async (tx) => {
      // Verifica o crea la fidelity card
      let fidelityCard = await tx.fidelityCard.findUnique({
        where: { clienteId }
      });

      if (!fidelityCard) {
        // Genera codice cliente unico
        let codiceCliente = generaCodiceCliente();
        let tentativo = 0;
        
        // Verifica unicità del codice
        while (tentativo < 10) {
          const esistente = await tx.fidelityCard.findUnique({
            where: { codiceCliente }
          });
          
          if (!esistente) break;
          
          codiceCliente = generaCodiceCliente();
          tentativo++;
        }
        
        // Ottieni nome cliente
        const cliente = await tx.cliente.findUnique({
          where: { id: clienteId },
          select: { nome: true, cognome: true }
        });
        
        fidelityCard = await tx.fidelityCard.create({
          data: {
            id: nanoid(),
            clienteId,
            codiceCliente,
            nomeCliente: `${cliente?.nome} ${cliente?.cognome || ''}`.trim(),
            punti: 0, // Sistema semplice
            puntiTotali: 0,
            puntiMensili: 0,
            puntiDisponibili: 0,
            meseRiferimento: new Date(),
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
      }

      // Controlla se è un nuovo mese e resetta i punti mensili
      const oggi = new Date();
      const meseCorrente = oggi.getMonth();
      const meseCard = fidelityCard.meseRiferimento.getMonth();
      
      if (meseCorrente !== meseCard) {
        await tx.fidelityCard.update({
          where: { id: fidelityCard.id },
          data: {
            puntiMensili: 0,
            meseRiferimento: oggi
          }
        });
        fidelityCard.puntiMensili = 0;
      }

      // Crea il movimento punti
      const movimento = await tx.movimentoPunti.create({
        data: {
          id: nanoid(),
          fidelityCardId: fidelityCard.id,
          tipo: "ACQUISTO",
          punti: puntiDaAssegnare,
          descrizione: `Acquisto €${importoPagato.toFixed(2)}`,
          importoOriginale: new Decimal(importoPagato),
          ordinazioneId,
          operatoreId: user.id
        }
      });

      // Aggiorna i punti della card
      const cardAggiornata = await tx.fidelityCard.update({
        where: { id: fidelityCard.id },
        data: {
          puntiTotali: { increment: puntiDaAssegnare },
          puntiMensili: { increment: puntiDaAssegnare }
        }
      });

      return {
        movimento,
        fidelityCard: cardAggiornata,
        puntiAssegnati: puntiDaAssegnare
      };
    });

    return {
      success: true,
      punti: puntiDaAssegnare,
      puntiTotali: result.fidelityCard.puntiTotali,
      puntiMensili: result.fidelityCard.puntiMensili,
      message: `+${puntiDaAssegnare} punti guadagnati!`
    };
  } catch (error) {
    console.error("Errore assegnazione punti:", error);
    return {
      success: false,
      error: "Errore nell'assegnazione dei punti"
    };
  }
}

/**
 * Ottieni il saldo punti di un cliente
 */
export async function getSaldoPunti(clienteId: string) {
  try {
    const fidelityCard = await prisma.fidelityCard.findUnique({
      where: { clienteId },
      include: {
        _count: {
          select: {
            movimenti: true,
            riscatti: {
              where: { statoUtilizzo: "ATTIVO" }
            }
          }
        }
      }
    });

    if (!fidelityCard) {
      return {
        success: true,
        hasCard: false,
        puntiTotali: 0,
        puntiMensili: 0
      };
    }

    // Controlla se serve reset mensile
    const oggi = new Date();
    const meseCorrente = oggi.getMonth();
    const meseCard = fidelityCard.meseRiferimento.getMonth();
    
    let puntiMensili = fidelityCard.puntiMensili;
    if (meseCorrente !== meseCard) {
      puntiMensili = 0;
    }

    return {
      success: true,
      hasCard: true,
      cardId: fidelityCard.id,
      puntiTotali: fidelityCard.puntiTotali,
      puntiMensili,
      quotaPagata: fidelityCard.quotaPagata,
      dataScadenzaQuota: fidelityCard.dataScadenzaQuota,
      attiva: fidelityCard.attiva,
      prossimoReset: new Date(oggi.getFullYear(), oggi.getMonth() + 1, 1)
    };
  } catch (error) {
    console.error("Errore recupero saldo punti:", error);
    return {
      success: false,
      error: "Errore nel recupero del saldo punti"
    };
  }
}

/**
 * Attiva fidelity card con pagamento quota
 */
export async function attivaFidelityCard(
  clienteId: string,
  modalitaPagamento: "CONTANTI" | "POS" | "PUNTI"
) {
  try {
    const user = await getCurrentUser();
    if (!user || !["CASSA", "ADMIN", "MANAGER"].includes(user.ruolo)) {
      return { success: false, error: "Non autorizzato" };
    }

    const result = await prisma.$transaction(async (tx) => {
      let fidelityCard = await tx.fidelityCard.findUnique({
        where: { clienteId }
      });

      const oggi = new Date();
      const scadenza = new Date(oggi.getFullYear(), oggi.getMonth() + 1, 0, 23, 59, 59);

      if (!fidelityCard) {
        // Crea nuova card
        fidelityCard = await tx.fidelityCard.create({
          data: {
            id: nanoid(),
            clienteId,
            puntiTotali: 0,
            puntiMensili: 0,
            quotaPagata: true,
            dataScadenzaQuota: scadenza,
            attiva: true,
            meseRiferimento: oggi
          }
        });
      } else {
        // Aggiorna card esistente
        if (modalitaPagamento === "PUNTI") {
          // Verifica punti sufficienti (75 punti)
          if (fidelityCard.puntiTotali < 75) {
            throw new Error(`Punti insufficienti. Richiesti: 75, disponibili: ${fidelityCard.puntiTotali}`);
          }

          // Scala i punti
          await tx.movimentoPunti.create({
            data: {
              id: nanoid(),
              fidelityCardId: fidelityCard.id,
              tipo: "QUOTA",
              punti: -75,
              descrizione: "Pagamento quota mensile con punti",
              operatoreId: user.id
            }
          });

          await tx.fidelityCard.update({
            where: { id: fidelityCard.id },
            data: {
              puntiTotali: { decrement: 75 },
              puntiMensili: { decrement: 75 }
            }
          });
        }

        // Attiva la quota
        fidelityCard = await tx.fidelityCard.update({
          where: { id: fidelityCard.id },
          data: {
            quotaPagata: true,
            dataScadenzaQuota: scadenza,
            attiva: true
          }
        });
      }

      // Registra il movimento se pagamento in denaro
      if (modalitaPagamento !== "PUNTI") {
        await tx.movimentoPunti.create({
          data: {
            id: nanoid(),
            fidelityCardId: fidelityCard.id,
            tipo: "QUOTA",
            punti: 0,
            descrizione: `Quota mensile pagata in ${modalitaPagamento}`,
            importoOriginale: new Decimal(10),
            operatoreId: user.id
          }
        });
      }

      return fidelityCard;
    });

    revalidatePath("/cassa");
    revalidatePath(`/clienti/${clienteId}`);

    return {
      success: true,
      fidelityCard: serializeDecimalData(result),
      message: modalitaPagamento === "PUNTI" 
        ? "Quota pagata con 75 punti!"
        : "Fidelity card attivata con successo!"
    };
  } catch (error: any) {
    console.error("Errore attivazione fidelity card:", error);
    return {
      success: false,
      error: error.message || "Errore nell'attivazione della card"
    };
  }
}

/**
 * Preview calcolo punti (per mostrare sullo scontrino prima del pagamento)
 */
export function previewPunti(importo: number) {
  const punti = calcolaPunti(importo);
  const prossimaSoglia = Math.ceil(importo / 2) * 2;
  const puntiProssimaSoglia = calcolaPunti(prossimaSoglia);
  
  return {
    puntiAttuali: punti,
    importoAttuale: importo,
    prossimaSoglia: importo < prossimaSoglia ? prossimaSoglia : null,
    puntiProssimaSoglia: importo < prossimaSoglia ? puntiProssimaSoglia : null,
    differenzaImporto: prossimaSoglia - importo
  };
}

/**
 * Genera codice cliente unico
 */
function generaCodiceCliente(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // Escluse I e O per evitare confusione
  const numbers = '23456789'; // Esclusi 0 e 1 per evitare confusione
  
  let code = '';
  
  // 3 lettere
  for (let i = 0; i < 3; i++) {
    code += letters[Math.floor(Math.random() * letters.length)];
  }
  
  // 4 numeri
  for (let i = 0; i < 4; i++) {
    code += numbers[Math.floor(Math.random() * numbers.length)];
  }
  
  return code;
}

/**
 * Recupera fidelity card tramite codice cliente (per PWA)
 */
export async function getFidelityCardByCodice(codiceCliente: string) {
  try {
    const card = await prisma.fidelityCard.findUnique({
      where: { codiceCliente },
      include: {
        cliente: {
          select: {
            nome: true,
            cognome: true,
            telefono: true,
          }
        },
        _count: {
          select: {
            movimenti: true,
            riscatti: {
              where: { statoUtilizzo: "ATTIVO" }
            }
          }
        }
      }
    });

    if (!card) {
      return {
        success: false,
        error: "Carta non trovata"
      };
    }

    // Controlla se serve reset mensile
    const oggi = new Date();
    const meseCorrente = oggi.getMonth();
    const meseCard = card.meseRiferimento.getMonth();
    
    let puntiMensiliAggiornati = card.puntiMensili;
    if (meseCorrente !== meseCard) {
      // Reset punti mensili
      await prisma.fidelityCard.update({
        where: { id: card.id },
        data: {
          puntiMensili: 0,
          meseRiferimento: oggi
        }
      });
      puntiMensiliAggiornati = 0;
    }

    // Calcola punti disponibili (totali - già utilizzati)
    const puntiUtilizzati = await prisma.movimentoPunti.aggregate({
      where: {
        fidelityCardId: card.id,
        tipo: { in: ["RISCATTO", "QUOTA"] },
        punti: { lt: 0 }
      },
      _sum: { punti: true }
    });

    const puntiDisponibili = card.puntiTotali + (puntiUtilizzati._sum.punti || 0);

    // Prepara i dati per la risposta
    const cardData = {
      id: card.id,
      codiceCliente: card.codiceCliente,
      nomeCliente: card.nomeCliente || `${card.cliente.nome} ${card.cliente.cognome || ''}`.trim(),
      punti: card.punti, // Per compatibilità sistema esistente
      puntiTotali: card.puntiTotali,
      puntiMensili: puntiMensiliAggiornati,
      puntiDisponibili,
      quotaAttiva: card.quotaPagata && card.dataScadenzaQuota && card.dataScadenzaQuota > oggi,
      dataScadenzaQuota: card.dataScadenzaQuota,
      prossimoReset: new Date(oggi.getFullYear(), oggi.getMonth() + 1, 1),
      riscattiAttivi: card._count.riscatti,
      dataCreazione: card.createdAt,
      dataUltimaModifica: card.updatedAt
    };

    return {
      success: true,
      card: serializeDecimalData(cardData)
    };
  } catch (error) {
    console.error("Errore recupero fidelity card:", error);
    return {
      success: false,
      error: "Errore nel recupero della carta"
    };
  }
}