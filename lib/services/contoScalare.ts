import { prisma } from "@/lib/db";
import { StatoConto, TipoMovimentoScalare } from "@prisma/client";

export interface ContoScalareData {
  id: string;
  tavoloId?: number | null;
  clienteId?: string | null;
  nomeCliente?: string | null;
  totaleOrdinato: number;
  totalePagato: number;
  saldoRimanente: number;
  stato: StatoConto;
  dataApertura: Date;
  dataChiusura?: Date | null;
  movimenti: MovimentoContoData[];
}

export interface MovimentoContoData {
  id: string;
  tipo: TipoMovimentoScalare;
  importo: number;
  descrizione: string;
  timestamp: Date;
  clientePagatoreId?: string | null;
  nomeClientePagatore?: string | null;
}

export class ContoScalareService {
  /**
   * Ottiene o crea un conto scalare per un tavolo
   */
  static async getOrCreateContoTavolo(tavoloId: number, operatoreId: string): Promise<ContoScalareData> {
    let conto = await prisma.contoScalare.findFirst({
      where: {
        tavoloId,
        stato: StatoConto.APERTO
      },
      include: {
        movimenti: {
          include: {
            clientePagatore: {
              select: { nome: true }
            }
          },
          orderBy: { timestamp: 'desc' }
        }
      }
    });

    if (!conto) {
      conto = await prisma.contoScalare.create({
        data: {
          tavoloId,
          stato: StatoConto.APERTO,
          totaleOrdinato: 0,
          totalePagato: 0,
          saldoRimanente: 0
        },
        include: {
          movimenti: {
            include: {
              clientePagatore: {
                select: { nome: true }
              }
            },
            orderBy: { timestamp: 'desc' }
          }
        }
      });
    }

    return this.mapContoToData(conto);
  }

  /**
   * Ottiene o crea un conto scalare per un cliente specifico
   */
  static async getOrCreateContoCliente(
    clienteId: string | null, 
    nomeCliente: string | null, 
    operatoreId: string
  ): Promise<ContoScalareData> {
    let conto = await prisma.contoScalare.findFirst({
      where: {
        OR: [
          { clienteId: clienteId },
          { nomeCliente: nomeCliente }
        ],
        stato: StatoConto.APERTO
      },
      include: {
        movimenti: {
          include: {
            clientePagatore: {
              select: { nome: true }
            }
          },
          orderBy: { timestamp: 'desc' }
        }
      }
    });

    if (!conto) {
      conto = await prisma.contoScalare.create({
        data: {
          clienteId,
          nomeCliente,
          stato: StatoConto.APERTO,
          totaleOrdinato: 0,
          totalePagato: 0,
          saldoRimanente: 0
        },
        include: {
          movimenti: {
            include: {
              clientePagatore: {
                select: { nome: true }
              }
            },
            orderBy: { timestamp: 'desc' }
          }
        }
      });
    }

    return this.mapContoToData(conto);
  }

  /**
   * Aggiunge un ordine al conto scalare
   */
  static async aggiungiOrdine(
    contoId: string,
    ordinazioneId: string,
    importo: number,
    descrizione: string,
    operatoreId: string
  ): Promise<ContoScalareData> {
    const result = await prisma.$transaction(async (tx) => {
      // Aggiunge movimento di tipo ORDINE
      await tx.movimentoContoScalare.create({
        data: {
          contoScalareId: contoId,
          tipo: TipoMovimentoScalare.ORDINE,
          importo,
          descrizione,
          ordinazioneId,
          operatoreId
        }
      });

      // Aggiorna i totali del conto
      const conto = await tx.contoScalare.update({
        where: { id: contoId },
        data: {
          totaleOrdinato: {
            increment: importo
          },
          saldoRimanente: {
            increment: importo
          }
        },
        include: {
          movimenti: {
            include: {
              clientePagatore: {
                select: { nome: true }
              }
            },
            orderBy: { timestamp: 'desc' }
          }
        }
      });

      return conto;
    });

    return this.mapContoToData(result);
  }

  /**
   * Registra un pagamento per il conto scalare
   */
  static async registraPagamento(
    contoId: string,
    importo: number,
    descrizione: string,
    clientePagatoreId: string | null,
    operatoreId: string,
    pagamentoId?: string
  ): Promise<ContoScalareData> {
    const result = await prisma.$transaction(async (tx) => {
      // Aggiunge movimento di tipo PAGAMENTO
      await tx.movimentoContoScalare.create({
        data: {
          contoScalareId: contoId,
          tipo: TipoMovimentoScalare.PAGAMENTO,
          importo: -importo, // Negativo perché riduce il saldo
          descrizione,
          clientePagatoreId,
          pagamentoId,
          operatoreId
        }
      });

      // Aggiorna i totali del conto
      const conto = await tx.contoScalare.update({
        where: { id: contoId },
        data: {
          totalePagato: {
            increment: importo
          },
          saldoRimanente: {
            decrement: importo
          }
        },
        include: {
          movimenti: {
            include: {
              clientePagatore: {
                select: { nome: true }
              }
            },
            orderBy: { timestamp: 'desc' }
          }
        }
      });

      // Se il saldo è 0 o negativo, chiude automaticamente il conto
      if (conto.saldoRimanente.toNumber() <= 0) {
        await tx.contoScalare.update({
          where: { id: contoId },
          data: {
            stato: StatoConto.CHIUSO,
            dataChiusura: new Date()
          }
        });
      }

      return conto;
    });

    return this.mapContoToData(result);
  }

  /**
   * Ottiene il saldo corrente di un conto
   */
  static async getSaldoConto(contoId: string): Promise<number> {
    const conto = await prisma.contoScalare.findUnique({
      where: { id: contoId },
      select: { saldoRimanente: true }
    });

    return conto?.saldoRimanente.toNumber() || 0;
  }

  /**
   * Chiude manualmente un conto
   */
  static async chiudiConto(contoId: string, operatoreId: string): Promise<ContoScalareData> {
    const conto = await prisma.contoScalare.update({
      where: { id: contoId },
      data: {
        stato: StatoConto.CHIUSO,
        dataChiusura: new Date()
      },
      include: {
        movimenti: {
          include: {
            clientePagatore: {
              select: { nome: true }
            }
          },
          orderBy: { timestamp: 'desc' }
        }
      }
    });

    return this.mapContoToData(conto);
  }

  /**
   * Ottiene tutti i conti aperti per un tavolo
   */
  static async getContiApertiTavolo(tavoloId: number): Promise<ContoScalareData[]> {
    const conti = await prisma.contoScalare.findMany({
      where: {
        tavoloId,
        stato: StatoConto.APERTO
      },
      include: {
        movimenti: {
          include: {
            clientePagatore: {
              select: { nome: true }
            }
          },
          orderBy: { timestamp: 'desc' }
        }
      },
      orderBy: { dataApertura: 'desc' }
    });

    return conti.map(this.mapContoToData);
  }

  /**
   * Ottiene tutti i conti aperti nel sistema
   */
  static async getTuttiContiAperti(): Promise<ContoScalareData[]> {
    const conti = await prisma.contoScalare.findMany({
      where: {
        stato: StatoConto.APERTO
      },
      include: {
        movimenti: {
          include: {
            clientePagatore: {
              select: { nome: true }
            }
          },
          orderBy: { timestamp: 'desc' }
        }
      },
      orderBy: { dataApertura: 'desc' }
    });

    return conti.map(this.mapContoToData);
  }

  /**
   * Utility per mappare il risultato Prisma al tipo di dato
   */
  private static mapContoToData(conto: any): ContoScalareData {
    return {
      id: conto.id,
      tavoloId: conto.tavoloId,
      clienteId: conto.clienteId,
      nomeCliente: conto.nomeCliente,
      totaleOrdinato: conto.totaleOrdinato.toNumber(),
      totalePagato: conto.totalePagato.toNumber(),
      saldoRimanente: conto.saldoRimanente.toNumber(),
      stato: conto.stato,
      dataApertura: conto.dataApertura,
      dataChiusura: conto.dataChiusura,
      movimenti: conto.movimenti?.map((mov: any) => ({
        id: mov.id,
        tipo: mov.tipo,
        importo: mov.importo.toNumber(),
        descrizione: mov.descrizione,
        timestamp: mov.timestamp,
        clientePagatoreId: mov.clientePagatoreId,
        nomeClientePagatore: mov.clientePagatore?.nome
      })) || []
    };
  }
}