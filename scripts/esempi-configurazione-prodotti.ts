// Esempi di configurazione prodotti con conversioni unità di misura

import { PrismaClient } from '@prisma/client';

// Esempi di configurazioni tipiche per diversi tipi di prodotti

// 1. BIBITE - Acquisto in cartoni, vendita in bottiglie
const cocaCola = {
  prodotto: {
    nome: "Coca Cola 33cl",
    categoria: "Bibite",
    prezzo: 3.00, // prezzo vendita singola bottiglia
    postazione: "BANCO"
  },
  prodottoMagazzino: {
    unitaAcquisto: "cartone",
    pezziPerUnita: 24,        // 24 bottiglie per cartone
    codiceFornitore: "CC-33-24",
    stockMinimoMagazzino: 5,  // 5 cartoni = 120 bottiglie
    leadTimeGiorni: 2
  },
  prezzoFornitore: 15.00      // €15 per cartone (€0.625 per bottiglia)
};

// 2. ALCOLICI - Acquisto in bottiglia, vendita a porzioni
const ginBombay = {
  prodotto: {
    nome: "Gin Bombay (porzione)",
    categoria: "Distillati",
    prezzo: 0.50,              // supplemento gin nel cocktail
    postazione: "BANCO",
    isMiscelato: true
  },
  prodottoMagazzino: {
    unitaAcquisto: "bottiglia",
    pezziPerUnita: 1,
    pesoUnitario: 0.7,        // 700ml = 0.7 litri
    codiceFornitore: "BOMB-70CL",
    stockMinimoMagazzino: 6,   // 6 bottiglie
    leadTimeGiorni: 3
  },
  bottiglia: {
    mlBottiglia: 700,
    mlPorzione: 40,            // 40ml per cocktail
    // 700 / 40 = 17.5 porzioni per bottiglia
  },
  prezzoFornitore: 25.00       // €25 per bottiglia (€1.43 per porzione)
};

// 3. CAFFÈ - Acquisto in buste/kg, vendita a tazzine
const caffeMiscela = {
  prodotto: {
    nome: "Caffè Espresso",
    categoria: "Caffetteria",
    prezzo: 1.20,              // prezzo vendita tazzina
    postazione: "BANCO"
  },
  prodottoMagazzino: {
    unitaAcquisto: "kg",
    pezziPerUnita: 1,
    pesoUnitario: 1.0,         // 1 kg
    codiceFornitore: "CAFFE-MISC-1KG",
    stockMinimoMagazzino: 10,  // 10 kg
    leadTimeGiorni: 2,
    temperaturaStoccaggio: "ambiente"
  },
  configurazione: {
    grammaturaPorzione: 7,     // 7g per tazzina
    // 1000g / 7g = 142 caffè per kg
  },
  prezzoFornitore: 15.00       // €15 per kg (€0.105 per tazzina)
};

// 4. BIRRA ALLA SPINA - Acquisto in fusti, vendita a bicchieri
const birraSpina = {
  prodotti: [
    {
      nome: "Birra Piccola 0.2L",
      prezzo: 2.50,
      mlPorzione: 200
    },
    {
      nome: "Birra Media 0.4L", 
      prezzo: 4.00,
      mlPorzione: 400
    },
    {
      nome: "Birra Grande 0.5L",
      prezzo: 5.00,
      mlPorzione: 500
    }
  ],
  prodottoMagazzino: {
    unitaAcquisto: "fusto",
    pezziPerUnita: 1,
    volumeUnitario: 30,        // 30 litri
    codiceFornitore: "BIRRA-FUSTO-30L",
    stockMinimoMagazzino: 2,   // 2 fusti
    leadTimeGiorni: 1,
    temperaturaStoccaggio: "frigo"
  },
  prezzoFornitore: 60.00       // €60 per fusto 30L (€2/litro)
  // Conversioni:
  // 30L = 150 birre piccole (0.2L) - costo €0.40
  // 30L = 75 birre medie (0.4L) - costo €0.80
  // 30L = 60 birre grandi (0.5L) - costo €1.00
};

// 5. SNACK - Acquisto in buste grandi, vendita a porzioni
const patatine = {
  prodotto: {
    nome: "Patatine (porzione)",
    categoria: "Snack",
    prezzo: 2.00,              // prezzo vendita porzione
    postazione: "IMMEDIATO"
  },
  prodottoMagazzino: {
    unitaAcquisto: "busta",
    pezziPerUnita: 1,
    pesoUnitario: 1.0,         // 1 kg
    codiceFornitore: "PAT-1KG",
    stockMinimoMagazzino: 5,   // 5 buste
    leadTimeGiorni: 3
  },
  configurazione: {
    porzioniPerBusta: 20,      // stima 50g a porzione
  },
  prezzoFornitore: 8.00        // €8 per kg (€0.40 per porzione)
};

// 6. VINI - Acquisto in casse, vendita a bottiglia o calice
const vinoRosso = {
  prodotti: [
    {
      nome: "Vino Rosso (bottiglia)",
      prezzo: 18.00,
      mlPorzione: 750            // bottiglia intera
    },
    {
      nome: "Vino Rosso (calice)",
      prezzo: 4.00,
      mlPorzione: 150            // calice da 150ml
    }
  ],
  prodottoMagazzino: {
    unitaAcquisto: "cassa",
    pezziPerUnita: 6,          // 6 bottiglie per cassa
    codiceFornitore: "VINO-ROSSO-6",
    stockMinimoMagazzino: 3,   // 3 casse = 18 bottiglie
    leadTimeGiorni: 7,
    temperaturaStoccaggio: "cantina"
  },
  prezzoFornitore: 48.00       // €48 per cassa (€8 per bottiglia)
  // 1 bottiglia = 5 calici da 150ml
};

// Funzione helper per calcolare margini
function calcolaAnalisiProdotto(config: any) {
  console.log(`\n=== Analisi: ${config.prodotto.nome} ===`);
  
  const costoUnitaAcquisto = config.prezzoFornitore;
  const pezziPerUnita = config.prodottoMagazzino.pezziPerUnita;
  
  // Calcolo costo base
  let costoUnitarioVendita = costoUnitaAcquisto;
  let porzioniPerUnita = pezziPerUnita;
  
  // Gestione conversioni speciali
  if (config.bottiglia) {
    porzioniPerUnita = config.bottiglia.mlBottiglia / config.bottiglia.mlPorzione;
  } else if (config.configurazione?.grammaturaPorzione) {
    porzioniPerUnita = (config.prodottoMagazzino.pesoUnitario * 1000) / config.configurazione.grammaturaPorzione;
  } else if (config.configurazione?.porzioniPerBusta) {
    porzioniPerUnita = config.configurazione.porzioniPerBusta;
  }
  
  const costoPorzione = costoUnitaAcquisto / porzioniPerUnita;
  const prezzoVendita = config.prodotto.prezzo;
  const margine = prezzoVendita - costoPorzione;
  const marginePercentuale = (margine / prezzoVendita) * 100;
  
  console.log(`Acquisto: €${costoUnitaAcquisto} per ${config.prodottoMagazzino.unitaAcquisto}`);
  console.log(`Conversione: 1 ${config.prodottoMagazzino.unitaAcquisto} = ${porzioniPerUnita.toFixed(1)} porzioni`);
  console.log(`Costo porzione: €${costoPorzione.toFixed(3)}`);
  console.log(`Prezzo vendita: €${prezzoVendita.toFixed(2)}`);
  console.log(`Margine: €${margine.toFixed(2)} (${marginePercentuale.toFixed(1)}%)`);
  
  // ROI
  const roi = (margine / costoPorzione) * 100;
  console.log(`ROI: ${roi.toFixed(0)}%`);
}

// Esegui analisi
console.log("=== ANALISI CONVERSIONI E MARGINI ===");

calcolaAnalisiProdotto(cocaCola);

// Gin - analisi corretta per cocktail completo
console.log(`\n=== Analisi: Gin Tonic (cocktail completo) ===`);
const costoGin = 25 / (700/40); // €25 bottiglia / 17.5 porzioni
const costoTonica = 1.50; // 1 bottiglietta
const costoTotale = costoGin + costoTonica;
const prezzoGinTonic = 8.00;
console.log(`Costo gin (40ml): €${costoGin.toFixed(2)}`);
console.log(`Costo tonica: €${costoTonica.toFixed(2)}`);
console.log(`Costo totale: €${costoTotale.toFixed(2)}`);
console.log(`Prezzo vendita: €${prezzoGinTonic.toFixed(2)}`);
console.log(`Margine: €${(prezzoGinTonic - costoTotale).toFixed(2)} (${((prezzoGinTonic - costoTotale) / prezzoGinTonic * 100).toFixed(1)}%)`);

calcolaAnalisiProdotto(caffeMiscela);
calcolaAnalisiProdotto({
  prodotto: birraSpina.prodotti[1], // birra media
  prodottoMagazzino: birraSpina.prodottoMagazzino,
  prezzoFornitore: birraSpina.prezzoFornitore,
  configurazione: { porzioniPerBusta: 75 } // 30L / 0.4L
});
calcolaAnalisiProdotto(patatine);

// Vino - analisi corretta per calice
console.log(`\n=== Analisi: Vino Rosso (calice) ===`);
const costoBottigliaVino = 48 / 6; // €48 cassa / 6 bottiglie
const caliciPerBottiglia = 750 / 150; // 5 calici
const costoCalice = costoBottigliaVino / caliciPerBottiglia;
const prezzoCalice = 4.00;
console.log(`Costo bottiglia: €${costoBottigliaVino.toFixed(2)}`);
console.log(`Calici per bottiglia: ${caliciPerBottiglia}`);
console.log(`Costo calice: €${costoCalice.toFixed(2)}`);
console.log(`Prezzo vendita: €${prezzoCalice.toFixed(2)}`);
console.log(`Margine: €${(prezzoCalice - costoCalice).toFixed(2)} (${((prezzoCalice - costoCalice) / prezzoCalice * 100).toFixed(1)}%)`);
console.log(`ROI: ${((prezzoCalice - costoCalice) / costoCalice * 100).toFixed(0)}%`);

// Script per creare questi prodotti nel database
async function createExampleProducts() {
  const prisma = new PrismaClient();
  
  try {
    console.log("\n\n=== CREAZIONE PRODOTTI ESEMPIO ===");
    
    // Qui andrebbero le create per:
    // 1. Categorie menu
    // 2. Prodotti 
    // 3. ProdottoMagazzino
    // 4. ProdottoFornitore
    // 5. Configurazioni specifiche (bottiglia, etc.)
    
    console.log("Per creare questi prodotti nel database:");
    console.log("1. Completa la migrazione del sistema magazzino");
    console.log("2. Esegui lo script di popolazione dati");
    
  } catch (error) {
    console.error("Errore:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Esporta configurazioni per uso in altri script
export const configurazioni = {
  cocaCola,
  ginBombay,
  caffeMiscela,
  birraSpina,
  patatine,
  vinoRosso
};