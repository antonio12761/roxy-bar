"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-multi-tenant";
import { revalidatePath } from "next/cache";
import { secureLog } from "@/lib/utils/log-sanitizer";
import { Decimal } from "@prisma/client/runtime/library";

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

    // Genera dati scontrino per stampante Bluetooth
    const scontrino = {
      numero: `SCO-${Date.now()}`,
      data: new Date().toISOString(),
      tavolo: ordinazione.Tavolo?.numero,
      cameriere: ordinazione.User?.nome,
      nomeCliente: ordinazione.nomeCliente,
      righe: ordinazione.RigaOrdinazione.map(riga => ({
        nome: riga.Prodotto.nome,
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

    console.log("📄 Scontrino generato per stampante:", scontrino);

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

export interface PaymentHistory {
  id: string;
  importo: number;
  modalita: string;
  clienteNome: string | null;
  timestamp: string;
  operatore: {
    nome: string;
  } | null;
  ordinazione: {
    id: string;
    numero: number;
    tavolo: {
      numero: string;
    } | null;
    righe: Array<{
      id: string;
      quantita: number;
      prezzo: number;
      prodotto: {
        nome: string;
      };
    }>;
  };
}

export interface ReceiptRequest {
  id: string;
  orderId: string;
  tavolo: {
    numero: string;
  } | null;
  tipo: string;
  richiedente: string;
  importo: number;
  dataRichiesta: Date;
  stato: 'PENDING' | 'PROCESSING' | 'COMPLETED';
}

/**
 * Recupera lo storico dei pagamenti
 */
export async function getPaymentHistory(date?: string) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return { 
        success: false, 
        error: "Non autenticato" 
      };
    }

    // Verifica permessi (CASSA o superiore)
    if (!["ADMIN", "MANAGER", "CASSA", "SUPERVISORE"].includes(user.ruolo)) {
      return { 
        success: false, 
        error: "Permessi insufficienti" 
      };
    }

    let dateFilter = {};
    if (date) {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      
      dateFilter = {
        timestamp: {
          gte: startDate,
          lte: endDate
        }
      };
    }

    const payments = await prisma.pagamento.findMany({
      where: dateFilter,
      include: {
        User: {
          select: {
            nome: true
          }
        },
        Ordinazione: {
          select: {
            id: true,
            numero: true,
            Tavolo: {
              select: {
                numero: true
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
            }
          }
        }
      },
      orderBy: {
        timestamp: 'desc'
      }
    });

    // Serializza i dati per evitare problemi con Decimal
    const serializedPayments: PaymentHistory[] = payments.map(payment => ({
      id: payment.id,
      importo: (payment.importo as Decimal).toNumber(),
      modalita: payment.modalita,
      clienteNome: payment.clienteNome,
      timestamp: payment.timestamp.toISOString(),
      operatore: payment.User,
      ordinazione: {
        id: payment.Ordinazione.id,
        numero: payment.Ordinazione.numero,
        tavolo: payment.Ordinazione.Tavolo,
        righe: payment.Ordinazione.RigaOrdinazione.map((riga) => ({
          id: riga.id,
          quantita: riga.quantita,
          prezzo: (riga.prezzo as Decimal).toNumber(),
          prodotto: riga.Prodotto
        }))
      }
    }));

    return {
      success: true,
      data: serializedPayments
    };
  } catch (error) {
    secureLog.error('Get payment history error:', error);
    return { 
      success: false, 
      error: 'Errore nel recupero dello storico pagamenti' 
    };
  }
}

/**
 * Recupera le richieste di scontrino pendenti
 */
export async function getReceiptRequests() {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return { 
        success: false, 
        error: "Non autenticato" 
      };
    }

    // Verifica permessi (CASSA o superiore)
    if (!["ADMIN", "MANAGER", "CASSA", "SUPERVISORE"].includes(user.ruolo)) {
      return { 
        success: false, 
        error: "Permessi insufficienti" 
      };
    }

    // Per ora simula le richieste di scontrino
    // In un sistema reale, queste potrebbero essere memorizzate in una tabella dedicata
    const ordinazioniConsegnate = await prisma.ordinazione.findMany({
      where: {
        stato: "CONSEGNATO",
        // Filtra solo quelle che potrebbero aver bisogno di scontrino
        dataChiusura: {
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
        dataChiusura: 'desc'
      },
      take: 20
    });

    // Simula richieste di scontrino basate sui pagamenti recenti
    const richiesteSimulate: ReceiptRequest[] = ordinazioniConsegnate
      .filter(ord => ord.Pagamento.length > 0) // Solo ordini pagati
      .map(ord => {
        const ultimoPagamento = ord.Pagamento[ord.Pagamento.length - 1];
        const importoTotale = ord.Pagamento.reduce(
          (sum: number, pag) => sum + (pag.importo as Decimal).toNumber(), 
          0
        );
        
        return {
          id: `req-${ord.id}`,
          orderId: ord.id,
          tavolo: ord.Tavolo,
          tipo: ord.tipo,
          richiedente: ord.User?.nome || "Sistema",
          importo: importoTotale,
          dataRichiesta: ultimoPagamento.timestamp,
          stato: Math.random() > 0.7 ? "PENDING" : Math.random() > 0.5 ? "PROCESSING" : "COMPLETED"
        } as ReceiptRequest;
      })
      .filter(req => req.stato === "PENDING" || req.stato === "PROCESSING"); // Solo quelle da processare

    return {
      success: true,
      data: richiesteSimulate
    };
  } catch (error) {
    secureLog.error('Get receipt requests error:', error);
    return { 
      success: false, 
      error: 'Errore nel recupero delle richieste scontrino' 
    };
  }
}

/**
 * Recupera il totale incassato per periodo
 */
export async function getCashTotal(startDate?: Date, endDate?: Date) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return { 
        success: false, 
        error: "Non autenticato" 
      };
    }

    // Verifica permessi (CASSA o superiore)
    if (!["ADMIN", "MANAGER", "CASSA", "SUPERVISORE"].includes(user.ruolo)) {
      return { 
        success: false, 
        error: "Permessi insufficienti" 
      };
    }

    // Default: oggi
    const start = startDate || new Date();
    start.setHours(0, 0, 0, 0);
    
    const end = endDate || new Date();
    end.setHours(23, 59, 59, 999);

    // Recupera totali per modalità di pagamento
    const totaliPerModalita = await prisma.pagamento.groupBy({
      by: ['modalita'],
      where: {
        timestamp: {
          gte: start,
          lte: end
        }
      },
      _sum: {
        importo: true
      },
      _count: true
    });

    // Recupera totale generale
    const totaleGenerale = await prisma.pagamento.aggregate({
      where: {
        timestamp: {
          gte: start,
          lte: end
        }
      },
      _sum: {
        importo: true
      },
      _count: true
    });

    const result = {
      periodo: {
        inizio: start.toISOString(),
        fine: end.toISOString()
      },
      totaleGenerale: {
        importo: totaleGenerale._sum.importo?.toNumber() || 0,
        numeroTransazioni: totaleGenerale._count
      },
      totaliPerModalita: totaliPerModalita.map(t => ({
        modalita: t.modalita,
        importo: t._sum.importo?.toNumber() || 0,
        numeroTransazioni: t._count
      }))
    };

    return {
      success: true,
      data: result
    };
  } catch (error) {
    secureLog.error('Get cash total error:', error);
    return { 
      success: false, 
      error: 'Errore nel calcolo dei totali' 
    };
  }
}

/**
 * Genera report giornaliero cassa
 */
export async function generateDailyCashReport(date?: Date) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return { 
        success: false, 
        error: "Non autenticato" 
      };
    }

    // Verifica permessi (CASSA o superiore)
    if (!["ADMIN", "MANAGER", "CASSA", "SUPERVISORE"].includes(user.ruolo)) {
      return { 
        success: false, 
        error: "Permessi insufficienti" 
      };
    }

    const reportDate = date || new Date();
    const startDate = new Date(reportDate);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(reportDate);
    endDate.setHours(23, 59, 59, 999);

    // 1. Totale incassato per modalità
    const totaliModalita = await prisma.pagamento.groupBy({
      by: ['modalita'],
      where: {
        timestamp: {
          gte: startDate,
          lte: endDate
        }
      },
      _sum: {
        importo: true
      },
      _count: true
    });

    // 2. Totale ordini per tipo
    const ordiniPerTipo = await prisma.ordinazione.groupBy({
      by: ['tipo'],
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate
        },
        stato: 'PAGATO'
      },
      _count: true,
      _sum: {
        totale: true
      }
    });

    // 3. Top prodotti venduti
    const topProdotti = await prisma.rigaOrdinazione.groupBy({
      by: ['prodottoId'],
      where: {
        Ordinazione: {
          createdAt: {
            gte: startDate,
            lte: endDate
          },
          stato: 'PAGATO'
        }
      },
      _sum: {
        quantita: true,
        prezzo: true
      },
      orderBy: {
        _sum: {
          quantita: 'desc'
        }
      },
      take: 10
    });

    // Recupera dettagli prodotti
    const prodottiIds = topProdotti.map(p => p.prodottoId);
    const prodotti = await prisma.prodotto.findMany({
      where: { id: { in: prodottiIds } },
      select: { id: true, nome: true, categoria: true }
    });

    const topProdottiConDettagli = topProdotti.map(tp => {
      const prodotto = prodotti.find(p => p.id === tp.prodottoId);
      return {
        prodotto: prodotto?.nome || 'Sconosciuto',
        categoria: prodotto?.categoria || '',
        quantita: tp._sum.quantita || 0,
        totale: tp._sum.prezzo?.toNumber() || 0
      };
    });

    // 4. Riepilogo cassa
    const riepilogo = {
      data: reportDate.toLocaleDateString('it-IT'),
      operatore: user.nome,
      totaliModalita: totaliModalita.map(t => ({
        modalita: t.modalita,
        importo: t._sum.importo?.toNumber() || 0,
        transazioni: t._count
      })),
      ordiniPerTipo: ordiniPerTipo.map(o => ({
        tipo: o.tipo,
        numero: o._count,
        totale: o._sum.totale?.toNumber() || 0
      })),
      topProdotti: topProdottiConDettagli,
      totaleGenerale: totaliModalita.reduce(
        (sum, t) => sum + (t._sum.importo?.toNumber() || 0), 
        0
      ),
      numeroTransazioni: totaliModalita.reduce((sum, t) => sum + t._count, 0)
    };

    return {
      success: true,
      data: riepilogo
    };
  } catch (error) {
    secureLog.error('Generate daily cash report error:', error);
    return { 
      success: false, 
      error: 'Errore nella generazione del report' 
    };
  }
}

/**
 * Marca una richiesta scontrino come processata
 */
export async function markReceiptAsProcessed(requestId: string) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return { 
        success: false, 
        error: "Non autenticato" 
      };
    }

    // Verifica permessi (CASSA o superiore)
    if (!["ADMIN", "MANAGER", "CASSA", "SUPERVISORE"].includes(user.ruolo)) {
      return { 
        success: false, 
        error: "Permessi insufficienti" 
      };
    }

    // In un sistema reale, aggiorneremmo una tabella dedicata
    // Per ora simula l'aggiornamento
    
    // Revalidate pages
    revalidatePath('/cassa');
    revalidatePath('/cassa/richieste-scontrino');

    return {
      success: true,
      message: 'Richiesta scontrino processata con successo'
    };
  } catch (error) {
    secureLog.error('Mark receipt as processed error:', error);
    return { 
      success: false, 
      error: 'Errore nel processare la richiesta' 
    };
  }
}