export interface ProdottoOrdine {
  prodottoId: number;
  quantita: number;
  prezzo: number;
  note?: string;
  glassesCount?: number;
}

export interface NuovaOrdinazione {
  tavoloId?: number;
  clienteId?: string;
  tipo: "TAVOLO" | "ASPORTO" | "BANCONE";
  note?: string;
  prodotti: ProdottoOrdine[];
}

export type StatoOrdinazione = "ORDINATO" | "IN_PREPARAZIONE" | "PRONTO" | "CONSEGNATO" | "RICHIESTA_CONTO" | "PAGATO" | "ANNULLATO";
export type StatoRiga = "INSERITO" | "IN_LAVORAZIONE" | "PRONTO" | "CONSEGNATO" | "ANNULLATO";

export interface FiltriStorico {
  dataInizio?: Date;
  dataFine?: Date;
  tavoloId?: number;
  cameriereId?: string;
  limit?: number;
}