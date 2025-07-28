"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { notificationManager } from "@/lib/notifications/NotificationManager";
import { serializeDecimalData } from "@/lib/utils/decimal-serializer";

export async function getOrdinazioniDaPagare() {
  try {
    const ordinazioni = await prisma.ordinazione.findMany({
      where: {
        stato: {
          not: "PAGATA"  // Escludi solo le ordinazioni già pagate (corretto da PAGATO a PAGATA)
        },
        statoPagamento: {
          not: "COMPLETAMENTE_PAGATO"
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
            prodotto: {
              select: {
                nome: true,
                prezzo: true
              }
            }
          }
        },
        pagamenti: true
      },
      orderBy: {
        dataApertura: 'asc'
      }
    });

    // Calcola totale rimanente per ogni ordinazione e serializza Decimal
    const ordinazioniConTotali = ordinazioni.map(ord => {
      const totalePagato = ord.pagamenti.reduce((sum, pag) => sum + pag.importo.toNumber(), 0);
      const totaleRighe = ord.righe.reduce((sum, riga) => sum + (riga.prezzo.toNumber() * riga.quantita), 0);
      const rimanente = totaleRighe - totalePagato;

      // Separa righe pagate e non pagate
      const righePagate = ord.righe.filter(riga => riga.isPagato);
      const righeNonPagate = ord.righe.filter(riga => !riga.isPagato);
      const totaleRighePagate = righePagate.reduce((sum, riga) => sum + (riga.prezzo.toNumber() * riga.quantita), 0);
      const totaleRigheNonPagate = righeNonPagate.reduce((sum, riga) => sum + (riga.prezzo.toNumber() * riga.quantita), 0);

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
    if (!utente) {
      return { success: false, error: "Utente non autenticato" };
    }

    // Verifica permessi (CASSA o superiore)
    if (!["ADMIN", "MANAGER", "OPERATORE", "CASSA"].includes(utente.ruolo)) {
      return { success: false, error: "Permessi insufficienti" };
    }

    // Recupera l'ordinazione con le righe non pagate
    const ordinazione = await prisma.ordinazione.findUnique({
      where: { id: ordinazioneId },
      include: {
        righe: {
          where: { isPagato: false }
        },
        pagamenti: true
      }
    });

    if (!ordinazione) {
      return { success: false, error: "Ordinazione non trovata" };
    }

    // Calcola totale rimanente
    const totaleRighe = ordinazione.righe.reduce((sum, riga) => sum + (riga.prezzo.toNumber() * riga.quantita), 0);
    const totalePagato = ordinazione.pagamenti.reduce((sum, pag) => sum + pag.importo.toNumber(), 0);
    const rimanente = totaleRighe - totalePagato;

    // Temporaneamente commentiamo questo controllo finché non implementiamo
    // il supporto per pagamenti parziali di prodotti specifici
    // if (importo > rimanente) {
    //   return { success: false, error: "Importo superiore al dovuto" };
    // }
    
    console.log("Controllo importo:", { importo, rimanente, check: importo > rimanente });

    // Crea il pagamento
    const pagamento = await prisma.pagamento.create({
      data: {
        ordinazioneId,
        importo,
        modalita,
        clienteNome,
        operatoreId: utente.id,
        righeIds: ordinazione.righe.map(r => r.id) // Per ora assegna tutte le righe
      }
    });

    // Gestisci pagamento parziale o completo
    let importoResidue = importo;
    const righeNonPagate = await prisma.rigaOrdinazione.findMany({
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
    const righePagate = [];

    // Marca le righe come pagate in base all'importo
    for (const riga of righeNonPagate) {
      const costoRiga = riga.prezzo.toNumber() * riga.quantita;
      
      if (importoResidue >= costoRiga) {
        // Paga completamente questa riga
        await prisma.rigaOrdinazione.update({
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
    await prisma.pagamento.update({
      where: { id: pagamento.id },
      data: {
        righeIds: righePagate
      }
    });

    // Verifica se tutte le righe sono state pagate
    const righeAncoraAperte = await prisma.rigaOrdinazione.count({
      where: {
        ordinazioneId,
        isPagato: false
      }
    });

    // Calcola il nuovo totale rimanente
    const righeRimanenti = await prisma.rigaOrdinazione.findMany({
      where: {
        ordinazioneId,
        isPagato: false
      }
    });
    
    const totaleRimanente = righeRimanenti.reduce((sum, riga) => 
      sum + (riga.prezzo.toNumber() * riga.quantita), 0
    );

    console.log(`Pagamento completato: righe pagate ${righePagate.length}, righe rimanenti ${righeAncoraAperte}, totale rimanente €${totaleRimanente}`);

    if (righeAncoraAperte === 0) {
      // Aggiorna stato ordinazione - completamente pagata
      await prisma.ordinazione.update({
        where: { id: ordinazioneId },
        data: {
          stato: "PAGATA",
          statoPagamento: "COMPLETAMENTE_PAGATO",
          dataChiusura: new Date()
        }
      });

      // Libera il tavolo se era occupato
      if (ordinazione.tavoloId) {
        await prisma.tavolo.update({
          where: { id: ordinazione.tavoloId },
          data: { stato: "LIBERO" }
        });
      }
      
      // Notifica pagamento completato
      notificationManager.notifyOrderPaid({
        orderId: ordinazioneId,
        tableNumber: ordinazione.tavoloId ? await prisma.tavolo.findUnique({
          where: { id: ordinazione.tavoloId },
          select: { numero: true }
        }).then(t => t ? parseInt(t.numero) : undefined) : undefined,
        orderType: ordinazione.tipo,
        amount: importo,
        customerName: clienteNome || undefined
      });
    } else {
      // Pagamento parziale - aggiorna solo lo stato
      await prisma.ordinazione.update({
        where: { id: ordinazioneId },
        data: {
          statoPagamento: "PARZIALMENTE_PAGATO"
        }
      });
      
      console.log(`Ordinazione ${ordinazioneId} aggiornata a PARZIALMENTE_PAGATO`);
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
    console.error("Errore creazione pagamento:", error);
    console.error("Stack trace:", error instanceof Error ? error.stack : "No stack");
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
    if (!["ADMIN", "MANAGER", "OPERATORE", "CAMERIERE"].includes(utente.ruolo)) {
      return { success: false, error: "Permessi insufficienti" };
    }

    // Recupera l'ordinazione
    const ordinazione = await prisma.ordinazione.findUnique({
      where: { id: ordinazioneId },
      include: {
        tavolo: true,
        righe: {
          where: { isPagato: false }
        },
        pagamenti: true
      }
    });

    if (!ordinazione) {
      return { success: false, error: "Ordinazione non trovata" };
    }

    // Calcola importo rimanente
    const totaleRighe = ordinazione.righe.reduce((sum, riga) => sum + (riga.prezzo.toNumber() * riga.quantita), 0);
    const totalePagato = ordinazione.pagamenti.reduce((sum, pag) => sum + pag.importo.toNumber(), 0);
    const rimanente = totaleRighe - totalePagato;

    if (rimanente <= 0) {
      return { success: false, error: "Ordinazione già pagata" };
    }

    // Notifica richiesta pagamento
    notificationManager.notifyPaymentRequested({
      orderId: ordinazioneId,
      tableNumber: ordinazione.tavolo ? parseInt(ordinazione.tavolo.numero) : undefined,
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
    if (!["ADMIN", "MANAGER", "OPERATORE", "CAMERIERE"].includes(utente.ruolo)) {
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
          tavolo: true
        }
      });

      if (ordinazione) {
        // Invia notifica alla cassa per richiesta scontrino
        notificationManager.notifyReceiptRequested({
          orderId,
          tableNumber: ordinazione.tavolo ? parseInt(ordinazione.tavolo.numero) : undefined,
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