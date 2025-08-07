export interface OrderItem {
  id: string;
  ordinazioneId: string;
  prodotto: string;
  prodottoId?: number | null;
  quantita: number;
  prezzo: number;
  stato: "INSERITO" | "IN_LAVORAZIONE" | "PRONTO" | "CONSEGNATO";
  timestamp: string;
  postazione: string;
  note?: string | null;
  glassesCount?: number;
  configurazione?: any; // Per miscelati e prodotti configurabili
}

export interface Ordinazione {
  id: string;
  tavolo?: string | number;
  cliente?: string;
  nomeCliente?: string;
  timestamp: string;
  items: OrderItem[];
  totaleCosto: number;
  stato: "ORDINATO" | "IN_PREPARAZIONE" | "PRONTO" | "CONSEGNATO" | "ORDINATO_ESAURITO";
  hasKitchenItems: boolean;
  cameriere?: string;
  note?: string;
  numero?: number;
}