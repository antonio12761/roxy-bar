"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-multi-tenant";
import { revalidatePath } from "next/cache";
import { notificationManager } from "@/lib/notifications/NotificationManager";
import { serializeDecimalData } from "@/lib/utils/decimal-serializer";
import { nanoid } from "nanoid";
import { sseService } from "@/lib/sse/sse-service";
// import { rateLimiters } from "@/lib/middleware/rate-limiter"; // Removed - file deleted

export async function creaDebito(
  clienteId: string,
  ordinazioneId: string,
  importo: number,
  note?: string
) {
  try {
    const utente = await getCurrentUser();
    if (!utente) {
      return { success: false, error: "Utente non autenticato" };
    }
    
    // RATE LIMITING: Disabled - rate limiter removed
    // const rateLimitResult = await rateLimiters.debt.check(utente.id, 5);
    // if (!rateLimitResult.success) {
    //   const resetIn = Math.ceil((rateLimitResult.reset.getTime() - Date.now()) / 1000);
    //   return { 
    //     success: false, 
    //     error: `Troppe richieste di creazione debito. Riprova tra ${resetIn} secondi.`
    //   };
    // }

    // Verifica permessi (CASSA o superiore)
    if (!["ADMIN", "MANAGER", "CASSA"].includes(utente.ruolo)) {
      return { success: false, error: "Permessi insufficienti" };
    }

    // Verifica che l'ordinazione esista
    const ordinazione = await prisma.ordinazione.findUnique({
      where: { id: ordinazioneId },
      include: {
        Tavolo: true
      }
    });

    if (!ordinazione) {
      return { success: false, error: "Ordinazione non trovata" };
    }

    // TRANSAZIONE ATOMICA per creare debito e aggiornare ordinazione
    const result = await prisma.$transaction(async (tx) => {
      // Lock pessimistico sull'ordinazione
      const ordinazioneLocked = await tx.$queryRaw`
        SELECT id FROM "Ordinazione" 
        WHERE id = ${ordinazioneId}
        FOR UPDATE
      `;
      
      if (!ordinazioneLocked || (ordinazioneLocked as any[]).length === 0) {
        throw new Error("Impossibile acquisire lock sull'ordinazione");
      }
      
      // Verifica che l'ordinazione non sia già pagata
      const ordinazioneAttuale = await tx.ordinazione.findUnique({
        where: { id: ordinazioneId },
        select: { statoPagamento: true, stato: true }
      });
      
      if (ordinazioneAttuale?.statoPagamento === "COMPLETAMENTE_PAGATO" || 
          ordinazioneAttuale?.stato === "PAGATO") {
        throw new Error("Ordinazione già pagata");
      }
      
      // Crea il debito
      const debito = await tx.debito.create({
        data: {
          id: nanoid(),
          Cliente: {
            connect: { id: clienteId }
          },
          Ordinazione: {
            connect: { id: ordinazioneId }
          },
          importo,
          note: note || null,
          Operatore: {
            connect: { id: utente.id }
          }
        },
        include: {
          Cliente: true,
          Ordinazione: {
            include: {
              Tavolo: true
            }
          }
        }
      });

      // Aggiorna lo stato dell'ordinazione a PAGATO (tramite debito)
      await tx.ordinazione.update({
        where: { id: ordinazioneId },
        data: {
          stato: "PAGATO",
          statoPagamento: "COMPLETAMENTE_PAGATO",
          dataChiusura: new Date()
        }
      });
      
      // Marca tutte le righe come pagate
      await tx.rigaOrdinazione.updateMany({
        where: {
          ordinazioneId,
          isPagato: false
        },
        data: {
          isPagato: true,
          pagatoDa: `Debito - ${debito.Cliente.nome}`
        }
      });

      // Libera il tavolo se necessario
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

        if (altriOrdiniAttivi === 0) {
          await tx.tavolo.update({
            where: { id: ordinazione.tavoloId },
            data: { stato: "LIBERO" }
          });
        }
      }
      
      return debito;
    });
    
    const debito = result;

    // Emetti evento SSE per debito creato
    const eventData = {
      debitoId: debito.id,
      clienteId,
      clienteName: debito.Cliente.nome,
      amount: importo,
      orderId: ordinazioneId,
      tableNumber: debito.Ordinazione?.Tavolo?.numero || undefined,
      timestamp: new Date().toISOString()
    };

    sseService.emit('debt:created' as any, eventData, {
      broadcast: true,
      skipRateLimit: true,
      tenantId: utente.tenantId,
      queueIfOffline: true
    });

    // Emit con delays per client che si riconnettono
    const delays = [100, 250, 500, 1000, 2000];
    delays.forEach(delay => {
      setTimeout(() => {
        sseService.emit('debt:created' as any, eventData, {
          broadcast: true,
          skipRateLimit: true,
          tenantId: utente.tenantId
        });
      }, delay);
    });

    revalidatePath("/cassa");

    return {
      success: true,
      debito: serializeDecimalData(debito),
      message: `Debito di €${importo.toFixed(2)} creato per ${debito.Cliente.nome}`
    };
  } catch (error) {
    console.error("Errore creazione debito:", error);
    return {
      success: false,
      error: "Errore durante la creazione del debito"
    };
  }
}

export async function getDebiti(options?: {
  page?: number;
  limit?: number;
  clienteId?: string;
  fromDate?: Date;
  toDate?: Date;
}) {
  try {
    // Defaults per paginazione
    const page = options?.page || 1;
    const limit = options?.limit || 50; // Max 50 per pagina
    const skip = (page - 1) * limit;
    
    // Costruisci filtri
    const where: any = {
      stato: {
        in: ["APERTO", "PARZIALMENTE_PAGATO"]
      }
    };
    
    // Filtro per cliente
    if (options?.clienteId) {
      where.clienteId = options.clienteId;
    }
    
    // Filtro temporale (ultimi 6 mesi di default se non specificato)
    const fromDate = options?.fromDate || new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
    const toDate = options?.toDate || new Date();
    
    where.dataCreazione = {
      gte: fromDate,
      lte: toDate
    };
    
    // Count totale per paginazione
    const totalCount = await prisma.debito.count({ where });
    
    // Query con paginazione
    const debiti = await prisma.debito.findMany({
      where,
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
      skip,
      take: limit
    });

    // Calcola importo rimanente per ogni debito
    const debitiConRimanente = debiti.map(debito => {
      const totalePagato = debito.PagamentiDebito.reduce(
        (sum, pag) => sum + pag.importo.toNumber(),
        0
      );
      const rimanente = debito.importo.toNumber() - totalePagato;

      return {
        ...debito,
        totalePagato,
        rimanente
      };
    });

    // Ritorna con metadati di paginazione
    return {
      data: serializeDecimalData(debitiConRimanente),
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNext: page * limit < totalCount,
        hasPrev: page > 1
      }
    };
  } catch (error) {
    console.error("Errore recupero debiti:", error);
    return {
      data: [],
      pagination: {
        page: 1,
        limit: 50,
        totalCount: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false
      }
    };
  }
}

export async function pagaDebito(
  debitoId: string,
  importo: number,
  modalita: "POS" | "CONTANTI" | "MISTO",
  note?: string
) {
  try {
    const utente = await getCurrentUser();
    if (!utente) {
      return { success: false, error: "Utente non autenticato" };
    }

    // Verifica permessi (CASSA o superiore)
    if (!["ADMIN", "MANAGER", "CASSA"].includes(utente.ruolo)) {
      return { success: false, error: "Permessi insufficienti" };
    }

    const result = await prisma.$transaction(async (tx) => {
      // Recupera il debito
      const debito = await tx.debito.findUnique({
        where: { id: debitoId },
        include: {
          PagamentiDebito: true
        }
      });

      if (!debito) {
        throw new Error("Debito non trovato");
      }

      if (debito.stato === "PAGATO") {
        throw new Error("Debito già pagato");
      }

      // Calcola importo rimanente
      const totalePagato = debito.PagamentiDebito.reduce(
        (sum, pag) => sum + pag.importo.toNumber(),
        0
      );
      const rimanente = debito.importo.toNumber() - totalePagato;

      if (importo > rimanente) {
        throw new Error(`Importo superiore al dovuto. Rimanente: €${rimanente.toFixed(2)}`);
      }

      // Crea il pagamento
      const pagamento = await tx.pagamentoDebito.create({
        data: {
          id: nanoid(),
          Debito: {
            connect: { id: debitoId }
          },
          importo,
          modalita,
          Operatore: {
            connect: { id: utente.id }
          },
          note: note || null
        }
      });

      // Aggiorna stato debito
      const nuovoTotalePagato = totalePagato + importo;
      const nuovoStato = nuovoTotalePagato >= debito.importo.toNumber() 
        ? "PAGATO" 
        : "PARZIALMENTE_PAGATO";

      await tx.debito.update({
        where: { id: debitoId },
        data: {
          importoPagato: nuovoTotalePagato,
          stato: nuovoStato,
          dataPagamento: nuovoStato === "PAGATO" ? new Date() : undefined
        }
      });

      return {
        pagamento,
        debitoAggiornato: {
          ...debito,
          stato: nuovoStato,
          importoPagato: nuovoTotalePagato
        }
      };
    });

    // Emetti evento SSE
    const eventData = {
      debitoId,
      paymentId: result.pagamento.id,
      amount: importo,
      remainingAmount: result.debitoAggiornato.importo.toNumber() - result.debitoAggiornato.importoPagato,
      status: result.debitoAggiornato.stato,
      timestamp: new Date().toISOString()
    };

    sseService.emit('debt:paid' as any, eventData, {
      broadcast: true,
      skipRateLimit: true,
      tenantId: utente.tenantId,
      queueIfOffline: true
    });

    revalidatePath("/cassa");

    return {
      success: true,
      ...serializeDecimalData(result)
    };
  } catch (error: any) {
    console.error("Errore pagamento debito:", error);
    return {
      success: false,
      error: error.message || "Errore durante il pagamento del debito"
    };
  }
}

export async function getClientiConDebiti() {
  try {
    const clienti = await prisma.cliente.findMany({
      where: {
        Debiti: {
          some: {
            stato: {
              in: ["APERTO", "PARZIALMENTE_PAGATO"]
            }
          }
        }
      },
      include: {
        Debiti: {
          where: {
            stato: {
              in: ["APERTO", "PARZIALMENTE_PAGATO"]
            }
          },
          include: {
            PagamentiDebito: true
          }
        }
      },
      orderBy: {
        nome: 'asc'
      }
    });

    // Calcola totale debiti per cliente
    const clientiConTotali = clienti.map((cliente: any) => {
      const totaleDebiti = cliente.Debiti.reduce((sum: number, debito: any) => {
        const totalePagato = debito.PagamentiDebito.reduce(
          (s: number, p: any) => s + p.importo.toNumber(),
          0
        );
        return sum + (debito.importo.toNumber() - totalePagato);
      }, 0);

      return {
        ...cliente,
        totaleDebiti,
        numeroDebiti: cliente.Debiti.length
      };
    });

    return serializeDecimalData(clientiConTotali);
  } catch (error) {
    console.error("Errore recupero clienti con debiti:", error);
    return [];
  }
}