"use server";

import { prisma } from "@/lib/db";

export async function getOrdinazioniPerStato() {
  try {
    console.log("🔍 Recupero ordinazioni per stato...");
    
    // Recupera ordini CONSEGNATO, RICHIESTA_CONTO e PAGAMENTO_RICHIESTO (tavoli da pagare)
    // Escludi ordini PARZIALMENTE_PAGATO che saranno in ordinazioniDaPagare
    const ordinazioniRitirate = await prisma.ordinazione.findMany({
      where: {
        stato: {
          in: ["CONSEGNATO", "RICHIESTA_CONTO", "PAGAMENTO_RICHIESTO"]
        },
        statoPagamento: "NON_PAGATO"
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
          select: {
            id: true,
            quantita: true,
            prezzo: true,
            note: true,
            isPagato: true,
            pagatoDa: true,
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
            modalita: true,
            clienteNome: true,
            timestamp: true
          }
        }
      },
      orderBy: {
        dataApertura: 'desc'
      }
    });

    // Recupera ordini con stato pagamento PARZIALMENTE_PAGATO (pagando - in attesa di pagamento completo)
    const ordinazioniDaPagare = await prisma.ordinazione.findMany({
      where: {
        statoPagamento: "PARZIALMENTE_PAGATO",
        stato: {
          in: ["CONSEGNATO", "RICHIESTA_CONTO", "PAGAMENTO_RICHIESTO"]
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
          select: {
            id: true,
            quantita: true,
            prezzo: true,
            note: true,
            isPagato: true,
            pagatoDa: true,
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
            modalita: true,
            clienteNome: true,
            timestamp: true
          }
        }
      },
      orderBy: {
        dataApertura: 'desc'
      }
    });

    // Recupera ordini PAGATO (ultimi 50)
    const ordinazioniPagate = await prisma.ordinazione.findMany({
      where: {
        OR: [
          { statoPagamento: "COMPLETAMENTE_PAGATO" },
          { stato: "PAGATO" }
        ]
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
          select: {
            id: true,
            quantita: true,
            prezzo: true,
            note: true,
            isPagato: true,
            pagatoDa: true,
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
            modalita: true,
            clienteNome: true,
            timestamp: true
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      },
      take: 50
    });

    console.log(`📊 Trovate ${ordinazioniRitirate.length} ordini RITIRATO (da pagare), ${ordinazioniDaPagare.length} ordini DA_PAGARE (parzialmente pagati), ${ordinazioniPagate.length} ordini PAGATO`);
    
    // Debug: mostra il primo ordine di ogni categoria
    if (ordinazioniRitirate.length > 0) {
      console.log('Esempio ordine ritirato:', {
        id: ordinazioniRitirate[0].id,
        numero: ordinazioniRitirate[0].numero,
        stato: ordinazioniRitirate[0].stato,
        statoPagamento: ordinazioniRitirate[0].statoPagamento,
        totale: ordinazioniRitirate[0].totale
      });
    }

    const mapOrdinazione = (ord: any) => {
      const totalePagamenti = ord.Pagamento.reduce((sum: number, pag: any) => sum + pag.importo.toNumber(), 0);
      const totaleOrdine = ord.totale.toNumber();
      
      // Debug: log per ordini con pagamenti
      if (totalePagamenti > 0) {
        console.log(`📋 Ordine #${ord.numero} - Righe:`, ord.RigaOrdinazione.map((r: any) => ({
          id: r.id,
          prodotto: r.Prodotto?.nome,
          isPagato: r.isPagato,
          pagatoDa: r.pagatoDa
        })));
      }
      
      // Per ora usa il calcolo standard: totale - pagamenti
      // TODO: Implementare tracciamento quantità parziali
      const rimanenteEffettivo = Math.max(0, totaleOrdine - totalePagamenti);
      
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
        totalePagato: totalePagamenti, // Aggiungi questo per compatibilità
        rimanente: rimanenteEffettivo,
        pagato: rimanenteEffettivo === 0 && totalePagamenti > 0,
        statoPagamento: ord.statoPagamento,
        stato: ord.stato,
        dataConsegna: ord.updatedAt.toISOString(),
        dataApertura: ord.dataApertura,
        righe: ord.RigaOrdinazione.map((riga: any) => ({
          id: riga.id,
          prezzo: riga.prezzo.toNumber(),
          quantita: riga.quantita,
          isPagato: riga.isPagato || false,  // Assicurati che sia sempre un boolean
          pagatoDa: riga.pagatoDa || null,
          prodotto: riga.Prodotto,
          note: riga.note
        })),
        pagamenti: ord.Pagamento.map((pag: any) => ({
          importo: pag.importo.toNumber(),
          modalita: pag.modalita,
          clienteNome: pag.clienteNome,
          timestamp: pag.timestamp,
          righeIds: pag.righeIds // Aggiungi info su quali righe sono state pagate
        }))
      };
    };

    // Recupera debiti aperti con limite (ultimi 20)
    const debiti = await prisma.debito.findMany({
      where: {
        stato: {
          in: ["APERTO", "PARZIALMENTE_PAGATO"]
        },
        // Solo debiti degli ultimi 30 giorni per performance
        dataCreazione: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        }
      },
      include: {
        Cliente: true,
        Ordinazione: {
          include: {
            Tavolo: true
          }
        },
        PagamentiDebito: true
      },
      orderBy: {
        dataCreazione: 'desc'
      },
      take: 20 // Limita a 20 debiti per performance
    });

    console.log(`📊 Trovati ${debiti.length} debiti aperti`);

    const debitiMapped = debiti.map((debito: any) => {
      const totalePagato = debito.PagamentiDebito.reduce(
        (sum: number, pag: any) => sum + pag.importo.toNumber(),
        0
      );
      const rimanente = debito.importo.toNumber() - totalePagato;

      return {
        id: debito.id,
        clienteId: debito.clienteId,
        clienteNome: debito.Cliente.nome,
        ordinazioneId: debito.ordinazioneId,
        numeroOrdine: debito.Ordinazione?.numero || null,
        tavolo: debito.Ordinazione?.Tavolo || null,
        importo: debito.importo.toNumber(),
        importoPagato: totalePagato,
        rimanente,
        stato: debito.stato,
        dataCreazione: debito.dataCreazione.toISOString(),
        note: debito.note
      };
    });

    // Aggrega ordini per tavolo lato server per evitare duplicazioni
    const aggregaPerTavolo = (ordini: any[]) => {
      const tavoliMap = new Map<string, any>();
      
      ordini.forEach(ord => {
        const tavoloKey = ord.tavolo?.numero || 'Asporto';
        
        if (!tavoliMap.has(tavoloKey)) {
          tavoliMap.set(tavoloKey, {
            tavoloNumero: tavoloKey,
            ordinazioni: [],
            totaleComplessivo: 0,
            totalePagatoComplessivo: 0,
            rimanenteComplessivo: 0,
            numeroClienti: 0,
            clientiNomi: [],
            primaDaApertura: ord.dataApertura
          });
        }
        
        const gruppo = tavoliMap.get(tavoloKey);
        gruppo.ordinazioni.push(ord);
        gruppo.totaleComplessivo += ord.totale;
        gruppo.totalePagatoComplessivo += ord.totalePagato || 0;
        gruppo.rimanenteComplessivo += ord.rimanente;
        
        if (ord.nomeCliente && !gruppo.clientiNomi.includes(ord.nomeCliente)) {
          gruppo.clientiNomi.push(ord.nomeCliente);
          gruppo.numeroClienti++;
        } else if (!ord.nomeCliente) {
          gruppo.numeroClienti++;
        }
        
        if (new Date(ord.dataApertura) < new Date(gruppo.primaDaApertura)) {
          gruppo.primaDaApertura = ord.dataApertura;
        }
      });
      
      return Array.from(tavoliMap.values());
    };
    
    // Prepara dati mappati
    const ritirateMap = ordinazioniRitirate.map(mapOrdinazione);
    const daPagareMap = ordinazioniDaPagare.map(mapOrdinazione);
    const pagateMap = ordinazioniPagate.map(mapOrdinazione);
    
    const result = {
      ritirate: ritirateMap,
      daPagare: daPagareMap,
      pagate: pagateMap,
      debiti: debitiMapped,
      // Aggiungi dati pre-aggregati per tavolo per evitare duplicazioni client-side
      tavoliRitirate: aggregaPerTavolo(ritirateMap),
      tavoliDaPagare: aggregaPerTavolo(daPagareMap),
      tavoliPagate: aggregaPerTavolo(pagateMap)
    };
    
    console.log(`📊 Ritorno risultati: ${result.ritirate.length} ritirate (${result.tavoliRitirate.length} tavoli), ${result.daPagare.length} da pagare (${result.tavoliDaPagare.length} tavoli), ${result.pagate.length} pagate (${result.tavoliPagate.length} tavoli), ${result.debiti.length} debiti`);
    
    return result;
  } catch (error) {
    console.error("Errore recupero ordinazioni per stato:", error);
    return {
      ritirate: [],
      daPagare: [],
      pagate: [],
      debiti: []
    };
  }
}

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
          select: {
            id: true,
            quantita: true,
            prezzo: true,
            note: true,
            isPagato: true,
            pagatoDa: true,
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
            modalita: true,
            clienteNome: true,
            timestamp: true
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
      
      // Per ora usa il calcolo standard: totale - pagamenti
      // TODO: Implementare tracciamento quantità parziali
      const rimanenteEffettivo = totaleOrdine - totalePagamenti;
      
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
        rimanente: rimanenteEffettivo,
        pagato: rimanenteEffettivo <= 0,
        statoPagamento: ord.statoPagamento,
        stato: ord.stato,
        dataConsegna: ord.updatedAt.toISOString(),
        dataApertura: ord.dataApertura,
        // Informazioni dettagliate per pagamenti parziali
        righePagate,
        righeNonPagate,
        totaleRighePagate,
        totaleRigheNonPagate,
        hasPagamentoParziale: totalePagamenti > 0 && rimanenteEffettivo > 0,
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
          modalita: pag.modalita,
          clienteNome: pag.clienteNome,
          timestamp: pag.timestamp
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