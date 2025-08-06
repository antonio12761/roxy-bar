"use server";

import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth-multi-tenant";
import { revalidatePath } from "next/cache";
import { serializeDecimalData } from "@/lib/utils/decimal-serializer";
import { nanoid } from "nanoid";
import { sseService } from "@/lib/sse/sse-service";

export async function creaDebitoDiretto(
  clienteId: string,
  importo: number,
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

    // TRANSAZIONE ATOMICA per creazione debito diretto
    const debito = await prisma.$transaction(async (tx) => {
      // Verifica che il cliente esista con lock
      const clienteLocked = await tx.$queryRaw`
        SELECT id FROM "Cliente" 
        WHERE id = ${clienteId}
        FOR UPDATE
      `;
      
      if (!clienteLocked || (clienteLocked as any[]).length === 0) {
        throw new Error("Cliente non trovato o impossibile acquisire lock");
      }
      
      const cliente = await tx.cliente.findUnique({
        where: { id: clienteId }
      });

      if (!cliente) {
        throw new Error("Cliente non trovato");
      }

      // Crea il debito senza ordinazione associata
      // @ts-ignore - Necessario per gestire il campo ordinazioneId null
      const newDebito = await tx.debito.create({
        data: {
          id: nanoid(),
          clienteId,
          ordinazioneId: null, // Esplicitamente null per debiti diretti
          importo,
          importoPagato: 0,
          stato: "APERTO",
          note: note || null,
          operatoreId: utente.id,
          dataCreazione: new Date()
        } as Prisma.DebitoUncheckedCreateInput,
        include: {
          Cliente: true
        }
      });
      
      return newDebito;
    });

    // Emetti evento SSE per debito creato
    const eventData = {
      debitoId: debito.id,
      clienteId,
      clienteName: debito.Cliente.nome,
      amount: importo,
      timestamp: new Date().toISOString()
    };

    sseService.emit('debt-created', eventData);

    // Ricarica i dati
    revalidatePath('/cassa');

    return { 
      success: true, 
      debito: serializeDecimalData(debito)
    };

  } catch (error) {
    console.error("Errore creazione debito diretto:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Errore durante la creazione del debito" 
    };
  }
}

export async function getDebitiAperti(options?: {
  page?: number;
  limit?: number;
  clienteId?: string;
}) {
  try {
    const utente = await getCurrentUser();
    if (!utente) {
      return { success: false, error: "Utente non autenticato" };
    }
    
    // Paginazione
    const page = options?.page || 1;
    const limit = Math.min(options?.limit || 20, 100); // Max 100 per sicurezza
    const skip = (page - 1) * limit;
    
    // Costruisci filtri
    const where: any = {
      stato: "APERTO",
      // Solo ultimi 90 giorni per default
      dataCreazione: {
        gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
      }
    };
    
    if (options?.clienteId) {
      where.clienteId = options.clienteId;
    }
    
    // Count totale
    const totalCount = await prisma.debito.count({ where });

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
      const totalePagato = debito.PagamentiDebito.reduce((sum, p) => 
        sum + p.importo.toNumber(), 0
      );
      
      return {
        ...debito,
        importoPagato: totalePagato,
        rimanente: debito.importo.toNumber() - totalePagato,
        clienteNome: debito.Cliente.nome,
        numeroOrdine: debito.Ordinazione?.numero || null,
        dataCreazione: debito.dataCreazione.toISOString()
      };
    });

    return { 
      success: true, 
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
      success: false, 
      error: error instanceof Error ? error.message : "Errore durante il recupero dei debiti" 
    };
  }
}