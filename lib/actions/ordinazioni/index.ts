// Re-export all types
export type {
  ProdottoOrdine,
  NuovaOrdinazione,
  StatoOrdinazione,
  StatoRiga,
  FiltriStorico
} from './types';

// Re-export auth helpers
export {
  getAuthenticatedUser,
  checkUserPermission
} from './auth-helpers';

// Re-export tavoli functions
export {
  getTavoli,
  getTableOrdersInfo,
  getCustomerNamesForTable
} from './tavoli';

// Re-export prodotti functions
export {
  getProdotti,
  getAllProdotti
} from './prodotti';

// Re-export ordini CRUD functions
export {
  getOrdinazioniAttiveTavolo,
  creaOrdinazione,
  getOrdinazioniAperte,
  cancellaOrdiniAttivi,
  cancellaOrdinazione,
  cancellaRigaOrdinazione,
  modificaQuantitaRiga,
  mergeOrdineProdotti
} from './ordini-crud';

// Re-export stati ordini functions
export {
  aggiornaStatoOrdinazione,
  aggiornaStatoRiga,
  completaTuttiGliItems,
  segnaOrdineRitirato,
  getOrdinazioniPerStato
} from './stati-ordini';

// Re-export richieste merge functions
export {
  getRichiesteMergePendenti,
  accettaRichiestaMerge,
  rifiutaRichiestaMerge,
  getMergedOrdersHistory
} from './richieste-merge';

// Re-export notifiche and sync functions
export {
  sincronizzaOrdiniTraStazioni,
  forzaRefreshStazioni,
  sollecitaOrdinePronto
} from './notifiche-sync';

// Re-export storico functions
export {
  getStoricoOrdinazioni
} from './storico';
