"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-multi-tenant";
import { nanoid } from "nanoid";
import { sseService } from "@/lib/sse/sse-service";
import { creaScontrinoQueue } from "@/lib/services/scontrino-queue";
import { OrderStateMachine, validateBatchTransitions } from "@/lib/state-machine/order-state-machine";
// import { rateLimiters } from "@/lib/middleware/rate-limiter"; // Removed - file deleted
import crypto from "crypto";
import { Prisma } from "@prisma/client";

// Tipo per batch payment
interface BatchPaymentItem {
  ordinazioneId: string;
  importo: number;
  modalita: 'POS' | 'CONTANTI' | 'MISTO';
  clienteNome?: string;
  righeIds?: string[];
}

interface BatchPaymentResult {
  success: boolean;
  processati: number;
  falliti: number;
  risultati: Array<{
    ordinazioneId: string;
    success: boolean;
    pagamentoId?: string;
    error?: string;
  }>;
  sessionePagamento?: string;
}

/**
 * Processa pagamenti multipli in una singola transazione
 * Riduce round-trip al DB e garantisce atomicità
 */
export async function processaBatchPagamenti(
  pagamenti: BatchPaymentItem[]
): Promise<BatchPaymentResult> {
  console.log(`🔄 Inizio batch payment per ${pagamenti.length} ordini`);
  
  try {
    const utente = await getCurrentUser();
    if (!utente) {
      return {
        success: false,
        processati: 0,
        falliti: pagamenti.length,
        risultati: pagamenti.map(p => ({
          ordinazioneId: p.ordinazioneId,
          success: false,
          error: "Utente non autenticato"
        }))
      };
    }

    // Rate limiting per batch - Disabled
    // const rateLimitResult = await rateLimiters.payment.check(utente.id, 20); // Limite più alto per batch
    // if (!rateLimitResult.success) {
    //   const resetIn = Math.ceil((rateLimitResult.reset.getTime() - Date.now()) / 1000);
    //   return {
    //     success: false,
    //     processati: 0,
    //     falliti: pagamenti.length,
    //     risultati: pagamenti.map(p => ({
    //       ordinazioneId: p.ordinazioneId,
    //       success: false,
    //       error: `Rate limit: riprova tra ${resetIn} secondi`
    //     }))
    //   };
    // }

    // Sessione unica per batch
    const sessionePagamento = crypto.randomUUID();
    const risultati: BatchPaymentResult['risultati'] = [];
    
    // TRANSAZIONE ATOMICA PER TUTTO IL BATCH
    const result = await prisma.$transaction(async (tx) => {
      let processati = 0;
      let falliti = 0;

      // Pre-carica tutti gli ordini con lock pessimistico
      const orderIds = pagamenti.map(p => p.ordinazioneId);
      
      // Lock tutti gli ordini con NOWAIT per prevenire deadlock
      // Usa Prisma.sql per costruire la query con array
      const query = Prisma.sql`
        SELECT id FROM "Ordinazione" 
        WHERE id = ANY(ARRAY[${Prisma.join(orderIds)}]::uuid[])
        FOR UPDATE NOWAIT
      `;
      
      await tx.$queryRaw(query).catch((err: any) => {
        if (err.code === 'P2034' || err.message?.includes('could not obtain lock')) {
          throw new Error('Uno o più ordini in elaborazione. Riprova tra qualche secondo.');
        }
        throw err;
      });

      // Carica ordini con relazioni
      const ordini = await tx.ordinazione.findMany({
        where: {
          id: { in: orderIds }
        },
        include: {
          RigaOrdinazione: {
            where: { isPagato: false }
          },
          Pagamento: true,
          Tavolo: true,
          User: {
            select: {
              nome: true,
              tenantId: true
            }
          }
        }
      });

      // Mappa ordini per ID
      const ordiniMap = new Map(ordini.map(o => [o.id, o]));

      // Valida transizioni di stato per tutti gli ordini
      const validationResult = validateBatchTransitions(
        ordini.map(o => ({
          id: o.id,
          stato: o.stato,
          statoPagamento: o.statoPagamento
        })),
        'PAY'
      );

      // Processa pagamenti validi
      for (const pagamento of pagamenti) {
        const ordine = ordiniMap.get(pagamento.ordinazioneId);
        
        if (!ordine) {
          risultati.push({
            ordinazioneId: pagamento.ordinazioneId,
            success: false,
            error: "Ordine non trovato"
          });
          falliti++;
          continue;
        }

        // Verifica se la transizione è valida
        const isValid = validationResult.valid.some(v => v.id === pagamento.ordinazioneId);
        if (!isValid) {
          const invalidReason = validationResult.invalid.find(i => i.id === pagamento.ordinazioneId);
          risultati.push({
            ordinazioneId: pagamento.ordinazioneId,
            success: false,
            error: invalidReason?.error || "Transizione di stato non valida"
          });
          falliti++;
          continue;
        }

        // Calcola importo rimanente
        const totaleRighe = ordine.RigaOrdinazione.reduce(
          (sum, riga) => sum + (riga.prezzo.toNumber() * riga.quantita), 0
        );
        const totalePagato = (ordine as any).Pagamento?.reduce(
          (sum: number, pag: any) => sum + pag.importo.toNumber(), 0
        ) || 0;
        const rimanente = totaleRighe - totalePagato;

        if (pagamento.importo > rimanente) {
          risultati.push({
            ordinazioneId: pagamento.ordinazioneId,
            success: false,
            error: `Importo ${pagamento.importo} superiore al rimanente ${rimanente}`
          });
          falliti++;
          continue;
        }

        try {
          // Crea pagamento
          const nuovoPagamento = await tx.pagamento.create({
            data: {
              id: nanoid(),
              ordinazioneId: pagamento.ordinazioneId,
              importo: pagamento.importo,
              modalita: pagamento.modalita,
              clienteNome: pagamento.clienteNome,
              operatoreId: utente.id,
              righeIds: pagamento.righeIds || []
            }
          });

          // Aggiorna righe se specificato
          if (pagamento.righeIds && pagamento.righeIds.length > 0) {
            await tx.rigaOrdinazione.updateMany({
              where: {
                id: { in: pagamento.righeIds },
                ordinazioneId: pagamento.ordinazioneId
              },
              data: {
                isPagato: true,
                pagatoDa: pagamento.clienteNome || utente.nome
              }
            });
          } else if (pagamento.importo >= rimanente) {
            // Se paga tutto, marca tutte le righe come pagate
            await tx.rigaOrdinazione.updateMany({
              where: {
                ordinazioneId: pagamento.ordinazioneId,
                isPagato: false
              },
              data: {
                isPagato: true,
                pagatoDa: pagamento.clienteNome || utente.nome
              }
            });
          }

          // Verifica se completamente pagato
          const righeRimanenti = await tx.rigaOrdinazione.count({
            where: {
              ordinazioneId: pagamento.ordinazioneId,
              isPagato: false
            }
          });

          // Aggiorna stato ordine
          if (righeRimanenti === 0) {
            await tx.ordinazione.update({
              where: { id: pagamento.ordinazioneId },
              data: {
                stato: "PAGATO",
                statoPagamento: "COMPLETAMENTE_PAGATO",
                dataChiusura: new Date()
              }
            });

            // Libera tavolo se necessario
            if (ordine.tavoloId) {
              const altriOrdiniAttivi = await tx.ordinazione.count({
                where: {
                  tavoloId: ordine.tavoloId,
                  id: { not: pagamento.ordinazioneId },
                  stato: { notIn: ["PAGATO", "ANNULLATO"] }
                }
              });

              if (altriOrdiniAttivi === 0) {
                await tx.tavolo.update({
                  where: { id: ordine.tavoloId },
                  data: { stato: "LIBERO" }
                });
              }
            }
          } else {
            await tx.ordinazione.update({
              where: { id: pagamento.ordinazioneId },
              data: {
                statoPagamento: "PARZIALMENTE_PAGATO"
              }
            });
          }

          risultati.push({
            ordinazioneId: pagamento.ordinazioneId,
            success: true,
            pagamentoId: nuovoPagamento.id
          });
          processati++;

        } catch (error) {
          risultati.push({
            ordinazioneId: pagamento.ordinazioneId,
            success: false,
            error: error instanceof Error ? error.message : "Errore pagamento"
          });
          falliti++;
        }
      }

      return { processati, falliti };
    }, {
      maxWait: 5000,  // Max 5 secondi di attesa
      timeout: 20000, // Timeout 20 secondi per batch
      isolationLevel: 'Serializable'
    });

    // Genera scontrini batch (fuori dalla transazione)
    if (result.processati > 0) {
      const pagamentiSuccesso = risultati.filter(r => r.success);
      
      for (const res of pagamentiSuccesso) {
        const ordine = await prisma.ordinazione.findUnique({
          where: { id: res.ordinazioneId },
          include: {
            RigaOrdinazione: {
              include: { Prodotto: true }
            },
            Tavolo: true,
            User: true
          }
        });

        if (ordine && res.pagamentoId) {
          const righeScontrino = ordine.RigaOrdinazione
            .filter((r: any) => r.isPagato)
            .map((riga: any) => ({
              prodotto: riga.Prodotto.nome,
              quantita: riga.quantita,
              prezzoUnitario: riga.prezzo.toNumber(),
              totaleRiga: riga.prezzo.toNumber() * riga.quantita
            }));

          await creaScontrinoQueue("NON_FISCALE", {
            tavoloNumero: ordine.Tavolo?.numero,
            clienteNome: "Batch Payment",
            cameriereNome: ordine.User.nome,
            righe: righeScontrino,
            totale: righeScontrino.reduce((sum: number, r: any) => sum + r.totaleRiga, 0),
            modalitaPagamento: "MISTO",
            ordinazioneIds: [res.ordinazioneId],
            pagamentoIds: [res.pagamentoId],
            sessionePagamento
          });
        }
      }

      // Emetti eventi SSE
      const tenantId = (await getCurrentUser())?.tenantId;
      if (tenantId) {
        sseService.emit('batch:payment:completed' as any, {
          sessionePagamento,
          processati: result.processati,
          falliti: result.falliti,
          timestamp: new Date().toISOString()
        }, {
          tenantId,
          broadcast: true
        });
      }
    }

    console.log(`✅ Batch payment completato: ${result.processati} successi, ${result.falliti} falliti`);

    return {
      success: result.falliti === 0,
      processati: result.processati,
      falliti: result.falliti,
      risultati,
      sessionePagamento
    };

  } catch (error) {
    console.error("Errore batch payment:", error);
    return {
      success: false,
      processati: 0,
      falliti: pagamenti.length,
      risultati: pagamenti.map(p => ({
        ordinazioneId: p.ordinazioneId,
        success: false,
        error: error instanceof Error ? error.message : "Errore batch processing"
      }))
    };
  }
}