const { PrismaClient } = require('@prisma/client');
const { Decimal } = require('@prisma/client/runtime/library');
const prisma = new PrismaClient();

async function fixGinTonic() {
  try {
    // Trova il Gin Tonic
    const ricetta = await prisma.ricettaMiscelata.findFirst({
      where: { nome: 'Gin Tonic' },
      include: { prodotto: true }
    });

    if (!ricetta) {
      console.log('Ricetta Gin Tonic non trovata');
      return;
    }

    console.log('Ricetta trovata:', {
      nome: ricetta.nome,
      prezzoVendita: ricetta.prezzoVendita.toString(),
      margineExtra: ricetta.margineExtra.toString(),
      prodottoPrezzo: ricetta.prodotto?.prezzo.toString()
    });

    // Se è in modalità dinamica (margineExtra > 0), il prezzo del prodotto dovrebbe essere = margineExtra
    if (ricetta.margineExtra.toString() !== '0' && ricetta.prodotto) {
      const nuovoPrezzo = ricetta.margineExtra;
      
      await prisma.prodotto.update({
        where: { id: ricetta.prodotto.id },
        data: {
          prezzo: nuovoPrezzo
        }
      });

      console.log(`\nAggiornato prezzo prodotto da €${ricetta.prodotto.prezzo.toString()} a €${nuovoPrezzo.toString()}`);
    }

  } catch (error) {
    console.error('Errore:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixGinTonic();