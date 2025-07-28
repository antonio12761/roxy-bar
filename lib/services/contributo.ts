import { prisma } from "@/lib/db";
import { TipoContributo } from "@prisma/client";

export interface ContributoInput {
  clienteId: string;
  clientePagatoreId?: string;
  tavoloId?: number;
  tipo: TipoContributo;
  riferimentoId: string;
  importo: number;
  descrizione?: string;
}

export interface ContributoCliente {
  id: string;
  clienteId: string;
  clientePagatoreId?: string;
  tavoloId?: number;
  tipo: TipoContributo;
  riferimentoId: string;
  importo: number;
  descrizione?: string;
  timestamp: Date;
}

export class ContributoService {
  /**
   * Crea un nuovo contributo cliente
   */
  static async creaContributo(input: ContributoInput): Promise<ContributoCliente> {
    return await prisma.contributoCliente.create({
      data: {
        clienteId: input.clienteId,
        clientePagatoreId: input.clientePagatoreId,
        tavoloId: input.tavoloId,
        tipo: input.tipo,
        riferimentoId: input.riferimentoId,
        importo: input.importo,
        descrizione: input.descrizione,
      },
    });
  }

  /**
   * Registra ordinazione per altro tavolo/cliente
   */
  static async ordinaPerAltri(
    clienteOrdinanteId: string,
    tavoloBeneficiarioId: number,
    ordinazioneId: string,
    importo: number,
    clienteBeneficiarioId?: string
  ): Promise<ContributoCliente> {
    const tavolo = await prisma.tavolo.findUnique({
      where: { id: tavoloBeneficiarioId },
    });

    return await this.creaContributo({
      clienteId: clienteOrdinanteId,
      clientePagatoreId: clienteBeneficiarioId,
      tavoloId: tavoloBeneficiarioId,
      tipo: TipoContributo.ORDINE_ALTRUI,
      riferimentoId: ordinazioneId,
      importo,
      descrizione: `Ordinazione per tavolo ${tavolo?.numero}${
        clienteBeneficiarioId ? " - Cliente specifico" : ""
      }`,
    });
  }

  /**
   * Registra pagamento per altro cliente/tavolo
   */
  static async pagaPerAltri(
    clientePagatoreId: string,
    pagamentoId: string,
    importo: number,
    tavoloId?: number,
    clienteBeneficiarioId?: string
  ): Promise<ContributoCliente> {
    let descrizione = "Pagamento per altri";
    
    if (tavoloId) {
      const tavolo = await prisma.tavolo.findUnique({
        where: { id: tavoloId },
      });
      descrizione = `Pagamento conto tavolo ${tavolo?.numero}`;
    }
    
    if (clienteBeneficiarioId) {
      const cliente = await prisma.cliente.findUnique({
        where: { id: clienteBeneficiarioId },
      });
      descrizione += ` - Cliente: ${cliente?.nome}`;
    }

    return await this.creaContributo({
      clienteId: clientePagatoreId,
      clientePagatoreId: clienteBeneficiarioId,
      tavoloId,
      tipo: TipoContributo.PAGAMENTO_ALTRUI,
      riferimentoId: pagamentoId,
      importo,
      descrizione,
    });
  }

  /**
   * Ottiene tutti i contributi di un cliente
   */
  static async getContributiCliente(clienteId: string): Promise<{
    effettuati: ContributoCliente[];
    ricevuti: ContributoCliente[];
    saldoNetto: number;
  }> {
    const [effettuati, ricevuti] = await Promise.all([
      prisma.contributoCliente.findMany({
        where: { clienteId },
        include: {
          clientePagatore: true,
          tavolo: true,
        },
        orderBy: { timestamp: "desc" },
      }),
      prisma.contributoCliente.findMany({
        where: { clientePagatoreId: clienteId },
        include: {
          cliente: true,
          tavolo: true,
        },
        orderBy: { timestamp: "desc" },
      }),
    ]);

    const totaleEffettuato = effettuati.reduce((sum, c) => sum + Number(c.importo), 0);
    const totaleRicevuto = ricevuti.reduce((sum, c) => sum + Number(c.importo), 0);
    const saldoNetto = totaleEffettuato - totaleRicevuto;

    return {
      effettuati,
      ricevuti,
      saldoNetto,
    };
  }

  /**
   * Ottiene contributi per tavolo
   */
  static async getContributiPerTavolo(tavoloId: number): Promise<ContributoCliente[]> {
    return await prisma.contributoCliente.findMany({
      where: { tavoloId },
      include: {
        cliente: true,
        clientePagatore: true,
      },
      orderBy: { timestamp: "desc" },
    });
  }

  /**
   * Calcola il saldo finale che un cliente deve pagare
   * considerando tutti i suoi contributi e quelli ricevuti
   */
  static async calcolaSaldoFinale(clienteId: string): Promise<{
    totaleOrdinazioni: number;
    totaleContributiEffettuati: number;
    totaleContributiRicevuti: number;
    saldoFinale: number;
    dettaglio: {
      ordinazioniProprie: number;
      ordinazioniPerAltri: number;
      pagamentiPerAltri: number;
      ordiniRicevutiDaAltri: number;
      pagamentiRicevutiDaAltri: number;
    };
  }> {
    // Ordinazioni del cliente
    const ordinazioni = await prisma.ordinazione.findMany({
      where: { clienteId },
      include: { righe: true },
    });

    // Contributi effettuati
    const contributiEffettuati = await prisma.contributoCliente.findMany({
      where: { clienteId },
    });

    // Contributi ricevuti
    const contributiRicevuti = await prisma.contributoCliente.findMany({
      where: { clientePagatoreId: clienteId },
    });

    const totaleOrdinazioni = ordinazioni.reduce(
      (sum, ord) => sum + Number(ord.totale),
      0
    );

    const ordinazioniPerAltri = contributiEffettuati
      .filter((c) => c.tipo === TipoContributo.ORDINE_ALTRUI)
      .reduce((sum, c) => sum + Number(c.importo), 0);

    const pagamentiPerAltri = contributiEffettuati
      .filter((c) => c.tipo === TipoContributo.PAGAMENTO_ALTRUI)
      .reduce((sum, c) => sum + Number(c.importo), 0);

    const ordiniRicevutiDaAltri = contributiRicevuti
      .filter((c) => c.tipo === TipoContributo.ORDINE_ALTRUI)
      .reduce((sum, c) => sum + Number(c.importo), 0);

    const pagamentiRicevutiDaAltri = contributiRicevuti
      .filter((c) => c.tipo === TipoContributo.PAGAMENTO_ALTRUI)
      .reduce((sum, c) => sum + Number(c.importo), 0);

    const totaleContributiEffettuati = ordinazioniPerAltri + pagamentiPerAltri;
    const totaleContributiRicevuti = ordiniRicevutiDaAltri + pagamentiRicevutiDaAltri;

    // Saldo finale = ordinazioni proprie + contributi per altri - contributi ricevuti
    const saldoFinale = totaleOrdinazioni + totaleContributiEffettuati - totaleContributiRicevuti;

    return {
      totaleOrdinazioni,
      totaleContributiEffettuati,
      totaleContributiRicevuti,
      saldoFinale,
      dettaglio: {
        ordinazioniProprie: totaleOrdinazioni,
        ordinazioniPerAltri,
        pagamentiPerAltri,
        ordiniRicevutiDaAltri,
        pagamentiRicevutiDaAltri,
      },
    };
  }
}