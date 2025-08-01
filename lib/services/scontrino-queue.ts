"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-multi-tenant";
import { revalidatePath } from "next/cache";
import crypto from "crypto";
import { nanoid } from "nanoid";

export interface RigaScontrino {
  prodotto: string;
  quantita: number;
  prezzoUnitario: number;
  totaleRiga: number;
  isPagato?: boolean;
  pagatoDa?: string;
}

export interface DatiScontrino {
  tavoloNumero?: string;
  clienteNome?: string;
  cameriereNome?: string;
  righe: RigaScontrino[];
  totale: number;
  modalitaPagamento?: "POS" | "CONTANTI" | "MISTO";
  ordinazioneIds: string[];
  pagamentoIds: string[];
  sessionePagamento?: string;
}

// Crea una nuova richiesta di scontrino nella queue
export async function creaScontrinoQueue(
  tipo: "NON_FISCALE" | "FISCALE",
  dati: DatiScontrino,
  priorita: "BASSA" | "NORMALE" | "ALTA" | "URGENTE" = "NORMALE"
) {
  try {
    const utente = await getCurrentUser();
    if (!utente) {
      return { success: false, error: "Utente non autenticato" };
    }

    // Genera hash per verifica integrità
    const contenutoCompleto = {
      tipo,
      dati,
      timestamp: new Date().toISOString(),
      operatore: utente.nome
    };
    
    const hash = crypto
      .createHash('sha256')
      .update(JSON.stringify(contenutoCompleto))
      .digest('hex');

    // Crea record nella queue
    const scontrino = await prisma.queueScontrino.create({
      data: {
        id: nanoid(),
        tipo,
        priorita,
        tavoloNumero: dati.tavoloNumero,
        sessionePagamento: dati.sessionePagamento,
        righe: JSON.stringify(dati.righe),
        totale: dati.totale,
        modalitaPagamento: dati.modalitaPagamento,
        clienteNome: dati.clienteNome,
        cameriereNome: dati.cameriereNome,
        ordinazioneIds: dati.ordinazioneIds,
        pagamentoIds: dati.pagamentoIds,
        operatoreId: utente.id,
        contenutoCompleto: JSON.stringify(contenutoCompleto),
        hash
      }
    });

    console.log(`[ScontrinoQueue] Creato scontrino ${tipo} - ID: ${scontrino.id}`);

    return {
      success: true,
      scontrinoId: scontrino.id,
      message: `Scontrino ${tipo} aggiunto alla queue`
    };

  } catch (error) {
    console.error("Errore creazione scontrino queue:", error);
    return {
      success: false,
      error: "Errore interno del server"
    };
  }
}

// Crea scontrino batch per più pagamenti dello stesso tavolo
export async function creaScontrinoBatch(
  tavoloNumero: string,
  pagamentiIds: string[],
  sessionePagamento: string
) {
  try {
    console.log(`[ScontrinoQueue] Creazione batch per tavolo ${tavoloNumero}, sessione ${sessionePagamento}`);

    // Recupera tutti i pagamenti della sessione
    const pagamenti = await prisma.pagamento.findMany({
      where: {
        id: { in: pagamentiIds }
      },
      include: {
        Ordinazione: {
          include: {
            RigaOrdinazione: {
              include: {
                Prodotto: true
              }
            },
            User: true,
            Tavolo: true
          }
        }
      }
    });

    if (pagamenti.length === 0) {
      return { success: false, error: "Nessun pagamento trovato" };
    }

    // Raggruppa righe per scontrino
    const righeMap = new Map<string, RigaScontrino>();
    let totaleComplessivo = 0;
    const ordinazioneIds = new Set<string>();

    for (const pagamento of pagamenti) {
      totaleComplessivo += pagamento.importo.toNumber();
      ordinazioneIds.add(pagamento.ordinazioneId);

      // Trova le righe pagate in questo pagamento
      const righeIds = Array.isArray(pagamento.righeIds) ? pagamento.righeIds : [];
      
      for (const rigaId of righeIds) {
        const riga = pagamento.Ordinazione.RigaOrdinazione.find((r: any) => r.id === rigaId);
        if (riga) {
          const key = `${riga.Prodotto.nome}-${riga.prezzo.toNumber()}`;
          
          if (righeMap.has(key)) {
            const rigaEsistente = righeMap.get(key)!;
            rigaEsistente.quantita += riga.quantita;
            rigaEsistente.totaleRiga += riga.prezzo.toNumber() * riga.quantita;
          } else {
            righeMap.set(key, {
              prodotto: riga.Prodotto.nome,
              quantita: riga.quantita,
              prezzoUnitario: riga.prezzo.toNumber(),
              totaleRiga: riga.prezzo.toNumber() * riga.quantita,
              isPagato: true,
              pagatoDa: pagamento.clienteNome || undefined
            });
          }
        }
      }
    }

    const righe = Array.from(righeMap.values());
    const primoP = pagamenti[0];
    const datiScontrino: DatiScontrino = {
      tavoloNumero,
      clienteNome: primoP.clienteNome || undefined,
      cameriereNome: primoP.Ordinazione.User.nome,
      righe,
      totale: totaleComplessivo,
      modalitaPagamento: pagamenti.length === 1 ? pagamenti[0].modalita : "MISTO",
      ordinazioneIds: Array.from(ordinazioneIds),
      pagamentoIds: pagamentiIds,
      sessionePagamento
    };

    // Crea scontrino non fiscale dettagliato
    const resultNonFiscale = await creaScontrinoQueue("NON_FISCALE", datiScontrino, "NORMALE");
    
    // Crea scontrino fiscale con totale
    const datiScontrinoFiscale: DatiScontrino = {
      ...datiScontrino,
      righe: [{
        prodotto: `Totale Tavolo ${tavoloNumero}`,
        quantita: 1,
        prezzoUnitario: totaleComplessivo,
        totaleRiga: totaleComplessivo
      }]
    };
    const resultFiscale = await creaScontrinoQueue("FISCALE", datiScontrinoFiscale, "ALTA");

    console.log(`[ScontrinoQueue] Batch creato: NonFiscale=${resultNonFiscale.scontrinoId}, Fiscale=${resultFiscale.scontrinoId}`);

    return {
      success: true,
      scontriniIds: {
        nonFiscale: resultNonFiscale.scontrinoId,
        fiscale: resultFiscale.scontrinoId
      },
      totale: totaleComplessivo,
      message: `Scontrini batch creati per tavolo ${tavoloNumero}`
    };

  } catch (error) {
    console.error("Errore creazione scontrino batch:", error);
    return {
      success: false,
      error: "Errore creazione scontrino batch"
    };
  }
}

// Recupera prossimi scontrini da stampare
export async function getProssimiScontrini(limite: number = 5) {
  try {
    const scontrini = await prisma.queueScontrino.findMany({
      where: {
        stato: { in: ["IN_CODA", "ERRORE"] },
        tentativiStampa: { lt: 3 } // Ancora tentativi disponibili
      },
      orderBy: [
        { priorita: "desc" },
        { timestampCreazione: "asc" }
      ],
      take: limite,
      include: {
        User: {
          select: { nome: true }
        }
      }
    });

    return {
      success: true,
      scontrini: scontrini.map(s => ({
        ...s,
        totale: s.totale.toNumber()
      }))
    };

  } catch (error) {
    console.error("Errore recupero scontrini queue:", error);
    return {
      success: false,
      error: "Errore recupero queue"
    };
  }
}

// Marca scontrino come stampato
export async function marcaScontrinoStampato(scontrinoId: string) {
  try {
    await prisma.queueScontrino.update({
      where: { id: scontrinoId },
      data: {
        stato: "STAMPATO",
        timestampStampa: new Date()
      }
    });

    return { success: true };

  } catch (error) {
    console.error("Errore aggiornamento scontrino:", error);
    return { success: false, error: "Errore aggiornamento stato" };
  }
}

// Marca scontrino con errore
export async function marcaScontrinoErrore(scontrinoId: string, errore: string) {
  try {
    await prisma.queueScontrino.update({
      where: { id: scontrinoId },
      data: {
        stato: "ERRORE",
        timestampErrore: new Date(),
        messaggioErrore: errore,
        tentativiStampa: { increment: 1 }
      }
    });

    return { success: true };

  } catch (error) {
    console.error("Errore aggiornamento errore scontrino:", error);
    return { success: false, error: "Errore aggiornamento errore" };
  }
}

// Pulisci scontrini vecchi (più di 7 giorni)
export async function pulisciScontriniVecchi() {
  try {
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - 7);

    const result = await prisma.queueScontrino.deleteMany({
      where: {
        timestampCreazione: { lt: dataLimite },
        stato: { in: ["STAMPATO", "ANNULLATO"] }
      }
    });

    console.log(`[ScontrinoQueue] Puliti ${result.count} scontrini vecchi`);

    return {
      success: true,
      eliminati: result.count
    };

  } catch (error) {
    console.error("Errore pulizia scontrini:", error);
    return { success: false, error: "Errore pulizia" };
  }
}

// Statistiche queue
export async function getStatisticheScontrini() {
  try {
    const [inCoda, inStampa, stampati, errori] = await Promise.all([
      prisma.queueScontrino.count({ where: { stato: "IN_CODA" } }),
      prisma.queueScontrino.count({ where: { stato: "IN_STAMPA" } }),
      prisma.queueScontrino.count({ 
        where: { 
          stato: "STAMPATO",
          timestampStampa: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        } 
      }),
      prisma.queueScontrino.count({ where: { stato: "ERRORE" } })
    ]);

    return {
      success: true,
      stats: {
        inCoda,
        inStampa,
        stampatiOggi: stampati,
        errori
      }
    };

  } catch (error) {
    console.error("Errore statistiche scontrini:", error);
    return { success: false, error: "Errore statistiche" };
  }
}