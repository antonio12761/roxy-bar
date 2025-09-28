"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-multi-tenant";
import { revalidatePath } from "next/cache";
import { sseService } from "@/lib/sse/sse-service";
import { nanoid } from "nanoid";
import { creaScontrinoQueue } from "@/lib/services/scontrino-queue";
import crypto from "crypto";
// import { rateLimiters } from "@/lib/middleware/rate-limiter"; // Removed - file deleted

interface PartialPayment {
  clienteNome: string;
  importo: number;
  modalita: 'POS' | 'CONTANTI' | 'MISTO';
  righeSelezionate: string[];
  quantitaPerRiga?: Record<string, number>; // Mappa rigaId -> quantità pagate
}

export async function creaPagamentiParziali(
  ordinazioneId: string,
  payments: PartialPayment[]
) {
  try {
    const utente = await getCurrentUser();
    if (!utente) {
      return { success: false, error: "Utente non autenticato" };
    }
    
    // RATE LIMITING: Disabled - rate limiter removed
    // const rateLimitResult = await rateLimiters.partialPayment.check(utente.id, 20);
    // if (!rateLimitResult.success) {
    //   const resetIn = Math.ceil((rateLimitResult.reset.getTime() - Date.now()) / 1000);
    //   return { 
    //     success: false, 
    //     error: `Troppe richieste di pagamento parziale. Riprova tra ${resetIn} secondi.`,
    //     rateLimited: true
    //   };
    // }

    // Verifica permessi (CAMERIERE, CASSA o superiore)
    if (!["ADMIN", "MANAGER", "CASSA", "CAMERIERE"].includes(utente.ruolo)) {
      return { success: false, error: "Permessi insufficienti" };
    }

    // Recupera l'ordinazione con le righe
    const ordinazione = await prisma.ordinazione.findUnique({
      where: { id: ordinazioneId },
      include: {
        RigaOrdinazione: {
          include: {
            Prodotto: {
              select: {
                nome: true
              }
            }
          }
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

    if (!ordinazione) {
      return { success: false, error: "Ordinazione non trovata" };
    }

    // Prevent payment if already paid
    if (ordinazione.statoPagamento === "COMPLETAMENTE_PAGATO" || ordinazione.stato === "PAGATO") {
      return { success: false, error: "Ordinazione già pagata completamente" };
    }
    
    // Validazione importi
    const totaleRighe = ordinazione.RigaOrdinazione.reduce(
      (sum, riga) => sum + (riga.prezzo.toNumber() * riga.quantita), 0
    );
    const totalePagato = ordinazione.Pagamento.reduce(
      (sum, pag) => sum + pag.importo.toNumber(), 0
    );
    const rimanente = totaleRighe - totalePagato;
    
    // Calcola totale dei pagamenti richiesti
    const totaleRichiesto = payments.reduce((sum, p) => sum + p.importo, 0);
    
    // Validazione: non permettere overpayment totale oltre il 10%
    const maxOverpayment = rimanente * 1.1;
    if (totaleRichiesto > maxOverpayment) {
      return {
        success: false,
        error: `Totale pagamenti (€${totaleRichiesto.toFixed(2)}) supera il massimo consentito (€${maxOverpayment.toFixed(2)})`
      };
    }
    
    // Validazione: ogni pagamento deve essere positivo
    for (const payment of payments) {
      if (payment.importo <= 0) {
        return { success: false, error: "Tutti gli importi devono essere maggiori di zero" };
      }
      
      // Validazione righe selezionate
      if (!payment.righeSelezionate || payment.righeSelezionate.length === 0) {
        return { success: false, error: "Selezionare almeno una riga per il pagamento" };
      }
      
      // Verifica che le righe esistano e non siano già pagate
      const righeValide = ordinazione.RigaOrdinazione.filter(
        r => payment.righeSelezionate.includes(r.id) && !r.isPagato
      );
      
      if (righeValide.length !== payment.righeSelezionate.length) {
        return { success: false, error: "Alcune righe selezionate non sono valide o sono già pagate" };
      }
    }

    // TRANSAZIONE ATOMICA per garantire consistenza con LOCK PESSIMISTICO
    const result = await prisma.$transaction(async (tx) => {
      // Lock pessimistico con NOWAIT per prevenire deadlock
      // Usa Prisma.sql per costruire la query con casting corretto
      const ordinazioneLocked = await tx.$queryRaw`
        SELECT id FROM "Ordinazione" 
        WHERE id = ${ordinazioneId}
        FOR UPDATE NOWAIT
      `.catch((err: any) => {
        if (err.code === 'P2034' || err.message?.includes('could not obtain lock')) {
          throw new Error('Ordine in elaborazione da un altro operatore. Riprova.');
        }
        throw err;
      });
      
      if (!ordinazioneLocked || (ordinazioneLocked as any[]).length === 0) {
        throw new Error("Impossibile acquisire lock sull'ordinazione");
      }
      
      // Verifica che l'ordine non sia già completamente pagato
      const ordinazioneAttuale = await tx.ordinazione.findUnique({
        where: { id: ordinazioneId },
        select: { statoPagamento: true, stato: true }
      });
      
      if (ordinazioneAttuale?.statoPagamento === "COMPLETAMENTE_PAGATO" || 
          ordinazioneAttuale?.stato === "PAGATO") {
        throw new Error("Ordinazione già pagata completamente");
      }
      const allPagamenti = [];
      const allRighePagate = new Set<string>();

      // Processa ogni pagamento
      for (const payment of payments) {
        // Prepara i dati del pagamento con le quantità se fornite
        const paymentData: any = {
          righeIds: payment.righeSelezionate || []
        };
        
        // Se sono fornite quantità parziali, includile nel JSON
        if (payment.quantitaPerRiga) {
          paymentData.quantitaPerRiga = payment.quantitaPerRiga;
        }
        
        // Crea il pagamento
        const pagamento = await tx.pagamento.create({
          data: {
            id: nanoid(),
            ordinazioneId,
            importo: payment.importo,
            modalita: payment.modalita,
            clienteNome: payment.clienteNome,
            operatoreId: utente.id,
            righeIds: paymentData
          }
        });

        // Gestione pagamento delle righe
        const righePagateInQuestoPagamento: string[] = []; // Dichiara qui la variabile per questo pagamento
        
        if (payment.righeSelezionate && payment.righeSelezionate.length > 0) {
          // Calcola il totale per le quantità selezionate
          let totaleRigheSelezionate = 0;
          const righeConQuantita: Record<string, { prezzo: number; quantitaTotale: number; quantitaPagata: number }> = {};
          
          for (const rigaId of payment.righeSelezionate) {
            const riga = await tx.rigaOrdinazione.findUnique({
              where: { id: rigaId }
            });
            
            if (riga) {
              const quantitaPagata = payment.quantitaPerRiga?.[rigaId] || riga.quantita;
              righeConQuantita[rigaId] = {
                prezzo: riga.prezzo.toNumber(),
                quantitaTotale: riga.quantita,
                quantitaPagata: quantitaPagata
              };
              totaleRigheSelezionate += riga.prezzo.toNumber() * quantitaPagata;
            }
          }
          
          // Verifica se il pagamento copre esattamente le quantità selezionate
          if (Math.abs(payment.importo - totaleRigheSelezionate) < 0.01) {
            // Per ogni riga, verifica se è completamente pagata considerando tutti i pagamenti precedenti
            for (const rigaId of payment.righeSelezionate) {
              const rigaInfo = righeConQuantita[rigaId];
              if (!rigaInfo) continue;
              
              // Recupera tutti i pagamenti precedenti per questa riga
              const pagamentiPrecedenti = await tx.pagamento.findMany({
                where: {
                  ordinazioneId,
                  id: { not: pagamento.id }
                }
              });
              
              // Calcola le quantità già pagate per questa riga
              let quantitaGiaPagata = 0;
              for (const pagPrecedente of pagamentiPrecedenti) {
                const righeData = pagPrecedente.righeIds as any;
                if (righeData.righeIds?.includes(rigaId)) {
                  // Se il pagamento precedente ha info sulle quantità, usale
                  if (righeData.quantitaPerRiga?.[rigaId]) {
                    quantitaGiaPagata += righeData.quantitaPerRiga[rigaId];
                  } else if (Array.isArray(righeData) && righeData.includes(rigaId)) {
                    // Assumiamo pagamento completo se non ci sono info quantità
                    quantitaGiaPagata = rigaInfo.quantitaTotale;
                    break;
                  }
                }
              }
              
              // Se ora abbiamo pagato tutte le quantità, marca come pagato
              if (quantitaGiaPagata + rigaInfo.quantitaPagata >= rigaInfo.quantitaTotale) {
                console.log(`✅ Marcando riga ${rigaId} come pagata (quantità: ${rigaInfo.quantitaPagata}/${rigaInfo.quantitaTotale})`);
                await tx.rigaOrdinazione.update({
                  where: { id: rigaId },
                  data: {
                    isPagato: true,
                    pagatoDa: payment.clienteNome
                  }
                });
                allRighePagate.add(rigaId);
              } else if (rigaInfo.quantitaPagata > 0) {
                // SPLIT: Se paghiamo solo parte della quantità, splitta la riga
                console.log(`🔀 Splittando riga ${rigaId}: ${rigaInfo.quantitaPagata} pagate, ${rigaInfo.quantitaTotale - rigaInfo.quantitaPagata} rimanenti`);
                
                // Recupera la riga originale per avere tutti i dati
                const rigaOriginale = await tx.rigaOrdinazione.findUnique({
                  where: { id: rigaId }
                });
                
                if (rigaOriginale) {
                  // Crea una nuova riga per la quantità pagata con tracciabilità
                  const nuovaRigaPagata = await tx.rigaOrdinazione.create({
                    data: {
                      id: crypto.randomUUID(),
                      ordinazioneId: rigaOriginale.ordinazioneId,
                      prodottoId: rigaOriginale.prodottoId,
                      quantita: rigaInfo.quantitaPagata,
                      prezzo: rigaOriginale.prezzo,
                      stato: rigaOriginale.stato,
                      postazione: rigaOriginale.postazione,
                      isPagato: true,
                      pagatoDa: payment.clienteNome,
                      note: rigaOriginale.note,
                      nomeProdotto: rigaOriginale.nomeProdotto,
                      createdAt: new Date(),
                      updatedAt: new Date(),
                      timestampOrdine: rigaOriginale.timestampOrdine,
                      timestampInizio: rigaOriginale.timestampInizio,
                      timestampPronto: rigaOriginale.timestampPronto,
                      timestampConsegna: rigaOriginale.timestampConsegna,
                      rigaOriginaleId: rigaId, // Traccia la riga originale
                      isSplit: true // Marca come riga splittata
                    }
                  });
                  
                  // Aggiorna la riga originale con la quantità rimanente
                  await tx.rigaOrdinazione.update({
                    where: { id: rigaId },
                    data: {
                      quantita: rigaInfo.quantitaTotale - rigaInfo.quantitaPagata - quantitaGiaPagata
                    }
                  });
                  
                  // Aggiungi la nuova riga alle righe pagate
                  righePagateInQuestoPagamento.push(nuovaRigaPagata.id);
                  allRighePagate.add(nuovaRigaPagata.id);
                }
              }
            }
          }
          
          // Aggiorna il pagamento con le righe effettivamente pagate (incluse quelle splittate)
          if (righePagateInQuestoPagamento.length > 0) {
            await tx.pagamento.update({
              where: { id: pagamento.id },
              data: {
                righeIds: {
                  righeIds: righePagateInQuestoPagamento,
                  quantitaPerRiga: {} // Le righe splittate hanno già le quantità corrette
                }
              }
            });
          }
          // Altrimenti, le righe rimangono non pagate ma il pagamento è registrato
        } else {
          // Se non ci sono righe selezionate, gestisci automaticamente
          let importoResidue = payment.importo;
          const righeNonPagate = await tx.rigaOrdinazione.findMany({
            where: {
              ordinazioneId,
              isPagato: false,
              id: {
                notIn: Array.from(allRighePagate)
              }
            },
            orderBy: {
              createdAt: 'asc'
            }
          });
          
          for (const riga of righeNonPagate) {
            const prezzoUnitario = riga.prezzo.toNumber();
            const quantitaTotale = riga.quantita;
            const costoRiga = prezzoUnitario * quantitaTotale;
            
            if (importoResidue >= costoRiga) {
              // Paga tutta la riga
              console.log(`✅ Auto-marcando riga ${riga.id} come pagata (importo: €${costoRiga})`);
              await tx.rigaOrdinazione.update({
                where: { id: riga.id },
                data: {
                  isPagato: true,
                  pagatoDa: payment.clienteNome
                }
              });
              importoResidue -= costoRiga;
              righePagateInQuestoPagamento.push(riga.id);
              allRighePagate.add(riga.id);
            } else if (importoResidue >= prezzoUnitario) {
              // Paga solo parte della quantità - SPLIT
              const quantitaPagabile = Math.floor(importoResidue / prezzoUnitario);
              console.log(`🔀 Auto-split riga ${riga.id}: ${quantitaPagabile} pagate, ${quantitaTotale - quantitaPagabile} rimanenti`);
              
              // Crea nuova riga per la quantità pagata con tracciabilità
              const nuovaRigaPagata = await tx.rigaOrdinazione.create({
                data: {
                  id: crypto.randomUUID(),
                  ordinazioneId: riga.ordinazioneId,
                  prodottoId: riga.prodottoId,
                  quantita: quantitaPagabile,
                  prezzo: riga.prezzo,
                  stato: riga.stato,
                  postazione: riga.postazione,
                  isPagato: true,
                  pagatoDa: payment.clienteNome,
                  note: riga.note,
                  nomeProdotto: riga.nomeProdotto,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                  timestampOrdine: riga.timestampOrdine,
                  timestampInizio: riga.timestampInizio,
                  timestampPronto: riga.timestampPronto,
                  timestampConsegna: riga.timestampConsegna,
                  rigaOriginaleId: riga.id, // Traccia la riga originale
                  isSplit: true // Marca come riga splittata
                }
              });
              
              // Aggiorna riga originale con quantità rimanente
              await tx.rigaOrdinazione.update({
                where: { id: riga.id },
                data: {
                  quantita: quantitaTotale - quantitaPagabile
                }
              });
              
              importoResidue -= quantitaPagabile * prezzoUnitario;
              righePagateInQuestoPagamento.push(nuovaRigaPagata.id);
              allRighePagate.add(nuovaRigaPagata.id);
            }
            
            if (importoResidue <= 0.01) break; // Tolleranza per arrotondamenti
          }
          
          // GESTIONE IMPORTO RESIDUO NON ALLOCATO
          if (importoResidue > 0.01) {
            console.warn(`⚠️ Importo residuo non allocato: €${importoResidue.toFixed(2)} per pagamento ${pagamento.id}`);
            
            // Crea una nota nel pagamento per tracciare l'importo non allocato
            await tx.pagamento.update({
              where: { id: pagamento.id },
              data: {
                righeIds: {
                  righeIds: righePagateInQuestoPagamento,
                  importoNonAllocato: importoResidue,
                  note: `Importo residuo di €${importoResidue.toFixed(2)} non allocato a righe specifiche`
                }
              }
            });
            
            // Opzione 1: Crea un "credito" per il cliente
            if (payment.clienteNome && importoResidue > 1) { // Solo se > 1 euro
              console.log(`💳 Creando credito di €${importoResidue.toFixed(2)} per ${payment.clienteNome}`);
              
              // Trova o crea cliente
              let cliente = await tx.cliente.findFirst({
                where: { nome: payment.clienteNome }
              });
              
              if (!cliente) {
                cliente = await tx.cliente.create({
                  data: {
                    id: crypto.randomUUID(),
                    nome: payment.clienteNome,
                    tenantId: ordinazione.User?.tenantId || 'default',
                    email: null,
                    telefono: null,
                    attivo: true
                  }
                });
              }
              
              // Registra il credito come movimento positivo
              await tx.movimentoCliente.create({
                data: {
                  id: crypto.randomUUID(),
                  clienteId: cliente.id,
                  tipo: 'ACCONTO',
                  importo: importoResidue,
                  descrizione: `Credito da pagamento ordine #${ordinazione.numero} (ID: ${ordinazioneId})`,
                  data: new Date(),
                  updatedAt: new Date()
                }
              });
            }
          } else if (righePagateInQuestoPagamento.length > 0) {
            // Aggiorna il pagamento con le righe pagate normalmente
            await tx.pagamento.update({
              where: { id: pagamento.id },
              data: {
                righeIds: righePagateInQuestoPagamento
              }
            });
          }
        }

        allPagamenti.push(pagamento);
      }

      // Verifica se tutte le righe sono state pagate
      const righeAncoraAperte = await tx.rigaOrdinazione.count({
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
      
      const totaleRimanente = righeRimanenti.reduce((sum, riga) => 
        sum + (riga.prezzo.toNumber() * riga.quantita), 0
      );

      // Determina il nuovo stato pagamento
      let nuovoStatoPagamento;
      if (righeAncoraAperte === 0) {
        nuovoStatoPagamento = "COMPLETAMENTE_PAGATO";
      } else {
        const totaleOrdine = (ordinazione as any).RigaOrdinazione.reduce((sum: number, riga: any) => 
          sum + (riga.prezzo.toNumber() * riga.quantita), 0
        );
        const totalePagato = payments.reduce((sum, p) => sum + p.importo, 0) + 
          ((ordinazione as any).Pagamento?.reduce((sum: number, p: any) => sum + p.importo.toNumber(), 0) || 0);
        
        if (totalePagato > 0 && totalePagato < totaleOrdine) {
          nuovoStatoPagamento = "PARZIALMENTE_PAGATO";
        } else if (totalePagato >= totaleOrdine) {
          nuovoStatoPagamento = "COMPLETAMENTE_PAGATO";
        } else {
          nuovoStatoPagamento = "NON_PAGATO";
        }
      }

      // Aggiorna lo stato dell'ordinazione - SEMPRE sincronizzati
      const updateData: any = {
        statoPagamento: nuovoStatoPagamento
      };
      
      // Se completamente pagato, SEMPRE aggiorna entrambi gli stati
      if (nuovoStatoPagamento === "COMPLETAMENTE_PAGATO") {
        updateData.stato = "PAGATO";
        updateData.dataChiusura = new Date();
        
        // Verifica e libera tavolo se necessario
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
      }
      // Se parzialmente pagato, NON cambiare lo stato principale
      // mantiene CONSEGNATO/RICHIESTA_CONTO/etc
      
      const ordinazioneAggiornata = await tx.ordinazione.update({
        where: { id: ordinazioneId },
        data: updateData
      });

      // Crea lo scontrino in background
      if (nuovoStatoPagamento === "COMPLETAMENTE_PAGATO") {
        // Prepara i dati per lo scontrino
        const sessionePagamento = crypto.randomUUID();
        const datiScontrino = {
          tavoloNumero: ordinazione.Tavolo?.numero,
          clienteNome: ordinazione.nomeCliente || 'Cliente',
          cameriereNome: ordinazione.User?.nome || 'Cameriere',
          righe: ordinazione.RigaOrdinazione.map((riga: any) => ({
            prodotto: riga.Prodotto.nome,
            quantita: riga.quantita,
            prezzoUnitario: riga.prezzo.toNumber(),
            totaleRiga: riga.prezzo.toNumber() * riga.quantita,
            isPagato: riga.isPagato,
            pagatoDa: riga.pagatoDa
          })),
          totale: ordinazione.RigaOrdinazione.reduce((sum: number, riga: any) => 
            sum + (riga.prezzo.toNumber() * riga.quantita), 0
          ),
          modalitaPagamento: "MISTO" as const, // Potrebbe essere misto in caso di pagamenti parziali
          ordinazioneIds: [ordinazioneId],
          pagamentoIds: allPagamenti.map(p => p.id),
          sessionePagamento
        };
        
        await creaScontrinoQueue("NON_FISCALE", datiScontrino);
        await creaScontrinoQueue("FISCALE", {
          ...datiScontrino,
          righe: [{
            prodotto: `Tavolo ${ordinazione.Tavolo?.numero || 'Asporto'}`,
            quantita: 1,
            prezzoUnitario: datiScontrino.totale,
            totaleRiga: datiScontrino.totale
          }]
        }, "ALTA");
      }

      // Invia evento SSE per aggiornamento stato
      const tenantId = ordinazione.User?.tenantId;
      if (tenantId) {
        sseService.emit('payment:update', {
          ordinazioneId,
          statoPagamento: nuovoStatoPagamento,
          totaleRimanente,
          pagamenti: allPagamenti.map(p => ({
            id: p.id,
            importo: p.importo.toNumber(),
            clienteNome: p.clienteNome,
            modalita: p.modalita
          })),
          timestamp: new Date().toISOString()
        }, {
          tenantId,
          broadcast: true
        });

        // Se completamente pagato, invia anche evento di completamento
        if (nuovoStatoPagamento === "COMPLETAMENTE_PAGATO") {
          sseService.emit('order:paid', {
            ordinazioneId,
            numero: ordinazione.numero,
            tavolo: ordinazione.Tavolo?.numero || 'Asporto',
            totale: (ordinazione as any).RigaOrdinazione.reduce((sum: number, riga: any) => 
              sum + (riga.prezzo.toNumber() * riga.quantita), 0
            ),
            timestamp: new Date().toISOString()
          }, {
            tenantId,
            broadcast: true
          });
        }
      }

      return {
        success: true,
        data: {
          ordinazioneId,
          statoPagamento: nuovoStatoPagamento,
          pagamenti: allPagamenti.map(p => ({
            id: p.id,
            ordinazioneId: p.ordinazioneId,
            importo: p.importo.toNumber(),
            modalita: p.modalita,
            clienteNome: p.clienteNome,
            timestamp: p.timestamp
          })),
          totaleRimanente
        }
      };
    }, {
      maxWait: 5000,
      timeout: 15000, // Più tempo per pagamenti multipli
      isolationLevel: 'Serializable'
    });

    // Revalida i percorsi
    revalidatePath('/cassa');
    revalidatePath('/cameriere');
    
    return result;
  } catch (error) {
    console.error("Errore in creaPagamentiParziali:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Errore durante il pagamento" 
    };
  }
}

// Funzione helper per ottenere i dettagli dei pagamenti parziali di un'ordinazione
export async function getDettagliPagamentiOrdinazione(ordinazioneId: string) {
  try {
    const ordinazione = await prisma.ordinazione.findUnique({
      where: { id: ordinazioneId },
      include: {
        RigaOrdinazione: {
          include: {
            Prodotto: {
              select: {
                nome: true
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
          },
          orderBy: {
            timestamp: 'desc'
          }
        }
      }
    });

    if (!ordinazione) {
      return { success: false, error: "Ordinazione non trovata" };
    }

    // Mappa le righe per cliente pagatore
    const pagamentiPerCliente = new Map<string, {
      clienteNome: string;
      righe: any[];
      totale: number;
      modalita: string[];
    }>();

    // Aggrega i pagamenti per cliente
    for (const pagamento of (ordinazione as any).Pagamento) {
      const clienteNome = pagamento.clienteNome || 'Cliente Anonimo';
      
      if (!pagamentiPerCliente.has(clienteNome)) {
        pagamentiPerCliente.set(clienteNome, {
          clienteNome,
          righe: [],
          totale: 0,
          modalita: []
        });
      }

      const cliente = pagamentiPerCliente.get(clienteNome)!;
      cliente.totale += pagamento.importo.toNumber();
      
      if (!cliente.modalita.includes(pagamento.modalita)) {
        cliente.modalita.push(pagamento.modalita);
      }

      // Trova le righe pagate in questo pagamento
      const righeData = pagamento.righeIds as any;
      let righeIds: string[] = [];
      let quantitaPerRiga: Record<string, number> = {};
      
      // Gestisci diversi formati di righeIds
      if (Array.isArray(righeData)) {
        righeIds = righeData;
      } else if (righeData?.righeIds) {
        righeIds = righeData.righeIds;
        quantitaPerRiga = righeData.quantitaPerRiga || {};
      }
      
      for (const rigaId of righeIds) {
        const riga = (ordinazione as any).RigaOrdinazione.find((r: any) => r.id === rigaId);
        if (riga) {
          const quantitaPagata = quantitaPerRiga[rigaId] || riga.quantita;
          cliente.righe.push({
            id: riga.id,
            prodotto: riga.Prodotto.nome,
            quantita: quantitaPagata,
            quantitaTotale: riga.quantita,
            prezzo: riga.prezzo.toNumber(),
            totale: riga.prezzo.toNumber() * quantitaPagata
          });
        }
      }
    }

    return {
      success: true,
      data: {
        ordinazioneId,
        numero: ordinazione.numero,
        statoPagamento: ordinazione.statoPagamento,
        pagamentiPerCliente: Array.from(pagamentiPerCliente.values()),
        righeNonPagate: (ordinazione as any).RigaOrdinazione
          .filter((r: any) => !r.isPagato)
          .map((r: any) => ({
            id: r.id,
            prodotto: r.Prodotto.nome,
            quantita: r.quantita,
            prezzo: r.prezzo.toNumber(),
            totale: r.prezzo.toNumber() * r.quantita
          }))
      }
    };
  } catch (error) {
    console.error("Errore in getDettagliPagamentiOrdinazione:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Errore durante il recupero dei dettagli" 
    };
  }
}