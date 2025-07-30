"use server";

import { prisma } from "@/lib/db";

export class QueryOptimizer {
  
  // Query ottimizzata per dashboard cameriere
  static async getCameriereOrders(cameriereId: string, limit: number = 50) {
    const startTime = Date.now();
    
    try {
      // Query ottimizzata con indice composto
      const orders = await prisma.ordinazione.findMany({
        where: {
          cameriereId,
          stato: {
            in: ['ORDINATO', 'IN_PREPARAZIONE', 'PRONTO', 'CONSEGNATO']
          }
        },
        include: {
          tavolo: {
            select: {
              numero: true,
              stato: true
            }
          },
          righe: {
            where: {
              stato: {
                not: 'ANNULLATO'
              }
            },
            include: {
              prodotto: {
                select: {
                  nome: true,
                  postazione: true
                }
              }
            },
            orderBy: {
              timestampOrdine: 'asc'
            }
          }
        },
        orderBy: [
          { stato: 'asc' },
          { dataApertura: 'desc' }
        ],
        take: limit
      });

      const queryTime = Date.now() - startTime;
      console.log(`[QueryOptimizer] getCameriereOrders: ${queryTime}ms`);
      
      return {
        data: orders,
        queryTime,
        optimization: 'Utilizzato indice composto cameriereId_dataApertura_stato'
      };

    } catch (error) {
      console.error('[QueryOptimizer] Errore getCameriereOrders:', error);
      throw error;
    }
  }

  // Query ottimizzata per postazioni di lavoro
  static async getStationOrders(station: 'PREPARA' | 'CUCINA', limit: number = 100) {
    const startTime = Date.now();
    
    try {
      // Query con indice specifico per postazione
      const righe = await prisma.rigaOrdinazione.findMany({
        where: {
          postazione: station,
          stato: {
            in: ['INSERITO', 'IN_LAVORAZIONE']
          }
        },
        include: {
          prodotto: {
            select: {
              nome: true,
              tempoPreparazione: true
            }
          },
          ordinazione: {
            select: {
              numero: true,
              tipo: true,
              nomeCliente: true,
              tavolo: {
                select: {
                  numero: true
                }
              }
            }
          }
        },
        orderBy: [
          { stato: 'asc' },
          { timestampOrdine: 'asc' }
        ],
        take: limit
      });

      const queryTime = Date.now() - startTime;
      console.log(`[QueryOptimizer] getStationOrders(${station}): ${queryTime}ms`);
      
      return {
        data: righe,
        queryTime,
        optimization: 'Utilizzato indice postazione_stato_timestampOrdine'
      };

    } catch (error) {
      console.error(`[QueryOptimizer] Errore getStationOrders(${station}):`, error);
      throw error;
    }
  }

  // Query ottimizzata per tavoli con stato
  static async getTablesWithOrders() {
    const startTime = Date.now();
    
    try {
      // Query con join ottimizzato
      const tables = await prisma.tavolo.findMany({
        where: {
          stato: {
            in: ['OCCUPATO', 'RISERVATO']
          }
        },
        include: {
          ordinazioni: {
            where: {
              stato: {
                not: 'PAGATO'
              }
            },
            include: {
              righe: {
                where: {
                  isPagato: false
                },
                select: {
                  stato: true,
                  postazione: true,
                  prezzo: true,
                  quantita: true
                }
              },
              cameriere: {
                select: {
                  nome: true
                }
              }
            },
            orderBy: {
              dataApertura: 'asc'
            }
          }
        },
        orderBy: {
          numero: 'asc'
        }
      });

      const queryTime = Date.now() - startTime;
      console.log(`[QueryOptimizer] getTablesWithOrders: ${queryTime}ms`);
      
      return {
        data: tables,
        queryTime,
        optimization: 'Utilizzato indice stato_zona + tavoloId_stato_statoPagamento'
      };

    } catch (error) {
      console.error('[QueryOptimizer] Errore getTablesWithOrders:', error);
      throw error;
    }
  }

  // Query per ordini pronti (ottimizzata per velocità)
  static async getReadyOrders(cameriereId?: string) {
    const startTime = Date.now();
    
    try {
      const whereClause: any = {
        stato: 'PRONTO'
      };
      
      if (cameriereId) {
        whereClause.cameriereId = cameriereId;
      }

      const orders = await prisma.ordinazione.findMany({
        where: whereClause,
        include: {
          tavolo: {
            select: {
              numero: true
            }
          },
          righe: {
            where: {
              stato: 'PRONTO'
            },
            include: {
              prodotto: {
                select: {
                  nome: true,
                  postazione: true
                }
              }
            }
          }
        },
        orderBy: [
          { updatedAt: 'asc' } // Più vecchi prima
        ]
      });

      const queryTime = Date.now() - startTime;
      console.log(`[QueryOptimizer] getReadyOrders: ${queryTime}ms`);
      
      return {
        data: orders,
        queryTime,
        optimization: 'Utilizzato indice updatedAt_stato per ordini pronti'
      };

    } catch (error) {
      console.error('[QueryOptimizer] Errore getReadyOrders:', error);
      throw error;
    }
  }

  // Query per statistiche pagamenti (ottimizzata per analytics)
  static async getPaymentStats(startDate: Date, endDate: Date) {
    const startTime = Date.now();
    
    try {
      // Query aggregata ottimizzata
      const stats = await prisma.pagamento.aggregate({
        where: {
          timestamp: {
            gte: startDate,
            lte: endDate
          }
        },
        _sum: {
          importo: true
        },
        _count: {
          id: true
        }
      });

      // Query per breakdown per modalità
      const modalityBreakdown = await prisma.pagamento.groupBy({
        by: ['modalita'],
        where: {
          timestamp: {
            gte: startDate,
            lte: endDate
          }
        },
        _sum: {
          importo: true
        },
        _count: {
          id: true
        }
      });

      const queryTime = Date.now() - startTime;
      console.log(`[QueryOptimizer] getPaymentStats: ${queryTime}ms`);
      
      return {
        data: {
          total: stats,
          byModality: modalityBreakdown
        },
        queryTime,
        optimization: 'Utilizzato indice timestamp_modalita per aggregazioni'
      };

    } catch (error) {
      console.error('[QueryOptimizer] Errore getPaymentStats:', error);
      throw error;
    }
  }

  // Query per menu ottimizzata
  static async getActiveMenu() {
    const startTime = Date.now();
    
    try {
      const categories = await prisma.categoriaMenu.findMany({
        where: {
          attiva: true
        },
        include: {
          prodotti: {
            where: {
              disponibile: true,
              isDeleted: false
            },
            orderBy: {
              ordineProdotto: 'asc'
            },
            select: {
              id: true,
              nome: true,
              descrizione: true,
              prezzo: true,
              postazione: true,
              tempoPreparazione: true,
              immagine: true
            }
          }
        },
        orderBy: {
          ordinamento: 'asc'
        }
      });

      const queryTime = Date.now() - startTime;
      console.log(`[QueryOptimizer] getActiveMenu: ${queryTime}ms`);
      
      return {
        data: categories,
        queryTime,
        optimization: 'Utilizzato indice disponibile_categoriaMenuId_ordineProdotto'
      };

    } catch (error) {
      console.error('[QueryOptimizer] Errore getActiveMenu:', error);
      throw error;
    }
  }

  // Query per ordini in ritardo (priorità)
  static async getDelayedOrders(thresholdMinutes: number = 20) {
    const startTime = Date.now();
    const thresholdTime = new Date(Date.now() - thresholdMinutes * 60 * 1000);
    
    try {
      const delayedRighe = await prisma.rigaOrdinazione.findMany({
        where: {
          stato: {
            in: ['INSERITO', 'IN_LAVORAZIONE']
          },
          timestampOrdine: {
            lt: thresholdTime
          }
        },
        include: {
          prodotto: {
            select: {
              nome: true
            }
          },
          ordinazione: {
            select: {
              numero: true,
              tavolo: {
                select: {
                  numero: true
                }
              },
              cameriere: {
                select: {
                  nome: true
                }
              }
            }
          }
        },
        orderBy: {
          timestampOrdine: 'asc' // Più vecchi prima
        }
      });

      const queryTime = Date.now() - startTime;
      console.log(`[QueryOptimizer] getDelayedOrders: ${queryTime}ms`);
      
      return {
        data: delayedRighe,
        queryTime,
        optimization: 'Utilizzato indice stato_timestampOrdine_postazione'
      };

    } catch (error) {
      console.error('[QueryOptimizer] Errore getDelayedOrders:', error);
      throw error;
    }
  }

  // Analisi performance query
  static async analyzeQueryPerformance() {
    const queries = [
      'getCameriereOrders',
      'getStationOrders',
      'getTablesWithOrders',
      'getReadyOrders',
      'getPaymentStats',
      'getActiveMenu',
      'getDelayedOrders'
    ];

    const results = [];
    
    for (const queryName of queries) {
      const startTime = Date.now();
      
      try {
        switch (queryName) {
          case 'getCameriereOrders':
            await this.getCameriereOrders('test-id', 10);
            break;
          case 'getStationOrders':
            await this.getStationOrders('PREPARA', 10);
            break;
          case 'getTablesWithOrders':
            await this.getTablesWithOrders();
            break;
          case 'getReadyOrders':
            await this.getReadyOrders();
            break;
          case 'getPaymentStats':
            const today = new Date();
            const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
            await this.getPaymentStats(yesterday, today);
            break;
          case 'getActiveMenu':
            await this.getActiveMenu();
            break;
          case 'getDelayedOrders':
            await this.getDelayedOrders(20);
            break;
        }
        
        const queryTime = Date.now() - startTime;
        results.push({
          query: queryName,
          time: queryTime,
          status: 'success'
        });
        
      } catch (error) {
        results.push({
          query: queryName,
          time: Date.now() - startTime,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return {
      timestamp: new Date(),
      results,
      averageTime: results.reduce((sum, r) => sum + r.time, 0) / results.length
    };
  }

  // Ottimizzazione automatica query lente
  static async optimizeSlowQueries() {
    const analysis = await this.analyzeQueryPerformance();
    const slowQueries = analysis.results.filter(r => r.time > 1000); // > 1 secondo
    
    const recommendations = [];
    
    for (const slow of slowQueries) {
      switch (slow.query) {
        case 'getCameriereOrders':
          recommendations.push({
            query: slow.query,
            time: slow.time,
            suggestion: 'Considerare aggiunta di limit più basso o paginazione',
            indexSuggestion: 'Verificare indice cameriereId_dataApertura_stato'
          });
          break;
          
        case 'getStationOrders':
          recommendations.push({
            query: slow.query,
            time: slow.time,
            suggestion: 'Implementare cache per query frequenti della stazione',
            indexSuggestion: 'Verificare indice postazione_stato_timestampOrdine'
          });
          break;
          
        default:
          recommendations.push({
            query: slow.query,
            time: slow.time,
            suggestion: 'Query lenta rilevata - analisi manuale necessaria'
          });
      }
    }

    return {
      analysis,
      slowQueries,
      recommendations,
      totalOptimizationNeeded: slowQueries.length > 0
    };
  }
}

// Funzioni di utilità per monitoraggio performance
export async function logQueryPerformance(queryName: string, duration: number) {
  if (duration > 500) { // Log solo query > 500ms
    console.warn(`[Performance] Query lenta rilevata: ${queryName} took ${duration}ms`);
  }
}

export function createQueryTimer(queryName: string) {
  const start = Date.now();
  return () => {
    const duration = Date.now() - start;
    logQueryPerformance(queryName, duration);
    return duration;
  };
}