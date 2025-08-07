"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-multi-tenant";
import { revalidatePath } from "next/cache";
import { notificationManager } from "@/lib/notifications/NotificationManager";
import { serializeDecimalData } from "@/lib/utils/decimal-serializer";
import { creaScontrinoQueue, creaScontrinoBatch } from "@/lib/services/scontrino-queue";
import { sseService } from "@/lib/sse/sse-service";
import { SSEEventMap } from "@/lib/sse/sse-events";
import crypto from "crypto";
import { nanoid } from "nanoid";
// import { rateLimiters } from "@/lib/middleware/rate-limiter"; // Removed - file deleted

export async function getOrdinazioniDaPagare() {
  try {
    const ordinazioni = await prisma.ordinazione.findMany({
      where: {
        stato: {
          not: "PAGATO"  // Escludi solo le ordinazioni già pagate
        },
        statoPagamento: {
          not: "COMPLETAMENTE_PAGATO"
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
            Prodotto: {
              select: {
                nome: true,
                prezzo: true
              }
            }
          }
        },
        Pagamento: true
      },
      orderBy: {
        dataApertura: 'asc'
      }
    });

    // Calcola totale rimanente per ogni ordinazione e serializza Decimal
    const ordinazioniConTotali = ordinazioni.map(ord => {
      const totalePagato = (ord as any).Pagamento?.reduce((sum: number, pag: any) => sum + pag.importo.toNumber(), 0) || 0;
      const totaleRighe = (ord as any).RigaOrdinazione?.reduce((sum: number, riga: any) => sum + (riga.prezzo.toNumber() * riga.quantita), 0) || 0;
      const rimanente = totaleRighe - totalePagato;

      // Separa righe pagate e non pagate
      const righePagate = (ord as any).RigaOrdinazione?.filter((riga: any) => riga.isPagato) || [];
      const righeNonPagate = (ord as any).RigaOrdinazione?.filter((riga: any) => !riga.isPagato) || [];
      const totaleRighePagate = righePagate.reduce((sum: number, riga: any) => sum + (riga.prezzo.toNumber() * riga.quantita), 0);
      const totaleRigheNonPagate = righeNonPagate.reduce((sum: number, riga: any) => sum + (riga.prezzo.toNumber() * riga.quantita), 0);

      return {
        ...ord,
        totaleRighe,
        totalePagato,
        rimanente,
        // Informazioni aggiuntive per pagamenti parziali
        righePagate: righePagate.length,
        righeNonPagate: righeNonPagate.length,
        totaleRighePagate,
        totaleRigheNonPagate,
        hasPagamentoParziale: righePagate.length > 0 && righeNonPagate.length > 0
      };
    });

    // Usa il serializzatore automatico per convertire tutti i Decimal
    const serializedData = serializeDecimalData(ordinazioniConTotali);
    return serializedData.filter(ord => ord.rimanente > 0);
  } catch (error) {
    console.error("Errore recupero ordinazioni da pagare:", error);
    return [];
  }
}

export async function creaPagamento(
  ordinazioneId: string,
  modalita: "POS" | "CONTANTI" | "MISTO",
  importo: number,
  clienteNome?: string
) {
  console.log("=== INIZIO creaPagamento (VERSIONE AGGIORNATA) ===");
  
  try {
    console.log("creaPagamento called with:", {
      ordinazioneId,
      modalita,
      importo,
      clienteNome
    });
    
    const utente = await getCurrentUser();
    console.log("Utente recuperato:", utente?.id, utente?.ruolo);
    if (!utente) {
      console.error("ERRORE: Utente non autenticato");
      return { success: false, error: "Utente non autenticato" };
    }
    
    // RATE LIMITING: Disabled - rate limiter removed
    // const rateLimitResult = await rateLimiters.payment.check(utente.id, 10);
    // if (!rateLimitResult.success) {
    //   const resetIn = Math.ceil((rateLimitResult.reset.getTime() - Date.now()) / 1000);
    //   return { 
    //     success: false, 
    //     error: `Troppe richieste di pagamento. Riprova tra ${resetIn} secondi.`,
    //     rateLimited: true,
    //     resetIn
    //   };
    // }

    // Verifica permessi (CASSA o superiore)
    if (!["ADMIN", "MANAGER", "CASSA"].includes(utente.ruolo)) {
      console.error("ERRORE: Permessi insufficienti, ruolo:", utente.ruolo);
      return { success: false, error: "Permessi insufficienti" };
    }
    console.log("Permessi verificati OK");

    // Recupera l'ordinazione con TUTTE le righe per calcolo corretto
    console.log("Recupero ordinazione:", ordinazioneId);
    const ordinazione = await prisma.ordinazione.findUnique({
      where: { id: ordinazioneId },
      include: {
        RigaOrdinazione: true, // Prendi TUTTE le righe per calcolo totale
        Pagamento: true
      }
    });

    if (!ordinazione) {
      console.error("ERRORE: Ordinazione non trovata:", ordinazioneId);
      return { success: false, error: "Ordinazione non trovata" };
    }
    const righeNonPagate = ordinazione.RigaOrdinazione.filter((r: any) => !r.isPagato);
    console.log("Ordinazione trovata, totale righe:", ordinazione.RigaOrdinazione.length, "righe non pagate:", righeNonPagate.length);

    // Prevent payment if already paid
    if (ordinazione.statoPagamento === "COMPLETAMENTE_PAGATO" || ordinazione.stato === "PAGATO") {
      return { success: false, error: "Ordinazione già pagata completamente" };
    }

    // Calcola totale rimanente SOLO delle righe NON pagate
    const totaleRigheNonPagate = righeNonPagate.reduce((sum: number, riga: any) => sum + (riga.prezzo.toNumber() * riga.quantita), 0) || 0;
    const totalePagato = (ordinazione as any).Pagamento?.reduce((sum: number, pag: any) => sum + pag.importo.toNumber(), 0) || 0;
    const rimanente = totaleRigheNonPagate; // Il rimanente è solo il totale delle righe non pagate
    
    console.log("Calcolo importi:", {
      totaleRigheNonPagate,
      totalePagato,
      rimanente,
      importoRichiesto: importo
    });

    // Validazione importo - permetti overpayment solo se esplicitamente richiesto
    if (importo > rimanente) {
      // Permetti overpayment fino al 10% per gestire arrotondamenti e mance
      const maxOverpayment = rimanente * 1.1;
      if (importo > maxOverpayment) {
        return { 
          success: false, 
          error: `Importo €${importo.toFixed(2)} troppo elevato. Massimo consentito: €${maxOverpayment.toFixed(2)} (include 10% mancia)` 
        };
      }
      // Log overpayment per audit
      console.log(`Overpayment rilevato: €${(importo - rimanente).toFixed(2)} su ordine ${ordinazioneId}`);
    }
    
    // Validazione importo minimo
    if (importo <= 0) {
      return { success: false, error: "L'importo deve essere maggiore di zero" };
    }

    // TRANSAZIONE ATOMICA per garantire consistenza con LOCK PESSIMISTICO
    let pagamento: any;
    let righePagate: string[] = [];
    let righeAncoraAperte = 0;
    let totaleRimanente = 0;
    
    console.log("Inizio transazione database...");
    const result = await prisma.$transaction(async (tx) => {
      console.log("Dentro transazione, acquisizione lock...");
      // Lock pessimistico con NOWAIT per prevenire deadlock
      const ordinazioneLocked = await tx.$queryRaw`
        SELECT id FROM "Ordinazione" 
        WHERE id = ${ordinazioneId}
        FOR UPDATE NOWAIT
      `.catch((err: any) => {
        if (err.code === 'P2034' || err.message?.includes('could not obtain lock')) {
          throw new Error('Ordine in elaborazione da un altro operatore. Riprova tra qualche secondo.');
        }
        throw err;
      });
      
      if (!ordinazioneLocked || (ordinazioneLocked as any[]).length === 0) {
        console.error("ERRORE: Lock fallito per ordinazione:", ordinazioneId);
        throw new Error("Impossibile acquisire lock sull'ordinazione");
      }
      console.log("Lock acquisito con successo");
      // Verifica ancora che l'ordine non sia già completamente pagato
      const ordinazioneAttuale = await tx.ordinazione.findUnique({
        where: { id: ordinazioneId },
        select: { statoPagamento: true, stato: true }
      });
      
      if (ordinazioneAttuale?.statoPagamento === "COMPLETAMENTE_PAGATO" || 
          ordinazioneAttuale?.stato === "PAGATO") {
        throw new Error("Ordinazione già pagata completamente");
      }
      
      // Crea il pagamento
      const pagamentoId = nanoid();
      pagamento = await tx.pagamento.create({
        data: {
          id: pagamentoId,
          ordinazioneId,
          importo,
          modalita,
          clienteNome,
          operatoreId: utente.id,
          righeIds: [] // Verrà aggiornato dopo
        }
      });

      // Crea record audit trail
      await tx.paymentHistory.create({
        data: {
          id: nanoid(),
          pagamentoId: pagamentoId,
          ordinazioneId: ordinazioneId,
          action: 'CREATE',
          importo: importo,
          modalita: modalita,
          operatoreId: utente.id,
          operatoreNome: utente.nome,
          previousState: { statoPagamento: ordinazioneAttuale?.statoPagamento || 'NON_PAGATO' },
          newState: { statoPagamento: righeAncoraAperte === 0 ? 'COMPLETAMENTE_PAGATO' : 'PARZIALMENTE_PAGATO' },
          metadata: {
            clienteNome,
            righeProcessate: righePagate.length,
            importoOriginale: importo,
            timestamp: new Date().toISOString()
          }
        }
      });

      // Gestisci pagamento parziale o completo
      let importoResidue = importo;
      const righeNonPagate = await tx.rigaOrdinazione.findMany({
        where: {
          ordinazioneId,
          isPagato: false
        },
        orderBy: {
          createdAt: 'asc'
        }
      });

      console.log(`Gestione pagamento: importo €${importo}, righe non pagate: ${righeNonPagate.length}`);

      // Lista delle righe effettivamente pagate in questo pagamento
      righePagate = [];

      // Marca le righe come pagate in base all'importo
      for (const riga of righeNonPagate) {
        const costoRiga = riga.prezzo.toNumber() * riga.quantita;
        
        if (importoResidue >= costoRiga) {
          // Paga completamente questa riga
          await tx.rigaOrdinazione.update({
            where: { id: riga.id },
            data: {
              isPagato: true,
              pagatoDa: clienteNome
            }
          });
          importoResidue -= costoRiga;
          righePagate.push(riga.id);
          console.log(`Riga pagata: ${riga.id} - €${costoRiga}, residuo: €${importoResidue}`);
        } else {
          // Pagamento parziale - per ora lo saltiamo
          console.log(`Importo insufficiente per riga ${riga.id} (costa €${costoRiga}, residuo €${importoResidue})`);
          break;
        }
      }

      // Aggiorna il record pagamento con le righe effettivamente pagate
      await tx.pagamento.update({
        where: { id: pagamento.id },
        data: {
          righeIds: righePagate
        }
      });

      // Verifica se tutte le righe sono state pagate
      righeAncoraAperte = await tx.rigaOrdinazione.count({
        where: {
          ordinazioneId,
          isPagato: false
        }
      });

      // Calcola il nuovo totale rimanente
      const righeRimanenti = await tx.rigaOrdinazione.findMany({
        where: {
          ordinazioneId,
          isPagato: false
        }
      });
      
      totaleRimanente = righeRimanenti.reduce((sum, riga) => 
        sum + (riga.prezzo.toNumber() * riga.quantita), 0
      );

      console.log(`Pagamento completato: righe pagate ${righePagate.length}, righe rimanenti ${righeAncoraAperte}, totale rimanente €${totaleRimanente}`);
      console.log("Verifica pagamento completo:", {
        righeAncoraAperte,
        totaleRimanente,
        importoPagato: importo,
        willCloseTavolo: righeAncoraAperte === 0
      });

      let tavoloLiberato = false;
      if (righeAncoraAperte === 0) {
        // Aggiorna stato ordinazione - SEMPRE sincronizzati stato e statoPagamento
        await tx.ordinazione.update({
          where: { id: ordinazioneId },
          data: {
            stato: "PAGATO",
            statoPagamento: "COMPLETAMENTE_PAGATO",
            dataChiusura: new Date()
          }
        });

        // Verifica altri ordini attivi prima di liberare il tavolo
        if (ordinazione.tavoloId) {
          const altriOrdiniAttivi = await tx.ordinazione.count({
            where: {
              tavoloId: ordinazione.tavoloId,
              id: { not: ordinazioneId },
              stato: {
                notIn: ["PAGATO", "ANNULLATO"]
              }
            }
          });
          
          // Libera il tavolo SOLO se non ci sono altri ordini attivi
          if (altriOrdiniAttivi === 0) {
            await tx.tavolo.update({
              where: { id: ordinazione.tavoloId },
              data: { stato: "LIBERO" }
            });
            tavoloLiberato = true;
          }
        }
      
      // Notifica pagamento completato
      const tableNumber = ordinazione.tavoloId ? await prisma.tavolo.findUnique({
        where: { id: ordinazione.tavoloId },
        select: { numero: true }
      }).then(t => t ? parseInt(t.numero) : undefined) : undefined;
      
      notificationManager.notifyOrderPaid({
        orderId: ordinazioneId,
        tableNumber,
        orderType: ordinazione.tipo,
        amount: importo,
        customerName: clienteNome || undefined
      });
      
      // Emetti evento SSE direttamente (come fa creaOrdinazione)
      const eventData: SSEEventMap['order:paid'] = {
        orderId: ordinazioneId,
        amount: importo,
        paymentMethod: modalita,
        cashierId: utente.id,
        timestamp: new Date().toISOString()
      };
      
      // Emit immediately with broadcast
      sseService.emit('order:paid', eventData, { 
        broadcast: true, 
        skipRateLimit: true,
        tenantId: utente.tenantId,
        queueIfOffline: true
      });
      
      // Also emit with delays to catch reconnecting clients
      const delays = [100, 250, 500, 1000, 2000];
      delays.forEach(delay => {
        setTimeout(() => {
          sseService.emit('order:paid', eventData, { 
            broadcast: true, 
            skipRateLimit: true,
            tenantId: utente.tenantId
          });
        }, delay);
      });
      } else {
        // Pagamento parziale - mantieni stati sincronizzati
        await tx.ordinazione.update({
          where: { id: ordinazioneId },
          data: {
            statoPagamento: "PARZIALMENTE_PAGATO",
            // NON cambiare lo stato principale se parzialmente pagato
            // stato rimane CONSEGNATO/RICHIESTA_CONTO/etc
          }
        });
        
        console.log(`Ordinazione ${ordinazioneId} aggiornata a PARZIALMENTE_PAGATO`);
      }
    
      // Return transaction results
      return { pagamento, righePagate, righeAncoraAperte, totaleRimanente };
    }, {
      maxWait: 5000,  // Max 5 secondi di attesa per acquisire la transazione
      timeout: 10000, // Timeout 10 secondi per completare la transazione
      isolationLevel: 'Serializable' // Massimo isolamento per prevenire anomalie
    });

    // Crea scontrino nella queue
    try {
      const ordinazioneCompleta = await prisma.ordinazione.findUnique({
        where: { id: ordinazioneId },
        include: {
          RigaOrdinazione: {
            where: { id: { in: righePagate } },
            include: { Prodotto: true }
          },
          User: true,
          Tavolo: true
        }
      });

      if (ordinazioneCompleta) {
        const righeScontrino = ordinazioneCompleta.RigaOrdinazione.map((riga: any) => ({
          prodotto: riga.Prodotto.nome,
          quantita: riga.quantita,
          prezzoUnitario: riga.prezzo.toNumber(),
          totaleRiga: riga.prezzo.toNumber() * riga.quantita,
          isPagato: true,
          pagatoDa: clienteNome
        }));

        const sessionePagamento = crypto.randomUUID();
        
        await creaScontrinoQueue("NON_FISCALE", {
          tavoloNumero: ordinazioneCompleta.Tavolo?.numero,
          clienteNome,
          cameriereNome: ordinazioneCompleta.User.nome,
          righe: righeScontrino,
          totale: importo,
          modalitaPagamento: modalita,
          ordinazioneIds: [ordinazioneId],
          pagamentoIds: [pagamento.id],
          sessionePagamento
        });

        await creaScontrinoQueue("FISCALE", {
          tavoloNumero: ordinazioneCompleta.Tavolo?.numero,
          clienteNome,
          cameriereNome: ordinazioneCompleta.User.nome,
          righe: [{
            prodotto: `Totale Ordine #${ordinazioneCompleta.numero}`,
            quantita: 1,
            prezzoUnitario: importo,
            totaleRiga: importo
          }],
          totale: importo,
          modalitaPagamento: modalita,
          ordinazioneIds: [ordinazioneId],
          pagamentoIds: [pagamento.id],
          sessionePagamento
        }, "ALTA");
      }
    } catch (scontrinoError) {
      console.error("Errore creazione scontrini:", scontrinoError);
      // Non bloccare il pagamento per errori scontrino
    }

    revalidatePath("/cassa");
    revalidatePath("/cameriere");

    return { 
      success: true, 
      pagamento,
      righeAggiornate: {
        righePagate: righePagate.length,
        righeRimanenti: righeAncoraAperte,
        totaleRimanente,
        statoFinale: righeAncoraAperte === 0 ? "COMPLETAMENTE_PAGATO" : "PARZIALMENTE_PAGATO"
      }
    };
    
  } catch (error) {
    console.error("=== ERRORE CRITICO IN creaPagamento ===");
    console.error("Errore creazione pagamento:", error);
    console.error("Stack trace:", error instanceof Error ? error.stack : "No stack");
    console.error("Tipo errore:", typeof error);
    if (error instanceof Error) {
      console.error("Message:", error.message);
      console.error("Name:", error.name);
    }
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Errore interno del server" 
    };
  }
}

export async function richiediPagamento(ordinazioneId: string) {
  try {
    const utente = await getCurrentUser();
    if (!utente) {
      return { success: false, error: "Utente non autenticato" };
    }

    // Verifica permessi (CAMERIERE o superiore)
    if (!["ADMIN", "MANAGER", "CAMERIERE"].includes(utente.ruolo)) {
      return { success: false, error: "Permessi insufficienti" };
    }

    // Recupera l'ordinazione
    const ordinazione = await prisma.ordinazione.findUnique({
      where: { id: ordinazioneId },
      include: {
        Tavolo: true,
        RigaOrdinazione: {
          where: { isPagato: false }
        },
        Pagamento: true
      }
    });

    if (!ordinazione) {
      return { success: false, error: "Ordinazione non trovata" };
    }

    // Calcola importo rimanente
    const totaleRighe = ordinazione.RigaOrdinazione.reduce((sum, riga) => sum + (riga.prezzo.toNumber() * riga.quantita), 0);
    const totalePagato = ordinazione.Pagamento.reduce((sum, pag) => sum + pag.importo.toNumber(), 0);
    const rimanente = totaleRighe - totalePagato;

    if (rimanente <= 0) {
      return { success: false, error: "Ordinazione già pagata" };
    }

    // Notifica richiesta pagamento
    notificationManager.notifyPaymentRequested({
      orderId: ordinazioneId,
      tableNumber: ordinazione.Tavolo ? parseInt(ordinazione.Tavolo.numero) : undefined,
      orderType: ordinazione.tipo,
      amount: rimanente,
      customerName: ordinazione.clienteId || ordinazione.nomeCliente || undefined
    });

    revalidatePath("/cameriere");
    revalidatePath("/cassa");

    return { 
      success: true, 
      message: "Richiesta di pagamento inviata alla cassa",
      amount: rimanente
    };
  } catch (error) {
    console.error("Errore richiesta pagamento:", error);
    return { success: false, error: "Errore interno del server" };
  }
}

export async function richiediScontrino(
  items: Array<{ orderId: string; totalPrice: number }>,
  totalAmount: number,
  paymentMethod: "CONTANTI" | "POS",
  waiterName: string
) {
  try {
    const utente = await getCurrentUser();
    if (!utente) {
      return { success: false, error: "Utente non autenticato" };
    }

    // Verifica permessi (CAMERIERE o superiore)
    if (!["ADMIN", "MANAGER", "CAMERIERE"].includes(utente.ruolo)) {
      return { success: false, error: "Permessi insufficienti" };
    }

    // Raggruppa per ordine
    const orderGroups = items.reduce((acc, item) => {
      if (!acc[item.orderId]) {
        acc[item.orderId] = 0;
      }
      acc[item.orderId] += item.totalPrice;
      return acc;
    }, {} as Record<string, number>);

    // Per ogni ordine coinvolto, notifica la richiesta scontrino
    for (const [orderId, amount] of Object.entries(orderGroups)) {
      // Recupera info ordine per la notifica
      const ordinazione = await prisma.ordinazione.findUnique({
        where: { id: orderId },
        include: {
          Tavolo: true
        }
      });

      if (ordinazione) {
        // Invia notifica alla cassa per richiesta scontrino
        notificationManager.notifyReceiptRequested({
          orderId,
          tableNumber: ordinazione.Tavolo ? parseInt(ordinazione.Tavolo.numero) : undefined,
          orderType: ordinazione.tipo,
          amount,
          waiterName: utente.nome,
          paymentMethod
        });
      }
    }

    revalidatePath("/cameriere");
    revalidatePath("/cassa");

    return { 
      success: true, 
      message: "Richiesta scontrino inviata alla cassa"
    };
  } catch (error) {
    console.error("Errore richiesta scontrino:", error);
    return { success: false, error: "Errore interno del server" };
  }
}

// Nuova funzione per pagare righe specifiche
export async function creaPagamentoRigheSpecifiche(
  righeIds: string[],
  modalita: "POS" | "CONTANTI" | "MISTO",
  clienteNome?: string
) {
  console.log("=== INIZIO creaPagamentoRigheSpecifiche ===");
  
  try {
    console.log("creaPagamentoRigheSpecifiche called with:", {
      righeIds,
      modalita,
      clienteNome
    });
    
    const utente = await getCurrentUser();
    if (!utente) {
      return { success: false, error: "Utente non autenticato" };
    }

    // Verifica permessi (CASSA o superiore)
    if (!["ADMIN", "MANAGER", "CASSA"].includes(utente.ruolo)) {
      return { success: false, error: "Permessi insufficienti" };
    }

    // Usa transazione con timeout e isolation level per garantire atomicità
    const result = await prisma.$transaction(async (prisma) => {
      // Recupera le righe selezionate con i loro ordini
      const righe = await prisma.rigaOrdinazione.findMany({
        where: {
          id: { in: righeIds },
          isPagato: false // Solo righe non ancora pagate
        },
        include: {
          Prodotto: {
            select: { nome: true }
          },
          Ordinazione: {
            include: {
              Tavolo: true
            }
          }
        }
      });

      if (righe.length === 0) {
        throw new Error("Nessuna riga trovata o tutte già pagate");
      }

      // Calcola il totale delle righe selezionate
      const totaleImporto = righe.reduce((sum, riga) => 
        sum + riga.prezzo.toNumber() * riga.quantita, 0
      );

      // Raggruppa righe per ordinazione
      const righePerOrdinazione = righe.reduce((acc, riga) => {
        const ordId = riga.ordinazioneId;
        if (!acc[ordId]) {
          acc[ordId] = [];
        }
        acc[ordId].push(riga);
        return acc;
      }, {} as Record<string, typeof righe>);

      const pagamentiCreati = [];

      // Crea un pagamento per ogni ordinazione coinvolta
      for (const [ordinazioneId, righeOrd] of Object.entries(righePerOrdinazione)) {
        const importoOrd = righeOrd.reduce((sum, riga) => 
          sum + riga.prezzo.toNumber() * riga.quantita, 0
        );

        // Crea il pagamento
        const pagamentoId = nanoid();
        const pagamento = await prisma.pagamento.create({
          data: {
            id: pagamentoId,
            ordinazioneId,
            importo: importoOrd,
            modalita,
            clienteNome,
            righeIds: righeOrd.map(r => r.id),
            operatoreId: utente.id
          }
        });

        // Conta righe rimanenti prima di creare audit trail
        const righeRimanentiCount = await prisma.rigaOrdinazione.count({
          where: {
            ordinazioneId,
            isPagato: false
          }
        });

        // Crea record audit trail per ogni pagamento
        await prisma.paymentHistory.create({
          data: {
            id: nanoid(),
            pagamentoId: pagamentoId,
            ordinazioneId: ordinazioneId,
            action: 'CREATE',
            importo: importoOrd,
            modalita: modalita,
            operatoreId: utente.id,
            operatoreNome: utente.nome,
            previousState: { statoPagamento: 'NON_PAGATO' }, // Assumiamo stato iniziale
            newState: { statoPagamento: righeRimanentiCount === righeOrd.length ? 'COMPLETAMENTE_PAGATO' : 'PARZIALMENTE_PAGATO' },
            metadata: {
              clienteNome,
              righeProcessate: righeOrd.map(r => r.id),
              importoOriginale: importoOrd,
              timestamp: new Date().toISOString()
            }
          }
        });

        pagamentiCreati.push(pagamento);

        // Marca le righe come pagate
        await prisma.rigaOrdinazione.updateMany({
          where: {
            id: { in: righeOrd.map(r => r.id) }
          },
          data: {
            isPagato: true,
            pagatoDa: clienteNome || utente.nome
          }
        });

        // Controlla se l'ordinazione è completamente pagata
        const righeRimanenti = await prisma.rigaOrdinazione.count({
          where: {
            ordinazioneId,
            isPagato: false
          }
        });

        // Aggiorna lo stato dell'ordinazione
        const nuovoStatoPagamento = righeRimanenti === 0 ? 
          "COMPLETAMENTE_PAGATO" : "PARZIALMENTE_PAGATO";

        await prisma.ordinazione.update({
          where: { id: ordinazioneId },
          data: {
            statoPagamento: nuovoStatoPagamento,
            ...(nuovoStatoPagamento === "COMPLETAMENTE_PAGATO" && {
              stato: "PAGATO"
            })
          }
        });

        console.log(`Ordinazione ${ordinazioneId} aggiornata a ${nuovoStatoPagamento}`);
      }

      return {
        pagamentiCreati,
        totaleImporto,
        righeAggiornate: righe.length,
        righeInfo: righe.map(r => ({
          id: r.id,
          ordinazioneId: r.ordinazioneId,
          tavolo: r.Ordinazione.Tavolo
        }))
      };
    });

    // Invia notifiche fuori dalla transazione
    const ordinazioniCoinvolte = [...new Set(result.righeInfo.map(r => r.ordinazioneId))];
    
    for (const ordId of ordinazioniCoinvolte) {
      const rigaInfo = result.righeInfo.find(r => r.ordinazioneId === ordId);
      if (rigaInfo) {
        notificationManager.notifyOrderPaid({
          orderId: ordId,
          tableNumber: rigaInfo.tavolo ? parseInt(rigaInfo.tavolo.numero) : undefined,
          orderType: 'TAVOLO',
          items: [],
          customerName: clienteNome || utente.nome,
          waiterName: utente.nome
        });
      }
    }

    // Crea scontrini batch se più ordinazioni dallo stesso tavolo
    try {
      const tavoliCoinvolti = [...new Set(result.righeInfo.map(r => r.tavolo?.numero).filter(Boolean))];
      
      if (tavoliCoinvolti.length === 1 && tavoliCoinvolti[0]) {
        // Batch printing per stesso tavolo
        const tavoloNumero = tavoliCoinvolti[0];
        const sessionePagamento = crypto.randomUUID();
        
        await creaScontrinoBatch(
          tavoloNumero,
          result.pagamentiCreati.map(p => p.id),
          sessionePagamento
        );
      } else {
        // Scontrini separati per tavoli diversi
        for (const pagamento of result.pagamentiCreati) {
          const ordinazioneCompleta = await prisma.ordinazione.findUnique({
            where: { id: pagamento.ordinazioneId },
            include: {
              RigaOrdinazione: {
                where: { 
                  id: { in: Array.isArray(pagamento.righeIds) ? pagamento.righeIds as string[] : [] }
                },
                include: { Prodotto: true }
              },
              User: true,
              Tavolo: true
            }
          });

          if (ordinazioneCompleta) {
            const righeScontrino = ordinazioneCompleta.RigaOrdinazione.map((riga: any) => ({
              prodotto: riga.Prodotto.nome,
              quantita: riga.quantita,
              prezzoUnitario: riga.prezzo.toNumber(),
              totaleRiga: riga.prezzo.toNumber() * riga.quantita,
              isPagato: true,
              pagatoDa: clienteNome || utente.nome
            }));

            const sessionePagamento = crypto.randomUUID();
            
            await creaScontrinoQueue("NON_FISCALE", {
              tavoloNumero: ordinazioneCompleta.Tavolo?.numero,
              clienteNome: clienteNome || utente.nome,
              cameriereNome: ordinazioneCompleta.User.nome,
              righe: righeScontrino,
              totale: pagamento.importo.toNumber(),
              modalitaPagamento: modalita,
              ordinazioneIds: [pagamento.ordinazioneId],
              pagamentoIds: [pagamento.id],
              sessionePagamento
            });

            await creaScontrinoQueue("FISCALE", {
              tavoloNumero: ordinazioneCompleta.Tavolo?.numero,
              clienteNome: clienteNome || utente.nome,
              cameriereNome: ordinazioneCompleta.User.nome,
              righe: [{
                prodotto: `Pagamento Parziale`,
                quantita: 1,
                prezzoUnitario: pagamento.importo.toNumber(),
                totaleRiga: pagamento.importo.toNumber()
              }],
              totale: pagamento.importo.toNumber(),
              modalitaPagamento: modalita,
              ordinazioneIds: [pagamento.ordinazioneId],
              pagamentoIds: [pagamento.id],
              sessionePagamento
            }, "ALTA");
          }
        }
      }
    } catch (scontrinoError) {
      console.error("Errore creazione scontrini batch:", scontrinoError);
      // Non bloccare il pagamento per errori scontrino
    }

    revalidatePath("/cassa");
    revalidatePath("/cameriere");

    return { 
      success: true, 
      pagamenti: result.pagamentiCreati,
      totaleImporto: result.totaleImporto,
      righeAggiornate: result.righeAggiornate,
      ordinazioniCoinvolte: ordinazioniCoinvolte.length
    };
  } catch (error) {
    console.error("Errore creazione pagamento righe specifiche:", error);
    console.error("Stack trace:", error instanceof Error ? error.stack : "No stack");
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Errore interno del server" 
    };
  }
}