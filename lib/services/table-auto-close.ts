"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { notificationManager } from "@/lib/notifications/NotificationManager";

export interface AutoCloseConfig {
  delayMinutes: number;        // Minuti di attesa prima di chiudere
  enableAutoClose: boolean;    // Abilita/disabilita funzionalità
  notifyWaiter: boolean;      // Notifica cameriere prima di chiudere
  requireConfirmation: boolean; // Richiede conferma manuale
}

export interface TableCloseCandidate {
  tavoloId: string;
  numero: string;
  lastPaymentTime: Date;
  totalAmount: number;
  cameriereId: string;
  cameriereNome: string;
  minutesSincePayment: number;
  canAutoClose: boolean;
  reason?: string;
}

export class TableAutoCloseManager {
  private config: AutoCloseConfig = {
    delayMinutes: 5,
    enableAutoClose: true,
    notifyWaiter: true,
    requireConfirmation: false
  };

  private processingTables = new Set<string>();

  constructor(config?: Partial<AutoCloseConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  // Trova tavoli candidati per chiusura automatica
  async findTableCloseCanditates(): Promise<TableCloseCandidate[]> {
    try {
      const thresholdTime = new Date(Date.now() - this.config.delayMinutes * 60 * 1000);
      
      console.log(`[AutoClose] Ricerca tavoli completamente pagati prima di ${thresholdTime.toLocaleString()}`);

      // Query ottimizzata per trovare tavoli con tutti gli ordini pagati
      const tavoli = await prisma.tavolo.findMany({
        where: {
          stato: 'OCCUPATO',
          Ordinazione: {
            some: {
              stato: {
                not: 'PAGATO'
              },
              statoPagamento: 'COMPLETAMENTE_PAGATO'
            }
          }
        },
        include: {
          Ordinazione: {
            where: {
              statoPagamento: 'COMPLETAMENTE_PAGATO'
            },
            include: {
              Pagamento: {
                orderBy: {
                  timestamp: 'desc'
                },
                take: 1
              },
              User: {
                select: {
                  id: true,
                  nome: true
                }
              },
              RigaOrdinazione: {
                where: {
                  isPagato: false
                }
              }
            }
          }
        }
      });

      const candidates: TableCloseCandidate[] = [];

      for (const tavolo of tavoli) {
        // Verifica se tutti gli ordini del tavolo sono completamente pagati
        const hasUnpaidOrders = await prisma.ordinazione.count({
          where: {
            tavoloId: tavolo.id,
            statoPagamento: {
              not: 'COMPLETAMENTE_PAGATO'
            },
            stato: {
              not: 'PAGATO'
            }
          }
        });

        if (hasUnpaidOrders > 0) {
          console.log(`[AutoClose] Tavolo ${tavolo.numero} ha ancora ordini non pagati`);
          continue;
        }

        // Trova l'ultimo pagamento
        const lastPayment = await prisma.pagamento.findFirst({
          where: {
            Ordinazione: {
              tavoloId: tavolo.id
            }
          },
          orderBy: {
            timestamp: 'desc'
          },
          include: {
            Ordinazione: {
              include: {
                User: {
                  select: {
                    id: true,
                    nome: true
                  }
                }
              }
            }
          }
        });

        if (!lastPayment) continue;

        const minutesSincePayment = Math.floor(
          (Date.now() - lastPayment.timestamp.getTime()) / 60000
        );

        const totalAmount = tavolo.Ordinazione.reduce((sum: number, ord: any) => {
          return sum + ord.Pagamento.reduce((pSum: number, pag: any) => pSum + pag.importo.toNumber(), 0);
        }, 0);

        let canAutoClose = true;
        let reason: string | undefined;

        // Controlli per auto-close
        if (minutesSincePayment < this.config.delayMinutes) {
          canAutoClose = false;
          reason = `Attesa ${this.config.delayMinutes - minutesSincePayment} minuti rimanenti`;
        }

        if (this.processingTables.has(tavolo.id.toString())) {
          canAutoClose = false;
          reason = 'Già in elaborazione';
        }

        candidates.push({
          tavoloId: tavolo.id.toString(),
          numero: tavolo.numero,
          lastPaymentTime: lastPayment.timestamp,
          totalAmount,
          cameriereId: lastPayment.Ordinazione.User.id,
          cameriereNome: lastPayment.Ordinazione.User.nome,
          minutesSincePayment,
          canAutoClose,
          reason
        });
      }

      console.log(`[AutoClose] Trovati ${candidates.length} tavoli candidati, ${candidates.filter(c => c.canAutoClose).length} pronti per chiusura`);
      
      return candidates;

    } catch (error) {
      console.error('[AutoClose] Errore ricerca candidati:', error);
      return [];
    }
  }

  // Chiude automaticamente un tavolo
  async closeTable(tavoloId: string, force: boolean = false): Promise<{
    success: boolean;
    message: string;
    error?: string;
  }> {
    
    if (this.processingTables.has(tavoloId)) {
      return {
        success: false,
        message: 'Tavolo già in elaborazione'
      };
    }

    this.processingTables.add(tavoloId);

    try {
      const tavolo = await prisma.tavolo.findUnique({
        where: { id: parseInt(tavoloId) },
        include: {
          Ordinazione: {
            where: {
              stato: {
                not: 'PAGATO'
              }
            },
            include: {
              RigaOrdinazione: {
                where: {
                  isPagato: false
                }
              },
              User: {
                select: {
                  id: true,
                  nome: true
                }
              }
            }
          }
        }
      });

      if (!tavolo) {
        return {
          success: false,
          message: 'Tavolo non trovato'
        };
      }

      // Verifica finale che tutto sia pagato
      const unpaidRighe = tavolo.Ordinazione.reduce((sum: number, ord: any) => 
        sum + ord.RigaOrdinazione.length, 0
      );

      if (unpaidRighe > 0 && !force) {
        return {
          success: false,
          message: `${unpaidRighe} prodotti ancora non pagati`
        };
      }

      // Notifica cameriere se richiesto
      if (this.config.notifyWaiter && tavolo.Ordinazione.length > 0) {
        const cameriere = tavolo.Ordinazione[0].User;
        
        // TODO: Implementare notifica chiusura automatica tavolo
        // notificationManager.notifyTableAutoClose({
        //   tableNumber: parseInt(tavolo.numero),
        //   cameriereId: cameriere.id,
        //   totalAmount: 0, // Calcolato sotto
        //   minutesElapsed: this.config.delayMinutes
        // });
      }

      // Transazione per chiudere tutto
      await prisma.$transaction(async (tx) => {
        // Chiudi tutte le ordinazioni del tavolo
        await tx.ordinazione.updateMany({
          where: {
            tavoloId: tavolo.id,
            stato: {
              not: 'PAGATO'
            }
          },
          data: {
            stato: 'PAGATO',
            dataChiusura: new Date()
          }
        });

        // Libera il tavolo
        await tx.tavolo.update({
          where: { id: tavolo.id },
          data: {
            stato: 'LIBERO',
            updatedAt: new Date()
          }
        });
      });

      console.log(`[AutoClose] Tavolo ${tavolo.numero} chiuso automaticamente`);

      revalidatePath('/cameriere');
      revalidatePath('/cassa');
      revalidatePath('/supervisore');

      return {
        success: true,
        message: `Tavolo ${tavolo.numero} chiuso automaticamente`
      };

    } catch (error) {
      console.error(`[AutoClose] Errore chiusura tavolo ${tavoloId}:`, error);
      return {
        success: false,
        message: 'Errore durante la chiusura',
        error: error instanceof Error ? error.message : 'Errore sconosciuto'
      };
    } finally {
      this.processingTables.delete(tavoloId);
    }
  }

  // Processo completo di auto-close
  async processAutoClose(): Promise<{
    processed: number;
    closed: number;
    notified: number;
    errors: string[];
  }> {
    
    if (!this.config.enableAutoClose) {
      return {
        processed: 0,
        closed: 0,
        notified: 0,
        errors: ['Auto-close disabilitato']
      };
    }

    const startTime = Date.now();
    console.log('[AutoClose] Inizio processo auto-close tavoli');

    const candidates = await this.findTableCloseCanditates();
    const results = {
      processed: candidates.length,
      closed: 0,
      notified: 0,
      errors: [] as string[]
    };

    for (const candidate of candidates) {
      if (!candidate.canAutoClose) {
        console.log(`[AutoClose] Tavolo ${candidate.numero} non pronto: ${candidate.reason}`);
        continue;
      }

      try {
        if (this.config.requireConfirmation) {
          // In modalità conferma, solo notifica
          if (this.config.notifyWaiter) {
            // TODO: Implementare notifica tavolo pronto per chiusura
            // notificationManager.notifyTableReadyForClose({
            //   tableNumber: parseInt(candidate.numero),
            //   cameriereId: candidate.cameriereId,
            //   minutesElapsed: candidate.minutesSincePayment
            // });
            // results.notified++;
          }
        } else {
          // Chiusura automatica
          const closeResult = await this.closeTable(candidate.tavoloId);
          
          if (closeResult.success) {
            results.closed++;
          } else {
            results.errors.push(`Tavolo ${candidate.numero}: ${closeResult.message}`);
          }
        }

      } catch (error) {
        const errorMsg = `Tavolo ${candidate.numero}: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`;
        results.errors.push(errorMsg);
        console.error(`[AutoClose] ${errorMsg}`);
      }
    }

    const processTime = Date.now() - startTime;
    console.log(`[AutoClose] Processo completato in ${processTime}ms:`, results);

    return results;
  }

  // Aggiorna configurazione
  updateConfig(newConfig: Partial<AutoCloseConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('[AutoClose] Configurazione aggiornata:', this.config);
  }

  // Ottieni configurazione corrente
  getConfig(): AutoCloseConfig {
    return { ...this.config };
  }

  // Statistiche processo auto-close
  async getAutoCloseStats(days: number = 7) {
    try {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      
      // Tavoli chiusi automaticamente (approssimazione basata su pattern)
      const autoClosedTables = await prisma.tavolo.count({
        where: {
          updatedAt: {
            gte: startDate
          },
          stato: 'LIBERO'
        }
      });

      // Tempo medio tra ultimo pagamento e chiusura tavolo
      const recentOrders = await prisma.ordinazione.findMany({
        where: {
          stato: 'PAGATO',
          dataChiusura: {
            gte: startDate
          }
        },
        include: {
          Pagamento: {
            orderBy: {
              timestamp: 'desc'
            },
            take: 1
          }
        }
      });

      let totalWaitTime = 0;
      let validSamples = 0;

      for (const order of recentOrders) {
        if (order.dataChiusura && order.Pagamento.length > 0) {
          const waitTime = order.dataChiusura.getTime() - order.Pagamento[0].timestamp.getTime();
          if (waitTime > 0) {
            totalWaitTime += waitTime;
            validSamples++;
          }
        }
      }

      const avgWaitTimeMinutes = validSamples > 0 
        ? Math.round(totalWaitTime / validSamples / 60000)
        : 0;

      return {
        period: `${days} giorni`,
        estimatedAutoClosedTables: autoClosedTables,
        averageWaitTimeMinutes: avgWaitTimeMinutes,
        configuredDelayMinutes: this.config.delayMinutes,
        isEnabled: this.config.enableAutoClose,
        requiresConfirmation: this.config.requireConfirmation
      };

    } catch (error) {
      console.error('[AutoClose] Errore statistiche:', error);
      return null;
    }
  }
}

// Istanza globale
export const tableAutoCloseManager = new TableAutoCloseManager();

// Job per esecuzione periodica (da chiamare ogni 2-3 minuti)
export async function runTableAutoCloseJob(): Promise<void> {
  try {
    await tableAutoCloseManager.processAutoClose();
  } catch (error) {
    console.error('[AutoClose] Errore job periodico:', error);
  }
}