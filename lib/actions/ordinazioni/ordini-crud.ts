"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-multi-tenant";
import { revalidatePath } from "next/cache";
import { notificationManager } from "@/lib/notifications/NotificationManager";
import { sseService } from "@/lib/sse/sse-service";
import { emitOrderEvent } from "@/lib/actions/real-time";
import { serializeDecimalData } from "@/lib/utils/decimal-serializer";
import { ordersCache } from "@/lib/cache/orders-cache";
import { ordersSyncService } from "@/lib/services/orders-sync-service";
import { nanoid } from "nanoid";
import type { NuovaOrdinazione, ProdottoOrdine } from "./types";
import { updateInventoryAfterOrder, restoreInventoryAfterCancellation } from "@/lib/actions/inventory-management";
import { verificaERiservaQuantita, rilasciaQuantitaRiservate } from "@/lib/actions/inventario-esaurito";
import { saveConfigurazioneRigaOrdine } from "@/lib/actions/prodotti-configurabili";

export async function getOrdinazioniAttiveTavolo(tavoloId: number) {
  try {
    const utente = await getCurrentUser();
    if (!utente) {
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
    
    return serializeDecimalData({ 
      success: true, 
      ordinazioni: serializedOrdinazioni 
    });
  } catch (error) {
    return { 
      success: false, 
      error: "Errore nel caricamento delle ordinazioni" 
    };
  }
}

export async function creaOrdinazione(dati: NuovaOrdinazione) {
  try {
    const utente = await getCurrentUser();
    if (!utente) {
      return { success: false, error: "Utente non autenticato" };
    }

    const normalizedRole = utente.ruolo?.trim().toUpperCase();
    
    if (!["ADMIN", "MANAGER", "CAMERIERE"].includes(utente.ruolo)) {
      return { success: false, error: "Permessi insufficienti" };
    }

    const result = await prisma.$transaction(async (tx) => {
      // Prima di tutto, verifica e riserva le quantità richieste
      const verificaRiserva = await verificaERiservaQuantita(
        dati.prodotti.map(p => ({ prodottoId: p.prodottoId, quantita: p.quantita })),
        tx
      );

      if (!verificaRiserva.success) {
        // Se alcuni prodotti non sono disponibili, restituisci i dettagli
        return {
          success: false,
          error: "Alcuni prodotti non sono disponibili nelle quantità richieste",
          prodottiNonDisponibili: verificaRiserva.prodottiNonDisponibili
        };
      }

      if (dati.tavoloId) {
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
            dataApertura: 'desc'
          }
        });

        if (ordineInCoda) {
          const nuoveRighe = [];
          
          for (const p of dati.prodotti) {
            const rigaEsistente = ordineInCoda.RigaOrdinazione.find(
              r => r.prodottoId === p.prodottoId && r.stato === "INSERITO"
            );
            
            if (rigaEsistente) {
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
              nuoveRighe.push(rigaAggiornata);
            } else {
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

          const nuovoTotale = Number(ordineInCoda.totale) + dati.prodotti.reduce(
            (sum, p) => sum + (p.prezzo * p.quantita),
            0
          );

          await tx.ordinazione.update({
            where: { id: ordineInCoda.id },
            data: { 
              totale: nuovoTotale,
              updatedAt: new Date(),
              note: ordineInCoda.note 
                ? `${ordineInCoda.note} | Aggiunto ordine da ${utente.nome} alle ${new Date().toLocaleTimeString('it-IT')}`
                : `Aggiunto ordine da ${utente.nome} alle ${new Date().toLocaleTimeString('it-IT')}`
            }
          });

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
          
          // L'inventario è già stato aggiornato da verificaERiservaQuantita

          return { 
            success: true, 
            ordinazione: ordinazioneAggiornata, 
            merged: true,
            message: `Prodotti aggiunti all'ordine esistente #${ordineInCoda.numero}` 
          };
        }

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

        if (ordineInPreparazione) {
          console.log('[creaOrdinazione] Ordine in preparazione trovato, creando richiesta merge:', ordineInPreparazione.id);
          
          const tavolo = await tx.tavolo.findUnique({
            where: { id: dati.tavoloId! }
          });
          
          const richiestaMerge = await tx.richiestaMerge.create({
            data: {
              id: nanoid(),
              ordinazioneId: ordineInPreparazione.id,
              tavoloId: dati.tavoloId!,
              numeroTavolo: tavolo?.numero || dati.tavoloId!.toString(),
              numeroOrdine: ordineInPreparazione.numero,
              prodotti: JSON.stringify(dati.prodotti),
              richiedenteName: utente.nome || 'Cameriere',
              richiedenteId: utente.id,
              stato: 'PENDING'
            }
          });
          
          console.log('[creaOrdinazione] Richiesta merge creata:', richiestaMerge.id, 'per ordine:', richiestaMerge.ordinazioneId);
          
          sseService.emit('merge:request', {
            id: richiestaMerge.id,
            ordinazioneId: richiestaMerge.ordinazioneId,
            tavoloId: richiestaMerge.tavoloId,
            numeroTavolo: richiestaMerge.numeroTavolo,
            numeroOrdine: richiestaMerge.numeroOrdine,
            richiedenteName: richiestaMerge.richiedenteName,
            prodotti: dati.prodotti.map(p => ({
              prodottoId: p.prodottoId,
              nome: '',
              quantita: p.quantita,
              prezzo: p.prezzo,
              note: p.note
            }))
          });
          
          return {
            success: true,
            mergePending: true,
            message: 'Richiesta di aggiunta prodotti inviata. In attesa di conferma dalla preparazione.'
          };
        }

        const ultimoOrdine = await tx.ordinazione.findFirst({
          where: {
            tavoloId: dati.tavoloId,
            stato: {
              in: ["ORDINATO", "IN_PREPARAZIONE"]
            },
            dataApertura: {
              gte: new Date(Date.now() - 5 * 60 * 1000)
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

        if (ultimoOrdine) {
          const prodottiEsistenti = ultimoOrdine.RigaOrdinazione.map(r => ({
            prodottoId: r.prodottoId,
            quantita: r.quantita
          }));
          
          const prodottiNuovi = dati.prodotti.map(p => ({
            prodottoId: p.prodottoId,
            quantita: p.quantita
          }));

          const isProbabileDuplicato = prodottiEsistenti.length === prodottiNuovi.length &&
            prodottiEsistenti.every(pe => 
              prodottiNuovi.some(pn => pn.prodottoId === pe.prodottoId && pn.quantita === pe.quantita)
            );

          if (isProbabileDuplicato) {
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

        await tx.tavolo.update({
          where: { id: dati.tavoloId },
          data: { stato: "OCCUPATO" },
        });
      }

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

      const totale = dati.prodotti.reduce(
        (sum, p) => sum + (p.prezzo * p.quantita),
        0
      );

      let nomeCliente = undefined;
      if (dati.note) {
        const match = dati.note.match(/Cliente:\s*([^-]+)/);
        if (match && match[1]) {
          nomeCliente = match[1].trim();
        }
      }

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
              const rigaId = nanoid();
              // Usa il prezzo finale se è stato calcolato con le varianti, altrimenti usa il prezzo base
              const prezzoRiga = p.prezzoFinale || p.prezzo;
              return {
                id: rigaId,
                prodottoId: p.prodottoId,
                quantita: p.quantita,
                prezzo: prezzoRiga,
                note: p.note,
                glassesCount: p.glassesCount,
                stato: "INSERITO",
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

      // Salva le configurazioni per i prodotti configurabili dopo la creazione dell'ordine
      for (const prodotto of dati.prodotti) {
        if (prodotto.configurazione && prodotto.prezzoFinale) {
          const rigaOrdinazione = ordinazione.RigaOrdinazione.find(
            r => r.prodottoId === prodotto.prodottoId
          );
          if (rigaOrdinazione) {
            await saveConfigurazioneRigaOrdine(
              rigaOrdinazione.id,
              prodotto.configurazione,
              prodotto.prezzoFinale
            );
          }
        }
      }

      return { success: true, ordinazione: serializeDecimalData(ordinazione) };
    }, {
      timeout: 15000, // 15 secondi per transazioni complesse
      maxWait: 5000   // Massimo tempo di attesa per acquisire il lock
    });

    if (!result.success) {
      return result;
    }

    // L'inventario è già stato aggiornato nella transazione da verificaERiservaQuantita

    if (result.merged && result.ordinazione) {
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
      
      const event = {
        orderId: result.ordinazione.id,
        tableNumber: parseInt(dati.tavoloId!.toString()),
        newItems: dati.prodotti.map(p => ({
          id: nanoid(),
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
      notificationManager.notifyOrderCreated({
        orderId: result.ordinazione.id,
        tableNumber: result.ordinazione.Tavolo ? parseInt(result.ordinazione.Tavolo.numero) : undefined,
        orderType: result.ordinazione.tipo,
        items: result.ordinazione.RigaOrdinazione ? result.ordinazione.RigaOrdinazione.map(r => ({
          nome: r.Prodotto?.nome || 'Prodotto',
          quantita: r.quantita,
          postazione: r.postazione
        })) : [],
        customerName: result.ordinazione.clienteId || undefined,
        waiterName: utente.nome
      });
      
      const eventData = {
        orderId: result.ordinazione.id,
        tableNumber: result.ordinazione.Tavolo ? parseInt(result.ordinazione.Tavolo.numero) : undefined,
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
      
      sseService.emit('order:new', eventData, { 
        broadcast: true, 
        skipRateLimit: true,
        tenantId: utente.tenantId,
        queueIfOffline: true
      });
      
      await emitOrderEvent(result.ordinazione.id, "new");
      
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

export async function getOrdinazioniAperte() {
  try {
    const result = await ordersSyncService.getOrders();
    return serializeDecimalData(result);
  } catch (error) {
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

    if (utente.ruolo !== 'SUPERVISORE' && utente.ruolo !== 'ADMIN' && utente.ruolo !== 'PREPARA') {
      return { success: false, error: "Permessi insufficienti" };
    }

    const count = await prisma.ordinazione.count();

    // Ordine corretto di cancellazione per rispettare le foreign key:
    // 1. Prima cancella tutti i pagamenti dei debiti
    await prisma.pagamentoDebito.deleteMany({});
    
    // 2. Poi cancella tutti i debiti
    await prisma.debito.deleteMany({});
    
    // 3. Cancella tutti i pagamenti (che hanno riferimenti alle ordinazioni)
    await prisma.pagamento.deleteMany({});
    
    // 4. Cancella tutti gli ordini esauriti (che hanno riferimenti alle ordinazioni)
    await prisma.ordineEsaurito.deleteMany({});
    
    // 5. Infine cancella tutti gli ordini
    await prisma.ordinazione.deleteMany({});

    await prisma.tavolo.updateMany({
      where: {
        stato: "OCCUPATO"
      },
      data: {
        stato: "LIBERO"
      }
    });

    ordersCache.invalidate();

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

export async function cancellaOrdinazione(ordinazioneId: string) {
  try {
    const utente = await getCurrentUser();
    if (!utente) {
      return { success: false, error: "Utente non autenticato" };
    }

    if (!['CAMERIERE', 'SUPERVISORE', 'ADMIN'].includes(utente.ruolo)) {
      return { success: false, error: "Permessi insufficienti" };
    }

    const result = await prisma.$transaction(async (tx) => {
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

      if (utente.ruolo === 'CAMERIERE' && ordinazione.stato !== 'ORDINATO') {
        return { success: false, error: "Non puoi cancellare ordini già in preparazione" };
      }

      // Rilascia le quantità riservate
      if (ordinazione.stato === 'ORDINATO') {
        const itemsToRelease = ordinazione.RigaOrdinazione.map(r => ({
          prodottoId: r.prodottoId,
          quantita: r.quantita
        }));

        await rilasciaQuantitaRiservate(itemsToRelease, tx);
      }

      await tx.ordinazione.delete({
        where: { id: ordinazioneId }
      });

      if (ordinazione.Tavolo) {
        const altreOrdinazioni = await tx.ordinazione.count({
          where: {
            tavoloId: ordinazione.tavoloId,
            id: { not: ordinazioneId }
          }
        });

        if (altreOrdinazioni === 0) {
          await tx.tavolo.update({
            where: { id: ordinazione.tavoloId! },
            data: { stato: 'LIBERO' }
          });
        }
      }

      return { success: true, ordinazione };
    });

    if (result.success && result.ordinazione) {
      ordersCache.remove(ordinazioneId);

      sseService.emit('order:cancelled', {
        orderId: ordinazioneId,
        tableNumber: result.ordinazione.tavoloId && result.ordinazione.Tavolo ? parseInt(result.ordinazione.Tavolo.numero) : undefined,
        orderType: result.ordinazione.tipo,
        reason: "Cancellata dall'utente",
        approvedBy: utente.nome || utente.id,
        timestamp: new Date().toISOString()
      });

      revalidatePath("/cameriere/ordini-in-corso");
      revalidatePath("/prepara");
      revalidatePath("/cucina");

      return { success: true, message: "Ordinazione cancellata con successo" };
    }

    return result;
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

    if (!['CAMERIERE', 'SUPERVISORE', 'ADMIN'].includes(utente.ruolo)) {
      return { success: false, error: "Permessi insufficienti" };
    }

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

    if (utente.ruolo === 'CAMERIERE' && riga.stato !== 'INSERITO') {
      return { success: false, error: "Non puoi cancellare prodotti già in preparazione" };
    }

    const righeRimanenti = await prisma.rigaOrdinazione.count({
      where: {
        ordinazioneId: riga.ordinazioneId,
        id: { not: rigaId }
      }
    });

    if (righeRimanenti === 0) {
      return await cancellaOrdinazione(riga.ordinazioneId);
    }

    const result = await prisma.$transaction(async (tx) => {
      // Rilascia la quantità riservata per il prodotto cancellato
      if (riga.stato === 'INSERITO') {
        await rilasciaQuantitaRiservate(
          [{
            prodottoId: riga.prodottoId,
            quantita: riga.quantita
          }],
          tx
        );
      }

      await tx.rigaOrdinazione.delete({
        where: { id: rigaId }
      });

      const righe = await tx.rigaOrdinazione.findMany({
        where: { ordinazioneId: riga.ordinazioneId }
      });

      const nuovoTotale = righe.reduce((sum, r) => {
        return sum + (parseFloat(r.prezzo.toString()) * r.quantita);
      }, 0);

      await tx.ordinazione.update({
        where: { id: riga.ordinazioneId },
        data: { totale: nuovoTotale }
      });

      return { success: true };
    });

    if (!result.success) {
      return result;
    }

    ordersCache.remove(riga.ordinazioneId);

    sseService.emit('order:item-cancelled', {
      orderId: riga.ordinazioneId,
      itemId: rigaId,
      productName: riga.Prodotto?.nome,
      tableNumber: riga.Ordinazione.Tavolo ? parseInt(riga.Ordinazione.Tavolo.numero) : undefined,
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

    if (!['CAMERIERE', 'SUPERVISORE', 'ADMIN'].includes(utente.ruolo)) {
      return { success: false, error: "Permessi insufficienti" };
    }

    if (nuovaQuantita < 1) {
      return { success: false, error: "La quantità deve essere almeno 1" };
    }

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

    if (utente.ruolo === 'CAMERIERE' && riga.stato !== 'INSERITO') {
      return { success: false, error: "Non puoi modificare prodotti già in preparazione" };
    }

    const result = await prisma.$transaction(async (tx) => {
      // Aggiorna l'inventario per la differenza di quantità
      if (riga.stato === 'INSERITO') {
        const differenza = nuovaQuantita - riga.quantita;
        if (differenza !== 0) {
          if (differenza > 0) {
            // Verifica e riserva la quantità aggiuntiva
            const verificaRiserva = await verificaERiservaQuantita(
              [{
                prodottoId: riga.prodottoId,
                quantita: differenza
              }],
              tx
            );
            
            if (!verificaRiserva.success) {
              return {
                success: false,
                error: `Quantità non disponibile. Disponibili: ${verificaRiserva.prodottiNonDisponibili[0]?.quantitaDisponibile || 0}`,
                prodottiNonDisponibili: verificaRiserva.prodottiNonDisponibili
              };
            }
          } else {
            // Rilascia parte della quantità riservata
            await rilasciaQuantitaRiservate(
              [{
                prodottoId: riga.prodottoId,
                quantita: Math.abs(differenza)
              }],
              tx
            );
          }
        }
      }

      await tx.rigaOrdinazione.update({
        where: { id: rigaId },
        data: { quantita: nuovaQuantita }
      });

      const righe = await tx.rigaOrdinazione.findMany({
        where: { ordinazioneId: riga.ordinazioneId }
      });

      const nuovoTotale = righe.reduce((sum, r) => {
        return sum + (parseFloat(r.prezzo.toString()) * r.quantita);
      }, 0);

      await tx.ordinazione.update({
        where: { id: riga.ordinazioneId },
        data: { totale: nuovoTotale }
      });

      return { success: true };
    });

    if (!result.success) {
      return result;
    }

    ordersCache.remove(riga.ordinazioneId);

    sseService.emit('order:item-modified', {
      orderId: riga.ordinazioneId,
      itemId: rigaId,
      productName: riga.Prodotto?.nome,
      oldQuantity: riga.quantita,
      newQuantity: nuovaQuantita,
      tableNumber: riga.Ordinazione.Tavolo ? parseInt(riga.Ordinazione.Tavolo.numero) : undefined,
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

export async function mergeOrdineProdotti(ordinazioneId: string, prodotti: ProdottoOrdine[]) {
  try {
    const utente = await getCurrentUser();
    if (!utente) {
      return { success: false, error: "Utente non autenticato" };
    }

    const result = await prisma.$transaction(async (tx) => {
      // Prima verifica e riserva le quantità richieste per il merge
      const verificaRiserva = await verificaERiservaQuantita(
        prodotti.map(p => ({ prodottoId: p.prodottoId, quantita: p.quantita })),
        tx
      );

      if (!verificaRiserva.success) {
        return {
          success: false,
          error: "Alcuni prodotti non sono disponibili nelle quantità richieste",
          prodottiNonDisponibili: verificaRiserva.prodottiNonDisponibili
        };
      }

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

      const righeAggiornate = [];
      
      for (const p of prodotti) {
        const rigaEsistente = ordineEsistente.RigaOrdinazione.find(
          r => r.prodottoId === p.prodottoId && r.stato !== "CONSEGNATO"
        );
        
        if (rigaEsistente) {
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
    }, {
      timeout: 10000, // 10 secondi
      maxWait: 5000   // Massimo tempo di attesa per acquisire il lock
    });

    if (result.success) {
      notificationManager.notifyOrderUpdated({
        orderId: ordinazioneId,
        tableNumber: result.ordinazione?.Tavolo ? parseInt(result.ordinazione.Tavolo.numero) : undefined,
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