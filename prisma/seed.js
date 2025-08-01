const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Dati per i prodotti con prezzi
const prodottiData = [
  // CAFFETTERIA
  { nome: 'Caffè Espresso', prezzo: 1.20, categoria: 'CAFFETTERIA', disponibile: true, postazione: 'BANCO' },
  { nome: 'Caffè Macchiato', prezzo: 1.40, categoria: 'CAFFETTERIA', disponibile: true, postazione: 'BANCO' },
  { nome: 'Cappuccino', prezzo: 1.80, categoria: 'CAFFETTERIA', disponibile: true, postazione: 'BANCO' },
  { nome: 'Caffè Lungo', prezzo: 1.50, categoria: 'CAFFETTERIA', disponibile: true, postazione: 'BANCO' },
  { nome: 'Caffè Americano', prezzo: 2.00, categoria: 'CAFFETTERIA', disponibile: true, postazione: 'BANCO' },
  { nome: 'Caffè Decaffeinato', prezzo: 1.30, categoria: 'CAFFETTERIA', disponibile: true, postazione: 'BANCO' },
  { nome: 'Caffè d\'Orzo', prezzo: 1.40, categoria: 'CAFFETTERIA', disponibile: true, postazione: 'BANCO' },
  { nome: 'Ginseng', prezzo: 1.60, categoria: 'CAFFETTERIA', disponibile: true, postazione: 'BANCO' },
  { nome: 'Marocchino', prezzo: 2.00, categoria: 'CAFFETTERIA', disponibile: true, postazione: 'BANCO' },
  { nome: 'Caffè Corretto', prezzo: 2.50, categoria: 'CAFFETTERIA', disponibile: true, postazione: 'BANCO' },
  { nome: 'Latte Macchiato', prezzo: 2.20, categoria: 'CAFFETTERIA', disponibile: true, postazione: 'BANCO' },
  { nome: 'Cioccolata Calda', prezzo: 3.50, categoria: 'CAFFETTERIA', disponibile: true, postazione: 'BANCO' },
  { nome: 'Tè Caldo', prezzo: 2.00, categoria: 'CAFFETTERIA', disponibile: true, postazione: 'BANCO' },
  { nome: 'Camomilla', prezzo: 2.00, categoria: 'CAFFETTERIA', disponibile: true, postazione: 'BANCO' },
  { nome: 'Tisana', prezzo: 2.20, categoria: 'CAFFETTERIA', disponibile: true, postazione: 'BANCO' },

  // APERITIVI
  { nome: 'Aperol Spritz', prezzo: 6.00, categoria: 'APERITIVI', disponibile: true, postazione: 'BANCO' },
  { nome: 'Campari Spritz', prezzo: 6.00, categoria: 'APERITIVI', disponibile: true, postazione: 'BANCO' },
  { nome: 'Hugo', prezzo: 6.50, categoria: 'APERITIVI', disponibile: true, postazione: 'BANCO' },
  { nome: 'Negroni', prezzo: 7.00, categoria: 'APERITIVI', disponibile: true, postazione: 'BANCO' },
  { nome: 'Americano', prezzo: 6.00, categoria: 'APERITIVI', disponibile: true, postazione: 'BANCO' },
  { nome: 'Sbagliato', prezzo: 6.50, categoria: 'APERITIVI', disponibile: true, postazione: 'BANCO' },
  { nome: 'Campari Soda', prezzo: 4.50, categoria: 'APERITIVI', disponibile: true, postazione: 'BANCO' },
  { nome: 'Aperol Soda', prezzo: 4.50, categoria: 'APERITIVI', disponibile: true, postazione: 'BANCO' },
  { nome: 'Crodino', prezzo: 3.50, categoria: 'APERITIVI', disponibile: true, postazione: 'BANCO' },
  { nome: 'Aperitivo Analcolico', prezzo: 4.00, categoria: 'APERITIVI', disponibile: true, postazione: 'BANCO' },

  // COCKTAIL
  { nome: 'Mojito', prezzo: 8.00, categoria: 'COCKTAIL', disponibile: true, postazione: 'BANCO' },
  { nome: 'Cuba Libre', prezzo: 7.00, categoria: 'COCKTAIL', disponibile: true, postazione: 'BANCO' },
  { nome: 'Long Island', prezzo: 9.00, categoria: 'COCKTAIL', disponibile: true, postazione: 'BANCO' },
  { nome: 'Margarita', prezzo: 8.00, categoria: 'COCKTAIL', disponibile: true, postazione: 'BANCO' },
  { nome: 'Daiquiri', prezzo: 7.50, categoria: 'COCKTAIL', disponibile: true, postazione: 'BANCO' },
  { nome: 'Cosmopolitan', prezzo: 8.00, categoria: 'COCKTAIL', disponibile: true, postazione: 'BANCO' },
  { nome: 'Manhattan', prezzo: 8.50, categoria: 'COCKTAIL', disponibile: true, postazione: 'BANCO' },
  { nome: 'Old Fashioned', prezzo: 9.00, categoria: 'COCKTAIL', disponibile: true, postazione: 'BANCO' },
  { nome: 'Whisky Sour', prezzo: 8.00, categoria: 'COCKTAIL', disponibile: true, postazione: 'BANCO' },
  { nome: 'Pina Colada', prezzo: 8.50, categoria: 'COCKTAIL', disponibile: true, postazione: 'BANCO' },
  { nome: 'Caipirinha', prezzo: 7.50, categoria: 'COCKTAIL', disponibile: true, postazione: 'BANCO' },
  { nome: 'Sex on the Beach', prezzo: 8.00, categoria: 'COCKTAIL', disponibile: true, postazione: 'BANCO' },
  { nome: 'Moscow Mule', prezzo: 8.00, categoria: 'COCKTAIL', disponibile: true, postazione: 'BANCO' },
  { nome: 'Gin Tonic', prezzo: 7.00, categoria: 'COCKTAIL', disponibile: true, postazione: 'BANCO' },
  { nome: 'Gin Fizz', prezzo: 7.50, categoria: 'COCKTAIL', disponibile: true, postazione: 'BANCO' },

  // BIRRE
  { nome: 'Birra Piccola 0.2L', prezzo: 2.50, categoria: 'BIRRE', disponibile: true, postazione: 'BANCO' },
  { nome: 'Birra Media 0.4L', prezzo: 4.50, categoria: 'BIRRE', disponibile: true, postazione: 'BANCO' },
  { nome: 'Birra Grande 0.5L', prezzo: 5.50, categoria: 'BIRRE', disponibile: true, postazione: 'BANCO' },
  { nome: 'Birra Bottiglia 0.33L', prezzo: 3.50, categoria: 'BIRRE', disponibile: true, postazione: 'BANCO' },
  { nome: 'Birra Artigianale 0.33L', prezzo: 5.00, categoria: 'BIRRE', disponibile: true, postazione: 'BANCO' },
  { nome: 'Birra Weiss 0.5L', prezzo: 6.00, categoria: 'BIRRE', disponibile: true, postazione: 'BANCO' },
  { nome: 'Birra Rossa 0.5L', prezzo: 6.00, categoria: 'BIRRE', disponibile: true, postazione: 'BANCO' },
  { nome: 'Birra IPA 0.33L', prezzo: 5.50, categoria: 'BIRRE', disponibile: true, postazione: 'BANCO' },
  { nome: 'Birra Analcolica', prezzo: 3.00, categoria: 'BIRRE', disponibile: true, postazione: 'BANCO' },
  { nome: 'Radler', prezzo: 4.00, categoria: 'BIRRE', disponibile: true, postazione: 'BANCO' },

  // ALCOLICI
  { nome: 'Grappa', prezzo: 3.50, categoria: 'ALCOLICI', disponibile: true, postazione: 'BANCO' },
  { nome: 'Amaro', prezzo: 3.50, categoria: 'ALCOLICI', disponibile: true, postazione: 'BANCO' },
  { nome: 'Whisky', prezzo: 5.00, categoria: 'ALCOLICI', disponibile: true, postazione: 'BANCO' },
  { nome: 'Rum', prezzo: 4.50, categoria: 'ALCOLICI', disponibile: true, postazione: 'BANCO' },
  { nome: 'Vodka', prezzo: 4.00, categoria: 'ALCOLICI', disponibile: true, postazione: 'BANCO' },
  { nome: 'Gin', prezzo: 4.50, categoria: 'ALCOLICI', disponibile: true, postazione: 'BANCO' },
  { nome: 'Tequila', prezzo: 4.50, categoria: 'ALCOLICI', disponibile: true, postazione: 'BANCO' },
  { nome: 'Sambuca', prezzo: 3.50, categoria: 'ALCOLICI', disponibile: true, postazione: 'BANCO' },
  { nome: 'Limoncello', prezzo: 3.00, categoria: 'ALCOLICI', disponibile: true, postazione: 'BANCO' },
  { nome: 'Baileys', prezzo: 4.00, categoria: 'ALCOLICI', disponibile: true, postazione: 'BANCO' },
  { nome: 'Jagermeister', prezzo: 4.00, categoria: 'ALCOLICI', disponibile: true, postazione: 'BANCO' },
  { nome: 'Brandy', prezzo: 4.50, categoria: 'ALCOLICI', disponibile: true, postazione: 'BANCO' },
  { nome: 'Cognac', prezzo: 6.00, categoria: 'ALCOLICI', disponibile: true, postazione: 'BANCO' },

  // BIBITE
  { nome: 'Coca Cola', prezzo: 3.00, categoria: 'BIBITE', disponibile: true, postazione: 'BANCO' },
  { nome: 'Coca Cola Zero', prezzo: 3.00, categoria: 'BIBITE', disponibile: true, postazione: 'BANCO' },
  { nome: 'Fanta', prezzo: 3.00, categoria: 'BIBITE', disponibile: true, postazione: 'BANCO' },
  { nome: 'Sprite', prezzo: 3.00, categoria: 'BIBITE', disponibile: true, postazione: 'BANCO' },
  { nome: 'Tè Freddo', prezzo: 3.00, categoria: 'BIBITE', disponibile: true, postazione: 'BANCO' },
  { nome: 'Succo di Frutta', prezzo: 3.00, categoria: 'BIBITE', disponibile: true, postazione: 'BANCO' },
  { nome: 'Acqua Naturale 0.5L', prezzo: 1.50, categoria: 'BIBITE', disponibile: true, postazione: 'BANCO' },
  { nome: 'Acqua Frizzante 0.5L', prezzo: 1.50, categoria: 'BIBITE', disponibile: true, postazione: 'BANCO' },
  { nome: 'Acqua Tonica', prezzo: 3.00, categoria: 'BIBITE', disponibile: true, postazione: 'BANCO' },
  { nome: 'Ginger Beer', prezzo: 3.50, categoria: 'BIBITE', disponibile: true, postazione: 'BANCO' },
  { nome: 'Red Bull', prezzo: 4.00, categoria: 'BIBITE', disponibile: true, postazione: 'BANCO' },
  { nome: 'Limonata', prezzo: 3.00, categoria: 'BIBITE', disponibile: true, postazione: 'BANCO' },
  { nome: 'Aranciata', prezzo: 3.00, categoria: 'BIBITE', disponibile: true, postazione: 'BANCO' },
  { nome: 'Chinotto', prezzo: 3.00, categoria: 'BIBITE', disponibile: true, postazione: 'BANCO' },

  // PANINI
  { nome: 'Panino Prosciutto e Formaggio', prezzo: 5.00, categoria: 'PANINI', disponibile: true, postazione: 'CUCINA' },
  { nome: 'Panino Salame', prezzo: 4.50, categoria: 'PANINI', disponibile: true, postazione: 'CUCINA' },
  { nome: 'Panino Mortadella', prezzo: 4.50, categoria: 'PANINI', disponibile: true, postazione: 'CUCINA' },
  { nome: 'Panino Bresaola', prezzo: 6.00, categoria: 'PANINI', disponibile: true, postazione: 'CUCINA' },
  { nome: 'Panino Crudo', prezzo: 6.50, categoria: 'PANINI', disponibile: true, postazione: 'CUCINA' },
  { nome: 'Panino Cotto', prezzo: 5.00, categoria: 'PANINI', disponibile: true, postazione: 'CUCINA' },
  { nome: 'Panino Tonno', prezzo: 5.50, categoria: 'PANINI', disponibile: true, postazione: 'CUCINA' },
  { nome: 'Panino Vegetariano', prezzo: 5.00, categoria: 'PANINI', disponibile: true, postazione: 'CUCINA' },
  { nome: 'Panino Caprese', prezzo: 5.50, categoria: 'PANINI', disponibile: true, postazione: 'CUCINA' },
  { nome: 'Toast', prezzo: 4.00, categoria: 'PANINI', disponibile: true, postazione: 'CUCINA' },
  { nome: 'Tramezzino', prezzo: 3.50, categoria: 'PANINI', disponibile: true, postazione: 'CUCINA' },
  { nome: 'Piadina Classica', prezzo: 6.00, categoria: 'PANINI', disponibile: true, postazione: 'CUCINA' },
  { nome: 'Piadina Vegetariana', prezzo: 5.50, categoria: 'PANINI', disponibile: true, postazione: 'CUCINA' },
  { nome: 'Focaccia Farcita', prezzo: 5.50, categoria: 'PANINI', disponibile: true, postazione: 'CUCINA' },
  { nome: 'Club Sandwich', prezzo: 7.00, categoria: 'PANINI', disponibile: true, postazione: 'CUCINA' },

  // GELATI
  { nome: 'Gelato 1 Gusto', prezzo: 2.50, categoria: 'GELATI', disponibile: true, postazione: 'BANCO' },
  { nome: 'Gelato 2 Gusti', prezzo: 3.50, categoria: 'GELATI', disponibile: true, postazione: 'BANCO' },
  { nome: 'Gelato 3 Gusti', prezzo: 4.50, categoria: 'GELATI', disponibile: true, postazione: 'BANCO' },
  { nome: 'Cono Piccolo', prezzo: 3.00, categoria: 'GELATI', disponibile: true, postazione: 'BANCO' },
  { nome: 'Cono Medio', prezzo: 4.00, categoria: 'GELATI', disponibile: true, postazione: 'BANCO' },
  { nome: 'Cono Grande', prezzo: 5.00, categoria: 'GELATI', disponibile: true, postazione: 'BANCO' },
  { nome: 'Coppa Piccola', prezzo: 3.50, categoria: 'GELATI', disponibile: true, postazione: 'BANCO' },
  { nome: 'Coppa Media', prezzo: 4.50, categoria: 'GELATI', disponibile: true, postazione: 'BANCO' },
  { nome: 'Coppa Grande', prezzo: 5.50, categoria: 'GELATI', disponibile: true, postazione: 'BANCO' },
  { nome: 'Affogato al Caffè', prezzo: 4.50, categoria: 'GELATI', disponibile: true, postazione: 'BANCO' },
  { nome: 'Granita', prezzo: 3.00, categoria: 'GELATI', disponibile: true, postazione: 'BANCO' },
  { nome: 'Sorbetto', prezzo: 3.50, categoria: 'GELATI', disponibile: true, postazione: 'BANCO' },
  { nome: 'Gelato con Panna', prezzo: 0.50, categoria: 'GELATI', disponibile: true, postazione: 'BANCO' },
];

async function main() {
  console.log('🌱 Inizio seed dei prodotti con prezzi...');
  
  // Trova il codice più alto esistente
  const maxCodice = await prisma.prodotto.findFirst({
    orderBy: { codice: 'desc' },
    select: { codice: true },
  });
  
  let codice = (maxCodice?.codice || 999) + 1;
  
  // Inserisce i nuovi prodotti
  let inseriti = 0;
  for (const prodotto of prodottiData) {
    // Controlla se il prodotto esiste già
    const exists = await prisma.prodotto.findFirst({
      where: { nome: prodotto.nome },
    });
    
    if (!exists) {
      await prisma.prodotto.create({
        data: {
          ...prodotto,
          codice: codice++,
          ordineProdotto: codice - 1000,
        },
      });
      inseriti++;
    }
  }
  
  console.log(`✅ Inseriti ${inseriti} nuovi prodotti (${prodottiData.length - inseriti} già esistenti)`);
  
  // Verifica conteggio per categoria
  const categorie = ['CAFFETTERIA', 'APERITIVI', 'COCKTAIL', 'BIRRE', 'ALCOLICI', 'BIBITE', 'PANINI', 'GELATI'];
  
  for (const categoria of categorie) {
    const count = await prisma.prodotto.count({
      where: { categoria },
    });
    console.log(`📊 ${categoria}: ${count} prodotti`);
  }
  
  // Mostra alcuni esempi di prezzi
  console.log('\n💰 Esempi di prezzi:');
  const esempi = await prisma.prodotto.findMany({
    take: 10,
    orderBy: { codice: 'asc' },
  });
  
  esempi.forEach(p => {
    console.log(`- ${p.nome}: €${p.prezzo}`);
  });
}

main()
  .catch((e) => {
    console.error('❌ Errore durante il seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });