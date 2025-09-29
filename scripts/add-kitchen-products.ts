import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addKitchenProducts() {
  console.log('🍳 Aggiunta prodotti cucina...');

  try {
    // Prima verifichiamo se abbiamo già una categoria Cucina
    let categoriaCucina = await prisma.category.findFirst({
      where: { name: 'Cucina' }
    });

    if (!categoriaCucina) {
      // Creiamo la categoria Cucina
      const maxOrder = await prisma.category.aggregate({
        _max: { order: true }
      });
      
      categoriaCucina = await prisma.category.create({
        data: {
          name: 'Cucina',
          icon: 'utensils',
          order: (maxOrder._max.order || 0) + 10
        }
      });
      console.log('✅ Categoria Cucina creata');
    }

    // Prodotti cucina da aggiungere
    const prodottiCucina = [
      // Antipasti
      { nome: 'Bruschetta Classica', prezzo: 6.00, descrizione: 'Pomodoro fresco, basilico, aglio' },
      { nome: 'Tagliere Misto', prezzo: 15.00, descrizione: 'Salumi e formaggi locali' },
      { nome: 'Caprese', prezzo: 8.00, descrizione: 'Mozzarella di bufala, pomodoro, basilico' },
      { nome: 'Antipasto di Mare', prezzo: 12.00, descrizione: 'Insalata di mare mista' },
      
      // Primi Piatti
      { nome: 'Spaghetti Carbonara', prezzo: 10.00, descrizione: 'Guanciale, pecorino, uovo' },
      { nome: 'Penne Arrabbiata', prezzo: 9.00, descrizione: 'Pomodoro, peperoncino, aglio' },
      { nome: 'Risotto ai Funghi', prezzo: 12.00, descrizione: 'Porcini, parmigiano, burro' },
      { nome: 'Lasagne al Forno', prezzo: 11.00, descrizione: 'Ragù, besciamella, mozzarella' },
      { nome: 'Gnocchi al Pomodoro', prezzo: 9.50, descrizione: 'Gnocchi fatti in casa' },
      
      // Secondi Piatti
      { nome: 'Cotoletta alla Milanese', prezzo: 16.00, descrizione: 'Con patate al forno' },
      { nome: 'Filetto di Manzo', prezzo: 22.00, descrizione: 'Con verdure grigliate' },
      { nome: 'Salmone alla Griglia', prezzo: 18.00, descrizione: 'Con insalata mista' },
      { nome: 'Pollo ai Ferri', prezzo: 14.00, descrizione: 'Con patate arrosto' },
      { nome: 'Frittura Mista', prezzo: 20.00, descrizione: 'Calamari e gamberi' },
      
      // Contorni
      { nome: 'Insalata Mista', prezzo: 5.00, descrizione: 'Verde, pomodori, carote' },
      { nome: 'Patate Fritte', prezzo: 4.50, descrizione: 'Tagliate fresche' },
      { nome: 'Verdure Grigliate', prezzo: 6.00, descrizione: 'Zucchine, melanzane, peperoni' },
      { nome: 'Spinaci Saltati', prezzo: 5.50, descrizione: 'Con aglio e olio' },
      
      // Pizza (anche se preparata in cucina)
      { nome: 'Margherita', prezzo: 7.00, descrizione: 'Pomodoro, mozzarella, basilico' },
      { nome: 'Diavola', prezzo: 8.50, descrizione: 'Pomodoro, mozzarella, salame piccante' },
      { nome: 'Quattro Stagioni', prezzo: 9.50, descrizione: 'Funghi, carciofi, prosciutto, olive' },
      { nome: 'Capricciosa', prezzo: 9.00, descrizione: 'Funghi, prosciutto, carciofi' },
      
      // Panini/Hamburger
      { nome: 'Hamburger Classico', prezzo: 12.00, descrizione: 'Manzo, insalata, pomodoro, salse' },
      { nome: 'Cheeseburger', prezzo: 13.00, descrizione: 'Hamburger con formaggio' },
      { nome: 'Club Sandwich', prezzo: 10.00, descrizione: 'Pollo, bacon, uovo, insalata' }
    ];

    // Aggiungiamo i prodotti
    let count = 0;
    for (const prodotto of prodottiCucina) {
      // Verifica se il prodotto esiste già
      const existing = await prisma.prodotto.findFirst({
        where: { 
          nome: prodotto.nome,
          categoria: 'Cucina'
        }
      });

      if (!existing) {
        await prisma.prodotto.create({
          data: {
            nome: prodotto.nome,
            prezzo: prodotto.prezzo,
            descrizione: prodotto.descrizione,
            categoria: 'Cucina',
            disponibile: true,
            postazione: 'CUCINA', // Importante: destinazione CUCINA
            ordineProdotto: count * 10,
            updatedAt: new Date(),
            Category: {
              connect: { id: categoriaCucina.id }
            }
          }
        });
        console.log(`✅ Aggiunto: ${prodotto.nome}`);
        count++;
      } else {
        // Aggiorna la postazione se necessario
        if (existing.postazione !== 'CUCINA') {
          await prisma.prodotto.update({
            where: { id: existing.id },
            data: { postazione: 'CUCINA' }
          });
          console.log(`📝 Aggiornata postazione per: ${prodotto.nome}`);
        } else {
          console.log(`⏭️  Esiste già: ${prodotto.nome}`);
        }
      }
    }

    console.log(`\n✅ Operazione completata! Aggiunti ${count} nuovi prodotti cucina.`);

    // Mostra il riepilogo
    const totalePerCategoria = await prisma.prodotto.groupBy({
      by: ['postazione'],
      _count: {
        id: true
      },
      where: {
        disponibile: true
      }
    });

    console.log('\n📊 Riepilogo prodotti per postazione:');
    totalePerCategoria.forEach(gruppo => {
      console.log(`${gruppo.postazione}: ${gruppo._count.id} prodotti`);
    });

  } catch (error) {
    console.error('❌ Errore:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Esegui lo script
addKitchenProducts();