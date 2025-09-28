import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkProdotti() {
  try {
    const totalProdotti = await prisma.prodotto.count();
    const prodottiAttivi = await prisma.prodotto.count({ where: { isDeleted: false } });
    const prodottiDisponibili = await prisma.prodotto.count({ where: { disponibile: true } });
    
    console.log('Totale prodotti:', totalProdotti);
    console.log('Prodotti attivi (non cancellati):', prodottiAttivi);
    console.log('Prodotti disponibili:', prodottiDisponibili);
    
    const primoProdotto = await prisma.prodotto.findFirst();
    console.log('\nPrimo prodotto:', primoProdotto);
  } catch (error) {
    console.error('Errore:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkProdotti();