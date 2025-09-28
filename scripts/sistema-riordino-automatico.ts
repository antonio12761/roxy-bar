// Sistema di Riordino Automatico basato su Stock Minimo
// Converte automaticamente le necessità di vendita in ordini fornitore

// Simulazione enum che saranno nel database
enum UnitaAcquisto {
  CARTONE = 'CARTONE',
  CASSA = 'CASSA',
  BANCALE = 'BANCALE',
  BOTTIGLIA = 'BOTTIGLIA',
  FUSTO = 'FUSTO',
  KG = 'KG',
  LITRO = 'LITRO',
  BUSTA = 'BUSTA',
  PEZZO = 'PEZZO'
}

enum UnitaVendita {
  BOTTIGLIA = 'BOTTIGLIA',
  BICCHIERE = 'BICCHIERE',
  CALICE = 'CALICE',
  TAZZINA = 'TAZZINA',
  PORZIONE = 'PORZIONE',
  PEZZO = 'PEZZO'
}

interface ConfigurazioneProdotto {
  prodottoId: number;
  nome: string;
  
  // Configurazione conversione
  unitaAcquisto: UnitaAcquisto;
  pezziPerUnitaAcquisto: number;
  unitaVendita: UnitaVendita;
  fattoreConversione: number;
  
  // Livelli di riordino (in unità di vendita)
  stockMinimo: number;           // Quando riordinare
  stockMassimo: number;          // Quanto avere max
  puntoRiordino: number;         // Stock minimo + consumo durante lead time
  
  // Parametri riordino
  leadTimeGiorni: number;        // Tempo consegna fornitore
  consumoMedioGiornaliero: number;  // In unità vendita
  lottominimoAcquisto: number;   // Minimo ordinabile in unità acquisto
  
  // Fornitore
  fornitoreId: number;
  prezzoAcquisto: number;        // Per unità acquisto
}

/**
 * Calcola le necessità di riordino
 */
function calcolaRiordino(config: ConfigurazioneProdotto, giacenzaAttuale: number): {
  necessitaRiordino: boolean;
  quantitaDaOrdinare: number;
  unitaAcquisto: UnitaAcquisto;
  motivazione: string;
  dettaglio: any;
} {
  // Calcola consumo durante lead time
  const consumoDuranteLeadTime = config.consumoMedioGiornaliero * config.leadTimeGiorni;
  
  // Calcola punto di riordino dinamico
  const puntoRiordino = config.stockMinimo + consumoDuranteLeadTime;
  
  // Verifica se necessario riordinare
  if (giacenzaAttuale > puntoRiordino) {
    return {
      necessitaRiordino: false,
      quantitaDaOrdinare: 0,
      unitaAcquisto: config.unitaAcquisto,
      motivazione: "Stock sufficiente",
      dettaglio: {
        giacenzaAttuale,
        puntoRiordino,
        margine: giacenzaAttuale - puntoRiordino
      }
    };
  }
  
  // Calcola quantità ideale da ordinare (in unità vendita)
  const quantitaIdealeVendita = config.stockMassimo - giacenzaAttuale + consumoDuranteLeadTime;
  
  // Converti in unità acquisto
  const quantitaIdealeAcquisto = Math.ceil(quantitaIdealeVendita / config.fattoreConversione);
  
  // Applica lotto minimo
  const quantitaDaOrdinare = Math.max(quantitaIdealeAcquisto, config.lottominimoAcquisto);
  
  // Arrotonda per ottimizzare trasporto (es. cartoni completi)
  const quantitaOttimizzata = ottimizzaQuantitaOrdine(quantitaDaOrdinare, config);
  
  return {
    necessitaRiordino: true,
    quantitaDaOrdinare: quantitaOttimizzata,
    unitaAcquisto: config.unitaAcquisto,
    motivazione: `Stock sotto punto riordino (${giacenzaAttuale} < ${puntoRiordino})`,
    dettaglio: {
      giacenzaAttuale,
      puntoRiordino,
      stockMassimo: config.stockMassimo,
      consumoDuranteLeadTime,
      quantitaIdealeVendita,
      quantitaIdealeAcquisto,
      quantitaOttimizzata,
      giorniCopertura: giacenzaAttuale / config.consumoMedioGiornaliero
    }
  };
}

/**
 * Ottimizza quantità per trasporto/stoccaggio
 */
function ottimizzaQuantitaOrdine(quantita: number, config: ConfigurazioneProdotto): number {
  // Logiche di ottimizzazione per unità di acquisto
  switch (config.unitaAcquisto) {
    case UnitaAcquisto.CARTONE:
      // Ordina cartoni pieni (es. multipli di 10)
      return Math.ceil(quantita / 10) * 10;
      
    case UnitaAcquisto.CASSA:
      // Ordina casse piene (es. multipli di 5)
      return Math.ceil(quantita / 5) * 5;
      
    case UnitaAcquisto.BANCALE:
      // Ordina bancali pieni
      return Math.ceil(quantita);
      
    default:
      return quantita;
  }
}

/**
 * Genera ordine fornitore da necessità di riordino
 */
async function generaOrdineFornitore(
  prodottiDaOrdinare: Array<{
    config: ConfigurazioneProdotto;
    quantita: number;
    motivazione: string;
  }>
) {
  // Raggruppa per fornitore
  const ordiniPerFornitore = new Map<number, typeof prodottiDaOrdinare>();
  
  prodottiDaOrdinare.forEach(item => {
    const fornitoreId = item.config.fornitoreId;
    if (!ordiniPerFornitore.has(fornitoreId)) {
      ordiniPerFornitore.set(fornitoreId, []);
    }
    ordiniPerFornitore.get(fornitoreId)!.push(item);
  });
  
  // Simulazione creazione ordini
  const ordiniSimulati = [];
  
  for (const [fornitoreId, prodotti] of ordiniPerFornitore) {
    const ordine = {
      id: `ORD-${Date.now()}-${fornitoreId}`,
      fornitoreId,
      stato: 'BOZZA',
      dataOrdine: new Date(),
      note: 'Ordine automatico basato su stock minimo',
      righe: prodotti.map(p => ({
        prodottoId: p.config.prodottoId,
        nome: p.config.nome,
        quantita: p.quantita,
        unitaMisura: p.config.unitaAcquisto,
        prezzoUnitario: p.config.prezzoAcquisto,
        importoTotale: p.quantita * p.config.prezzoAcquisto,
        note: p.motivazione
      }))
    };
    
    ordiniSimulati.push(ordine);
  }
  
  return ordiniSimulati;
}

// ESEMPI DI CONFIGURAZIONE

const esempiConfig: ConfigurazioneProdotto[] = [
  {
    // Coca Cola - venduta a bottiglie, acquistata a cartoni
    prodottoId: 1,
    nome: "Coca Cola 33cl",
    unitaAcquisto: UnitaAcquisto.CARTONE,
    pezziPerUnitaAcquisto: 24,
    unitaVendita: UnitaVendita.BOTTIGLIA,
    fattoreConversione: 24,
    stockMinimo: 48,              // 2 cartoni
    stockMassimo: 240,            // 10 cartoni
    puntoRiordino: 72,            // 3 cartoni
    leadTimeGiorni: 2,
    consumoMedioGiornaliero: 30,  // 30 bottiglie/giorno
    lottominimoAcquisto: 5,       // Min 5 cartoni
    fornitoreId: 1,
    prezzoAcquisto: 15.00
  },
  
  {
    // Caffè - venduto a tazzine, acquistato a kg
    prodottoId: 2,
    nome: "Caffè Miscela Bar",
    unitaAcquisto: UnitaAcquisto.KG,
    pezziPerUnitaAcquisto: 1,
    unitaVendita: UnitaVendita.TAZZINA,
    fattoreConversione: 142,      // 1kg = 142 tazzine (7g)
    stockMinimo: 200,             // ~1.4 kg
    stockMassimo: 1500,           // ~10.5 kg
    puntoRiordino: 400,           // ~2.8 kg
    leadTimeGiorni: 3,
    consumoMedioGiornaliero: 100, // 100 caffè/giorno
    lottominimoAcquisto: 5,       // Min 5 kg
    fornitoreId: 2,
    prezzoAcquisto: 15.00
  },
  
  {
    // Birra spina - venduta a bicchieri, acquistata a fusti
    prodottoId: 3,
    nome: "Birra alla Spina",
    unitaAcquisto: UnitaAcquisto.FUSTO,
    pezziPerUnitaAcquisto: 1,
    unitaVendita: UnitaVendita.BICCHIERE,  // 0.4L medi
    fattoreConversione: 75,       // 30L / 0.4L = 75 bicchieri
    stockMinimo: 100,             // ~1.3 fusti
    stockMassimo: 300,            // 4 fusti
    puntoRiordino: 150,           // 2 fusti
    leadTimeGiorni: 1,
    consumoMedioGiornaliero: 50,  // 50 birre medie/giorno
    lottominimoAcquisto: 2,       // Min 2 fusti
    fornitoreId: 3,
    prezzoAcquisto: 60.00
  },
  
  {
    // Vino - venduto a calici e bottiglie, acquistato a casse
    prodottoId: 4,
    nome: "Vino Rosso Casa",
    unitaAcquisto: UnitaAcquisto.CASSA,
    pezziPerUnitaAcquisto: 6,
    unitaVendita: UnitaVendita.CALICE,
    fattoreConversione: 30,       // 6 bottiglie × 5 calici = 30
    stockMinimo: 50,              // ~1.7 casse
    stockMassimo: 150,            // 5 casse
    puntoRiordino: 80,            // ~2.7 casse  
    leadTimeGiorni: 7,
    consumoMedioGiornaliero: 10,  // 10 calici/giorno
    lottominimoAcquisto: 3,       // Min 3 casse
    fornitoreId: 4,
    prezzoAcquisto: 48.00
  }
];

// SIMULAZIONE RIORDINO

console.log("=== ANALISI NECESSITÀ RIORDINO ===\n");

// Simula giacenze attuali
const giacenzeAttuali = [
  { prodottoId: 1, giacenza: 40 },   // Coca Cola: 40 bottiglie
  { prodottoId: 2, giacenza: 250 },  // Caffè: 250 tazzine (~1.8 kg)
  { prodottoId: 3, giacenza: 80 },   // Birra: 80 bicchieri (~1.1 fusti)
  { prodottoId: 4, giacenza: 45 }    // Vino: 45 calici (1.5 casse)
];

const ordiniDaGenerare = [];

giacenzeAttuali.forEach(g => {
  const config = esempiConfig.find(c => c.prodottoId === g.prodottoId)!;
  const risultato = calcolaRiordino(config, g.giacenza);
  
  console.log(`${config.nome}:`);
  console.log(`- Giacenza: ${g.giacenza} ${config.unitaVendita}`);
  console.log(`- Punto riordino: ${risultato.dettaglio.puntoRiordino || config.puntoRiordino}`);
  console.log(`- Necessita riordino: ${risultato.necessitaRiordino ? 'SÌ' : 'NO'}`);
  
  if (risultato.necessitaRiordino) {
    console.log(`- Da ordinare: ${risultato.quantitaDaOrdinare} ${config.unitaAcquisto}`);
    console.log(`- Equivale a: ${risultato.quantitaDaOrdinare * config.fattoreConversione} ${config.unitaVendita}`);
    console.log(`- Costo ordine: €${(risultato.quantitaDaOrdinare * config.prezzoAcquisto).toFixed(2)}`);
    
    ordiniDaGenerare.push({
      config,
      quantita: risultato.quantitaDaOrdinare,
      motivazione: risultato.motivazione
    });
  }
  
  console.log('');
});

// ANALISI COPERTURA

console.log("=== ANALISI GIORNI COPERTURA ===\n");

giacenzeAttuali.forEach(g => {
  const config = esempiConfig.find(c => c.prodottoId === g.prodottoId)!;
  const giorniCopertura = g.giacenza / config.consumoMedioGiornaliero;
  const alert = giorniCopertura <= config.leadTimeGiorni;
  
  console.log(`${config.nome}: ${giorniCopertura.toFixed(1)} giorni ${alert ? '⚠️ CRITICO' : '✓'}`);
});

// SUGGERIMENTI OTTIMIZZAZIONE

console.log("\n=== OTTIMIZZAZIONE ORDINI ===\n");

console.log("Suggerimenti per ridurre costi:");
console.log("1. Raggruppa ordini stesso fornitore");
console.log("2. Sfrutta sconti quantità");
console.log("3. Considera stagionalità (es. più birra in estate)");
console.log("4. Monitora scadenze per FIFO");
console.log("5. Bilancia costi stoccaggio vs frequenza ordini");

// Export per uso in produzione
export {
  calcolaRiordino,
  ottimizzaQuantitaOrdine,
  generaOrdineFornitore,
  ConfigurazioneProdotto
};