"use server";

import { prisma } from "@/lib/db";

export async function getOrdinazioniConsegnate() {
  try {
    console.log("🔍 Recupero ordinazioni consegnate...");
    
    const ordinazioni = await prisma.ordinazione.findMany({
      where: {
        stato: {
          in: ["CONSEGNATO", "RICHIESTA_CONTO"]
        },
        statoPagamento: {
          not: "COMPLETAMENTE_PAGATO"
        }
      },
      include: {
        Tavolo: {
          select: {
            numero: true
          }
        },
        User: {
          select: {
            nome: true
          }
        },
        Cliente: {
          select: {
            nome: true,
            telefono: true
          }
        },
        RigaOrdinazione: {
          include: {
            Prodotto: {
              select: {
                nome: true
              }
            }
          }
        },
        Pagamento: {
          select: {
            importo: true,
            modalita: true
          }
        }
      },
      orderBy: {
        dataApertura: 'desc' // Più recenti prima
      }
    });

    console.log(`📊 Trovate ${ordinazioni.length} ordinazioni consegnate`);
    ordinazioni.forEach(ord => {
      console.log(`  - Ordine ${ord.numero}: stato=${ord.stato}, statoPagamento=${ord.statoPagamento}, totale=${ord.totale}`);
    });

    // Restituisci le ordinazioni nel formato che il componente ContiPage si aspetta
    return ordinazioni.map(ord => {
      const totalePagamenti = ord.Pagamento.reduce((sum, pag) => sum + pag.importo.toNumber(), 0);
      const totaleOrdine = ord.totale.toNumber();
      
      // Calcola informazioni sui pagamenti parziali
      const righePagate = ord.RigaOrdinazione.filter(riga => riga.isPagato).length;
      const righeNonPagate = ord.RigaOrdinazione.filter(riga => !riga.isPagato).length;
      const totaleRighePagate = ord.RigaOrdinazione
        .filter(riga => riga.isPagato)
        .reduce((sum, riga) => sum + (riga.prezzo.toNumber() * riga.quantita), 0);
      const totaleRigheNonPagate = ord.RigaOrdinazione
        .filter(riga => !riga.isPagato)
        .reduce((sum, riga) => sum + (riga.prezzo.toNumber() * riga.quantita), 0);
      
      return {
        id: ord.id,
        numero: ord.numero,
        tavolo: ord.Tavolo,
        tipo: ord.tipo,
        cameriere: ord.User,
        cliente: ord.Cliente,
        nomeCliente: ord.nomeCliente,
        totale: totaleOrdine,
        totalePagamenti: totalePagamenti,
        rimanente: totaleOrdine - totalePagamenti,
        pagato: totalePagamenti >= totaleOrdine,
        statoPagamento: ord.statoPagamento,
        stato: ord.stato,
        dataConsegna: ord.updatedAt.toISOString(),
        dataApertura: ord.dataApertura,
        // Informazioni dettagliate per pagamenti parziali
        righePagate,
        righeNonPagate,
        totaleRighePagate,
        totaleRigheNonPagate,
        hasPagamentoParziale: totalePagamenti > 0 && totalePagamenti < totaleOrdine,
        righe: ord.RigaOrdinazione.map(riga => ({
          id: riga.id,
          prezzo: riga.prezzo.toNumber(),
          quantita: riga.quantita,
          isPagato: riga.isPagato,
          pagatoDa: riga.pagatoDa || undefined,
          prodotto: riga.Prodotto
        })),
        pagamenti: ord.Pagamento.map(pag => ({
          importo: pag.importo.toNumber(),
          modalita: pag.modalita
        }))
      };
    });
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
          in: ["CONSEGNATO", "RICHIESTA_CONTO"]
        },
        // Filtra solo quelle che potrebbero aver bisogno di scontrino
        updatedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Ultime 24 ore
        }
      },
      include: {
        Tavolo: {
          select: {
            numero: true
          }
        },
        User: {
          select: {
            nome: true
          }
        },
        Pagamento: {
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
      .filter(ord => ord.Pagamento.length > 0) // Solo ordini pagati
      .map(ord => {
        const ultimoPagamento = ord.Pagamento[ord.Pagamento.length - 1];
        const importoTotale = ord.Pagamento.reduce((sum: number, pag: any) => sum + pag.importo.toNumber(), 0);
        
        return {
          id: `req-${ord.id}`,
          orderId: ord.id,
          tavolo: ord.Tavolo,
          tipo: ord.tipo,
          richiedente: ord.User?.nome || "Sistema",
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
        Tavolo: true,
        User: {
          select: {
            nome: true
          }
        },
        RigaOrdinazione: {
          include: {
            Prodotto: true
          }
        },
        Pagamento: true
      }
    });

    if (!ordinazione) {
      return { success: false, error: "Ordinazione non trovata" };
    }

    // Simula la generazione dello scontrino
    const scontrino = {
      numero: `SCO-${Date.now()}`,
      data: new Date().toISOString(),
      tavolo: ordinazione.Tavolo?.numero,
      cameriere: ordinazione.User?.nome,
      righe: ordinazione.RigaOrdinazione.map(riga => ({
        prodotto: riga.Prodotto.nome,
        quantita: riga.quantita,
        prezzo: riga.prezzo.toNumber(),
        totale: riga.prezzo.toNumber() * riga.quantita
      })),
      totale: ordinazione.totale.toNumber(),
      pagamenti: ordinazione.Pagamento.map(pag => ({
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