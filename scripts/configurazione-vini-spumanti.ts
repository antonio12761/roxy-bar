// Configurazione specifica per vini e spumanti
// che possono essere venduti sia a bottiglia che a bicchiere/calice

import { UnitaAcquisto, UnitaVendita, UnitaMisuraContenuto } from '@prisma/client';

// CONFIGURAZIONE VINI

// 1. VINO ROSSO DELLA CASA
const vinoRossoCasa = {
  // Prodotti di vendita (2 varianti dello stesso vino)
  prodotti: [
    {
      nome: "Vino Rosso Casa (bottiglia)",
      categoria: "Vini",
      prezzo: 18.00,
      codice: "VINO-ROSSO-BTG"
    },
    {
      nome: "Vino Rosso Casa (calice)",
      categoria: "Vini", 
      prezzo: 4.00,
      codice: "VINO-ROSSO-CAL"
    }
  ],
  
  // Configurazione acquisto
  acquisto: {
    unitaAcquisto: UnitaAcquisto.CASSA,
    quantitaAcquisto: 1,
    contenutoAcquisto: 6,                    // 6 bottiglie per cassa
    unitaMisuraContenuto: UnitaMisuraContenuto.PEZZI,
    prezzoAcquisto: 48.00                    // €48 per cassa (€8/bottiglia)
  },
  
  // Configurazioni vendita
  conversioni: [
    {
      // Vendita bottiglia intera
      unitaVendita: UnitaVendita.BOTTIGLIA,
      quantitaVendita: 1,                    // 1 bottiglia
      fattoreConversione: 6,                 // 1 cassa = 6 bottiglie
      margineBottiglia: 10.00                // €18 vendita - €8 costo = €10 margine (55%)
    },
    {
      // Vendita a calice
      unitaVendita: UnitaVendita.CALICE,
      quantitaVendita: 0.15,                 // 150ml per calice
      mlBottiglia: 0.75,                     // 750ml per bottiglia
      caliciPerBottiglia: 5,                 // 750ml / 150ml = 5 calici
      fattoreConversione: 30,                // 1 cassa = 6 bottiglie × 5 calici = 30 calici
      margineCalice: 2.40                    // €4 vendita - €1.60 costo = €2.40 margine (60%)
    }
  ]
};

// 2. PROSECCO DOC
const proseccoDOC = {
  prodotti: [
    {
      nome: "Prosecco DOC (bottiglia)",
      categoria: "Spumanti",
      prezzo: 22.00,
      codice: "PROSECCO-DOC-BTG"
    },
    {
      nome: "Prosecco DOC (flûte)",
      categoria: "Spumanti",
      prezzo: 4.50,
      codice: "PROSECCO-DOC-FLUTE"
    }
  ],
  
  acquisto: {
    unitaAcquisto: UnitaAcquisto.CASSA,
    quantitaAcquisto: 1,
    contenutoAcquisto: 6,
    unitaMisuraContenuto: UnitaMisuraContenuto.PEZZI,
    prezzoAcquisto: 60.00                    // €60 per cassa (€10/bottiglia)
  },
  
  conversioni: [
    {
      unitaVendita: UnitaVendita.BOTTIGLIA,
      quantitaVendita: 1,
      fattoreConversione: 6,
      margineBottiglia: 12.00                // €22 vendita - €10 costo
    },
    {
      unitaVendita: UnitaVendita.FLUTE,
      quantitaVendita: 0.10,                 // 100ml per flûte
      mlBottiglia: 0.75,
      flutePerBottiglia: 7.5,                // 750ml / 100ml = 7.5 flûte
      fattoreConversione: 45,                // 1 cassa = 6 × 7.5 = 45 flûte
      margineFlute: 3.17                     // €4.50 vendita - €1.33 costo
    }
  ]
};

// 3. CHAMPAGNE
const champagne = {
  prodotti: [
    {
      nome: "Champagne Moët (bottiglia)",
      categoria: "Champagne",
      prezzo: 80.00,
      codice: "MOET-BTG"
    },
    {
      nome: "Champagne Moët (flûte)", 
      categoria: "Champagne",
      prezzo: 12.00,
      codice: "MOET-FLUTE"
    }
  ],
  
  acquisto: {
    unitaAcquisto: UnitaAcquisto.BOTTIGLIA,  // Acquisto singolo, non in cassa
    quantitaAcquisto: 1,
    contenutoAcquisto: 750,                  // 750ml
    unitaMisuraContenuto: UnitaMisuraContenuto.ML,
    prezzoAcquisto: 45.00                    // €45 per bottiglia
  },
  
  conversioni: [
    {
      unitaVendita: UnitaVendita.BOTTIGLIA,
      quantitaVendita: 1,
      fattoreConversione: 1,
      margineBottiglia: 35.00                // €80 vendita - €45 costo
    },
    {
      unitaVendita: UnitaVendita.FLUTE,
      quantitaVendita: 100,                  // 100ml per flûte
      fattoreConversione: 7.5,               // 750ml / 100ml = 7.5 flûte
      margineFlute: 6.00                     // €12 vendita - €6 costo
    }
  ]
};

// 4. VINO BIANCO IN CARAFFA
const vinoBiancoCaraffa = {
  prodotti: [
    {
      nome: "Vino Bianco Casa (1L)",
      categoria: "Vini",
      prezzo: 12.00,
      codice: "VINO-BIANCO-1L"
    },
    {
      nome: "Vino Bianco Casa (0.5L)",
      categoria: "Vini",
      prezzo: 7.00,
      codice: "VINO-BIANCO-05L"
    },
    {
      nome: "Vino Bianco Casa (0.25L)",
      categoria: "Vini",
      prezzo: 4.00,
      codice: "VINO-BIANCO-025L"
    }
  ],
  
  acquisto: {
    unitaAcquisto: UnitaAcquisto.TANICA,     // Vino sfuso in tanica
    quantitaAcquisto: 1,
    contenutoAcquisto: 10,                   // 10 litri
    unitaMisuraContenuto: UnitaMisuraContenuto.LITRI,
    prezzoAcquisto: 25.00                    // €25 per 10L (€2.50/litro)
  },
  
  conversioni: [
    {
      unitaVendita: UnitaVendita.PORZIONE,   // Caraffa 1L
      quantitaVendita: 1,
      fattoreConversione: 10,
      margine1L: 9.50                        // €12 vendita - €2.50 costo
    },
    {
      unitaVendita: UnitaVendita.PORZIONE,   // Caraffa 0.5L
      quantitaVendita: 0.5,
      fattoreConversione: 20,
      margine05L: 5.75                       // €7 vendita - €1.25 costo
    },
    {
      unitaVendita: UnitaVendita.PORZIONE,   // Caraffa 0.25L
      quantitaVendita: 0.25,
      fattoreConversione: 40,
      margine025L: 3.375                     // €4 vendita - €0.625 costo
    }
  ]
};

// FUNZIONI DI GESTIONE

/**
 * Calcola il consumo di vino quando si vende a bicchiere
 */
function calcolaConsumoVino(tipoVendita: 'BOTTIGLIA' | 'CALICE', quantita: number) {
  if (tipoVendita === 'BOTTIGLIA') {
    // Vendita bottiglia intera: scarica 1 bottiglia dall'inventario
    return {
      consumoBottiglie: quantita,
      consumoCasse: quantita / 6  // Se tracciamo anche in casse
    };
  } else {
    // Vendita a calice: calcola quante bottiglie consumate
    const caliciPerBottiglia = 5;  // 750ml / 150ml
    return {
      consumoBottiglie: quantita / caliciPerBottiglia,
      consumoCasse: quantita / (caliciPerBottiglia * 6)
    };
  }
}

/**
 * Gestisce l'apertura di una bottiglia per servizio al calice
 */
function registraAperturaBottiglia(prodottoId: number, ubicazioneId: number) {
  // Quando si apre una bottiglia per servire a calice:
  // 1. Scarica 1 bottiglia dall'inventario bottiglie chiuse
  // 2. Crea un "inventario temporaneo" per la bottiglia aperta
  // 3. Traccia quanti calici rimangono disponibili
  
  return {
    bottigliaAperta: {
      prodottoId,
      ubicazioneId,
      mlRimanenti: 750,
      caliciDisponibili: 5,
      dataApertura: new Date(),
      scadenzaConsigliata: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 giorni
    }
  };
}

/**
 * Analisi margini per doppia vendita (bottiglia + calice)
 */
function analisiMargineMisto(venditeMese: any) {
  // Esempio dati vendite mensili
  const venditeBottiglie = 20;  // 20 bottiglie intere
  const venditeCalici = 150;    // 150 calici
  
  // Calcolo consumo totale
  const bottigliePerCalici = venditeCalici / 5;  // 30 bottiglie
  const bottiglieTotali = venditeBottiglie + bottigliePerCalici;  // 50 bottiglie
  const casseTotali = bottiglieTotali / 6;  // 8.33 casse
  
  // Calcolo ricavi
  const ricaviBottiglie = venditeBottiglie * 18;  // €360
  const ricaviCalici = venditeCalici * 4;         // €600
  const ricaviTotali = ricaviBottiglie + ricaviCalici;  // €960
  
  // Calcolo costi
  const costoPerBottiglia = 8;  // €48 cassa / 6
  const costoTotale = bottiglieTotali * costoPerBottiglia;  // €400
  
  // Analisi
  return {
    consumo: {
      bottiglieTotali,
      casseTotali: casseTotali.toFixed(1),
      dettaglio: {
        bottglieIntere: venditeBottiglie,
        bottigliePerCalici: bottigliePerCalici
      }
    },
    economico: {
      ricaviTotali,
      costoTotale,
      margine: ricaviTotali - costoTotale,
      marginePercentuale: ((ricaviTotali - costoTotale) / ricaviTotali * 100).toFixed(1),
      ricavoMedioBottiglia: (ricaviTotali / bottiglieTotali).toFixed(2)
    },
    performance: {
      percentualeBottiglie: (ricaviBottiglie / ricaviTotali * 100).toFixed(1),
      percentualeCalici: (ricaviCalici / ricaviTotali * 100).toFixed(1),
      margineBottiglie: ((18 - 8) / 18 * 100).toFixed(1),
      margineCalici: ((4 - 1.6) / 4 * 100).toFixed(1)
    }
  };
}

// REPORT ESEMPIO
console.log("=== ANALISI VENDITE VINO ===");
console.log("\nEsempio mensile:");
const analisi = analisiMargineMisto({});
console.log(analisi);

console.log("\n=== GESTIONE BOTTIGLIE APERTE ===");
console.log("Best practices:");
console.log("1. Registrare apertura bottiglia con data/ora");
console.log("2. Tracciare consumo progressivo (calici serviti)");
console.log("3. Alert per bottiglie aperte da >3 giorni");
console.log("4. Inventario separato per bottiglie aperte/chiuse");
console.log("5. FIFO rigoroso per minimizzare sprechi");

// Export configurazioni
export const configurazioniVini = {
  vinoRossoCasa,
  proseccoDOC,
  champagne,
  vinoBiancoCaraffa,
  utils: {
    calcolaConsumoVino,
    registraAperturaBottiglia,
    analisiMargineMisto
  }
};