import { Prisma, StatoOrdinazione } from "@prisma/client";

// Definizione delle transizioni valide per gli stati degli ordini
// Ora bidirezionale - permette di tornare indietro negli stati
const TRANSIZIONI_STATO_ORDINE: Record<StatoOrdinazione, StatoOrdinazione[]> = {
  ORDINATO: [
    "IN_PREPARAZIONE", 
    "ANNULLATO"
  ],
  IN_PREPARAZIONE: [
    "ORDINATO",         // Può tornare a ORDINATO
    "PRONTO", 
    "ANNULLATO"         // Può essere annullato anche in preparazione
  ],
  PRONTO: [
    "IN_PREPARAZIONE",  // Può tornare in preparazione
    "CONSEGNATO"
  ],
  CONSEGNATO: [
    "PRONTO",           // Può tornare a PRONTO se necessario
    "RICHIESTA_CONTO",
    "PAGATO"            // Può essere pagato direttamente
  ],
  RICHIESTA_CONTO: [
    "CONSEGNATO",       // Può tornare a CONSEGNATO
    "PAGAMENTO_RICHIESTO"
  ],
  PAGAMENTO_RICHIESTO: [
    "RICHIESTA_CONTO",  // Può tornare indietro
    "PAGATO"
  ],
  PAGATO: [],           // Stato finale - non può cambiare
  ANNULLATO: []         // Stato finale - non può cambiare
};

// Classe per errori di transizione di stato
export class TransizioneStatoError extends Error {
  constructor(
    public readonly statoAttuale: string,
    public readonly nuovoStato: string,
    public readonly entita: 'ordinazione' | 'rigaOrdinazione',
    public readonly id?: string
  ) {
    super(
      `Transizione di stato non valida per ${entita}${id ? ` ${id}` : ''}: ` +
      `da ${statoAttuale} a ${nuovoStato}`
    );
    this.name = 'TransizioneStatoError';
  }
}

// Funzione per validare le transizioni di stato
export function validaTransizioneStato(
  statoAttuale: StatoOrdinazione,
  nuovoStato: StatoOrdinazione
): boolean {
  const transizioniPermesse = TRANSIZIONI_STATO_ORDINE[statoAttuale];
  return transizioniPermesse.includes(nuovoStato);
}

// Cache per evitare log duplicati
const recentTransitions = new Map<string, number>();
const TRANSITION_COOLDOWN = 30000; // 30 secondi per evitare log multipli

// Middleware Prisma per validazione stati (aggiornato per Client Extensions)
export async function validateStateTransition(
  prismaClient: any,
  model: string,
  action: string,
  args: any
) {
  // Intercetta solo le operazioni di update su Ordinazione
  if (model === 'Ordinazione' && action === 'update') {
    const { where, data } = args;
    
    // Se viene aggiornato lo stato
    if (data.stato) {
      // Recupera lo stato attuale
      const ordinazioneAttuale = await prismaClient.ordinazione.findUnique({
        where,
        select: { id: true, stato: true }
      });
      
      if (ordinazioneAttuale) {
        const nuovoStato = data.stato as StatoOrdinazione;
        const statoAttuale = ordinazioneAttuale.stato as StatoOrdinazione;
        
        // Valida la transizione
        if (!validaTransizioneStato(statoAttuale, nuovoStato)) {
          throw new TransizioneStatoError(
            statoAttuale,
            nuovoStato,
            'ordinazione',
            ordinazioneAttuale.id
          );
        }
        
        // Log della transizione per audit con debounce
        const transitionKey = `${ordinazioneAttuale.id}:${statoAttuale}→${nuovoStato}`;
        const now = Date.now();
        const lastLogged = recentTransitions.get(transitionKey);
        
        if (!lastLogged || now - lastLogged > TRANSITION_COOLDOWN) {
          console.log(
            `✅ Transizione stato ordinazione ${ordinazioneAttuale.id}: ` +
            `${statoAttuale} → ${nuovoStato}`
          );
          recentTransitions.set(transitionKey, now);
          
          // Cleanup vecchie entries
          if (recentTransitions.size > 100) {
            const cutoff = now - TRANSITION_COOLDOWN * 2;
            for (const [key, time] of recentTransitions.entries()) {
              if (time < cutoff) {
                recentTransitions.delete(key);
              }
            }
          }
        }
      }
    }
  }
  
  // Intercetta anche updateMany per sicurezza
  if (model === 'Ordinazione' && action === 'updateMany') {
    const { where, data } = args;
    
    if (data.stato) {
      // Per updateMany, dobbiamo prima recuperare tutti i record
      const ordinazioni = await prismaClient.ordinazione.findMany({
        where,
        select: { id: true, stato: true }
      });
      
      const nuovoStato = data.stato as StatoOrdinazione;
      
      // Valida ogni transizione
      for (const ord of ordinazioni) {
        const statoAttuale = ord.stato as StatoOrdinazione;
        if (!validaTransizioneStato(statoAttuale, nuovoStato)) {
          throw new TransizioneStatoError(
            statoAttuale,
            nuovoStato,
            'ordinazione',
            ord.id
          );
        }
      }
    }
  }
}

// Funzione helper per ottenere gli stati successivi possibili
export function getStatiSuccessivi(statoAttuale: StatoOrdinazione): StatoOrdinazione[] {
  return TRANSIZIONI_STATO_ORDINE[statoAttuale] || [];
}

// Funzione helper per verificare se uno stato è finale
export function isStatoFinale(stato: StatoOrdinazione): boolean {
  return stato === 'PAGATO' || stato === 'ANNULLATO';
}

// Funzione per gestire richieste di annullamento
export interface RichiestaAnnullamento {
  ordinazioneId: string;
  motivo: string;
  richiedenteName: string;
  richiedenteId: string;
  statoAttuale: StatoOrdinazione;
}

export function canRequestCancellation(stato: StatoOrdinazione): boolean {
  // Può richiedere annullamento da ORDINATO o IN_PREPARAZIONE
  return stato === 'ORDINATO' || stato === 'IN_PREPARAZIONE';
}