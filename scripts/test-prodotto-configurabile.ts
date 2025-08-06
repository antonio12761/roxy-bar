import { PrismaClient } from '@prisma/client';
import { nanoid } from 'nanoid';

const prisma = new PrismaClient();

async function createTestConfigurableProduct() {
  try {
    // Trova o crea un prodotto Gin Tonic
    let ginTonic = await prisma.prodotto.findFirst({
      where: { nome: 'Gin Tonic Test' }
    });

    if (!ginTonic) {
      ginTonic = await prisma.prodotto.create({
        data: {
          nome: 'Gin Tonic Test',
          descrizione: 'Gin Tonic configurabile con scelta di gin e tonica',
          prezzo: 8.00,
          categoria: 'COCKTAIL',
          disponibile: true,
          postazione: 'BANCO',
          updatedAt: new Date()
        }
      });
      console.log('✅ Prodotto Gin Tonic creato:', ginTonic.id);
    }

    // Crea il prodotto configurabile
    const prodottoConfig = await prisma.prodottoConfigurabile.upsert({
      where: { prodottoId: ginTonic.id },
      update: {},
      create: {
        id: nanoid(),
        prodottoId: ginTonic.id,
        nome: ginTonic.nome,
        tipo: 'COCKTAIL',
        richiedeScelta: true,
        sceltaMultipla: false
      }
    });
    console.log('✅ Prodotto configurabile creato/aggiornato:', prodottoConfig.id);

    // Crea gruppo per la scelta del Gin
    const gruppoGin = await prisma.gruppoIngredienti.create({
      data: {
        id: nanoid(),
        prodottoConfigurableId: prodottoConfig.id,
        nome: 'Scelta Gin',
        descrizione: 'Seleziona il gin preferito',
        obbligatorio: true,
        ordinamento: 1,
        minimoSelezioni: 1,
        massimoSelezioni: 1
      }
    });
    console.log('✅ Gruppo Gin creato:', gruppoGin.id);

    // Aggiungi varianti di Gin
    const gins = [
      { nome: 'Bombay Sapphire', prezzoExtra: 0 },
      { nome: "Hendrick's", prezzoExtra: 2 },
      { nome: 'Tanqueray', prezzoExtra: 1 },
      { nome: 'Gin Mare', prezzoExtra: 3 },
      { nome: 'Monkey 47', prezzoExtra: 4 }
    ];

    for (let i = 0; i < gins.length; i++) {
      await prisma.ingrediente.create({
        data: {
          id: nanoid(),
          gruppoIngredientiId: gruppoGin.id,
          nome: gins[i].nome,
          prezzoExtra: gins[i].prezzoExtra,
          disponibile: true,
          ordinamento: i
        }
      });
    }
    console.log('✅ Ingredienti Gin aggiunti');

    // Crea gruppo per la scelta della Tonica
    const gruppoTonica = await prisma.gruppoIngredienti.create({
      data: {
        id: nanoid(),
        prodottoConfigurableId: prodottoConfig.id,
        nome: 'Scelta Tonica',
        descrizione: 'Seleziona la tonica preferita',
        obbligatorio: true,
        ordinamento: 2,
        minimoSelezioni: 1,
        massimoSelezioni: 1
      }
    });
    console.log('✅ Gruppo Tonica creato:', gruppoTonica.id);

    // Aggiungi varianti di Tonica
    const toniche = [
      { nome: 'Schweppes', prezzoExtra: 0 },
      { nome: 'Fever-Tree', prezzoExtra: 1.5 },
      { nome: '1724', prezzoExtra: 3 },
      { nome: 'Thomas Henry', prezzoExtra: 1 }
    ];

    for (let i = 0; i < toniche.length; i++) {
      await prisma.ingrediente.create({
        data: {
          id: nanoid(),
          gruppoIngredientiId: gruppoTonica.id,
          nome: toniche[i].nome,
          prezzoExtra: toniche[i].prezzoExtra,
          disponibile: true,
          ordinamento: i
        }
      });
    }
    console.log('✅ Ingredienti Tonica aggiunti');

    // Crea gruppo opzionale per i garnish
    const gruppoGarnish = await prisma.gruppoIngredienti.create({
      data: {
        id: nanoid(),
        prodottoConfigurableId: prodottoConfig.id,
        nome: 'Garnish Extra',
        descrizione: 'Aggiungi decorazioni extra (opzionale)',
        obbligatorio: false,
        ordinamento: 3,
        minimoSelezioni: 0,
        massimoSelezioni: 2
      }
    });
    console.log('✅ Gruppo Garnish creato:', gruppoGarnish.id);

    // Aggiungi garnish opzionali
    const garnish = [
      { nome: 'Cetriolo', prezzoExtra: 0.5 },
      { nome: 'Bacche di Ginepro', prezzoExtra: 1 },
      { nome: 'Rosmarino', prezzoExtra: 0.5 },
      { nome: 'Lime', prezzoExtra: 0 }
    ];

    for (let i = 0; i < garnish.length; i++) {
      await prisma.ingrediente.create({
        data: {
          id: nanoid(),
          gruppoIngredientiId: gruppoGarnish.id,
          nome: garnish[i].nome,
          prezzoExtra: garnish[i].prezzoExtra,
          disponibile: true,
          ordinamento: i
        }
      });
    }
    console.log('✅ Ingredienti Garnish aggiunti');

    console.log('\n🎉 Prodotto configurabile di test creato con successo!');
    console.log('📝 Vai su /dashboard/products e clicca sull\'icona ⚙️ accanto a "Gin Tonic Test"');
    console.log('🍹 Poi vai su /cameriere per testare la selezione delle varianti');

  } catch (error) {
    console.error('❌ Errore:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestConfigurableProduct();