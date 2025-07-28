"use server";

import { prisma } from "@/lib/db";

export async function getOrdinazioniConsegnate() {
  try {
    const ordinazioni = await prisma.ordinazione.findMany({
      where: {
        stato: {
          in: ["CONSEGNATA", "RITIRATA"]
        },
        statoPagamento: {
          not: "COMPLETAMENTE_PAGATO"
        }
      },
      include: {
        tavolo: {
          select: {
            numero: true
          }
        },
        cameriere: {
          select: {
            nome: true
          }
        },
        cliente: {
          select: {
            nome: true,
            telefono: true
          }
        },
        righe: {
          include: {
            prodotto: {
              select: {
                nome: true
              }
            }
          }
        },
        pagamenti: {
          select: {
            importo: true,
            modalita: true
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      },
      take: 50 // Limite per performance
    });

    // Serializza i dati e calcola se l'ordine è pagato
    const ordiniFormattati = ordinazioni.map(ord => {
      const totalePagamenti = ord.pagamenti.reduce((sum, pag) => sum + pag.importo.toNumber(), 0);
      const totaleOrdine = ord.totale.toNumber();
      
      return {
        id: ord.id,
        tavolo: ord.tavolo,
        tipo: ord.tipo,
        cameriere: ord.cameriere,
        cliente: ord.cliente,
        nomeCliente: ord.nomeCliente,
        totale: totaleOrdine,
        pagato: totalePagamenti >= totaleOrdine,
        statoPagamento: ord.statoPagamento,
        dataConsegna: ord.updatedAt,
        righe: ord.righe.map(riga => ({
          ...riga,
          prezzo: riga.prezzo.toNumber(),
          isPagato: riga.isPagato,
          pagatoDa: riga.pagatoDa,
          prodotto: riga.prodotto
        }))
      };
    });

    return ordiniFormattati;
  } catch (error) {
    console.error("Errore recupero ordinazioni consegnate:", error);
    return [];
  }
}

export async function getRichiesteScontrino() {
  try {
    // Per ora simulo le richieste di scontrino
    // In un sistema reale, queste potrebbero essere memorizzate in una tabella dedicata
    const ordinazioniConsegnate = await prisma.ordinazione.findMany({
      where: {
        stato: {
          in: ["CONSEGNATA", "RITIRATA"]
        },
        // Filtra solo quelle che potrebbero aver bisogno di scontrino
        updatedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Ultime 24 ore
        }
      },
      include: {
        tavolo: {
          select: {
            numero: true
          }
        },
        cameriere: {
          select: {
            nome: true
          }
        },
        pagamenti: {
          select: {
            importo: true,
            modalita: true,
            timestamp: true
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      },
      take: 20
    });

    // Simula richieste di scontrino basate sui pagamenti recenti
    const richiesteSimulate = ordinazioniConsegnate
      .filter(ord => ord.pagamenti.length > 0) // Solo ordini pagati
      .map(ord => {
        const ultimoPagamento = ord.pagamenti[ord.pagamenti.length - 1];
        const importoTotale = ord.pagamenti.reduce((sum, pag) => sum + pag.importo.toNumber(), 0);
        
        return {
          id: `req-${ord.id}`,
          orderId: ord.id,
          tavolo: ord.tavolo,
          tipo: ord.tipo,
          richiedente: ord.cameriere?.nome || "Sistema",
          importo: importoTotale,
          dataRichiesta: ultimoPagamento.timestamp,
          stato: Math.random() > 0.7 ? "PENDING" : Math.random() > 0.5 ? "PROCESSING" : "COMPLETED"
        };
      })
      .filter(req => req.stato === "PENDING" || req.stato === "PROCESSING"); // Solo quelle da processare

    return richiesteSimulate;
  } catch (error) {
    console.error("Errore recupero richieste scontrino:", error);
    return [];
  }
}

export async function generaScontrino(orderId: string) {
  try {
    if (!orderId) {
      return { success: false, error: "ID ordine mancante" };
    }

    // Recupera l'ordinazione con tutti i dettagli
    const ordinazione = await prisma.ordinazione.findUnique({
      where: { id: orderId },
      include: {
        tavolo: true,
        cameriere: {
          select: {
            nome: true
          }
        },
        righe: {
          include: {
            prodotto: true
          }
        },
        pagamenti: true
      }
    });

    if (!ordinazione) {
      return { success: false, error: "Ordinazione non trovata" };
    }

    // Simula la generazione dello scontrino
    const scontrino = {
      numero: `SCO-${Date.now()}`,
      data: new Date().toISOString(),
      tavolo: ordinazione.tavolo?.numero,
      cameriere: ordinazione.cameriere?.nome,
      righe: ordinazione.righe.map(riga => ({
        prodotto: riga.prodotto.nome,
        quantita: riga.quantita,
        prezzo: riga.prezzo.toNumber(),
        totale: riga.prezzo.toNumber() * riga.quantita
      })),
      totale: ordinazione.totale.toNumber(),
      pagamenti: ordinazione.pagamenti.map(pag => ({
        metodo: pag.modalita,
        importo: pag.importo.toNumber()
      }))
    };

    // In un sistema reale, qui si invierebbe lo scontrino alla stampante fiscale
    console.log("📄 Scontrino generato:", scontrino);

    return {
      success: true,
      scontrino: scontrino,
      message: `Scontrino ${scontrino.numero} generato con successo`
    };

  } catch (error) {
    console.error("Errore generazione scontrino:", error);
    return { success: false, error: "Errore interno del server" };
  }
}