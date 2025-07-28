"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { broadcast } from "@/lib/notifications";
import { notificationManager } from "@/lib/notifications/NotificationManager";
import { sseService } from "@/lib/sse/sse-service";
import { serializeDecimalData } from "@/lib/utils/decimal-serializer";
import { ordersCache } from "@/lib/cache/orders-cache";
import { ordersSyncService } from "@/lib/services/orders-sync-service";
import { getStationCache } from "@/lib/cache/station-cache";
import { StationType } from "@/lib/sse/station-filters";

interface ProdottoOrdine {
  prodottoId: number;
  quantita: number;
  prezzo: number;
  note?: string;
}

interface NuovaOrdinazione {
  tavoloId?: number;
  clienteId?: string;
  tipo: "TAVOLO" | "ASPORTO" | "BANCONE";
  note?: string;
  prodotti: ProdottoOrdine[];
}

export async function creaOrdinazione(dati: NuovaOrdinazione) {
  try {
    console.log("🔵 creaOrdinazione: Inizio con dati:", dati);
    
    const utente = await getCurrentUser();
    if (!utente) {
      console.error("❌ creaOrdinazione: Utente non autenticato");
      return { success: false, error: "Utente non autenticato" };
    }
    console.log("✅ creaOrdinazione: Utente:", utente.nome, utente.ruolo);

    // Verifica permessi (CAMERIERE o superiore)
    if (!["ADMIN", "MANAGER", "OPERATORE", "CAMERIERE"].includes(utente.ruolo)) {
      return { success: false, error: "Permessi insufficienti" };
    }

    // Usa una transazione per operazioni atomiche
    const result = await prisma.$transaction(async (tx) => {
      // Controlla ordini duplicati se è un ordine al tavolo
      if (dati.tavoloId) {
        const ultimoOrdine = await tx.ordinazione.findFirst({
          where: {
            tavoloId: dati.tavoloId,
            stato: {
              in: ["APERTA", "INVIATA", "IN_PREPARAZIONE"]
            },
            dataApertura: {
              gte: new Date(Date.now() - 5 * 60 * 1000) // Ultimi 5 minuti
            }
          },
          include: {
            righe: {
              include: {
                prodotto: true
              }
            }
          },
          orderBy: {
            dataApertura: 'desc'
          }
        });

        // Se esiste un ordine simile recente, verifica se è duplicato
        if (ultimoOrdine) {
          const prodottiEsistenti = ultimoOrdine.righe.map(r => ({
            prodottoId: r.prodottoId,
            quantita: r.quantita
          }));
          
          const prodottiNuovi = dati.prodotti.map(p => ({
            prodottoId: p.prodottoId,
            quantita: p.quantita
          }));

          // Confronto semplice per rilevare duplicati
          const isProbabileDuplicato = prodottiEsistenti.length === prodottiNuovi.length &&
            prodottiEsistenti.every(pe => 
              prodottiNuovi.some(pn => pn.prodottoId === pe.prodottoId && pn.quantita === pe.quantita)
            );

          if (isProbabileDuplicato) {
            // Notifica il possibile duplicato alle stazioni
            notificationManager.notifyDuplicateOrderWarning(
              parseInt(ultimoOrdine.tavolo?.numero || "0"),
              ultimoOrdine.id,
              dati.prodotti
            );
            
            return { 
              success: false, 
              error: "Possibile ordine duplicato. Ordine simile creato negli ultimi 5 minuti.",
              duplicateOrder: ultimoOrdine
            };
          }
        }

        // Occupa il tavolo atomicamente
        await tx.tavolo.update({
          where: { id: dati.tavoloId },
          data: { stato: "OCCUPATO" },
        });
      }

      // Recupera destinazioni prodotti dal database
      const prodottiInfo = await tx.prodotto.findMany({
        where: {
          id: {
            in: dati.prodotti.map(p => p.prodottoId)
          }
        },
        select: {
          id: true,
          destinazione: true
        }
      });

      // Calcola totale
      const totale = dati.prodotti.reduce(
        (sum, p) => sum + (p.prezzo * p.quantita),
        0
      );

      // Estrai il nome del cliente dalle note
      let nomeCliente = undefined;
      if (dati.note) {
        const match = dati.note.match(/Cliente:\s*([^-]+)/);
        if (match && match[1]) {
          nomeCliente = match[1].trim();
        }
      }

      // Crea ordinazione con versioning
      const ordinazione = await tx.ordinazione.create({
        data: {
          cameriereId: utente.id,
          tavoloId: dati.tavoloId,
          clienteId: dati.clienteId,
          tipo: dati.tipo,
          note: dati.note,
          nomeCliente: nomeCliente,
          stato: "APERTA",
          totale,
          righe: {
            create: dati.prodotti.map(p => {
              const prodottoInfo = prodottiInfo.find(pi => pi.id === p.prodottoId);
              return {
                prodottoId: p.prodottoId,
                quantita: p.quantita,
                prezzo: p.prezzo,
                note: p.note,
                stato: "INSERITO",
                destinazione: prodottoInfo?.destinazione || "BAR",
              };
            })
          }
        },
        include: {
          tavolo: true,
          righe: {
            include: {
              prodotto: true
            }
          }
        }
      });

      return { success: true, ordinazione };
    });

    if (!result.success) {
      return result;
    }

    // Notifica nuova ordinazione fuori dalla transazione
    if (result.ordinazione) {
      console.log("📢 Invio notifica nuova ordinazione:", result.ordinazione.id);
      notificationManager.notifyOrderCreated({
        orderId: result.ordinazione.id,
        tableNumber: result.ordinazione.tavolo ? parseInt(result.ordinazione.tavolo.numero) : undefined,
        orderType: result.ordinazione.tipo,
        items: result.ordinazione.righe.map(r => ({
          nome: r.prodotto.nome,
          quantita: r.quantita,
          destinazione: r.destinazione
        })),
        customerName: result.ordinazione.clienteId || undefined,
        waiterName: utente.nome
      });
      
      // Emetti evento SSE direttamente
      console.log("🚀 Emissione evento order:new via SSE");
      sseService.emit('order:new', {
        orderId: result.ordinazione.id,
        tableNumber: result.ordinazione.tavolo ? parseInt(result.ordinazione.tavolo.numero) : undefined,
        customerName: result.ordinazione.nomeCliente,
        items: result.ordinazione.righe.map(r => ({
          id: r.id,
          productName: r.prodotto.nome,
          quantity: r.quantita,
          destination: r.destinazione
        })),
        totalAmount: result.ordinazione.totale.toNumber(),
        timestamp: new Date().toISOString()
      });
    }

    revalidatePath("/cameriere");
    revalidatePath("/prepara");
    revalidatePath("/cucina");
    revalidatePath("/supervisore");

    return result;
  } catch (error: any) {
    console.error("❌ Errore creazione ordinazione:", error);
    console.error("❌ Stack trace:", error.stack);
    console.error("❌ Error details:", {
      message: error.message,
      code: error.code,
      meta: error.meta
    });
    return { success: false, error: error.message || "Errore interno del server" };
  }
}

export async function getOrdinazioniAperte() {
  try {
    console.log('🔍 getOrdinazioniAperte: Inizio con cache e sync ottimizzato');
    
    // Usa il nuovo servizio di sync per ottenere ordini ottimizzati
    const result = await ordersSyncService.getOrders();
    
    console.log('🔍 getOrdinazioniAperte: Completato, ordinazioni:', result.length);
    
    return result;
  } catch (error) {
    console.error("Errore recupero ordinazioni:", error);
    
    // Fallback alla query diretta se servizio fallisce
    try {
      const ordinazioni = await prisma.ordinazione.findMany({
        where: {
          stato: {
            in: ["APERTA", "INVIATA", "IN_PREPARAZIONE", "PRONTA"]
          }
        },
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
          }
        },
        orderBy: {
          dataApertura: 'desc'
        }
      });

      return serializeDecimalData(ordinazioni);
    } catch (fallbackError) {
      console.error("Errore fallback recupero ordinazioni:", fallbackError);
      return [];
    }
  }
}

export async function getTavoli() {
  "use server";
  
  try {
    console.log("🔍 getTavoli: Inizio recupero tavoli dal database");
    
    // Verifica autenticazione
    const utente = await getCurrentUser();
    if (!utente) {
      console.log("❌ getTavoli: Utente non autenticato");
      return [];
    }
    console.log("✅ getTavoli: Utente autenticato:", utente.nome, utente.ruolo);
    
    const tavoli = await prisma.tavolo.findMany({
      where: {
        attivo: true
      },
      include: {
        ordinazioni: {
          where: {
            stato: {
              in: ["APERTA", "INVIATA", "IN_PREPARAZIONE", "PRONTA"]
            }
          },
          select: {
            nomeCliente: true,
            note: true
          },
          orderBy: {
            dataApertura: 'desc'
          },
          take: 1
        }
      },
      orderBy: {
        numero: 'asc'
      }
    });

    console.log(`✅ getTavoli: Trovati ${tavoli.length} tavoli attivi`);
    
    if (tavoli.length === 0) {
      console.log("⚠️ getTavoli: Nessun tavolo attivo trovato nel database");
      // Verifica se ci sono tavoli inattivi
      const tavoliTotali = await prisma.tavolo.count();
      console.log(`📊 getTavoli: Tavoli totali nel database: ${tavoliTotali}`);
      
      // Debug: mostra alcuni tavoli per capire il problema
      const tuttiTavoli = await prisma.tavolo.findMany({
        take: 5,
        orderBy: { numero: 'asc' }
      });
      console.log("🔍 getTavoli: Primi 5 tavoli nel DB:", tuttiTavoli);
    }
    
    // Aggiungi le informazioni del cliente
    const tavoliMapped = tavoli.map(tavolo => ({
      ...tavolo,
      clienteNome: tavolo.ordinazioni[0]?.nomeCliente || 
                   (tavolo.ordinazioni[0]?.note?.includes('Cliente:') 
                    ? tavolo.ordinazioni[0].note.split('Cliente: ')[1]?.split(' - ')[0] 
                    : null)
    }));
    
    console.log("📦 getTavoli: Tavoli processati:", tavoliMapped.length);
    if (tavoliMapped.length > 0) {
      console.log("🔍 getTavoli: Primo tavolo:", tavoliMapped[0]);
    }
    return tavoliMapped;
  } catch (error) {
    console.error("❌ getTavoli: Errore recupero tavoli:", error);
    return [];
  }
}

export async function getProdotti() {
  try {
    const prodotti = await prisma.prodotto.findMany({
      where: {
        disponibile: true,
        isDeleted: false
      },
      select: {
        id: true,
        nome: true,
        prezzo: true,
        categoria: true,
        destinazione: true,
        codice: true
      },
      orderBy: {
        categoria: 'asc'
      }
    });

    // Usa il serializzatore automatico per convertire tutti i Decimal
    return serializeDecimalData(prodotti);
  } catch (error) {
    console.error("Errore recupero prodotti:", error);
    return [];
  }
}

export async function getOrdinazioniPerStato() {
  try {
    const ordinazioni = await prisma.ordinazione.findMany({
      where: {
        stato: {
          in: ['INVIATA', 'PRONTA', 'CONSEGNATA', 'PAGATA']
        }
      },
      include: {
        righe: {
          include: {
            prodotto: true
          }
        },
        tavolo: true,
        cameriere: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return ordinazioni;
  } catch (error) {
    console.error("Errore recupero ordinazioni per stato:", error);
    return [];
  }
}

export async function aggiornaStatoOrdinazione(
  ordinazioneId: string,
  nuovoStato: "APERTA" | "INVIATA" | "IN_PREPARAZIONE" | "PRONTA" | "CONSEGNATA" | "PAGATA" | "ANNULLATA"
) {
  try {
    const utente = await getCurrentUser();
    if (!utente) {
      return { success: false, error: "Utente non autenticato" };
    }

    // Verifica che l'ordinazione esista e recupera lo stato attuale
    const ordinazioneCorrente = await prisma.ordinazione.findUnique({
      where: { id: ordinazioneId },
      select: { stato: true }
    });

    if (!ordinazioneCorrente) {
      return { success: false, error: "Ordinazione non trovata" };
    }

    // Verifica transizioni di stato valide
    if (nuovoStato === "ANNULLATA") {
      // ANNULLATA è permesso solo se lo stato attuale è APERTA
      if (ordinazioneCorrente.stato !== "APERTA") {
        return { 
          success: false, 
          error: "L'ordinazione può essere annullata solo se non è ancora in lavorazione" 
        };
      }
    }

    const ordinazione = await prisma.ordinazione.update({
      where: { id: ordinazioneId },
      data: { stato: nuovoStato },
      include: {
        tavolo: true
      }
    });

    // Notifica cambio stato per tutti gli stati
    switch (nuovoStato) {
      case "INVIATA":
        notificationManager.notifyOrderUpdated({
          orderId: ordinazione.id,
          tableNumber: ordinazione.tavolo ? parseInt(ordinazione.tavolo.numero) : undefined,
          orderType: ordinazione.tipo,
          status: nuovoStato,
          changes: [{
            field: 'stato',
            oldValue: ordinazioneCorrente.stato,
            newValue: nuovoStato
          }]
        });
        break;
      
      case "IN_PREPARAZIONE":
        notificationManager.notifyOrderUpdated({
          orderId: ordinazione.id,
          tableNumber: ordinazione.tavolo ? parseInt(ordinazione.tavolo.numero) : undefined,
          orderType: ordinazione.tipo,
          status: nuovoStato,
          changes: [{
            field: 'stato',
            oldValue: ordinazioneCorrente.stato,
            newValue: nuovoStato
          }]
        });
        break;
      
      case "PRONTA":
        notificationManager.notifyOrderReady({
          orderId: ordinazione.id,
          tableNumber: ordinazione.tavolo ? parseInt(ordinazione.tavolo.numero) : undefined,
          orderType: ordinazione.tipo
        });
        break;
      
      case "CONSEGNATA":
        notificationManager.notifyOrderDelivered({
          orderId: ordinazione.id,
          tableNumber: ordinazione.tavolo ? parseInt(ordinazione.tavolo.numero) : undefined,
          orderType: ordinazione.tipo,
          amount: parseFloat(ordinazione.totale.toString())
        });
        break;
      
      case "PAGATA":
        notificationManager.notifyOrderPaid({
          orderId: ordinazione.id,
          tableNumber: ordinazione.tavolo ? parseInt(ordinazione.tavolo.numero) : undefined,
          orderType: ordinazione.tipo,
          amount: parseFloat(ordinazione.totale.toString())
        });
        break;
      
      case "ANNULLATA":
        notificationManager.notifyOrderCancelled({
          orderId: ordinazione.id,
          tableNumber: ordinazione.tavolo ? parseInt(ordinazione.tavolo.numero) : undefined,
          orderType: ordinazione.tipo,
          reason: "Annullata dall'utente"
        });
        break;
    }

    // Emetti evento SSE specifico per ogni stato
    const sseEventMap: { [key: string]: string } = {
      "INVIATA": "order:sent",
      "IN_PREPARAZIONE": "order:in-preparation",
      "PRONTA": "order:ready",
      "CONSEGNATA": "order:delivered",
      "PAGATA": "order:paid",
      "ANNULLATA": "order:cancelled"
    };

    const sseEvent = sseEventMap[nuovoStato] || 'order:status-change';
    
    sseService.emit(sseEvent, {
      orderId: ordinazione.id,
      oldStatus: ordinazioneCorrente.stato,
      newStatus: nuovoStato,
      tableNumber: ordinazione.tavolo ? parseInt(ordinazione.tavolo.numero) : undefined,
      timestamp: new Date().toISOString()
    });

    revalidatePath("/prepara");
    revalidatePath("/gestione-ordini");
    revalidatePath("/cameriere");
    revalidatePath("/cameriere/conti");
    revalidatePath("/cameriere/ordini-in-corso");
    revalidatePath("/cassa");
    revalidatePath("/supervisore");

    return { success: true, ordinazione };
  } catch (error) {
    console.error("Errore aggiornamento stato ordinazione:", error);
    return { success: false, error: "Errore interno del server" };
  }
}

export async function aggiornaStatoRiga(
  rigaId: string, 
  nuovoStato: "INSERITO" | "IN_LAVORAZIONE" | "PRONTO" | "CONSEGNATO" | "ANNULLATO"
) {
  try {
    const utente = await getCurrentUser();
    if (!utente) {
      return { success: false, error: "Utente non autenticato" };
    }

    // Usa transazione per aggiornamento atomico
    const result = await prisma.$transaction(async (tx) => {
      // Verifica che la riga esista e recupera lo stato attuale
      const rigaCorrente = await tx.rigaOrdinazione.findUnique({
        where: { id: rigaId },
        include: {
          ordinazione: {
            include: {
              tavolo: true
            }
          },
          prodotto: true
        }
      });

      if (!rigaCorrente) {
        return { success: false, error: "Riga ordinazione non trovata" };
      }

      // Verifica transizioni di stato valide
      const transizioniValide = {
        "INSERITO": ["IN_LAVORAZIONE", "ANNULLATO"],
        "IN_LAVORAZIONE": ["PRONTO", "ANNULLATO"],
        "PRONTO": ["CONSEGNATO", "ANNULLATO"],
        "CONSEGNATO": [], // Stato finale
        "ANNULLATO": [] // Stato finale
      };

      if (!transizioniValide[rigaCorrente.stato].includes(nuovoStato)) {
        return { 
          success: false, 
          error: `Transizione non valida da ${rigaCorrente.stato} a ${nuovoStato}` 
        };
      }

      // Aggiorna lo stato
      const riga = await tx.rigaOrdinazione.update({
        where: { id: rigaId },
        data: {
          stato: nuovoStato,
          timestampInizio: nuovoStato === "IN_LAVORAZIONE" ? new Date() : rigaCorrente.timestampInizio,
          timestampPronto: nuovoStato === "PRONTO" ? new Date() : rigaCorrente.timestampPronto,
          timestampConsegna: nuovoStato === "CONSEGNATO" ? new Date() : rigaCorrente.timestampConsegna,
        },
        include: {
          ordinazione: {
            include: {
              tavolo: true
            }
          },
          prodotto: true
        }
      });

      // Verifica se tutte le righe dell'ordinazione sono complete
      if (nuovoStato === "CONSEGNATO") {
        const righeRimanenti = await tx.rigaOrdinazione.count({
          where: {
            ordinazioneId: riga.ordinazioneId,
            stato: {
              not: "CONSEGNATO"
            }
          }
        });

        // Se tutte le righe sono consegnate, aggiorna lo stato dell'ordinazione
        if (righeRimanenti === 0) {
          await tx.ordinazione.update({
            where: { id: riga.ordinazioneId },
            data: { stato: "CONSEGNATA" }
          });
        }
      }

      return { success: true, riga };
    });

    if (!result.success) {
      return result;
    }

    // Aggiorna cache con il nuovo stato
    if (result.riga) {
      ordersSyncService.updateItemStatus(
        result.riga.ordinazioneId, 
        result.riga.id, 
        nuovoStato
      );
      
      // Invalida cache per le postazioni interessate
      const prepCache = getStationCache(StationType.PREPARA);
      const cameriereCache = getStationCache(StationType.CAMERIERE);
      
      // Invalida cache ordine specifico
      prepCache.clear(`order:${result.riga.ordinazioneId}`);
      cameriereCache.clear(`order:${result.riga.ordinazioneId}`);
      
      // Se l'item è pronto, aggiorna cache "ready"
      if (nuovoStato === "PRONTO") {
        cameriereCache.set('orders:ready:update', Date.now(), Date.now());
      }
    }

    // Notifica cambio stato fuori dalla transazione
    if (result.riga) {
      const tableNumber = result.riga.ordinazione.tavolo ? parseInt(result.riga.ordinazione.tavolo.numero) : undefined;
      
      // Notifica cambio stato elemento
      notificationManager.notifyItemStatusChange(
        result.riga.ordinazione.id,
        result.riga.id,
        nuovoStato,
        result.riga.prodotto.nome,
        tableNumber
      );
      
      // Emetti evento SSE diretto per cambio stato item
      sseService.emit('order:item:update', {
        itemId: result.riga.id,
        orderId: result.riga.ordinazione.id,
        status: nuovoStato,
        previousStatus: result.riga.stato,
        tableNumber,
        timestamp: new Date().toISOString()
      });
      
      // Se l'ordine è completamente pronto o consegnato, notifica anche lo stato dell'ordine
      if (nuovoStato === "PRONTO") {
        // Verifica se tutti gli elementi sono pronti
        const tuttiPronti = await prisma.rigaOrdinazione.count({
          where: {
            ordinazioneId: result.riga.ordinazioneId,
            stato: { not: "PRONTO" }
          }
        }) === 0;
        
        if (tuttiPronti) {
          notificationManager.notifyOrderReady({
            orderId: result.riga.ordinazione.id,
            tableNumber,
            orderType: result.riga.ordinazione.tipo
          });
        }
      }
      
      // Se tutti gli elementi sono consegnati, notifica che l'ordine è completamente consegnato
      if (nuovoStato === "CONSEGNATO") {
        const tuttiConsegnati = await prisma.rigaOrdinazione.count({
          where: {
            ordinazioneId: result.riga.ordinazioneId,
            stato: { not: "CONSEGNATO" }
          }
        }) === 0;
        
        if (tuttiConsegnati) {
          // L'ordine è stato automaticamente aggiornato a CONSEGNATA nella transazione
          notificationManager.notifyOrderDelivered({
            orderId: result.riga.ordinazione.id,
            tableNumber,
            orderType: result.riga.ordinazione.tipo,
            amount: parseFloat(result.riga.ordinazione.totale.toString())
          });
          
          // Emetti evento SSE
          sseService.emit('order:delivered', {
            orderId: result.riga.ordinazione.id,
            oldStatus: result.riga.ordinazione.stato,
            newStatus: 'CONSEGNATA',
            tableNumber,
            timestamp: new Date().toISOString()
          });
        }
      }
    }

    revalidatePath("/prepara");
    revalidatePath("/cucina");
    revalidatePath("/cameriere");
    revalidatePath("/cameriere/conti");
    revalidatePath("/cameriere/ordini-in-corso");
    revalidatePath("/supervisore");

    return result;
  } catch (error) {
    console.error("Errore aggiornamento stato riga:", error);
    return { success: false, error: "Errore interno del server" };
  }
}

// Funzione per sincronizzare gli ordini tra le stazioni
export async function sincronizzaOrdiniTraStazioni() {
  try {
    const ordinazioni = await prisma.ordinazione.findMany({
      where: {
        stato: {
          in: ["ORDINATO", "IN_LAVORAZIONE", "PRONTO"]
        }
      },
      include: {
        tavolo: true,
        righe: {
          where: {
            stato: {
              not: "CONSEGNATO"
            }
          },
          include: {
            prodotto: true
          }
        }
      },
      orderBy: {
        dataApertura: 'desc'
      }
    });

    // Raggruppa per destinazione per notificare le stazioni appropriate
    const ordiniPerDestinazione = {
      BAR: [] as any[],
      CUCINA: [] as any[],
      PREPARA: [] as any[]
    };

    ordinazioni.forEach(ord => {
      ord.righe.forEach(riga => {
        const key = riga.destinazione as keyof typeof ordiniPerDestinazione;
        if (ordiniPerDestinazione[key]) {
          ordiniPerDestinazione[key].push({
            ordineId: ord.id,
            tavoloNumero: ord.tavolo?.numero,
            rigaId: riga.id,
            prodotto: riga.prodotto.nome,
            quantita: riga.quantita,
            stato: riga.stato,
            timestampOrdine: riga.timestampOrdine
          });
        }
      });
    });

    // Invia notifiche di sincronizzazione per ogni stazione
    Object.entries(ordiniPerDestinazione).forEach(([destinazione, ordini]) => {
      if (ordini.length > 0) {
        broadcast({
          type: "station_sync",
          message: `Sincronizzazione ordini per ${destinazione}`,
          data: {
            destinazione,
            ordini,
            timestamp: new Date().toISOString(),
            syncVersion: Date.now()
          },
          targetRoles: [destinazione === "BAR" ? "PREPARA" : destinazione]
        });
      }
    });

    return { 
      success: true, 
      message: "Sincronizzazione completata",
      ordiniSincronizzati: ordinazioni.length
    };
  } catch (error) {
    console.error("Errore sincronizzazione ordini:", error);
    return { success: false, error: "Errore durante la sincronizzazione" };
  }
}

// Funzione per forzare un refresh completo dei dati su tutte le stazioni
export async function forzaRefreshStazioni() {
  try {
    broadcast({
      type: "force_refresh",
      message: "Aggiornamento forzato di tutte le stazioni",
      data: {
        timestamp: new Date().toISOString(),
        syncVersion: Date.now()
      },
      targetRoles: ["CAMERIERE", "PREPARA", "CUCINA", "CASSA"]
    });

    return { success: true, message: "Refresh forzato inviato a tutte le stazioni" };
  } catch (error) {
    console.error("Errore refresh forzato:", error);
    return { success: false, error: "Errore durante il refresh forzato" };
  }
}

// Funzione per recuperare i nomi dei clienti precedenti per un tavolo
export async function getCustomerNamesForTable(tavoloId: number) {
  try {
    // Recupera gli ultimi ordini per questo tavolo delle ultime 24 ore
    const ordini = await prisma.ordinazione.findMany({
      where: {
        tavoloId: tavoloId,
        dataApertura: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Ultime 24 ore
        }
      },
      select: {
        note: true,
        nomeCliente: true,
        dataApertura: true
      },
      orderBy: {
        dataApertura: 'desc'
      },
      take: 10 // Ultimi 10 ordini
    });

    // Estrai i nomi dei clienti dalle note o dal campo nomeCliente
    const customerNames = new Set<string>();
    
    ordini.forEach(ordine => {
      // Prima controlla il campo nomeCliente
      if (ordine.nomeCliente) {
        customerNames.add(ordine.nomeCliente);
      }
      // Poi estrai il nome dalle note se presente
      else if (ordine.note) {
        const match = ordine.note.match(/Cliente:\s*([^-]+)/);
        if (match && match[1]) {
          const nome = match[1].trim();
          if (nome) {
            customerNames.add(nome);
          }
        }
      }
    });

    return {
      success: true,
      customerNames: Array.from(customerNames)
    };
  } catch (error) {
    console.error("Errore recupero nomi clienti:", error);
    return { 
      success: false, 
      error: "Errore durante il recupero dei nomi dei clienti",
      customerNames: []
    };
  }
}