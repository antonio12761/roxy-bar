"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-multi-tenant";
import { serializeDecimalData } from "@/lib/utils/decimal-serializer";

export async function getClientiStats() {
  try {
    const utente = await getCurrentUser();
    if (!utente) {
      return { success: false, error: "Utente non autenticato" };
    }

    // Verifica permessi
    if (!["ADMIN", "MANAGER", "CASSA"].includes(utente.ruolo)) {
      return { success: false, error: "Permessi insufficienti" };
    }

    // Ottieni tutti i clienti con le loro statistiche
    const clienti = await prisma.cliente.findMany({
      include: {
        Ordinazione: {
          include: {
            Pagamento: true,
            RigaOrdinazione: {
              include: {
                Prodotto: true
              }
            }
          }
        },
        Debiti: {
          include: {
            PagamentiDebito: true,
            Ordinazione: {
              include: {
                Tavolo: true
              }
            }
          }
        }
      },
      orderBy: {
        nome: 'asc'
      }
    });

    // Calcola statistiche per ogni cliente
    const clientiConStats = clienti.map(cliente => {
      // Statistiche ordini
      const ordiniTotali = cliente.Ordinazione.length;
      const ordiniInCorso = cliente.Ordinazione.filter((o: any) => 
        ["ORDINATO", "IN_PREPARAZIONE", "PRONTO", "CONSEGNATO"].includes(o.stato)
      ).length;
      const ordiniCompletati = cliente.Ordinazione.filter((o: any) => o.stato === "PAGATO").length;
      
      // Calcolo totale speso
      const totaleSpeso = cliente.Ordinazione
        .filter((o: any) => o.stato === "PAGATO")
        .reduce((sum: any, ord: any) => {
          const totaleOrdine = ord.RigaOrdinazione.reduce((s: any, r: any) => 
            s + (r.prezzo.toNumber() * r.quantita), 0
          );
          return sum + totaleOrdine;
        }, 0);

      // Statistiche debiti
      const debitiTotali = cliente.Debiti.length;
      const debitiAperti = cliente.Debiti.filter((d: any) => 
        d.stato === "APERTO" || d.stato === "PARZIALMENTE_PAGATO"
      ).length;
      
      const totaleDebiti = cliente.Debiti
        .filter((d: any) => d.stato === "APERTO" || d.stato === "PARZIALMENTE_PAGATO")
        .reduce((sum: any, debito: any) => {
          const totalePagato = debito.PagamentiDebito.reduce(
            (s: any, p: any) => s + p.importo.toNumber(), 0
          );
          return sum + (debito.importo.toNumber() - totalePagato);
        }, 0);

      // Prodotti più ordinati
      const prodottiFrequenza: Record<string, { nome: string; quantita: number; totale: number }> = {};
      cliente.Ordinazione.forEach((ord: any) => {
        ord.RigaOrdinazione.forEach((riga: any) => {
          const key = riga.prodottoId;
          if (!prodottiFrequenza[key]) {
            prodottiFrequenza[key] = {
              nome: riga.Prodotto.nome,
              quantita: 0,
              totale: 0
            };
          }
          prodottiFrequenza[key].quantita += riga.quantita;
          prodottiFrequenza[key].totale += riga.prezzo.toNumber() * riga.quantita;
        });
      });

      const prodottiPreferiti = Object.values(prodottiFrequenza)
        .sort((a, b) => b.quantita - a.quantita)
        .slice(0, 5);

      // Ultima attività
      const ultimaAttivita = cliente.Ordinazione.length > 0
        ? new Date(Math.max(...cliente.Ordinazione.map(o => new Date(o.dataApertura).getTime())))
        : cliente.createdAt;

      // Media spesa per ordine
      const mediaSpesa = ordiniCompletati > 0 ? totaleSpeso / ordiniCompletati : 0;

      return {
        id: cliente.id,
        nome: cliente.nome,
        telefono: cliente.telefono,
        email: cliente.email,
        createdAt: cliente.createdAt,
        ultimaAttivita,
        stats: {
          ordiniTotali,
          ordiniInCorso,
          ordiniCompletati,
          totaleSpeso,
          mediaSpesa,
          debitiTotali,
          debitiAperti,
          totaleDebiti,
          prodottiPreferiti
        }
      };
    });

    // Statistiche globali
    const statsGlobali = {
      totaleClienti: clienti.length,
      clientiAttivi: clientiConStats.filter(c => 
        new Date(c.ultimaAttivita) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      ).length,
      nuoviClientiMese: clienti.filter(c =>
        new Date(c.createdAt) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      ).length,
      totaleDebitiAperti: clientiConStats.reduce((sum, c) => sum + c.stats.totaleDebiti, 0),
      totaleIncassato: clientiConStats.reduce((sum, c) => sum + c.stats.totaleSpeso, 0),
      mediaSpesaCliente: clientiConStats.reduce((sum, c) => sum + c.stats.mediaSpesa, 0) / clientiConStats.length || 0
    };

    return {
      success: true,
      clienti: serializeDecimalData(clientiConStats),
      stats: statsGlobali
    };
  } catch (error) {
    console.error("Errore recupero statistiche clienti:", error);
    return {
      success: false,
      error: "Errore durante il recupero delle statistiche"
    };
  }
}

export async function getClienteDettaglio(clienteId: string) {
  try {
    const utente = await getCurrentUser();
    if (!utente) {
      return { success: false, error: "Utente non autenticato" };
    }

    const cliente = await prisma.cliente.findUnique({
      where: { id: clienteId },
      include: {
        Ordinazione: {
          include: {
            Tavolo: true,
            User: {
              select: {
                nome: true
              }
            },
            Pagamento: {
              include: {
                User: {
                  select: {
                    nome: true
                  }
                }
              }
            },
            RigaOrdinazione: {
              include: {
                Prodotto: true
              }
            }
          },
          orderBy: {
            dataApertura: 'desc'
          }
        },
        Debiti: {
          include: {
            Ordinazione: {
              include: {
                Tavolo: true
              }
            },
            PagamentiDebito: {
              include: {
                Operatore: {
                  select: {
                    nome: true
                  }
                }
              }
            },
            Operatore: {
              select: {
                nome: true
              }
            }
          },
          orderBy: {
            dataCreazione: 'desc'
          }
        }
      }
    });

    if (!cliente) {
      return { success: false, error: "Cliente non trovato" };
    }

    // Prepara timeline attività
    const timeline: any[] = [];

    // Aggiungi ordinazioni alla timeline
    cliente.Ordinazione.forEach(ord => {
      const totale = ord.RigaOrdinazione.reduce((sum, r) => 
        sum + (r.prezzo.toNumber() * r.quantita), 0
      );

      timeline.push({
        tipo: 'ordinazione',
        data: ord.dataApertura,
        descrizione: `Ordine #${ord.numero}`,
        dettagli: {
          tavolo: ord.Tavolo?.numero,
          cameriere: ord.User.nome,
          stato: ord.stato,
          totale,
          numeroArticoli: ord.RigaOrdinazione.reduce((sum, r) => sum + r.quantita, 0)
        }
      });

      // Aggiungi pagamenti
      ord.Pagamento.forEach(pag => {
        timeline.push({
          tipo: 'pagamento',
          data: pag.timestamp,
          descrizione: `Pagamento ordine #${ord.numero}`,
          dettagli: {
            importo: pag.importo.toNumber(),
            modalita: pag.modalita,
            operatore: pag.User.nome
          }
        });
      });
    });

    // Aggiungi debiti alla timeline
    cliente.Debiti.forEach(debito => {
      const totalePagato = debito.PagamentiDebito.reduce(
        (sum, p) => sum + p.importo.toNumber(), 0
      );
      const rimanente = debito.importo.toNumber() - totalePagato;

      timeline.push({
        tipo: 'debito',
        data: debito.dataCreazione,
        descrizione: debito.Ordinazione 
          ? `Debito per ordine #${debito.Ordinazione.numero}`
          : 'Debito diretto',
        dettagli: {
          importo: debito.importo.toNumber(),
          pagato: totalePagato,
          rimanente,
          stato: debito.stato,
          operatore: debito.Operatore.nome,
          note: debito.note
        }
      });

      // Aggiungi pagamenti debito
      debito.PagamentiDebito.forEach(pag => {
        timeline.push({
          tipo: 'pagamento_debito',
          data: pag.dataPagamento,
          descrizione: 'Pagamento debito',
          dettagli: {
            importo: pag.importo.toNumber(),
            modalita: pag.modalita,
            operatore: pag.Operatore.nome,
            note: pag.note
          }
        });
      });
    });

    // Ordina timeline per data
    timeline.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

    return {
      success: true,
      cliente: serializeDecimalData(cliente),
      timeline: serializeDecimalData(timeline)
    };
  } catch (error) {
    console.error("Errore recupero dettaglio cliente:", error);
    return {
      success: false,
      error: "Errore durante il recupero del dettaglio cliente"
    };
  }
}

export async function getClientiAnalytics(periodo: 'settimana' | 'mese' | 'anno' = 'mese') {
  try {
    const utente = await getCurrentUser();
    if (!utente) {
      return { success: false, error: "Utente non autenticato" };
    }

    if (!["ADMIN", "MANAGER"].includes(utente.ruolo)) {
      return { success: false, error: "Permessi insufficienti" };
    }

    // Calcola date in base al periodo
    const now = new Date();
    let startDate = new Date();
    
    switch (periodo) {
      case 'settimana':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'mese':
        startDate.setDate(now.getDate() - 30);
        break;
      case 'anno':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
    }

    // Ottieni ordini nel periodo
    const ordini = await prisma.ordinazione.findMany({
      where: {
        dataApertura: {
          gte: startDate
        },
        stato: "PAGATO"
      },
      include: {
        Cliente: true,
        RigaOrdinazione: true
      }
    });

    // Raggruppa per data
    const venditePeriodo: Record<string, number> = {};
    const clientiPeriodo: Record<string, Set<string>> = {};

    ordini.forEach(ord => {
      const data = ord.dataApertura.toISOString().split('T')[0];
      const totale = ord.RigaOrdinazione.reduce((sum, r) => 
        sum + (r.prezzo.toNumber() * r.quantita), 0
      );

      if (!venditePeriodo[data]) {
        venditePeriodo[data] = 0;
        clientiPeriodo[data] = new Set();
      }

      venditePeriodo[data] += totale;
      if (ord.clienteId) {
        clientiPeriodo[data].add(ord.clienteId);
      }
    });

    // Top clienti per fatturato
    const fatturatoPerCliente: Record<string, { nome: string; totale: number; ordini: number }> = {};
    
    ordini.forEach(ord => {
      if (ord.clienteId && ord.Cliente) {
        if (!fatturatoPerCliente[ord.clienteId]) {
          fatturatoPerCliente[ord.clienteId] = {
            nome: ord.Cliente.nome,
            totale: 0,
            ordini: 0
          };
        }
        
        const totale = ord.RigaOrdinazione.reduce((sum, r) => 
          sum + (r.prezzo.toNumber() * r.quantita), 0
        );
        
        fatturatoPerCliente[ord.clienteId].totale += totale;
        fatturatoPerCliente[ord.clienteId].ordini += 1;
      }
    });

    const topClienti = Object.values(fatturatoPerCliente)
      .sort((a, b) => b.totale - a.totale)
      .slice(0, 10);

    // Prepara dati per grafici
    const chartData = Object.entries(venditePeriodo).map(([data, totale]) => ({
      data,
      vendite: totale,
      clienti: clientiPeriodo[data].size
    })).sort((a, b) => a.data.localeCompare(b.data));

    return {
      success: true,
      chartData,
      topClienti,
      periodo: {
        totaleVendite: Object.values(venditePeriodo).reduce((sum, v) => sum + v, 0),
        clientiUnici: new Set(ordini.filter(o => o.clienteId).map(o => o.clienteId)).size,
        ordiniTotali: ordini.length,
        mediaOrdine: ordini.length > 0 
          ? Object.values(venditePeriodo).reduce((sum, v) => sum + v, 0) / ordini.length 
          : 0
      }
    };
  } catch (error) {
    console.error("Errore recupero analytics clienti:", error);
    return {
      success: false,
      error: "Errore durante il recupero delle analytics"
    };
  }
}