"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-multi-tenant";
import { revalidatePath } from "next/cache";
import { broadcast } from "@/lib/notifications";
import { notificationManager } from "@/lib/notifications/NotificationManager";
import { sseService } from "@/lib/sse/sse-service";
import { SSEEventMap } from "@/lib/sse/sse-events";
import { emitOrderEvent } from "@/lib/actions/real-time";
import { RealtimeService } from "@/lib/services/realtime-service";
import { serializeDecimalData } from "@/lib/utils/decimal-serializer";
import { ordersCache } from "@/lib/cache/orders-cache";
import { ordersSyncService } from "@/lib/services/orders-sync-service";
import { getStationCache } from "@/lib/cache/station-cache";
import { StationType } from "@/lib/sse/station-filters";
import { nanoid } from "nanoid";
import { getStatiSuccessivi, canRequestCancellation } from "@/lib/middleware/state-validation";
import type { DestinazioneRiga } from "@prisma/client";

// Helper per autenticazione
async function getAuthenticatedUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Utente non autenticato");
  }
  return user;
}

interface ProdottoOrdine {
  prodottoId: number;
  quantita: number;
  prezzo: number;
  note?: string;
  glassesCount?: number;
  configurazione?: any; // Configurazione per prodotti configurabili
  prezzoFinale?: number; // Prezzo finale con varianti
}

interface NuovaOrdinazione {
  tavoloId?: number;
  clienteId?: string;
  tipo: "TAVOLO" | "ASPORTO" | "BANCONE";
  note?: string;
  prodotti: ProdottoOrdine[];
}

export async function getOrdinazioniAttiveTavolo(tavoloId: number) {
  try {
    // Loading active orders for table
    
    const utente = await getCurrentUser();
    if (!utente) {
      // User not authenticated
      return { success: false, error: "Utente non autenticato" };
    }

    const ordinazioni = await prisma.ordinazione.findMany({
      where: {
        tavoloId: tavoloId,
        stato: {
          in: ["ORDINATO", "IN_PREPARAZIONE", "PRONTO", "CONSEGNATO"]
        },
        statoPagamento: "NON_PAGATO"
      },
      include: {
        RigaOrdinazione: {
          include: {
            Prodotto: true
          }
        },
        Tavolo: true
      },
      orderBy: {
        dataApertura: 'desc'
      }
    });

    const serializedOrdinazioni = serializeDecimalData(ordinazioni);
    // Found active orders
    
    return serializeDecimalData({ 
      success: true, 
      ordinazioni: serializedOrdinazioni 
    });
  } catch (error) {
    // Error loading orders
    return { 
      success: false, 
      error: "Errore nel caricamento delle ordinazioni" 
    };
  }
}

// DUPLICATE FUNCTION - USING VERSION FROM ordinazioni/ordini-crud.ts
// This was causing duplicate merge requests to be created
/*
export async function creaOrdinazione(dati: NuovaOrdinazione) {
  try {
    // Creating new order
    
    const utente = await getCurrentUser();
    if (!utente) {
      // User not authenticated
      return { success: false, error: "Utente non autenticato" };
    }
    // User validated

    // Verifica permessi (CAMERIERE o superiore)
    // Checking permissions
    
    // Prova anche con trim e uppercase per sicurezza
    const normalizedRole = utente.ruolo?.trim().toUpperCase();
    // Permission check
    
    if (!["ADMIN", "MANAGER", "CAMERIERE"].includes(utente.ruolo)) {
      // Insufficient permissions
      return { success: false, error: "Permessi insufficienti" };
    }

    // Usa una transazione per operazioni atomiche
    const result = await prisma.$transaction(async (tx) => {
      // Controlla ordini esistenti per merge automatico se è un ordine al tavolo
      if (dati.tavoloId) {
        // Cerca ordini in stato ORDINATO (in coda) per lo stesso tavolo per fare merge automatico
        const ordineInCoda = await tx.ordinazione.findFirst({
          where: {
            tavoloId: dati.tavoloId,
            stato: "ORDINATO",
            statoPagamento: "NON_PAGATO"
          },
          include: {
            RigaOrdinazione: {
              include: {
                Prodotto: true
              }
            }
          },
          orderBy: {
            dataApertura: 'desc' // Prendi l'ordine più recente
          }
        });

        // Se c'è un ordine in coda (ORDINATO), fai merge automatico
        if (ordineInCoda) {
          // Auto-merging order for table
          
          // Gestisci i prodotti: somma quantità per prodotti esistenti, aggiungi nuovi
          const nuoveRighe = [];
          
          for (const p of dati.prodotti) {
            // Cerca se il prodotto esiste già nell'ordine
            const rigaEsistente = ordineInCoda.RigaOrdinazione.find(
              r => r.prodottoId === p.prodottoId && r.stato === "INSERITO"
            );
            
            if (rigaEsistente) {
              // Se esiste, aggiorna la quantità sommandola
              const rigaAggiornata = await tx.rigaOrdinazione.update({
                where: { id: rigaEsistente.id },
                data: {
                  quantita: rigaEsistente.quantita + p.quantita,
                  // Aggiorna le note se ci sono nuove note
                  note: p.note ? 
                    (rigaEsistente.note ? `${rigaEsistente.note} | ${p.note}` : p.note) : 
                    rigaEsistente.note,
                  updatedAt: new Date()
                }
              });
              nuoveRighe.push(rigaAggiornata);
            } else {
              // Se non esiste, crea una nuova riga
              const nuovaRiga = await tx.rigaOrdinazione.create({
                data: {
                  id: nanoid(),
                  ordinazioneId: ordineInCoda.id,
                  prodottoId: p.prodottoId,
                  quantita: p.quantita,
                  prezzo: p.prezzo,
                  note: p.note,
                  glassesCount: p.glassesCount,
                  stato: "INSERITO",
                  postazione: "PREPARA",
                  updatedAt: new Date(),
                }
              });
              nuoveRighe.push(nuovaRiga);
            }
          }

          // Aggiorna il totale dell'ordine
          const nuovoTotale = Number(ordineInCoda.totale) + dati.prodotti.reduce(
            (sum, p) => sum + (p.prezzo * p.quantita),
            0
          );

          await tx.ordinazione.update({
            where: { id: ordineInCoda.id },
            data: { 
              totale: nuovoTotale,
              updatedAt: new Date(),
              // Aggiungi info sul merge nelle note
              note: ordineInCoda.note 
                ? `${ordineInCoda.note} | Aggiunto ordine da ${utente.nome} alle ${new Date().toLocaleTimeString('it-IT')}`
                : `Aggiunto ordine da ${utente.nome} alle ${new Date().toLocaleTimeString('it-IT')}`
            }
          });

          // Notifica il merge alle stazioni
          const event = {
            orderId: ordineInCoda.id,
            tableNumber: parseInt(dati.tavoloId.toString()),
            newItems: nuoveRighe.map(r => ({
              id: r.id,
              productName: dati.prodotti.find(p => p.prodottoId === r.prodottoId)?.prodottoId.toString() || '',
              quantity: r.quantita,
              station: r.postazione || 'PREPARA'
            })),
            totalAmount: nuovoTotale,
            mergedBy: utente.nome || utente.id
          };
          
          // L'evento verrà emesso dopo la transazione

          // Ricarica l'ordine con tutte le relazioni dopo il merge
          const ordinazioneAggiornata = await tx.ordinazione.findUnique({
            where: { id: ordineInCoda.id },
            include: {
              Tavolo: true,
              RigaOrdinazione: {
                include: {
                  Prodotto: true
                }
              }
            }
          });
          
          // Order merged successfully
          return { 
            success: true, 
            ordinazione: ordinazioneAggiornata, 
            merged: true,
            message: `Prodotti aggiunti all'ordine esistente #${ordineInCoda.numero}` 
          };
        }

        // Controlla se ci sono ordini IN_PREPARAZIONE per lo stesso tavolo
        const ordineInPreparazione = await tx.ordinazione.findFirst({
          where: {
            tavoloId: dati.tavoloId,
            stato: "IN_PREPARAZIONE",
            statoPagamento: "NON_PAGATO"
          },
          include: {
            RigaOrdinazione: {
              include: {
                Prodotto: true
              }
            }
          }
        });

        // Se c'è un ordine in preparazione, crea una richiesta di merge
        if (ordineInPreparazione) {
          // Order in preparation found, creating merge request
          
          // Recupera i dettagli del tavolo
          const tavolo = await tx.tavolo.findUnique({
            where: { id: dati.tavoloId! }
          });
          
          // Prima controlla se esiste già una richiesta di merge pendente con gli stessi prodotti
          const prodottiString = JSON.stringify(dati.prodotti);
          const richiestaEsistente = await tx.richiestaMerge.findFirst({
            where: {
              ordinazioneId: ordineInPreparazione.id,
              richiedenteId: utente.id,
              stato: 'PENDING',
              prodotti: prodottiString,
              // Controlla che sia stata creata negli ultimi 5 secondi per evitare duplicati
              createdAt: {
                gte: new Date(Date.now() - 5000)
              }
            }
          });

          if (richiestaEsistente) {
            console.log('[creaOrdinazione] Richiesta di merge duplicata rilevata, skipping creation');
            return {
              success: true,
              mergePending: true,
              message: 'Richiesta di aggiunta prodotti già inviata. In attesa di conferma dalla preparazione.'
            };
          }

          // Crea una richiesta di merge invece di fare il merge automatico
          console.log('[creaOrdinazione] Creando nuova richiesta di merge per ordine:', ordineInPreparazione.id);
          console.log('[creaOrdinazione] Prodotti da aggiungere:', dati.prodotti.length);
          
          const richiestaMerge = await tx.richiestaMerge.create({
            data: {
              id: nanoid(),
              ordinazioneId: ordineInPreparazione.id,
              tavoloId: dati.tavoloId!,
              numeroTavolo: tavolo?.numero || dati.tavoloId!.toString(),
              numeroOrdine: ordineInPreparazione.numero,
              prodotti: prodottiString,
              richiedenteName: utente.nome || 'Cameriere',
              richiedenteId: utente.id,
              stato: 'PENDING'
            }
          });
          
          console.log('[creaOrdinazione] Richiesta di merge creata con ID:', richiestaMerge.id);
          // Merge request created
          
          // Emetti evento SSE per notificare la nuova richiesta
          sseService.emit('merge:request', {
            id: richiestaMerge.id,
            ordinazioneId: richiestaMerge.ordinazioneId,
            tavoloId: richiestaMerge.tavoloId,
            numeroTavolo: richiestaMerge.numeroTavolo,
            numeroOrdine: richiestaMerge.numeroOrdine,
            richiedenteName: richiestaMerge.richiedenteName,
            prodotti: dati.prodotti.map(p => ({
              prodottoId: p.prodottoId,
              nome: '', // Will need to fetch product name
              quantita: p.quantita,
              prezzo: p.prezzo,
              note: p.note
            }))
          });
          
          // Restituisci successo ma con indicazione che è pending
          return {
            success: true,
            mergePending: true,
            message: 'Richiesta di aggiunta prodotti inviata. In attesa di conferma dalla preparazione.'
          };
        }

        // Controlla ordini duplicati (logica esistente)
        const ultimoOrdine = await tx.ordinazione.findFirst({
          where: {
            tavoloId: dati.tavoloId,
            stato: {
              in: ["ORDINATO", "IN_PREPARAZIONE"]
            },
            dataApertura: {
              gte: new Date(Date.now() - 5 * 60 * 1000) // Ultimi 5 minuti
            }
          },
          include: {
            RigaOrdinazione: {
              include: {
                Prodotto: true
              }
            }
          },
          orderBy: {
            dataApertura: 'asc'
          }
        });

        // Se esiste un ordine simile recente, verifica se è duplicato
        if (ultimoOrdine) {
          const prodottiEsistenti = ultimoOrdine.RigaOrdinazione.map(r => ({
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
              parseInt(ultimoOrdine.tavoloId?.toString() || "0"),
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

      // Recupera postazioni prodotti dal database
      const prodottiInfo = await tx.prodotto.findMany({
        where: {
          id: {
            in: dati.prodotti.map(p => p.prodottoId)
          }
        },
        select: {
          id: true,
          postazione: true
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
          id: nanoid(),
          cameriereId: utente.id,
          tavoloId: dati.tavoloId,
          clienteId: dati.clienteId,
          tipo: dati.tipo,
          note: dati.note,
          nomeCliente: nomeCliente,
          stato: "ORDINATO",
          totale,
          updatedAt: new Date(),
          RigaOrdinazione: {
            create: dati.prodotti.map(p => {
              const prodottoInfo = prodottiInfo.find(pi => pi.id === p.prodottoId);
              return {
                id: nanoid(),
                prodottoId: p.prodottoId,
                quantita: p.quantita,
                prezzo: p.prezzo,
                note: p.note,
                glassesCount: p.glassesCount,
                stato: "INSERITO",
                // Tutti gli ordini dei camerieri vanno a PREPARA
                postazione: "PREPARA",
                updatedAt: new Date(),
              };
            })
          }
        },
        include: {
          Tavolo: true,
          RigaOrdinazione: {
            include: {
              Prodotto: true
            }
          }
        }
      });

      return { success: true, ordinazione: serializeDecimalData(ordinazione) };
    }, {
      timeout: 10000, // 10 secondi
      maxWait: 5000   // Massimo tempo di attesa per acquisire il lock
    });

    if (!result.success) {
      return result;
    }


    // Gestione notifiche fuori dalla transazione
    if (result.merged && result.ordinazione) {
      // Se è stato fatto un merge, emetti evento order:merged
      // Sending merge notification
      
      // Recupera i dettagli dei prodotti per i nomi
      const prodottiDetails = await prisma.prodotto.findMany({
        where: {
          id: {
            in: dati.prodotti.map(p => p.prodottoId)
          }
        },
        select: {
          id: true,
          nome: true
        }
      });
      
      const event: SSEEventMap['order:merged'] = {
        orderId: result.ordinazione.id,
        tableNumber: parseInt(dati.tavoloId!.toString()),
        newItems: dati.prodotti.map(p => ({
          id: nanoid(), // Generiamo un ID temporaneo per il tracking
          productName: prodottiDetails.find(pd => pd.id === p.prodottoId)?.nome || 'Prodotto',
          quantity: p.quantita,
          station: 'PREPARA'
        })),
        totalAmount: result.ordinazione.totale.toNumber() + dati.prodotti.reduce((sum, p) => sum + (p.prezzo * p.quantita), 0),
        mergedBy: utente.nome || utente.id
      };
      
      sseService.emit('order:merged', event, { 
        broadcast: true, 
        skipRateLimit: true,
        tenantId: utente.tenantId,
        queueIfOffline: true
      });
      
      // Notifica anche come aggiornamento ordine
      notificationManager.notifyOrderUpdated({
        orderId: result.ordinazione.id,
        tableNumber: parseInt(dati.tavoloId!.toString()),
        orderType: result.ordinazione.tipo,
        status: result.ordinazione.stato,
        changes: [{
          field: 'prodotti',
          oldValue: 'Ordine originale',
          newValue: `Aggiunti ${dati.prodotti.length} prodotti`
        }]
      });
      
    } else if (result.ordinazione) {
      // Notifica nuova ordinazione normale
      // Sending new order notification
      notificationManager.notifyOrderCreated({
        orderId: result.ordinazione.id,
        tableNumber: result.ordinazione.Tavolo?.numero || undefined,
        orderType: result.ordinazione.tipo,
        items: result.ordinazione.RigaOrdinazione ? result.ordinazione.RigaOrdinazione.map(r => ({
          nome: r.Prodotto?.nome || 'Prodotto',
          quantita: r.quantita,
          postazione: r.postazione
        })) : [],
        customerName: result.ordinazione.clienteId || undefined,
        waiterName: utente.nome
      });
      
      // Emetti evento SSE direttamente
      // Emitting SSE event
      const eventData = {
        orderId: result.ordinazione.id,
        tableNumber: result.ordinazione.Tavolo?.numero || undefined,
        customerName: result.ordinazione.nomeCliente || undefined,
        items: result.ordinazione.RigaOrdinazione ? result.ordinazione.RigaOrdinazione.map(r => ({
          id: r.id,
          productName: r.Prodotto?.nome || 'Prodotto',
          quantity: r.quantita,
          destination: r.postazione
        })) : [],
        totalAmount: typeof result.ordinazione.totale === 'object' ? result.ordinazione.totale.toNumber() : result.ordinazione.totale,
        timestamp: new Date().toISOString()
      };
      // Emit immediately with broadcast to all clients and tenant info
      sseService.emit('order:new', eventData, { 
        broadcast: true, 
        skipRateLimit: true,
        tenantId: utente.tenantId,
        queueIfOffline: true
      });
      
      // Emit multiple times with delays to catch reconnecting clients
      const delays = [100, 250, 500, 1000, 2000];
      delays.forEach(delay => {
        setTimeout(() => {
          sseService.emit('order:new', eventData, { 
            broadcast: true, 
            skipRateLimit: true,
            tenantId: utente.tenantId
          });
        }, delay);
      });
    }

    revalidatePath("/cameriere");
    revalidatePath("/prepara");
    revalidatePath("/cucina");
    revalidatePath("/supervisore");

    return serializeDecimalData(result);
  } catch (error: any) {
    console.error("Errore creazione ordinazione:", error.message);
    return { success: false, error: error.message || "Errore interno del server" };
  }
}
*/

// Wrapper function to call the real implementation from ordinazioni/ordini-crud.ts
// This avoids duplication while working with "use server" constraints
import { creaOrdinazione as creaOrdinazioneImpl } from './ordinazioni/ordini-crud';

export async function creaOrdinazione(dati: NuovaOrdinazione) {
  "use server";
  return creaOrdinazioneImpl(dati);
}

export async function getOrdinazioniAperte() {
  try {
    // Fetching open orders
    
    // Usa il nuovo servizio di sync per ottenere ordini ottimizzati
    const result = await ordersSyncService.getOrders();
    
    // Orders fetched
    
    // Serializza i dati per evitare problemi con Decimal
    return serializeDecimalData(result);
  } catch (error) {
    // Error fetching orders
    
    // Fallback alla query diretta se servizio fallisce
    try {
      const ordinazioni = await prisma.ordinazione.findMany({
        where: {
          stato: {
            in: ["ORDINATO", "IN_PREPARAZIONE", "PRONTO", "CONSEGNATO", "ORDINATO_ESAURITO"]
          }
        },
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
          }
        },
        orderBy: {
          dataApertura: 'asc'
        }
      });

      return serializeDecimalData(ordinazioni);
    } catch (fallbackError) {
      // Fallback error
      return [];
    }
  }
}

export async function cancellaOrdiniAttivi() {
  try {
    const utente = await getCurrentUser();
    if (!utente) {
      return { success: false, error: "Utente non autenticato" };
    }

    // Solo SUPERVISORE può cancellare tutti gli ordini (temporaneamente anche PREPARA per test)
    if (utente.ruolo !== 'SUPERVISORE' && utente.ruolo !== 'ADMIN' && utente.ruolo !== 'PREPARA') {
      return { success: false, error: "Permessi insufficienti" };
    }

    // Conta TUTTI gli ordini prima della cancellazione
    const count = await prisma.ordinazione.count();

    // Ordine corretto di cancellazione per rispettare le foreign key:
    // 1. Prima cancella tutti i pagamenti dei debiti
    await prisma.pagamentoDebito.deleteMany({});
    
    // 2. Poi cancella tutti i debiti (che hanno riferimenti alle ordinazioni)
    await prisma.debito.deleteMany({});

    // 3. Cancella tutti i pagamenti (che hanno riferimenti alle ordinazioni)
    await prisma.pagamento.deleteMany({});

    // 4. Cancella tutti gli ordini esauriti (che hanno riferimenti alle ordinazioni)
    await prisma.ordineEsaurito.deleteMany({});

    // 5. Infine cancella TUTTI gli ordini (inclusi CONSEGNATO, RICHIESTA_PAGAMENTO, PAGATO)
    await prisma.ordinazione.deleteMany({});

    // Libera tutti i tavoli
    await prisma.tavolo.updateMany({
      where: {
        stato: "OCCUPATO"
      },
      data: {
        stato: "LIBERO"
      }
    });

    // Invalida la cache
    ordersCache.invalidate();

    // Notifica tutte le stazioni
    sseService.emit('system:reset', {
      message: 'Tutti gli ordini sono stati cancellati',
      resetBy: utente.nome || utente.id,
      timestamp: new Date().toISOString()
    }, { broadcast: true });

    revalidatePath("/prepara");
    revalidatePath("/cameriere");
    revalidatePath("/cucina");
    revalidatePath("/supervisore");
    revalidatePath("/cassa");

    return { 
      success: true, 
      message: `Cancellati ${count} ordini totali` 
    };
  } catch (error: any) {
    console.error("Errore cancellazione ordini:", error.message);
    return { 
      success: false, 
      error: "Errore durante la cancellazione degli ordini" 
    };
  }
}

export async function getTavoli() {
  "use server";
  
  try {
    // Fetching tables from database
    
    // Verifica autenticazione
    const utente = await getCurrentUser();
    if (!utente) {
      // User not authenticated
      return [];
    }
    // User authenticated
    
    const tavoli = await prisma.tavolo.findMany({
      where: {
        attivo: true
      },
      include: {
        GruppoTavoli: true,
        Ordinazione: {
          where: {
            stato: {
              in: ["ORDINATO", "IN_PREPARAZIONE", "PRONTO"]
            }
          },
          select: {
            nomeCliente: true,
            note: true
          },
          orderBy: {
            dataApertura: 'asc'
          },
          take: 1
        }
      },
      orderBy: {
        numero: 'asc'
      }
    });

    // Tables loaded
    
    if (tavoli.length === 0) {
      // No active tables found
      // Verifica se ci sono tavoli inattivi
      const tavoliTotali = await prisma.tavolo.count();
      // Total tables in database
      
      // Debug: mostra alcuni tavoli per capire il problema
      const tuttiTavoli = await prisma.tavolo.findMany({
        take: 5,
        orderBy: { numero: 'asc' }
      });
      // Sample tables from database
    }
    
    // Aggiungi le informazioni del cliente
    const tavoliMapped = tavoli.map(tavolo => ({
      ...tavolo,
      clienteNome: tavolo.Ordinazione[0]?.nomeCliente || 
                   (tavolo.Ordinazione[0]?.note?.includes('Cliente:') 
                    ? tavolo.Ordinazione[0].note.split('Cliente: ')[1]?.split(' - ')[0] 
                    : null)
    }));
    
    // Tables processed
    if (tavoliMapped.length > 0) {
      // First table sample
    }
    
    // Serializza i dati per evitare problemi con Decimal
    return serializeDecimalData(tavoliMapped);
  } catch (error: any) {
    console.error("Errore recupero tavoli:", error.message);
    return [];
  }
}

export async function getTableOrdersInfo(tableId: number) {
  "use server";
  
  try {
    const utente = await getCurrentUser();
    if (!utente) {
      return { ordersCount: 0, pendingAmount: 0, orders: [] };
    }
    
    // Ottieni tutte le ordinazioni aperte del tavolo
    const ordinazioni = await prisma.ordinazione.findMany({
      where: {
        tavoloId: tableId,
        stato: {
          in: ["ORDINATO", "IN_PREPARAZIONE", "PRONTO", "CONSEGNATO"]
        }
      },
      include: {
        RigaOrdinazione: {
          include: {
            Prodotto: true
          }
        }
      }
    });
    
    // Calcola il numero di ordini attivi
    const ordersCount = ordinazioni.filter(o => 
      ["ORDINATO", "IN_PREPARAZIONE", "PRONTO"].includes(o.stato)
    ).length;
    
    // Calcola il totale rimanente da pagare
    let pendingAmount = 0;
    for (const ordinazione of ordinazioni) {
      if (ordinazione.stato === "CONSEGNATO" && ordinazione.statoPagamento !== "COMPLETAMENTE_PAGATO") {
        const totaleOrdine = ordinazione.RigaOrdinazione.reduce((sum, riga) => {
          return sum + (Number(riga.prezzo) * riga.quantita);
        }, 0);
        pendingAmount += totaleOrdine;
      }
    }
    
    return serializeDecimalData({
      ordersCount,
      pendingAmount,
      orders: ordinazioni
    });
  } catch (error) {
    console.error("Errore recupero info tavolo:", error);
    return { ordersCount: 0, pendingAmount: 0, orders: [] };
  }
}

export async function getProdotti() {
  try {
    const prodotti = await prisma.prodotto.findMany({
      where: {
        isDeleted: false
      },
      select: {
        id: true,
        nome: true,
        prezzo: true,
        categoria: true,
        postazione: true,
        codice: true,
        requiresGlasses: true,
        disponibile: true,
        terminato: true
      },
      orderBy: {
        categoria: 'asc'
      }
    });

    // Usa il serializzatore automatico per convertire tutti i Decimal
    return serializeDecimalData(prodotti);
  } catch (error: any) {
    console.error("Errore recupero prodotti:", error.message);
    return [];
  }
}

export async function getAllProdotti() {
  try {
    const prodotti = await prisma.prodotto.findMany({
      where: {
        isDeleted: false
      },
      select: {
        id: true,
        nome: true,
        prezzo: true,
        categoria: true,
        postazione: true,
        codice: true,
        requiresGlasses: true,
        disponibile: true,
        terminato: true,
        ingredienti: true
      },
      orderBy: {
        categoria: 'asc'
      }
    });

    // Usa il serializzatore automatico per convertire tutti i Decimal
    return serializeDecimalData(prodotti);
  } catch (error: any) {
    console.error("Errore recupero tutti i prodotti:", error.message);
    return [];
  }
}

export async function getOrdinazioniPerStato() {
  try {
    const ordinazioni = await prisma.ordinazione.findMany({
      where: {
        stato: {
          in: ['PRONTO', 'CONSEGNATO', 'RICHIESTA_CONTO', 'PAGATO']
        }
      },
      include: {
        RigaOrdinazione: {
          include: {
            Prodotto: true
          }
        },
        Tavolo: true,
        User: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return ordinazioni;
  } catch (error: any) {
    console.error("Errore recupero ordinazioni:", error.message);
    return [];
  }
}

export async function aggiornaStatoOrdinazione(
  ordinazioneId: string,
  nuovoStato: "ORDINATO" | "IN_PREPARAZIONE" | "PRONTO" | "CONSEGNATO" | "RICHIESTA_CONTO" | "PAGATO" | "ANNULLATO" | "ORDINATO_ESAURITO"
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
    
    // Il middleware gestirà automaticamente la validazione delle transizioni
    // Wrappa l'update in un try-catch per gestire gli errori di transizione
    let ordinazione;
    try {
      ordinazione = await prisma.ordinazione.update({
        where: { id: ordinazioneId },
        data: { stato: nuovoStato },
        include: {
          Tavolo: true
        }
      });
    } catch (error: any) {
      // Se è un errore di transizione di stato, restituisci un messaggio user-friendly
      if (error.name === 'TransizioneStatoError') {
        return { 
          success: false, 
          error: `Non puoi cambiare lo stato da ${ordinazioneCorrente.stato} a ${nuovoStato}. Transizione non consentita.`,
          statoAttuale: ordinazioneCorrente.stato,
          transizioniPermesse: getStatiSuccessivi(ordinazioneCorrente.stato as any)
        };
      }
      // Altri errori
      throw error;
    }

    // Notifica cambio stato per tutti gli stati
    switch (nuovoStato) {
      case "ORDINATO":
        notificationManager.notifyOrderUpdated({
          orderId: ordinazione.id,
          tableNumber: ordinazione.Tavolo?.numero || undefined,
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
          tableNumber: ordinazione.Tavolo?.numero || undefined,
          orderType: ordinazione.tipo,
          status: nuovoStato,
          changes: [{
            field: 'stato',
            oldValue: ordinazioneCorrente.stato,
            newValue: nuovoStato
          }]
        });
        break;
      
      case "PRONTO":
        notificationManager.notifyOrderReady({
          orderId: ordinazione.id,
          tableNumber: ordinazione.Tavolo?.numero || undefined,
          orderType: ordinazione.tipo
        });
        break;
      
      case "CONSEGNATO":
        notificationManager.notifyOrderDelivered({
          orderId: ordinazione.id,
          tableNumber: ordinazione.Tavolo?.numero || undefined,
          orderType: ordinazione.tipo,
          amount: parseFloat(ordinazione.totale.toString())
        });
        break;
      
      case "PAGATO":
        notificationManager.notifyOrderPaid({
          orderId: ordinazione.id,
          tableNumber: ordinazione.Tavolo?.numero || undefined,
          orderType: ordinazione.tipo,
          amount: parseFloat(ordinazione.totale.toString())
        });
        break;
      
      case "ANNULLATO":
        notificationManager.notifyOrderCancelled({
          orderId: ordinazione.id,
          tableNumber: ordinazione.Tavolo?.numero || undefined,
          orderType: ordinazione.tipo,
          reason: "Annullata dall'utente"
        });
        break;
    }

    // Emetti evento SSE specifico per ogni stato
    const sseEventMap: { [key: string]: keyof SSEEventMap } = {
      "ORDINATO": "order:new",
      "IN_PREPARAZIONE": "order:in-preparation",
      "PRONTO": "order:ready",
      "CONSEGNATO": "order:delivered",
      "RICHIESTA_CONTO": "order:status-change",
      "PAGATO": "order:paid",
      "ANNULLATO": "order:cancelled"
    };

    const sseEvent = sseEventMap[nuovoStato] || 'order:status-change';
    
    // Prepara i dati dell'evento in base al tipo
    let eventData: any = {
      orderId: ordinazione.id,
      oldStatus: ordinazioneCorrente.stato,
      newStatus: nuovoStato,
      tableNumber: ordinazione.Tavolo?.numero || undefined,
      timestamp: new Date().toISOString()
    };
    
    // Aggiungi dati specifici per order:delivered
    if (nuovoStato === "CONSEGNATO") {
      eventData = {
        orderId: ordinazione.id,
        tableNumber: ordinazione.Tavolo?.numero || undefined,
        deliveredBy: utente.nome,
        timestamp: new Date().toISOString()
      };
    }
    
    // Emit immediately with broadcast (come fa creaOrdinazione)
    sseService.emit(sseEvent as keyof SSEEventMap, eventData, {
      broadcast: true,
      skipRateLimit: true,
      tenantId: utente.tenantId,
      queueIfOffline: true
    });
    
    // Also emit with delays to catch reconnecting clients (importante per cassa)
    const delays = [100, 250, 500, 1000, 2000];
    delays.forEach(delay => {
      setTimeout(() => {
        sseService.emit(sseEvent as keyof SSEEventMap, eventData, {
          broadcast: true,
          skipRateLimit: true,
          tenantId: utente.tenantId
        });
      }, delay);
    });

    revalidatePath("/prepara");
    revalidatePath("/gestione-ordini");
    revalidatePath("/cameriere");
    revalidatePath("/cameriere/conti");
    revalidatePath("/cameriere/ordini-in-corso");
    revalidatePath("/cassa");
    revalidatePath("/supervisore");

    return { success: true, ordinazione: serializeDecimalData(ordinazione) };
  } catch (error: any) {
    console.error("Errore aggiornamento stato:", error.message);
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

    // Rimuove tutta la logica di validazione degli stati delle righe
    // Le righe sono solo per tracking visivo, non hanno più restrizioni di stato
    const result = await prisma.$transaction(async (tx) => {
      const rigaCorrente = await tx.rigaOrdinazione.findUnique({
        where: { id: rigaId },
        include: {
          Ordinazione: {
            include: {
              Tavolo: true
            }
          },
          Prodotto: true
        }
      });

      if (!rigaCorrente) {
        return { success: false, error: "Riga ordinazione non trovata" };
      }

      // Aggiorna semplicemente lo stato senza validazioni
      const riga = await tx.rigaOrdinazione.update({
        where: { id: rigaId },
        data: {
          stato: nuovoStato,
          timestampInizio: nuovoStato === "IN_LAVORAZIONE" ? new Date() : rigaCorrente.timestampInizio,
          timestampPronto: nuovoStato === "PRONTO" ? new Date() : rigaCorrente.timestampPronto,
          timestampConsegna: nuovoStato === "CONSEGNATO" ? new Date() : rigaCorrente.timestampConsegna,
        },
        include: {
          Ordinazione: {
            include: {
              Tavolo: true
            }
          },
          Prodotto: true
        }
      });

      return { success: true, riga: serializeDecimalData(riga) };
    });

    if (!result.success) {
      return result;
    }

    // Aggiorna cache
    if (result.riga) {
      ordersSyncService.updateItemStatus(
        result.riga.ordinazioneId, 
        result.riga.id, 
        nuovoStato
      );
      
      const prepCache = getStationCache(StationType.PREPARA);
      const cameriereCache = getStationCache(StationType.CAMERIERE);
      
      prepCache.clear(`order:${result.riga.ordinazioneId}`);
      cameriereCache.clear(`order:${result.riga.ordinazioneId}`);
    }

    // Notifica cambio stato
    if (result.riga) {
      const tableNumber = result.riga.Ordinazione.Tavolo?.numero || undefined;
      
      notificationManager.notifyItemStatusChange(
        result.riga.Ordinazione.id,
        result.riga.id,
        nuovoStato,
        result.riga.Prodotto.nome,
        tableNumber
      );
      
      sseService.emit('order:item:update', {
        itemId: result.riga.id,
        orderId: result.riga.Ordinazione.id,
        status: nuovoStato as 'INSERITO' | 'IN_LAVORAZIONE' | 'PRONTO' | 'CONSEGNATO',
        previousStatus: result.riga.stato,
        timestamp: new Date().toISOString()
      });
    }

    revalidatePath("/prepara");
    revalidatePath("/cucina");
    revalidatePath("/cameriere");
    revalidatePath("/supervisore");

    return result;
  } catch (error: any) {
    console.error("Errore aggiornamento riga:", error.message);
    return { success: false, error: "Errore interno del server" };
  }
}

// Funzione per sincronizzare gli ordini tra le stazioni
export async function sincronizzaOrdiniTraStazioni() {
  try {
    const ordinazioni = await prisma.ordinazione.findMany({
      where: {
        stato: {
          in: ["ORDINATO", "IN_PREPARAZIONE", "PRONTO"]
        }
      },
      include: {
        Tavolo: true,
        RigaOrdinazione: {
          where: {
            stato: {
              not: "CONSEGNATO"
            }
          },
          include: {
            Prodotto: true
          }
        }
      },
      orderBy: {
        dataApertura: 'asc'
      }
    });

    // Raggruppa per postazione per notificare le stazioni appropriate
    const ordiniPerPostazione = {
      PREPARA: [] as any[],
      CUCINA: [] as any[],
      BANCO: [] as any[]
    };

    ordinazioni.forEach(ord => {
      ord.RigaOrdinazione.forEach((riga: any) => {
        const key = riga.postazione as keyof typeof ordiniPerPostazione;
        if (ordiniPerPostazione[key]) {
          ordiniPerPostazione[key].push({
            ordineId: ord.id,
            tavoloNumero: ord.Tavolo?.numero,
            rigaId: riga.id,
            prodotto: riga.Prodotto.nome,
            quantita: riga.quantita,
            stato: riga.stato,
            timestampOrdine: riga.timestampOrdine
          });
        }
      });
    });

    // Invia notifiche di sincronizzazione per ogni stazione
    Object.entries(ordiniPerPostazione).forEach(([postazione, ordini]) => {
      if (ordini.length > 0) {
        broadcast({
          type: "station_sync",
          message: `Sincronizzazione ordini per ${postazione}`,
          data: {
            postazione,
            ordini,
            timestamp: new Date().toISOString(),
            syncVersion: Date.now()
          },
          targetRoles: [postazione]
        });
      }
    });

    return { 
      success: true, 
      message: "Sincronizzazione completata",
      ordiniSincronizzati: ordinazioni.length
    };
  } catch (error: any) {
    console.error("Errore sincronizzazione:", error.message);
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
  } catch (error: any) {
    console.error("Errore refresh:", error.message);
    return { success: false, error: "Errore durante il refresh forzato" };
  }
}

// Funzione per recuperare i nomi dei clienti precedenti per un tavolo
export async function getRichiesteMergePendenti(ordinazioneId?: string) {
  const utente = await getAuthenticatedUser();
  if (!utente) {
    return { success: false, error: "Non autenticato" };
  }

  try {
    const richieste = await prisma.richiestaMerge.findMany({
      where: {
        stato: 'PENDING',
        ...(ordinazioneId && { ordinazioneId })
      },
      include: {
        Ordinazione: {
          include: {
            Tavolo: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Recupera i nomi dei prodotti
    const richiesteConProdotti = await Promise.all(
      richieste.map(async (r) => {
        const prodotti = JSON.parse(r.prodotti as string) as Array<{
          prodottoId: number;
          quantita: number;
          prezzo: number;
        }>;
        
        // Recupera i dettagli dei prodotti
        const prodottiDetails = await prisma.prodotto.findMany({
          where: {
            id: {
              in: prodotti.map(p => p.prodottoId)
            }
          },
          select: {
            id: true,
            nome: true
          }
        });
        
        // Mappa i prodotti con i loro nomi
        const prodottiConNomi = prodotti.map(p => ({
          ...p,
          nome: prodottiDetails.find(pd => pd.id === p.prodottoId)?.nome || 'Prodotto sconosciuto'
        }));
        
        return {
          ...r,
          prodotti: prodottiConNomi
        };
      })
    );

    return {
      success: true,
      richieste: serializeDecimalData(richiesteConProdotti)
    };
  } catch (error) {
    console.error("Errore recupero richieste merge:", error);
    return { success: false, error: "Errore nel recupero delle richieste" };
  }
}

export async function accettaRichiestaMerge(richiestaId: string) {
  const utente = await getAuthenticatedUser();
  if (!utente) {
    return { success: false, error: "Non autenticato" };
  }

  try {
    // Prima recupera la richiesta
    const richiesta = await prisma.richiestaMerge.findUnique({
      where: { id: richiestaId },
      include: {
        Ordinazione: true
      }
    });

    if (!richiesta) {
      return { success: false, error: "Richiesta non trovata" };
    }

    const prodotti = JSON.parse(richiesta.prodotti as string) as Array<{
      prodottoId: number;
      nome?: string;
      quantita: number;
      prezzo: number;
    }>;

    // Esegui il merge in una transazione
    const result = await prisma.$transaction(async (tx) => {
      // Aggiungi i prodotti all'ordine esistente
      for (const p of prodotti) {
        const rigaEsistente = await tx.rigaOrdinazione.findFirst({
          where: {
            ordinazioneId: richiesta.ordinazioneId,
            prodottoId: p.prodottoId,
            stato: { notIn: ['ANNULLATO'] }
          }
        });

        if (rigaEsistente) {
          // Recupera i dettagli del prodotto per sapere se richiede bicchieri
          const prodotto = await tx.prodotto.findUnique({
            where: { id: p.prodottoId },
            select: { requiresGlasses: true }
          });
          
          // Aggiorna la quantità esistente e il conteggio bicchieri
          await tx.rigaOrdinazione.update({
            where: { id: rigaEsistente.id },
            data: {
              quantita: rigaEsistente.quantita + p.quantita,
              glassesCount: prodotto?.requiresGlasses 
                ? (rigaEsistente.glassesCount || 0) + p.quantita 
                : rigaEsistente.glassesCount
            }
          });
        } else {
          // Recupera i dettagli del prodotto per sapere se richiede bicchieri
          const prodotto = await tx.prodotto.findUnique({
            where: { id: p.prodottoId },
            select: { requiresGlasses: true }
          });
          
          // Crea nuova riga
          await tx.rigaOrdinazione.create({
            data: {
              id: nanoid(),
              ordinazioneId: richiesta.ordinazioneId,
              prodottoId: p.prodottoId,
              quantita: p.quantita,
              prezzo: p.prezzo,
              stato: 'INSERITO',
              updatedAt: new Date(),
              glassesCount: prodotto?.requiresGlasses ? p.quantita : null
            }
          });
        }
      }

      // Ricalcola il totale dell'ordine dalle righe
      const righeOrdine = await tx.rigaOrdinazione.findMany({
        where: {
          ordinazioneId: richiesta.ordinazioneId,
          stato: { notIn: ['ANNULLATO'] }
        },
        include: {
          Prodotto: true
        }
      });
      
      const nuovoTotale = righeOrdine.reduce((sum, riga) => 
        sum + (riga.prezzo.toNumber() * riga.quantita), 0
      );
      
      // Calcola il numero totale di bicchieri necessari
      const numeroBicchieriTotale = righeOrdine.reduce((sum, riga) => {
        if (riga.Prodotto.requiresGlasses) {
          return sum + riga.quantita;
        }
        return sum;
      }, 0);
      
      await tx.ordinazione.update({
        where: { id: richiesta.ordinazioneId },
        data: {
          totale: nuovoTotale
        }
      });

      // Aggiorna lo stato della richiesta
      await tx.richiestaMerge.update({
        where: { id: richiestaId },
        data: {
          stato: 'ACCEPTED',
          elaboratoDa: utente.nome || utente.id,
          elaboratoAt: new Date()
        }
      });

      return {
        ordinazione: await tx.ordinazione.findUnique({
          where: { id: richiesta.ordinazioneId },
          include: {
            RigaOrdinazione: {
              include: {
                Prodotto: true
              }
            }
          }
        }),
        prodottiAggiunti: prodotti,
        numeroBicchieriTotale
      };
    });

    // Emetti evento SSE per notificare l'aggiornamento dell'ordine
    if (result.ordinazione) {
      // Recupera i dettagli completi dei prodotti aggiunti
      const prodottiDettagli = await prisma.prodotto.findMany({
        where: {
          id: {
            in: result.prodottiAggiunti.map(p => p.prodottoId)
          }
        }
      });
      
      const prodottiMap = new Map(prodottiDettagli.map(p => [p.id, p]));
      
      // RIMOSSO: emit duplicato di order:merged - viene già emesso da richieste-merge.ts
      // sseService.emit('order:merged', {
      //   orderId: result.ordinazione.id,
      //   tableNumber: richiesta.numeroTavolo ? parseInt(richiesta.numeroTavolo) : 0,
      //   newItems: result.prodottiAggiunti.map(p => {
      //     const prodotto = prodottiMap.get(p.prodottoId);
      //     return {
      //       id: nanoid(),
      //       productName: p.nome || prodotto?.nome || `Prodotto ${p.prodottoId}`,
      //       quantity: p.quantita,
      //       station: 'PREPARA'
      //     };
      //   }),
      //   totalAmount: result.ordinazione.totale.toNumber(),
      //   mergedBy: utente.nome || 'Preparazione'
      // });
    }

    return { success: true, message: "Prodotti aggiunti all'ordine con successo" };
  } catch (error) {
    console.error("Errore accettazione merge:", error);
    return { success: false, error: "Errore nell'accettazione della richiesta" };
  }
}

export async function rifiutaRichiestaMerge(richiestaId: string, motivo?: string) {
  const utente = await getAuthenticatedUser();
  if (!utente) {
    return { success: false, error: "Non autenticato" };
  }

  try {
    // Prima recupera la richiesta con tutti i dettagli
    const richiesta = await prisma.richiestaMerge.findUnique({
      where: { id: richiestaId },
      include: {
        Ordinazione: {
          include: {
            Tavolo: true
          }
        }
      }
    });
    
    if (!richiesta) {
      return { success: false, error: "Richiesta non trovata" };
    }
    
    // Parse dei prodotti dalla richiesta
    const prodotti = JSON.parse(richiesta.prodotti as string) as Array<{
      prodottoId: number;
      nome?: string;
      quantita: number;
      prezzo: number;
      postazione?: string;
      note?: string;
    }>;
    
    // Crea un nuovo ordine indipendente con i prodotti rifiutati
    const nuovoOrdine = await prisma.ordinazione.create({
      data: {
        id: nanoid(),
        tavoloId: richiesta.tavoloId,
        cameriereId: richiesta.richiedenteId,
        tipo: richiesta.Ordinazione.tipo,
        stato: 'ORDINATO', // Stato iniziale: in attesa
        nomeCliente: richiesta.Ordinazione.nomeCliente,
        note: `Ordine separato da rifiuto merge - Richiesto da ${richiesta.richiedenteName}`,
        totale: prodotti.reduce((sum, p) => sum + (p.quantita * p.prezzo), 0),
        dataApertura: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        RigaOrdinazione: {
          create: prodotti.map(prodotto => ({
            id: nanoid(),
            prodottoId: prodotto.prodottoId,
            quantita: prodotto.quantita,
            prezzo: prodotto.prezzo,
            stato: 'INSERITO', // Stato iniziale delle righe
            postazione: (prodotto.postazione || 'PREPARA') as DestinazioneRiga,
            Prodotto: {
              connect: { id: prodotto.prodottoId }
            },
            note: prodotto.note || null, // Usa null invece di undefined
            timestampOrdine: new Date(),
            updatedAt: new Date()
          }))
        }
      },
      include: {
        RigaOrdinazione: {
          include: {
            Prodotto: true
          }
        },
        Tavolo: true,
        User: true
      }
    });
    
    // Aggiorna la richiesta come rifiutata
    await prisma.richiestaMerge.update({
      where: { id: richiestaId },
      data: {
        stato: 'REJECTED',
        motivoRifiuto: motivo || 'Creato come ordine separato',
        elaboratoDa: utente.nome || utente.id,
        elaboratoAt: new Date()
      }
    });
    
    // Invia evento SSE per notificare il nuovo ordine
    let tableNumber: string | number | undefined = undefined;
    if (richiesta.Ordinazione.Tavolo?.numero) {
      tableNumber = richiesta.Ordinazione.Tavolo.numero;
    } else if (typeof richiesta.numeroTavolo === 'string') {
      tableNumber = richiesta.numeroTavolo;
    } else if (typeof richiesta.numeroTavolo === 'number') {
      tableNumber = richiesta.numeroTavolo;
    }
    
    const event: SSEEventMap['order:new'] = {
      orderId: nuovoOrdine.id,
      tableNumber,
      customerName: nuovoOrdine.nomeCliente || undefined,
      timestamp: new Date().toISOString(),
      items: nuovoOrdine.RigaOrdinazione.map(riga => ({
        id: riga.id,
        productName: riga.Prodotto?.nome || '',
        quantity: riga.quantita,
        destination: riga.postazione as string
      })),
      totalAmount: nuovoOrdine.totale.toNumber()
    };
    
    sseService.emit('order:new', event, { 
      broadcast: true, 
      skipRateLimit: true 
    });
    
    // Invalida cache
    ordersCache.remove(nuovoOrdine.id);
    
    // Forza refresh delle pagine
    revalidatePath("/prepara");
    revalidatePath("/cameriere");
    revalidatePath("/cucina");

    return { 
      success: true, 
      message: "Richiesta rifiutata e creato nuovo ordine separato",
      nuovoOrdineId: nuovoOrdine.id,
      numeroOrdine: nuovoOrdine.numero
    };
  } catch (error) {
    console.error("Errore rifiuto merge:", error);
    return { success: false, error: "Errore nel rifiuto della richiesta" };
  }
}

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
        dataApertura: 'asc'
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
  } catch (error: any) {
    console.error("Errore nomi clienti:", error.message);
    return { 
      success: false, 
      error: "Errore durante il recupero dei nomi dei clienti",
      customerNames: []
    };
  }
}

export async function sollecitaOrdinePronto(ordinazioneId: string) {
  "use server";
  
  try {
    const utente = await getCurrentUser();
    if (!utente) {
      return { success: false, error: "Utente non autenticato" };
    }

    // Verifica che l'ordinazione esista e sia pronta
    const ordinazione = await prisma.ordinazione.findUnique({
      where: { id: ordinazioneId },
      include: {
        Tavolo: true,
        User: true
      }
    });

    if (!ordinazione) {
      return { success: false, error: "Ordinazione non trovata" };
    }

    if ((ordinazione.stato as any) !== 'PRONTO') {
      return { success: false, error: "L'ordinazione non è ancora pronta" };
    }

    // Invia notifica di sollecito al cameriere e supervisore
    broadcast({
      type: "order_reminder",
      message: `⏰ Sollecito ritiro ordine: ${ordinazione.tipo} ${ordinazione.Tavolo ? `Tavolo ${ordinazione.Tavolo.numero}` : ''} - Ordine pronto`,
      data: {
        orderId: ordinazione.id,
        tableNumber: ordinazione.Tavolo?.numero,
        orderType: ordinazione.tipo
      },
      targetRoles: ["CAMERIERE", "SUPERVISORE"]
    });

    // Emetti evento SSE per il sollecito
    sseService.emit('notification:reminder', {
      orderId: ordinazione.id,
      tableNumber: ordinazione.Tavolo?.numero || undefined,
      type: 'pickup',
      message: `Sollecito per ordine ${ordinazione.tipo} ${ordinazione.Tavolo ? `Tavolo ${ordinazione.Tavolo.numero}` : ''}`
    });

    return { success: true, message: "Sollecito inviato" };
  } catch (error: any) {
    console.error("Errore sollecito:", error.message);
    return { success: false, error: "Errore durante l'invio del sollecito" };
  }
}

export async function mergeOrdineProdotti(ordinazioneId: string, prodotti: ProdottoOrdine[]) {
  "use server";
  
  try {
    const utente = await getCurrentUser();
    if (!utente) {
      return { success: false, error: "Utente non autenticato" };
    }

    const result = await prisma.$transaction(async (tx) => {
      // Recupera l'ordine esistente
      const ordineEsistente = await tx.ordinazione.findUnique({
        where: { id: ordinazioneId },
        include: {
          RigaOrdinazione: true,
          Tavolo: true
        }
      });

      if (!ordineEsistente) {
        return { success: false, error: "Ordine non trovato" };
      }

      // Gestisci i prodotti: somma quantità per prodotti esistenti, aggiungi nuovi
      const righeAggiornate = [];
      
      for (const p of prodotti) {
        // Cerca se il prodotto esiste già nell'ordine con stato non consegnato
        const rigaEsistente = ordineEsistente.RigaOrdinazione.find(
          r => r.prodottoId === p.prodottoId && r.stato !== "CONSEGNATO"
        );
        
        if (rigaEsistente) {
          // Se esiste, aggiorna la quantità sommandola
          const rigaAggiornata = await tx.rigaOrdinazione.update({
            where: { id: rigaEsistente.id },
            data: {
              quantita: rigaEsistente.quantita + p.quantita,
              note: p.note ? 
                (rigaEsistente.note ? `${rigaEsistente.note} | ${p.note}` : p.note) : 
                rigaEsistente.note,
              updatedAt: new Date()
            }
          });
          righeAggiornate.push(rigaAggiornata);
        } else {
          // Se non esiste, crea una nuova riga
          const nuovaRiga = await tx.rigaOrdinazione.create({
            data: {
              id: nanoid(),
              ordinazioneId: ordinazioneId,
              prodottoId: p.prodottoId,
              quantita: p.quantita,
              prezzo: p.prezzo,
              note: p.note,
              stato: "INSERITO",
              postazione: "PREPARA",
              updatedAt: new Date(),
            }
          });
          righeAggiornate.push(nuovaRiga);
        }
      }

      // Aggiorna il totale dell'ordine
      const nuovoTotale = Number(ordineEsistente.totale) + prodotti.reduce(
        (sum, p) => sum + (p.prezzo * p.quantita),
        0
      );

      await tx.ordinazione.update({
        where: { id: ordinazioneId },
        data: { 
          totale: nuovoTotale,
          updatedAt: new Date(),
          note: ordineEsistente.note 
            ? `${ordineEsistente.note} | Prodotti aggiunti da ${utente.nome} alle ${new Date().toLocaleTimeString('it-IT')}`
            : `Prodotti aggiunti da ${utente.nome} alle ${new Date().toLocaleTimeString('it-IT')}`
        }
      });

      return { 
        success: true, 
        ordinazione: ordineEsistente,
        message: `Prodotti aggiunti all'ordine #${ordineEsistente.numero}`
      };
    });

    if (result.success) {
      // Notifica il merge
      notificationManager.notifyOrderUpdated({
        orderId: ordinazioneId,
        tableNumber: result.ordinazione?.Tavolo?.numero || undefined,
        orderType: result.ordinazione?.tipo || 'TAVOLO',
        status: result.ordinazione?.stato || 'IN_PREPARAZIONE',
        changes: [{
          field: 'prodotti',
          oldValue: 'Ordine originale',
          newValue: `Aggiunti ${prodotti.length} prodotti`
        }]
      });

      revalidatePath("/cameriere");
      revalidatePath("/prepara");
    }

    return result;
  } catch (error: any) {
    console.error("Errore merge ordine:", error.message);
    return { success: false, error: "Errore durante il merge dell'ordine" };
  }
}

export async function completaTuttiGliItems(ordinazioneId: string) {
  "use server";
  
  try {
    const utente = await getCurrentUser();
    if (!utente) {
      return { success: false, error: "Utente non autenticato" };
    }

    // Usa transazione per aggiornamento atomico di tutti gli items
    const result = await prisma.$transaction(async (tx) => {
      // Recupera l'ordine con tutti gli items
      const ordinazione = await tx.ordinazione.findUnique({
        where: { id: ordinazioneId },
        include: {
          RigaOrdinazione: true,
          Tavolo: true
        }
      });

      if (!ordinazione) {
        return { success: false, error: "Ordinazione non trovata" };
      }

      // Verifica se l'ordine è già PRONTO o CONSEGNATO
      if (ordinazione.stato === 'PRONTO' || ordinazione.stato === 'CONSEGNATO') {
        console.log(`[completaTuttiGliItems] Ordine ${ordinazioneId} già in stato ${ordinazione.stato}, skip aggiornamento`);
        return { success: true, ordinazione, skipped: true };
      }

      // Aggiorna tutti gli items non ancora pronti/consegnati in una sola query
      const itemsAggiornati = await tx.rigaOrdinazione.updateMany({
        where: {
          ordinazioneId: ordinazioneId,
          stato: {
            notIn: ['PRONTO', 'CONSEGNATO', 'ANNULLATO']
          }
        },
        data: {
          stato: 'PRONTO',
          timestampInizio: new Date(),
          timestampPronto: new Date()
        }
      });

      // Solo se abbiamo aggiornato almeno un item, aggiorniamo l'ordine
      if (itemsAggiornati.count > 0 || ordinazione.stato !== ('PRONTO' as any)) {
        // Usa findFirst per verificare che l'ordine esista e non sia già PRONTO
        const ordinazioneDaAggiornare = await tx.ordinazione.findFirst({
          where: { 
            id: ordinazioneId,
            stato: { notIn: ['PRONTO', 'CONSEGNATO'] }
          }
        });

        if (ordinazioneDaAggiornare) {
          const ordinazioneAggiornata = await tx.ordinazione.update({
            where: { id: ordinazioneId },
            data: { stato: 'PRONTO' },
            include: { Tavolo: true }
          });
          return { success: true, ordinazione: ordinazioneAggiornata };
        }
      }

      return { success: true, ordinazione, noChanges: true };
    }, {
      isolationLevel: 'Serializable', // Previene aggiornamenti concorrenti
      timeout: 10000 // 10 secondi di timeout
    });

    if (!result.success) {
      return result;
    }

    // Notifiche fuori dalla transazione
    if (result.ordinazione) {
      notificationManager.notifyOrderReady({
        orderId: result.ordinazione.id,
        tableNumber: result.ordinazione.tavoloId && result.ordinazione.Tavolo ? result.ordinazione.Tavolo.numero : undefined,
        orderType: result.ordinazione.tipo
      });

      sseService.emit('order:ready', {
        orderId: result.ordinazione.id,
        orderNumber: result.ordinazione.numero,
        tableNumber: result.ordinazione.tavoloId && result.ordinazione.Tavolo ? result.ordinazione.Tavolo.numero : undefined,
        readyItems: [], // Not tracking individual items in this bulk operation
        timestamp: new Date().toISOString()
      });
    }

    // Invalida cache
    ordersCache.remove(ordinazioneId);
    await ordersSyncService.syncOrder(ordinazioneId);

    revalidatePath("/prepara");
    revalidatePath("/cameriere");
    revalidatePath("/supervisore");

    return { success: true, message: "Tutti gli items sono stati completati" };
  } catch (error: any) {
    console.error("Errore completamento items:", error.message, error);
    
    // Gestisci errori specifici di Prisma
    if (error.code === 'P2002') {
      return { success: false, error: "Conflitto di aggiornamento. Riprova tra qualche istante." };
    }
    
    if (error.code === 'P2025') {
      return { success: false, error: "Ordine non trovato o già aggiornato." };
    }
    
    if (error.message?.includes('timeout')) {
      return { success: false, error: "Operazione scaduta. Riprova." };
    }
    
    return { success: false, error: error.message || "Errore durante il completamento degli items" };
  }
}

export async function segnaOrdineRitirato(ordinazioneId: string, cameriereRitiroId?: string) {
  "use server";
  
  try {
    const utente = await getCurrentUser();
    if (!utente) {
      return { success: false, error: "Utente non autenticato" };
    }

    // Usa transazione per aggiornamento atomico
    const result = await prisma.$transaction(async (tx) => {
      // Verifica che l'ordinazione esista e sia pronta
      const ordinazione = await tx.ordinazione.findUnique({
        where: { id: ordinazioneId },
        include: {
          Tavolo: true,
          RigaOrdinazione: true
        }
      });

      if (!ordinazione) {
        return { success: false, error: "Ordinazione non trovata" };
      }

      // Se l'ordine non è PRONTO ma tutti gli items sono pronti, aggiorna prima lo stato dell'ordine
      if (ordinazione.stato !== 'PRONTO') {
        const tuttiPronti = ordinazione.RigaOrdinazione.every(
          riga => riga.stato === 'PRONTO' || riga.stato === 'CONSEGNATO' || riga.stato === 'ANNULLATO'
        );
        
        if (tuttiPronti) {
          // Aggiorna lo stato dell'ordine a PRONTO prima di procedere
          await tx.ordinazione.update({
            where: { id: ordinazioneId },
            data: { stato: 'PRONTO' }
          });
          // Order status updated based on items
        } else {
          // Order not ready yet
          return { success: false, error: "L'ordinazione non è pronta per il ritiro" };
        }
      }

      // Log dello stato prima dell'aggiornamento
      console.log(`🔄 Aggiornamento ordine ${ordinazioneId}: stato=${ordinazione.stato} -> CONSEGNATO, statoPagamento=${ordinazione.statoPagamento}`);
      
      // Aggiorna lo stato dell'ordinazione a CONSEGNATA
      const ordinazioneAggiornata = await tx.ordinazione.update({
        where: { id: ordinazioneId },
        data: {
          stato: 'CONSEGNATO',
          dataChiusura: new Date(),
          note: ordinazione.note 
            ? `${ordinazione.note} | Ritirato da: ${cameriereRitiroId || utente.nome}`
            : `Ritirato da: ${cameriereRitiroId || utente.nome}`
        }
      });

      // Aggiorna tutte le righe a CONSEGNATO
      await tx.rigaOrdinazione.updateMany({
        where: { 
          ordinazioneId: ordinazioneId,
          stato: { not: 'CONSEGNATO' }
        },
        data: {
          stato: 'CONSEGNATO',
          timestampConsegna: new Date()
        }
      });

      return { success: true, ordinazione: ordinazioneAggiornata };
    });

    if (!result.success) {
      return result;
    }

    // Invia notifiche fuori dalla transazione
    const ordinazione = await prisma.ordinazione.findUnique({
      where: { id: ordinazioneId },
      include: { Tavolo: true }
    });

    if (ordinazione) {
      // Notifica che l'ordine è stato consegnato
      notificationManager.notifyOrderDelivered({
        orderId: ordinazione.id,
        tableNumber: ordinazione.Tavolo?.numero || undefined,
        orderType: ordinazione.tipo,
        amount: parseFloat(ordinazione.totale.toString())
      });

      // Emetti evento SSE
      const eventData = {
        orderId: ordinazione.id,
        orderNumber: ordinazione.numero,
        tableNumber: ordinazione.Tavolo?.numero || undefined,
        deliveredBy: cameriereRitiroId || utente.nome,
        timestamp: new Date().toISOString()
      };
      
      // Emit to tenant to ensure all stations in the tenant receive it
      sseService.emit('order:delivered', eventData, {
        tenantId: utente.tenantId,
        broadcast: true,
        queueIfOffline: true // Queue the event if no clients are connected
      });
      
      // Also emit with short delays to catch reconnecting clients
      const delays = [100, 500, 1000];
      delays.forEach(delay => {
        setTimeout(() => {
          sseService.emit('order:delivered', eventData, {
            tenantId: utente.tenantId,
            broadcast: true
          });
        }, delay);
      });
    }

    // Invalida cache
    ordersCache.remove(ordinazioneId);
    
    // Forza sync degli ordini per aggiornare tutte le views
    await ordersSyncService.syncOrder(ordinazioneId);
    
    // Order delivered successfully
    
    revalidatePath("/prepara");
    revalidatePath("/cameriere");
    revalidatePath("/cassa");
    revalidatePath("/supervisore");

    return { success: true, message: "Ordine segnato come ritirato" };
  } catch (error: any) {
    console.error("Errore ritiro ordine:", error.message);
    return { success: false, error: "Errore durante il ritiro dell'ordine" };
  }
}

export async function cancellaOrdinazione(ordinazioneId: string) {
  try {
    const utente = await getCurrentUser();
    if (!utente) {
      return { success: false, error: "Utente non autenticato" };
    }

    // Solo CAMERIERE, SUPERVISORE o ADMIN possono cancellare ordini
    if (!['CAMERIERE', 'SUPERVISORE', 'ADMIN'].includes(utente.ruolo)) {
      return { success: false, error: "Permessi insufficienti" };
    }

    // Verifica che l'ordinazione esista
    const ordinazione = await prisma.ordinazione.findUnique({
      where: { id: ordinazioneId },
      include: { Tavolo: true }
    });

    if (!ordinazione) {
      return { success: false, error: "Ordinazione non trovata" };
    }

    // Solo ordini non ancora in preparazione possono essere cancellati dai camerieri
    if (utente.ruolo === 'CAMERIERE' && ordinazione.stato !== 'ORDINATO') {
      return { success: false, error: "Non puoi cancellare ordini già in preparazione" };
    }

    // Cancella l'ordinazione
    await prisma.ordinazione.delete({
      where: { id: ordinazioneId }
    });

    // Se è l'ultima ordinazione del tavolo, libera il tavolo
    if (ordinazione.Tavolo) {
      const altreOrdinazioni = await prisma.ordinazione.count({
        where: {
          tavoloId: ordinazione.tavoloId,
          id: { not: ordinazioneId }
        }
      });

      if (altreOrdinazioni === 0) {
        await prisma.tavolo.update({
          where: { id: ordinazione.tavoloId! },
          data: { stato: 'LIBERO' }
        });
      }
    }

    // Invalida cache
    ordersCache.remove(ordinazioneId);

    // Notifica SSE
    sseService.emit('order:cancelled', {
      orderId: ordinazioneId,
      tableNumber: ordinazione.tavoloId && ordinazione.Tavolo ? ordinazione.Tavolo.numero : undefined,
      orderType: ordinazione.tipo,
      reason: "Cancellata dall'utente",
      approvedBy: utente.nome || utente.id,
      timestamp: new Date().toISOString()
    });

    revalidatePath("/cameriere/ordini-in-corso");
    revalidatePath("/prepara");
    revalidatePath("/cucina");

    return { success: true, message: "Ordinazione cancellata con successo" };
  } catch (error) {
    console.error('Errore durante cancellazione ordinazione:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Errore durante la cancellazione' 
    };
  }
}

export async function cancellaRigaOrdinazione(rigaId: string) {
  try {
    const utente = await getCurrentUser();
    if (!utente) {
      return { success: false, error: "Utente non autenticato" };
    }

    // Solo CAMERIERE, SUPERVISORE o ADMIN possono cancellare righe
    if (!['CAMERIERE', 'SUPERVISORE', 'ADMIN'].includes(utente.ruolo)) {
      return { success: false, error: "Permessi insufficienti" };
    }

    // Verifica che la riga esista
    const riga = await prisma.rigaOrdinazione.findUnique({
      where: { id: rigaId },
      include: { 
        Ordinazione: { 
          include: { Tavolo: true } 
        },
        Prodotto: true
      }
    });

    if (!riga) {
      return { success: false, error: "Riga ordinazione non trovata" };
    }

    // Solo righe non ancora in preparazione possono essere cancellate dai camerieri
    if (utente.ruolo === 'CAMERIERE' && riga.stato !== 'INSERITO') {
      return { success: false, error: "Non puoi cancellare prodotti già in preparazione" };
    }

    // Conta le righe rimanenti
    const righeRimanenti = await prisma.rigaOrdinazione.count({
      where: {
        ordinazioneId: riga.ordinazioneId,
        id: { not: rigaId }
      }
    });

    // Se è l'ultima riga, cancella l'intera ordinazione
    if (righeRimanenti === 0) {
      return await cancellaOrdinazione(riga.ordinazioneId);
    }

    // Cancella la riga
    await prisma.rigaOrdinazione.delete({
      where: { id: rigaId }
    });

    // Ricalcola il totale dell'ordinazione
    const righe = await prisma.rigaOrdinazione.findMany({
      where: { ordinazioneId: riga.ordinazioneId }
    });

    const nuovoTotale = righe.reduce((sum, r) => {
      return sum + (parseFloat(r.prezzo.toString()) * r.quantita);
    }, 0);

    await prisma.ordinazione.update({
      where: { id: riga.ordinazioneId },
      data: { totale: nuovoTotale }
    });

    // Invalida cache
    ordersCache.remove(riga.ordinazioneId);

    // Notifica SSE
    sseService.emit('order:item-cancelled', {
      orderId: riga.ordinazioneId,
      itemId: rigaId,
      productName: riga.Prodotto?.nome,
      tableNumber: riga.Ordinazione.Tavolo?.numero || undefined,
      cancelledBy: utente.nome || utente.id,
      timestamp: new Date().toISOString()
    });

    revalidatePath("/cameriere/ordini-in-corso");
    revalidatePath("/prepara");
    revalidatePath("/cucina");

    return { success: true, message: "Prodotto rimosso dall'ordine" };
  } catch (error) {
    console.error('Errore durante cancellazione riga:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Errore durante la cancellazione' 
    };
  }
}

export async function modificaQuantitaRiga(rigaId: string, nuovaQuantita: number) {
  try {
    const utente = await getCurrentUser();
    if (!utente) {
      return { success: false, error: "Utente non autenticato" };
    }

    // Solo CAMERIERE, SUPERVISORE o ADMIN possono modificare quantità
    if (!['CAMERIERE', 'SUPERVISORE', 'ADMIN'].includes(utente.ruolo)) {
      return { success: false, error: "Permessi insufficienti" };
    }

    if (nuovaQuantita < 1) {
      return { success: false, error: "La quantità deve essere almeno 1" };
    }

    // Verifica che la riga esista
    const riga = await prisma.rigaOrdinazione.findUnique({
      where: { id: rigaId },
      include: { 
        Ordinazione: { 
          include: { Tavolo: true } 
        },
        Prodotto: true
      }
    });

    if (!riga) {
      return { success: false, error: "Riga ordinazione non trovata" };
    }

    // Solo righe non ancora in preparazione possono essere modificate dai camerieri
    if (utente.ruolo === 'CAMERIERE' && riga.stato !== 'INSERITO') {
      return { success: false, error: "Non puoi modificare prodotti già in preparazione" };
    }

    // Aggiorna la quantità
    await prisma.rigaOrdinazione.update({
      where: { id: rigaId },
      data: { quantita: nuovaQuantita }
    });

    // Ricalcola il totale dell'ordinazione
    const righe = await prisma.rigaOrdinazione.findMany({
      where: { ordinazioneId: riga.ordinazioneId }
    });

    const nuovoTotale = righe.reduce((sum, r) => {
      return sum + (parseFloat(r.prezzo.toString()) * r.quantita);
    }, 0);

    await prisma.ordinazione.update({
      where: { id: riga.ordinazioneId },
      data: { totale: nuovoTotale }
    });

    // Invalida cache
    ordersCache.remove(riga.ordinazioneId);

    // Notifica SSE
    sseService.emit('order:item-modified', {
      orderId: riga.ordinazioneId,
      itemId: rigaId,
      productName: riga.Prodotto?.nome,
      oldQuantity: riga.quantita,
      newQuantity: nuovaQuantita,
      tableNumber: riga.Ordinazione.Tavolo?.numero || undefined,
      modifiedBy: utente.nome || utente.id,
      timestamp: new Date().toISOString()
    });

    revalidatePath("/cameriere/ordini-in-corso");
    revalidatePath("/prepara");
    revalidatePath("/cucina");

    return { success: true, message: "Quantità aggiornata con successo" };
  } catch (error) {
    console.error('Errore durante modifica quantità:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Errore durante la modifica' 
    };
  }
}

export async function getStoricoOrdinazioni(filters?: {
  dataInizio?: Date;
  dataFine?: Date;
  tavoloId?: number;
  cameriereId?: string;
  limit?: number;
}) {
  try {
    const where: any = {
      stato: "PAGATO", // Only paid orders in history
      statoPagamento: "COMPLETAMENTE_PAGATO"
    };

    // Apply date filters
    if (filters?.dataInizio || filters?.dataFine) {
      where.dataChiusura = {};
      if (filters.dataInizio) {
        where.dataChiusura.gte = filters.dataInizio;
      }
      if (filters.dataFine) {
        where.dataChiusura.lte = filters.dataFine;
      }
    }

    // Apply table filter
    if (filters?.tavoloId) {
      where.tavoloId = filters.tavoloId;
    }

    // Apply waiter filter
    if (filters?.cameriereId) {
      where.operatoreId = filters.cameriereId;
    }

    const ordinazioni = await prisma.ordinazione.findMany({
      where,
      include: {
        Tavolo: {
          select: {
            numero: true,
            zona: true
          }
        },
        User: {
          select: {
            nome: true
          }
        },
        RigaOrdinazione: {
          include: {
            Prodotto: {
              select: {
                nome: true,
                categoria: true,
                prezzo: true
              }
            }
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
        }
      },
      orderBy: {
        dataChiusura: 'desc'
      },
      take: filters?.limit || 100 // Default to last 100 orders
    });

    // Calculate totals and format response
    return ordinazioni.map(ord => ({
      id: ord.id,
      numero: ord.numero,
      tavolo: ord.Tavolo,
      tipo: ord.tipo,
      cameriere: ord.User,
      stato: ord.stato,
      dataApertura: ord.dataApertura,
      dataChiusura: ord.dataChiusura,
      totale: ord.totale.toNumber(),
      righe: ord.RigaOrdinazione.map((riga: any) => ({
        id: riga.id,
        prodotto: {
          nome: riga.Prodotto.nome,
          categoria: riga.Prodotto.categoria
        },
        quantita: riga.quantita,
        prezzo: riga.prezzo.toNumber(),
        stato: riga.stato
      })),
      pagamenti: ord.Pagamento.map((pag: any) => ({
        id: pag.id,
        importo: pag.importo.toNumber(),
        modalita: pag.modalita,
        operatore: pag.User?.nome,
        dataCreazione: pag.dataCreazione
      })),
      durataMinuti: ord.dataChiusura ? 
        Math.floor((new Date(ord.dataChiusura).getTime() - new Date(ord.dataApertura).getTime()) / 60000) : 
        null
    }));
  } catch (error) {
    console.error("Errore recupero storico:", error);
    return [];
  }
}

// Recupera i dettagli storici degli ordini merged
export async function getMergedOrdersHistory(ordinazioneId: string) {
  try {
    const utente = await getCurrentUser();
    if (!utente) {
      return { success: false, error: "Non autenticato" };
    }

    // Recupera l'ordine corrente con tutte le relazioni
    const ordinazione = await prisma.ordinazione.findUnique({
      where: { id: ordinazioneId },
      include: {
        RigaOrdinazione: {
          include: {
            Prodotto: true
          }
        },
        User: true,
        Tavolo: true,
        RichiestaMerge: {
          where: { stato: 'ACCEPTED' },
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!ordinazione) {
      return { success: false, error: "Ordinazione non trovata" };
    }

    // Parsing delle note per identificare i merge
    const mergeHistory = [];
    
    // Ordine originale
    const originalOrder = {
      id: `${ordinazioneId}-original`,
      tipo: 'originale',
      cliente: ordinazione.nomeCliente || 'Cliente',
      cameriere: ordinazione.User?.nome || 'Cameriere',
      timestamp: ordinazione.dataApertura.toISOString(),
      items: [], // Dovremmo tracciare gli items originali separatamente
      totale: 0
    };

    // Se ci sono richieste merge accettate
    if (ordinazione.RichiestaMerge && ordinazione.RichiestaMerge.length > 0) {
      // Aggiungi l'ordine originale
      mergeHistory.push(originalOrder);

      // Aggiungi gli ordini merged
      ordinazione.RichiestaMerge.forEach((merge, index) => {
        const prodotti = merge.prodotti as any;
        
        // Parse dei prodotti che potrebbero essere in formato JSON string o oggetto
        let parsedProdotti = [];
        try {
          if (typeof prodotti === 'string') {
            parsedProdotti = JSON.parse(prodotti);
          } else if (Array.isArray(prodotti)) {
            parsedProdotti = prodotti;
          } else if (prodotti && typeof prodotti === 'object') {
            // Se è un oggetto singolo, mettilo in un array
            parsedProdotti = [prodotti];
          }
        } catch (e) {
          console.error('Errore parsing prodotti:', e);
          parsedProdotti = [];
        }
        
        mergeHistory.push({
          id: merge.id,
          tipo: 'aggiunto',
          numero: index + 1,
          cliente: ordinazione.nomeCliente || 'Cliente',
          cameriere: merge.richiedenteName,
          timestamp: merge.createdAt.toISOString(),
          items: parsedProdotti.map((p: any) => ({
            id: p.id || p.prodottoId || nanoid(),
            prodotto: p.nome || p.productName || p.nomeProdotto || 'Prodotto',
            quantita: p.quantita || p.quantity || 1,
            prezzo: p.prezzo || p.price || 0,
            note: p.note || p.notes || ''
          })),
          totale: parsedProdotti.reduce((sum: number, p: any) => 
            sum + ((p.quantita || p.quantity || 1) * (p.prezzo || p.price || 0)), 0
          )
        });
      });
    }

    return { 
      success: true, 
      mergeHistory,
      hasMerge: mergeHistory.length > 1
    };

  } catch (error) {
    console.error("Errore recupero storico merge:", error);
    return { success: false, error: "Errore nel recupero dello storico" };
  }
}
