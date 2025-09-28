"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-multi-tenant";
import { revalidatePath } from "next/cache";
import { notificationManager } from "@/lib/notifications/NotificationManager";
import { nanoid } from "nanoid";

export async function creaRichiestaPagamento(
  ordinazioneId: string,
  modalitaPagamento: 'POS' | 'CONTANTI' | 'MISTO' | 'BANCOMAT' | 'SATISPAY',
  clienteNome: string,
  prodottiSelezionati?: string[]
) {
  try {
    const utente = await getCurrentUser();
    if (!utente) {
      return { success: false, error: "Utente non autenticato" };
    }

    // Verifica permessi (CAMERIERE o superiore)
    if (!["ADMIN", "MANAGER", "CAMERIERE", "SUPERVISORE"].includes(utente.ruolo)) {
      return { success: false, error: "Permessi insufficienti" };
    }

    // Recupera l'ordinazione con dettagli
    const ordinazione = await prisma.ordinazione.findUnique({
      where: { id: ordinazioneId },
      include: {
        Tavolo: true,
        RigaOrdinazione: {
          where: { isPagato: false },
          include: {
            Prodotto: true
          }
        },
        Pagamento: true,
        User: true
      }
    });

    if (!ordinazione) {
      return { success: false, error: "Ordinazione non trovata" };
    }

    // Calcola importo rimanente
    const totaleRighe = ordinazione.RigaOrdinazione.reduce((sum, riga) => 
      sum + (riga.prezzo.toNumber() * riga.quantita), 0
    );
    const totalePagato = ordinazione.Pagamento.reduce((sum, pag) => 
      sum + pag.importo.toNumber(), 0
    );
    const rimanente = totaleRighe - totalePagato;

    if (rimanente <= 0) {
      return { success: false, error: "Ordinazione già pagata" };
    }

    // Mappa modalità pagamento per il database
    let modalitaDB: 'POS' | 'CONTANTI' | 'MISTO' = 'POS';
    if (modalitaPagamento === 'CONTANTI') modalitaDB = 'CONTANTI';
    else if (modalitaPagamento === 'MISTO') modalitaDB = 'MISTO';
    else modalitaDB = 'POS'; // POS, BANCOMAT, SATISPAY mappati su POS

    // Crea la richiesta di pagamento nel database
    const richiesta = await prisma.richiestaPagemento.create({
      data: {
        id: nanoid(),
        tipo: prodottiSelezionati && prodottiSelezionati.length > 0 ? 'PARZIALE' : 'ORDINAZIONE',
        tavoloNumero: ordinazione.Tavolo?.numero || 'ASPORTO',
        ordinazioneId: ordinazione.id,
        prodottiSelezionati: prodottiSelezionati ? JSON.stringify(prodottiSelezionati) : null,
        totale: rimanente,
        modalitaPagamento: modalitaDB,
        stato: 'RICHIESTA',
        cameriereId: utente.id,
        clienteNome: clienteNome
      }
    });

    // Notifica tramite notification manager (gestisce SSE automaticamente)
    notificationManager.notifyPaymentRequested({
      orderId: ordinazione.id,
      tableNumber: ordinazione.Tavolo?.numero || undefined,
      orderType: ordinazione.tipo,
      amount: rimanente,
      customerName: clienteNome,
      waiterName: utente.nome,
      paymentMethod: modalitaPagamento
    });

    revalidatePath("/cameriere");
    revalidatePath("/cassa");

    return { 
      success: true, 
      message: "Richiesta di pagamento inviata alla cassa",
      amount: rimanente,
      requestId: richiesta.id
    };
  } catch (error) {
    console.error("Errore creazione richiesta pagamento:", error);
    return { success: false, error: "Errore interno del server" };
  }
}

export async function getRichiestePagamentoPendenti() {
  try {
    const utente = await getCurrentUser();
    if (!utente) {
      return { success: false, error: "Utente non autenticato" };
    }

    // Solo CASSA può vedere le richieste
    if (!["ADMIN", "MANAGER", "CASSA", "SUPERVISORE"].includes(utente.ruolo)) {
      return { success: false, error: "Permessi insufficienti" };
    }

    const richieste = await prisma.richiestaPagemento.findMany({
      where: {
        stato: {
          in: ['RICHIESTA', 'IN_CORSO']
        },
        User: {
          tenantId: utente.tenantId
        }
      },
      include: {
        User: {
          select: {
            nome: true
          }
        }
      },
      orderBy: {
        timestampCreazione: 'asc'
      }
    });

    return { 
      success: true, 
      richieste: richieste.map(r => ({
        id: r.id,
        tipo: r.tipo,
        tavoloNumero: r.tavoloNumero,
        ordinazioneId: r.ordinazioneId,
        prodottiSelezionati: r.prodottiSelezionati ? JSON.parse(r.prodottiSelezionati) : null,
        totale: r.totale.toNumber(),
        modalitaPagamento: r.modalitaPagamento,
        stato: r.stato,
        cameriereNome: r.User.nome,
        clienteNome: r.clienteNome,
        timestampCreazione: r.timestampCreazione,
        timestampCompletamento: r.timestampCompletamento
      }))
    };
  } catch (error) {
    console.error("Errore recupero richieste pagamento:", error);
    return { success: false, error: "Errore interno del server" };
  }
}

export async function accettaRichiestaPagamento(richiestaId: string) {
  try {
    const utente = await getCurrentUser();
    if (!utente) {
      return { success: false, error: "Utente non autenticato" };
    }

    // Solo CASSA può accettare richieste
    if (!["ADMIN", "MANAGER", "CASSA", "SUPERVISORE"].includes(utente.ruolo)) {
      return { success: false, error: "Permessi insufficienti" };
    }

    // Recupera la richiesta con più dettagli
    const richiesta = await prisma.richiestaPagemento.findUnique({
      where: { id: richiestaId },
      include: {
        User: true
      }
    });

    if (!richiesta) {
      return { success: false, error: "Richiesta non trovata" };
    }

    if (richiesta.stato !== 'RICHIESTA') {
      return { success: false, error: "Richiesta già processata" };
    }

    // Aggiorna stato a COMPLETATO direttamente
    // (il pagamento vero verrà gestito dal componente chiamante)
    await prisma.richiestaPagemento.update({
      where: { id: richiestaId },
      data: { 
        stato: 'COMPLETATO',
        timestampCompletamento: new Date()
      }
    });

    revalidatePath("/cassa");

    return { 
      success: true, 
      message: "Richiesta accettata",
      ordinazioneId: richiesta.ordinazioneId,
      totale: richiesta.totale.toNumber(),
      clienteNome: richiesta.clienteNome,
      modalitaPagamento: richiesta.modalitaPagamento
    };
  } catch (error) {
    console.error("Errore accettazione richiesta:", error);
    return { success: false, error: "Errore interno del server" };
  }
}

export async function rifiutaRichiestaPagamento(richiestaId: string, motivo?: string) {
  try {
    const utente = await getCurrentUser();
    if (!utente) {
      return { success: false, error: "Utente non autenticato" };
    }

    // Solo CASSA può rifiutare richieste
    if (!["ADMIN", "MANAGER", "CASSA", "SUPERVISORE"].includes(utente.ruolo)) {
      return { success: false, error: "Permessi insufficienti" };
    }

    // Recupera la richiesta
    const richiesta = await prisma.richiestaPagemento.findUnique({
      where: { id: richiestaId },
      include: {
        User: true
      }
    });

    if (!richiesta) {
      return { success: false, error: "Richiesta non trovata" };
    }

    if (richiesta.stato !== 'RICHIESTA') {
      return { success: false, error: "Richiesta già processata" };
    }

    // Aggiorna stato ad ANNULLATO
    await prisma.richiestaPagemento.update({
      where: { id: richiestaId },
      data: { 
        stato: 'ANNULLATO',
        timestampCompletamento: new Date()
      }
    });

    // Invia notifica al cameriere tramite notification manager
    notificationManager.notify({
      title: 'Richiesta Rifiutata',
      message: motivo || `La tua richiesta di pagamento per il tavolo ${richiesta.tavoloNumero} è stata rifiutata`,
      type: 'error',
      userId: richiesta.cameriereId
    });

    revalidatePath("/cassa");

    return { 
      success: true, 
      message: "Richiesta rifiutata"
    };
  } catch (error) {
    console.error("Errore rifiuto richiesta:", error);
    return { success: false, error: "Errore interno del server" };
  }
}