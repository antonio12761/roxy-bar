import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkProdottiData() {
  try {
    console.log('=== Verifica dati Prodotti ===\n');
    
    // Conta totale prodotti
    const prodottiCount = await prisma.prodotto.count();
    console.log(`Totale prodotti nel database: ${prodottiCount}`);
    
    // Conta prodotti attivi
    const prodottiAttivi = await prisma.prodotto.count({
      where: { attivo: true }
    });
    console.log(`Prodotti attivi: ${prodottiAttivi}`);
    
    // Conta prodotti disponibili
    const prodottiDisponibili = await prisma.prodotto.count({
      where: { 
        attivo: true,
        disponibile: true
      }
    });
    console.log(`Prodotti disponibili: ${prodottiDisponibili}`);
    
    // Mostra categorie con conteggio prodotti
    const categorie = await prisma.categoria.findMany({
      where: { attiva: true },
      include: {
        _count: {
          select: { Prodotto: true }
        }
      },
      orderBy: { ordinamento: 'asc' }
    });
    
    console.log(`\nCategorie attive: ${categorie.length}`);
    categorie.forEach(cat => {
      console.log(`- ${cat.nome} (ID: ${cat.id}, Prodotti: ${cat._count.Prodotto})`);
    });
    
    // Se non ci sono prodotti, crea alcuni esempi
    if (prodottiCount === 0) {
      console.log('\n\n=== Creazione dati di esempio ===\n');
      
      // Crea categorie di base
      const catCaffe = await prisma.categoria.create({
        data: {
          nome: 'Caffetteria',
          descrizione: 'Caffè, cappuccini e bevande calde',
          colore: '#8B4513',
          icona: 'Coffee',
          ordinamento: 1,
          attiva: true
        }
      });
      console.log('✓ Categoria "Caffetteria" creata');
      
      const catBibite = await prisma.categoria.create({
        data: {
          nome: 'Bibite',
          descrizione: 'Bibite, succhi e bevande fredde',
          colore: '#4169E1',
          icona: 'GlassWater',
          ordinamento: 2,
          attiva: true
        }
      });
      console.log('✓ Categoria "Bibite" creata');
      
      const catPanini = await prisma.categoria.create({
        data: {
          nome: 'Panini',
          descrizione: 'Panini, toast e tramezzini',
          colore: '#FF8C00',
          icona: 'Sandwich',
          ordinamento: 3,
          attiva: true
        }
      });
      console.log('✓ Categoria "Panini" creata');
      
      const catDolci = await prisma.categoria.create({
        data: {
          nome: 'Dolci',
          descrizione: 'Cornetti, brioche e pasticceria',
          colore: '#FF69B4',
          icona: 'Cake',
          ordinamento: 4,
          attiva: true
        }
      });
      console.log('✓ Categoria "Dolci" creata');
      
      const catBirre = await prisma.categoria.create({
        data: {
          nome: 'Birre',
          descrizione: 'Birre alla spina e in bottiglia',
          colore: '#FFD700',
          icona: 'Beer',
          ordinamento: 5,
          attiva: true
        }
      });
      console.log('✓ Categoria "Birre" creata');
      
      // Crea prodotti per ogni categoria
      // Caffetteria
      const prodottiCaffe = [
        { nome: 'Caffè', prezzo: 1.20, destinazione: 'BANCO' },
        { nome: 'Caffè Decaffeinato', prezzo: 1.30, destinazione: 'BANCO' },
        { nome: 'Cappuccino', prezzo: 1.80, destinazione: 'BANCO' },
        { nome: 'Caffè Macchiato', prezzo: 1.40, destinazione: 'BANCO' },
        { nome: 'Latte Macchiato', prezzo: 2.00, destinazione: 'BANCO' },
        { nome: 'Tè', prezzo: 2.50, destinazione: 'BANCO' },
        { nome: 'Cioccolata Calda', prezzo: 3.00, destinazione: 'BANCO' }
      ];
      
      for (const prod of prodottiCaffe) {
        await prisma.prodotto.create({
          data: {
            ...prod,
            categoriaId: catCaffe.id,
            disponibile: true,
            attivo: true,
            ordinamento: 0
          }
        });
      }
      console.log(`✓ ${prodottiCaffe.length} prodotti creati per Caffetteria`);
      
      // Bibite
      const prodottiBibite = [
        { nome: 'Acqua Naturale 0.5L', prezzo: 1.50, destinazione: 'BANCO' },
        { nome: 'Acqua Frizzante 0.5L', prezzo: 1.50, destinazione: 'BANCO' },
        { nome: 'Coca Cola', prezzo: 3.00, destinazione: 'BANCO' },
        { nome: 'Fanta', prezzo: 3.00, destinazione: 'BANCO' },
        { nome: 'Sprite', prezzo: 3.00, destinazione: 'BANCO' },
        { nome: 'Succo di Frutta', prezzo: 2.50, destinazione: 'BANCO' },
        { nome: 'Red Bull', prezzo: 4.00, destinazione: 'BANCO' }
      ];
      
      for (const prod of prodottiBibite) {
        await prisma.prodotto.create({
          data: {
            ...prod,
            categoriaId: catBibite.id,
            disponibile: true,
            attivo: true,
            ordinamento: 0
          }
        });
      }
      console.log(`✓ ${prodottiBibite.length} prodotti creati per Bibite`);
      
      // Panini
      const prodottiPanini = [
        { nome: 'Panino Prosciutto e Formaggio', prezzo: 4.50, destinazione: 'CUCINA' },
        { nome: 'Panino Vegetariano', prezzo: 4.00, destinazione: 'CUCINA' },
        { nome: 'Toast Prosciutto e Formaggio', prezzo: 3.50, destinazione: 'CUCINA' },
        { nome: 'Tramezzino Tonno', prezzo: 3.00, destinazione: 'CUCINA' },
        { nome: 'Tramezzino Prosciutto', prezzo: 3.00, destinazione: 'CUCINA' },
        { nome: 'Piadina Crudo e Squacquerone', prezzo: 5.50, destinazione: 'CUCINA' },
        { nome: 'Focaccia Farcita', prezzo: 5.00, destinazione: 'CUCINA' }
      ];
      
      for (const prod of prodottiPanini) {
        await prisma.prodotto.create({
          data: {
            ...prod,
            categoriaId: catPanini.id,
            disponibile: true,
            attivo: true,
            ordinamento: 0
          }
        });
      }
      console.log(`✓ ${prodottiPanini.length} prodotti creati per Panini`);
      
      // Dolci
      const prodottiDolci = [
        { nome: 'Cornetto Vuoto', prezzo: 1.50, destinazione: 'BANCO' },
        { nome: 'Cornetto Crema', prezzo: 1.80, destinazione: 'BANCO' },
        { nome: 'Cornetto Cioccolato', prezzo: 1.80, destinazione: 'BANCO' },
        { nome: 'Cornetto Marmellata', prezzo: 1.80, destinazione: 'BANCO' },
        { nome: 'Brioche', prezzo: 1.50, destinazione: 'BANCO' },
        { nome: 'Muffin', prezzo: 2.50, destinazione: 'BANCO' },
        { nome: 'Tiramisù', prezzo: 4.00, destinazione: 'BANCO' }
      ];
      
      for (const prod of prodottiDolci) {
        await prisma.prodotto.create({
          data: {
            ...prod,
            categoriaId: catDolci.id,
            disponibile: true,
            attivo: true,
            ordinamento: 0
          }
        });
      }
      console.log(`✓ ${prodottiDolci.length} prodotti creati per Dolci`);
      
      // Birre
      const prodottiBirre = [
        { nome: 'Birra Piccola 0.2L', prezzo: 2.50, destinazione: 'BANCO' },
        { nome: 'Birra Media 0.4L', prezzo: 4.00, destinazione: 'BANCO' },
        { nome: 'Birra Grande 0.5L', prezzo: 5.00, destinazione: 'BANCO' },
        { nome: 'Birra Weiss 0.5L', prezzo: 5.50, destinazione: 'BANCO' },
        { nome: 'Birra Rossa 0.5L', prezzo: 5.50, destinazione: 'BANCO' },
        { nome: 'Corona', prezzo: 4.50, destinazione: 'BANCO' },
        { nome: 'Heineken', prezzo: 4.00, destinazione: 'BANCO' }
      ];
      
      for (const prod of prodottiBirre) {
        await prisma.prodotto.create({
          data: {
            ...prod,
            categoriaId: catBirre.id,
            disponibile: true,
            attivo: true,
            ordinamento: 0
          }
        });
      }
      console.log(`✓ ${prodottiBirre.length} prodotti creati per Birre`);
      
      console.log('\nDati di esempio creati con successo!');
      console.log(`Totale prodotti creati: ${prodottiCaffe.length + prodottiBibite.length + prodottiPanini.length + prodottiDolci.length + prodottiBirre.length}`);
    } else {
      // Mostra alcuni prodotti di esempio
      console.log('\n=== Alcuni prodotti nel database ===');
      const sampleProdotti = await prisma.prodotto.findMany({
        take: 10,
        where: { attivo: true },
        include: {
          Categoria: true
        },
        orderBy: { nome: 'asc' }
      });
      
      sampleProdotti.forEach(prod => {
        console.log(`- ${prod.nome} (€${prod.prezzo.toFixed(2)}) - Cat: ${prod.Categoria?.nome} - ${prod.disponibile ? 'Disponibile' : 'Non disponibile'}`);
      });
      
      if (prodottiCount > 10) {
        console.log(`... e altri ${prodottiCount - 10} prodotti`);
      }
    }
    
  } catch (error) {
    console.error('Errore:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkProdottiData();