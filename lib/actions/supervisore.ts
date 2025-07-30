"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function getSupervisoreStats() {
  try {
    // Verifica autorizzazione
    const user = await getCurrentUser();
    if (!user || user.ruolo !== 'SUPERVISORE') {
      return {
        ordiniAttivi: 0,
        utentiOnline: 0,
        incassoGiornaliero: 0,
        ordiniTotali: 0,
        scontrinoMedio: 0,
        tavoliServiti: 0,
        tempoMedio: 0
      };
    }

    // Data di oggi
    const oggi = new Date();
    oggi.setHours(0, 0, 0, 0);
    const domani = new Date(oggi);
    domani.setDate(oggi.getDate() + 1);

    // Conta ordini attivi (non consegnati)
    const ordiniAttivi = await prisma.ordinazione.count({
      where: {
        stato: {
          in: ["ORDINATO", "IN_PREPARAZIONE", "PRONTO"]
        }
      }
    });

    // Ordini totali di oggi
    const ordiniTotaliOggi = await prisma.ordinazione.count({
      where: {
        dataApertura: {
          gte: oggi,
          lt: domani
        }
      }
    });

    // Incasso giornaliero da ordini pagati di oggi
    const incassoResult = await prisma.ordinazione.aggregate({
      _sum: {
        totale: true
      },
      where: {
        dataApertura: {
          gte: oggi,
          lt: domani
        },
        statoPagamento: "COMPLETAMENTE_PAGATO"
      }
    });

    const incassoGiornaliero = incassoResult._sum.totale || 0;

    // Scontrino medio
    const scontrinoMedio = ordiniTotaliOggi > 0 
      ? Number(incassoGiornaliero) / ordiniTotaliOggi 
      : 0;

    // Tavoli serviti oggi (tavoli che hanno avuto almeno un ordine)
    const tavoliServiti = await prisma.ordinazione.groupBy({
      by: ['tavoloId'],
      where: {
        dataApertura: {
          gte: oggi,
          lt: domani
        },
        tavoloId: {
          not: null
        }
      }
    });

    // Tempo medio di preparazione (semplificato)
    const ordiniCompleti = await prisma.ordinazione.findMany({
      where: {
        dataApertura: {
          gte: oggi,
          lt: domani
        },
        stato: "CONSEGNATO",
        dataChiusura: {
          not: null
        }
      },
      select: {
        dataApertura: true,
        dataChiusura: true
      }
    });

    let tempoMedio = 0;
    if (ordiniCompleti.length > 0) {
      const tempiTotali = ordiniCompleti.reduce((acc, ord) => {
        if (ord.dataChiusura) {
          const diffMs = ord.dataChiusura.getTime() - ord.dataApertura.getTime();
          return acc + (diffMs / 1000 / 60); // converti in minuti
        }
        return acc;
      }, 0);
      tempoMedio = tempiTotali / ordiniCompleti.length;
    }

    // Utenti online basato su sessioni attive
    const utentiOnline = await prisma.user.count({
      where: {
        attivo: true,
        sessioni: {
          some: {
            expires: {
              gt: new Date()
            }
          }
        }
      }
    });

    return {
      ordiniAttivi,
      utentiOnline,
      incassoGiornaliero: Number(incassoGiornaliero),
      ordiniTotali: ordiniTotaliOggi,
      scontrinoMedio,
      tavoliServiti: tavoliServiti.length,
      tempoMedio
    };

  } catch (error) {
    console.error("Errore nel recupero delle statistiche:", error);
    return {
      ordiniAttivi: 0,
      utentiOnline: 0,
      incassoGiornaliero: 0,
      ordiniTotali: 0,
      scontrinoMedio: 0,
      tavoliServiti: 0,
      tempoMedio: 0
    };
  }
}

export async function getSupervisoreUsers() {
  try {
    // Verifica autorizzazione
    const user = await getCurrentUser();
    console.log(`[getSupervisoreUsers] Utente corrente:`, user);
    if (!user || user.ruolo !== 'SUPERVISORE') {
      console.log(`[getSupervisoreUsers] Accesso negato - Utente: ${user?.nome || 'null'}, Ruolo: ${user?.ruolo || 'null'}`);
      return [];
    }

    const users = await prisma.user.findMany({
      where: {
        attivo: true
      },
      include: {
        sessioni: {
          where: {
            expires: {
              gt: new Date() // Solo sessioni non scadute
            }
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 1
        }
      },
      orderBy: {
        nome: 'asc'
      }
    });

    console.log(`[getSupervisoreUsers] Trovati ${users.length} utenti nel database`);

    const mappedUsers = users.map(user => ({
      id: user.id,
      nome: user.nome,
      ruolo: user.ruolo,
      online: user.sessioni.length > 0,
      bloccato: user.bloccato || false,
      lastActivity: user.sessioni[0]?.createdAt || user.ultimoAccesso,
      currentTable: null // Questo potrebbe essere implementato in futuro
    }));

    console.log(`[getSupervisoreUsers] Utenti mappati:`, mappedUsers);
    return mappedUsers;

  } catch (error) {
    console.error("Errore nel recupero degli utenti:", error);
    return [];
  }
}

export async function getSupervisoreOrders() {
  try {
    // Verifica autorizzazione
    const user = await getCurrentUser();
    console.log('🔍 getSupervisoreOrders - User:', user?.nome, 'Role:', user?.ruolo);
    if (!user || user.ruolo !== 'SUPERVISORE') {
      console.log('❌ getSupervisoreOrders - Autorizzazione fallita');
      return [];
    }

    const ordinazioni = await prisma.ordinazione.findMany({
      where: {
        stato: {
          in: ["ORDINATO", "IN_PREPARAZIONE", "PRONTO", "CONSEGNATO", "RICHIESTA_CONTO", "PAGATO"]
        }
      },
      include: {
        tavolo: {
          select: {
            numero: true
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
        cameriere: {
          select: {
            nome: true,
            cognome: true
          }
        },
        cliente: {
          select: {
            nome: true
          }
        },
        pagamenti: {
          include: {
            clientePagatore: {
              select: {
                nome: true
              }
            }
          },
          orderBy: {
            timestamp: 'desc'
          },
          take: 1 // Prendi solo l'ultimo pagamento
        }
      },
      orderBy: {
        dataApertura: 'asc'
      },
      take: 50 // Limita a 50 ordini più recenti
    });

    // Converti i dati per il frontend
    return ordinazioni.map(ord => {
      const ultimoPagamento = ord.pagamenti[0]; // Il primo è il più recente per orderBy desc
      
      return {
        id: ord.id,
        tipo: ord.tipo,
        stato: ord.stato,
        tavolo: ord.tavolo,
        totale: ord.totale.toNumber(),
        dataApertura: ord.dataApertura,
        note: ord.note,
        cameriere: ord.cameriere,
        cliente: ord.cliente,
        nomeCliente: ord.nomeCliente,
        statoPagamento: ord.statoPagamento,
        // Dati di pagamento (se presente)
        clientePagatore: ultimoPagamento?.clientePagatore?.nome || ultimoPagamento?.clienteNome,
        modalitaPagamento: ultimoPagamento?.modalita,
        dataPagamento: ultimoPagamento?.timestamp,
        righe: ord.righe.map(riga => ({
          id: riga.id,
          quantita: riga.quantita,
          stato: riga.stato,
          postazione: riga.postazione,
          prezzo: riga.prodotto.prezzo.toNumber(),
          prodotto: {
            ...riga.prodotto,
            prezzo: riga.prodotto.prezzo.toNumber()
          }
        }))
      };
    });

  } catch (error) {
    console.error("Errore nel recupero delle ordinazioni:", error);
    return [];
  }
}

export async function cleanupExpiredSessions() {
  try {
    // Verifica autorizzazione
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.ruolo !== 'SUPERVISORE') {
      return {
        success: false,
        error: "Non autorizzato"
      };
    }

    // Elimina sessioni scadute
    const deletedSessions = await prisma.session.deleteMany({
      where: {
        expires: {
          lt: new Date()
        }
      }
    });

    console.log(`[Cleanup] Eliminate ${deletedSessions.count} sessioni scadute`);

    return {
      success: true,
      deletedSessions: deletedSessions.count
    };
  } catch (error) {
    console.error("Errore cleanup sessioni:", error);
    return {
      success: false,
      error: "Errore durante il cleanup"
    };
  }
}

export async function syncOrphansOrders() {
  try {
    // Verifica autorizzazione
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.ruolo !== 'SUPERVISORE') {
      return {
        success: false,
        error: "Non autorizzato"
      };
    }

    console.log("[Sync Orders] Avvio sincronizzazione ordini-utenti...");
    
    // Prima pulisci le sessioni scadute
    await cleanupExpiredSessions();

    // 1. Trova tutti gli utenti con sessioni attive
    const activeUsers = await prisma.user.findMany({
      where: {
        sessioni: {
          some: {
            expires: {
              gt: new Date()
            }
          }
        }
      },
      select: {
        id: true,
        nome: true
      }
    });

    const activeUserIds = activeUsers.map(u => u.id);
    console.log(`[Sync Orders] Utenti attivi: ${activeUserIds.length}`);

    // 2. Trova ordini aperti con camerieri non più attivi
    const orphanedOrders = await prisma.ordinazione.findMany({
      where: {
        stato: {
          in: ["ORDINATO", "IN_PREPARAZIONE", "PRONTO"]
        },
        cameriereId: {
          notIn: activeUserIds.length > 0 ? activeUserIds : ['']
        }
      },
      include: {
        cameriere: {
          select: {
            nome: true,
            cognome: true
          }
        },
        tavolo: {
          select: {
            numero: true
          }
        }
      }
    });

    console.log(`[Sync Orders] Trovati ${orphanedOrders.length} ordini orfani`);

    // 3. Report dei problemi trovati
    const issues = orphanedOrders.map(order => ({
      orderId: order.id,
      numeroOrdine: order.numero,
      tavolo: order.tavolo?.numero,
      stato: order.stato,
      cameriere: `${order.cameriere.nome} ${order.cameriere.cognome}`,
      dataApertura: order.dataApertura
    }));

    // 4. Opzionale: chiudi automaticamente ordini molto vecchi (più di 24 ore)
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const veryOldOrders = orphanedOrders.filter(order => 
      order.dataApertura < oneDayAgo
    );

    if (veryOldOrders.length > 0) {
      await prisma.ordinazione.updateMany({
        where: {
          id: {
            in: veryOldOrders.map(o => o.id)
          }
        },
        data: {
          stato: "ANNULLATO",
          note: "Annullato automaticamente - cameriere non più attivo"
        }
      });

      console.log(`[Sync Orders] Annullati ${veryOldOrders.length} ordini vecchi`);
    }

    return {
      success: true,
      activeUsers: activeUsers.length,
      orphanedOrders: orphanedOrders.length,
      autoClosedOrders: veryOldOrders.length,
      issues: issues,
      message: `Trovati ${orphanedOrders.length} ordini senza cameriere attivo. ${veryOldOrders.length} ordini vecchi sono stati annullati automaticamente.`
    };

  } catch (error) {
    console.error("Errore sincronizzazione ordini:", error);
    return {
      success: false,
      error: "Errore durante la sincronizzazione"
    };
  }
}

export async function toggleUserBlock(userId: string, shouldBlock: boolean) {
  try {
    // Verifica autorizzazione
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.ruolo !== 'SUPERVISORE') {
      return {
        success: false,
        error: "Non autorizzato"
      };
    }

    console.log(`[Supervisore Toggle Block] ${shouldBlock ? 'Blocco' : 'Sblocco'} utente ${userId} da parte del supervisore ${currentUser.nome}`);

    // Trova l'utente da bloccare/sbloccare
    const userToToggle = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!userToToggle) {
      return {
        success: false,
        error: "Utente non trovato"
      };
    }

    // Se il supervisore si sta auto-bloccando, comportamento speciale
    if (shouldBlock && userId === currentUser.id && currentUser.ruolo === 'SUPERVISORE') {
      console.log(`[Supervisore Toggle Block] Supervisore si auto-blocca: solo logout, non blocco permanente`);
      
      // Solo elimina le sessioni (logout), ma NON blocca l'utente
      await prisma.session.deleteMany({
        where: { userId: userId }
      });
      
      // Aggiorna solo ultimo accesso, NON il campo bloccato
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { 
          ultimoAccesso: new Date()
        }
      });
      
      return {
        success: true,
        message: `Logout forzato eseguito`,
        user: {
          id: updatedUser.id,
          nome: updatedUser.nome,
          ruolo: updatedUser.ruolo,
          bloccato: false // Rimane sempre sbloccato
        }
      };
    } else {
      // Comportamento normale per tutti gli altri casi
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { 
          bloccato: shouldBlock,
          ultimoAccesso: new Date()
        }
      });

      // Elimina le sessioni attive se si sta bloccando l'utente
      if (shouldBlock) {
        await prisma.session.deleteMany({
          where: { userId: userId }
        });
      }
      
      // Importa emitSSE se necessario per notifiche real-time
      try {
        const { emitSSE } = await import("@/lib/sse/sse-service");
        
        // Emetti evento SSE per notificare il cambio di stato
        emitSSE('user:blocked-status', {
          userId: userId,
          userName: userToToggle.nome,
          blocked: shouldBlock,
          supervisorName: currentUser.nome,
          timestamp: new Date().toISOString()
        });

        // Se bloccato, emetti anche evento presence per aggiornare lo stato online
        if (shouldBlock) {
          emitSSE('user:presence', {
            userId: userId,
            online: false,
            blocked: true,
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        console.log("SSE non disponibile, continuo senza notifiche real-time");
      }

      console.log(`[Supervisore Toggle Block] Utente ${userToToggle.nome} ${shouldBlock ? 'bloccato' : 'sbloccato'} con successo`);

      return {
        success: true,
        message: `${userToToggle.nome} è stato ${shouldBlock ? 'bloccato' : 'sbloccato'}`,
        user: {
          id: updatedUser.id,
          nome: updatedUser.nome,
          ruolo: updatedUser.ruolo,
          bloccato: updatedUser.bloccato
        }
      };
    }

  } catch (error) {
    console.error("Errore toggle block utente:", error);
    return {
      success: false,
      error: "Errore durante l'operazione"
    };
  }
}