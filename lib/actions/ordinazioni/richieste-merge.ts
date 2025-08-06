"use server";

import { prisma } from "@/lib/db";
import { sseService } from "@/lib/sse/sse-service";
import { serializeDecimalData } from "@/lib/utils/decimal-serializer";
import { nanoid } from "nanoid";
import { getAuthenticatedUser } from "./auth-helpers";

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

    const richiesteConProdotti = await Promise.all(
      richieste.map(async (r) => {
        const prodotti = JSON.parse(r.prodotti as string) as Array<{
          prodottoId: number;
          quantita: number;
          prezzo: number;
        }>;
        
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
  console.log('[accettaRichiestaMerge] Called with richiestaId:', richiestaId);
  console.log('[accettaRichiestaMerge] Call time:', new Date().toISOString());
  
  const utente = await getAuthenticatedUser();
  if (!utente) {
    return { success: false, error: "Non autenticato" };
  }

  try {
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

    const result = await prisma.$transaction(async (tx) => {
      for (const p of prodotti) {
        const rigaEsistente = await tx.rigaOrdinazione.findFirst({
          where: {
            ordinazioneId: richiesta.ordinazioneId,
            prodottoId: p.prodottoId,
            stato: { notIn: ['ANNULLATO'] }
          }
        });

        if (rigaEsistente) {
          const prodotto = await tx.prodotto.findUnique({
            where: { id: p.prodottoId },
            select: { requiresGlasses: true }
          });
          
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
          const prodotto = await tx.prodotto.findUnique({
            where: { id: p.prodottoId },
            select: { requiresGlasses: true }
          });
          
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
    }, {
      timeout: 10000, // 10 secondi
      maxWait: 5000   // Massimo tempo di attesa per acquisire il lock
    });

    if (result.ordinazione) {
      const prodottiDettagli = await prisma.prodotto.findMany({
        where: {
          id: {
            in: result.prodottiAggiunti.map(p => p.prodottoId)
          }
        }
      });
      
      const prodottiMap = new Map(prodottiDettagli.map(p => [p.id, p]));
      
      console.log('[accettaRichiestaMerge] Emitting order:merged event for order:', result.ordinazione.id);
      console.log('[accettaRichiestaMerge] Table number:', richiesta.numeroTavolo);
      
      sseService.emit('order:merged', {
        orderId: result.ordinazione.id,
        tableNumber: richiesta.numeroTavolo ? parseInt(richiesta.numeroTavolo) : 0,
        newItems: result.prodottiAggiunti.map(p => {
          const prodotto = prodottiMap.get(p.prodottoId);
          return {
            id: nanoid(),
            productName: p.nome || prodotto?.nome || `Prodotto ${p.prodottoId}`,
            quantity: p.quantita,
            station: 'PREPARA'
          };
        }),
        totalAmount: result.ordinazione.totale.toNumber(),
        mergedBy: utente.nome || 'Preparazione'
      });
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
    await prisma.richiestaMerge.update({
      where: { id: richiestaId },
      data: {
        stato: 'REJECTED',
        motivoRifiuto: motivo,
        elaboratoDa: utente.nome || utente.id,
        elaboratoAt: new Date()
      }
    });

    return { success: true, message: "Richiesta rifiutata" };
  } catch (error) {
    console.error("Errore rifiuto merge:", error);
    return { success: false, error: "Errore nel rifiuto della richiesta" };
  }
}

export async function getMergedOrdersHistory(ordinazioneId: string) {
  try {
    const utente = await getAuthenticatedUser();
    if (!utente) {
      return { success: false, error: "Non autenticato" };
    }

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

    const mergeHistory = [];
    
    const originalOrder = {
      id: `${ordinazioneId}-original`,
      tipo: 'originale',
      cliente: ordinazione.nomeCliente || 'Cliente',
      cameriere: ordinazione.User?.nome || 'Cameriere',
      timestamp: ordinazione.dataApertura.toISOString(),
      items: [],
      totale: 0
    };

    if (ordinazione.RichiestaMerge && ordinazione.RichiestaMerge.length > 0) {
      mergeHistory.push(originalOrder);

      ordinazione.RichiestaMerge.forEach((merge: any, index: number) => {
        const prodotti = merge.prodotti as any;
        
        mergeHistory.push({
          id: merge.id,
          tipo: 'aggiunto',
          numero: index + 1,
          cliente: ordinazione.nomeCliente || 'Cliente',
          cameriere: merge.richiedenteName,
          timestamp: merge.createdAt.toISOString(),
          items: Array.isArray(prodotti) ? prodotti.map((p: any) => ({
            id: p.id || nanoid(),
            prodotto: p.nome || p.productName || 'Prodotto',
            quantita: p.quantita || p.quantity || 1,
            prezzo: p.prezzo || p.price || 0,
            note: p.note || ''
          })) : [],
          totale: Array.isArray(prodotti) 
            ? prodotti.reduce((sum: number, p: any) => 
                sum + ((p.quantita || p.quantity || 1) * (p.prezzo || p.price || 0)), 0)
            : 0
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