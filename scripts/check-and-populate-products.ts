import { PrismaClient, TipoCategoriaIngrediente, DestinazioneRiga } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAndPopulateProducts() {
  try {
    console.log('=== Verifica Sistema Prodotti e Inventario ===\n');
    
    // 1. Verifica CategoriaMenu
    const categorieMenu = await prisma.categoriaMenu.count();
    console.log(`Categorie Menu: ${categorieMenu}`);
    
    // 2. Verifica Prodotti
    const prodottiCount = await prisma.prodotto.count({ where: { isDeleted: false } });
    console.log(`Prodotti attivi: ${prodottiCount}`);
    
    // 3. Verifica Inventario
    const inventarioCount = await prisma.inventario.count();
    console.log(`Prodotti in inventario: ${inventarioCount}`);
    
    // 4. Verifica Categorie Ingredienti (per cocktail)
    const categorieIngredienti = await prisma.categoriaIngrediente.count();
    console.log(`Categorie ingredienti: ${categorieIngredienti}`);
    
    // 5. Verifica Bottiglie
    const bottiglie = await prisma.bottiglia.count();
    console.log(`Bottiglie registrate: ${bottiglie}`);
    
    if (prodottiCount === 0) {
      console.log('\n=== Creazione dati di esempio ===\n');
      
      // STEP 1: Crea Categorie Menu
      console.log('1. Creazione categorie menu...');
      
      const catCaffetteria = await prisma.categoriaMenu.create({
        data: {
          nome: 'Caffetteria',
          nomeDisplay: 'Caffetteria',
          emoji: '☕',
          descrizione: 'Caffè e bevande calde',
          ordinamento: 1,
          coloreHex: '#8B4513',
          updatedAt: new Date()
        }
      });
      
      const catBibite = await prisma.categoriaMenu.create({
        data: {
          nome: 'Bibite',
          nomeDisplay: 'Bibite',
          emoji: '🥤',
          descrizione: 'Bevande fredde e soft drink',
          ordinamento: 2,
          coloreHex: '#4169E1',
          updatedAt: new Date()
        }
      });
      
      const catPanini = await prisma.categoriaMenu.create({
        data: {
          nome: 'Panini e Snack',
          nomeDisplay: 'Panini & Snack',
          emoji: '🥪',
          descrizione: 'Panini, toast e snack',
          ordinamento: 3,
          coloreHex: '#FF8C00',
          updatedAt: new Date()
        }
      });
      
      const catCocktail = await prisma.categoriaMenu.create({
        data: {
          nome: 'Cocktail',
          nomeDisplay: 'Cocktail',
          emoji: '🍸',
          descrizione: 'Cocktail e long drink',
          ordinamento: 4,
          coloreHex: '#FF1493',
          updatedAt: new Date()
        }
      });
      
      const catBirre = await prisma.categoriaMenu.create({
        data: {
          nome: 'Birre',
          nomeDisplay: 'Birre',
          emoji: '🍺',
          descrizione: 'Birre alla spina e in bottiglia',
          ordinamento: 5,
          coloreHex: '#FFD700',
          updatedAt: new Date()
        }
      });
      
      console.log('✓ Categorie menu create');
      
      // STEP 2: Crea prodotti semplici (vendita diretta)
      console.log('\n2. Creazione prodotti semplici...');
      
      // Caffetteria
      const caffe = await prisma.prodotto.create({
        data: {
          nome: 'Caffè Espresso',
          categoria: 'Caffetteria',
          categoriaMenuId: catCaffetteria.id,
          prezzo: 1.20,
          postazione: DestinazioneRiga.BANCO,
          disponibile: true
        }
      });
      
      await prisma.prodotto.createMany({
        data: [
          {
            nome: 'Cappuccino',
            categoria: 'Caffetteria',
            categoriaMenuId: catCaffetteria.id,
            prezzo: 1.80,
            postazione: DestinazioneRiga.BANCO,
            disponibile: true
          },
          {
            nome: 'Caffè Macchiato',
            categoria: 'Caffetteria',
            categoriaMenuId: catCaffetteria.id,
            prezzo: 1.40,
            postazione: DestinazioneRiga.BANCO,
            disponibile: true
          }
        ]
      });
      
      // Bibite
      const cocaCola = await prisma.prodotto.create({
        data: {
          nome: 'Coca Cola',
          categoria: 'Bibite',
          categoriaMenuId: catBibite.id,
          prezzo: 3.00,
          postazione: DestinazioneRiga.BANCO,
          disponibile: true
        }
      });
      
      // Aggiungi inventario per Coca Cola (esempio prodotto che va gestito a magazzino)
      await prisma.inventario.create({
        data: {
          prodottoId: cocaCola.id,
          giacenzaAttuale: 48, // 2 cartoni da 24
          giacenzaMinima: 12,
          unitaMisura: 'bottiglia'
        }
      });
      
      // Movimento di carico iniziale
      await prisma.movimentoInventario.create({
        data: {
          id: `MOV-${Date.now()}-1`,
          inventarioId: cocaCola.id,
          tipo: 'CARICO',
          quantita: 48,
          note: 'Carico iniziale',
          operatoreId: null, // Sistema
          timestamp: new Date()
        }
      });
      
      console.log('✓ Prodotti semplici creati');
      
      // STEP 3: Crea categorie ingredienti per cocktail
      console.log('\n3. Creazione sistema cocktail...');
      
      const catGin = await prisma.categoriaIngrediente.create({
        data: {
          nome: 'Gin',
          tipo: TipoCategoriaIngrediente.ALCOLICO,
          ordinamento: 1
        }
      });
      
      const catVodka = await prisma.categoriaIngrediente.create({
        data: {
          nome: 'Vodka',
          tipo: TipoCategoriaIngrediente.ALCOLICO,
          ordinamento: 2
        }
      });
      
      const catToniche = await prisma.categoriaIngrediente.create({
        data: {
          nome: 'Toniche',
          tipo: TipoCategoriaIngrediente.MIXER,
          ordinamento: 10
        }
      });
      
      const catSucchi = await prisma.categoriaIngrediente.create({
        data: {
          nome: 'Succhi',
          tipo: TipoCategoriaIngrediente.SUCCO,
          ordinamento: 20
        }
      });
      
      // Crea alcune bottiglie
      const ginBombay = await prisma.bottiglia.create({
        data: {
          nome: 'Bombay Sapphire',
          categoriaIngredienteId: catGin.id,
          prezzoBottiglia: 25.00,
          mlBottiglia: 700,
          mlPorzione: 40,
          disponibile: true
        }
      });
      
      const ginHendricks = await prisma.bottiglia.create({
        data: {
          nome: "Hendrick's",
          categoriaIngredienteId: catGin.id,
          prezzoBottiglia: 35.00,
          mlBottiglia: 700,
          mlPorzione: 40,
          disponibile: true
        }
      });
      
      const vodkaGrey = await prisma.bottiglia.create({
        data: {
          nome: 'Grey Goose',
          categoriaIngredienteId: catVodka.id,
          prezzoBottiglia: 40.00,
          mlBottiglia: 700,
          mlPorzione: 40,
          disponibile: true
        }
      });
      
      const tonicaSchweppes = await prisma.bottiglia.create({
        data: {
          nome: 'Schweppes Tonic',
          categoriaIngredienteId: catToniche.id,
          prezzoBottiglia: 1.50,
          mlBottiglia: 200,
          mlPorzione: 200,
          disponibile: true
        }
      });
      
      console.log('✓ Sistema cocktail creato');
      
      // STEP 4: Crea un cocktail (prodotto miscelato)
      console.log('\n4. Creazione cocktail di esempio...');
      
      const ginTonic = await prisma.prodotto.create({
        data: {
          nome: 'Gin Tonic',
          categoria: 'Cocktail',
          categoriaMenuId: catCocktail.id,
          prezzo: 8.00,
          postazione: DestinazioneRiga.BANCO,
          disponibile: true,
          isMiscelato: true,
          descrizione: 'Gin premium con tonica e guarnizione'
        }
      });
      
      // Crea la ricetta per Gin Tonic
      await prisma.ricettaMiscelata.create({
        data: {
          id: `RIC-${Date.now()}`,
          prodottoId: ginTonic.id,
          nome: 'Gin Tonic',
          descrizione: 'Classico long drink',
          componenteBase: 'GIN',
          ComponentiMiscelati: {
            create: [
              {
                id: `COMP-${Date.now()}-1`,
                categoriaIngrediente: 'Gin',
                categoriaIngredienteId: catGin.id,
                quantita: 1,
                obbligatorio: true,
                numeroSelezioni: 1
              },
              {
                id: `COMP-${Date.now()}-2`,
                categoriaIngrediente: 'Toniche',
                categoriaIngredienteId: catToniche.id,
                quantita: 1,
                obbligatorio: true,
                numeroSelezioni: 1
              }
            ]
          }
        }
      });
      
      console.log('✓ Cocktail Gin Tonic creato con ricetta');
      
      // STEP 5: Crea prodotti per panini (esempio prodotto configurabile)
      console.log('\n5. Creazione panini...');
      
      const panino = await prisma.prodotto.create({
        data: {
          nome: 'Panino Personalizzato',
          categoria: 'Panini',
          categoriaMenuId: catPanini.id,
          prezzo: 5.00,
          postazione: DestinazioneRiga.CUCINA,
          disponibile: true,
          descrizione: 'Panino con ingredienti a scelta'
        }
      });
      
      // Crea configurazione per panino
      await prisma.prodottoConfigurabile.create({
        data: {
          prodottoId: panino.id,
          configurazione: JSON.stringify({
            maxIngredienti: 4,
            prezzoBase: 5.00
          })
        }
      });
      
      // Crea gruppo ingredienti
      const gruppoSalumi = await prisma.gruppoIngredienti.create({
        data: {
          nome: 'Salumi',
          prodottoConfigurabileId: panino.id,
          minSelezioni: 1,
          maxSelezioni: 2,
          ordinamento: 1
        }
      });
      
      const gruppoFormaggi = await prisma.gruppoIngredienti.create({
        data: {
          nome: 'Formaggi',
          prodottoConfigurabileId: panino.id,
          minSelezioni: 0,
          maxSelezioni: 1,
          ordinamento: 2
        }
      });
      
      // Aggiungi ingredienti
      await prisma.ingrediente.createMany({
        data: [
          {
            nome: 'Prosciutto Crudo',
            gruppoId: gruppoSalumi.id,
            disponibile: true,
            sovrapprezzo: 1.00
          },
          {
            nome: 'Prosciutto Cotto',
            gruppoId: gruppoSalumi.id,
            disponibile: true,
            sovrapprezzo: 0.50
          },
          {
            nome: 'Salame',
            gruppoId: gruppoSalumi.id,
            disponibile: true,
            sovrapprezzo: 0.50
          },
          {
            nome: 'Mozzarella',
            gruppoId: gruppoFormaggi.id,
            disponibile: true,
            sovrapprezzo: 0.50
          },
          {
            nome: 'Formaggio',
            gruppoId: gruppoFormaggi.id,
            disponibile: true,
            sovrapprezzo: 0.00
          }
        ]
      });
      
      console.log('✓ Panino configurabile creato');
      
      // STEP 6: Birre con gestione a fusto
      console.log('\n6. Creazione birre...');
      
      const birraMedia = await prisma.prodotto.create({
        data: {
          nome: 'Birra Media 0.4L',
          categoria: 'Birre',
          categoriaMenuId: catBirre.id,
          prezzo: 4.00,
          postazione: DestinazioneRiga.BANCO,
          disponibile: true,
          descrizione: 'Birra alla spina 0.4L'
        }
      });
      
      // Per le birre alla spina potresti creare un inventario speciale
      // che conta in litri invece che pezzi
      await prisma.inventario.create({
        data: {
          prodottoId: birraMedia.id,
          giacenzaAttuale: 50, // 50 litri (un fusto)
          giacenzaMinima: 10,
          unitaMisura: 'litri'
        }
      });
      
      console.log('✓ Birre create');
      
      console.log('\n=== Riepilogo Finale ===');
      const finalCount = await prisma.prodotto.count({ where: { isDeleted: false } });
      const finalInventory = await prisma.inventario.count();
      const finalBottles = await prisma.bottiglia.count();
      
      console.log(`Prodotti creati: ${finalCount}`);
      console.log(`Prodotti in inventario: ${finalInventory}`);
      console.log(`Bottiglie registrate: ${finalBottles}`);
      
    } else {
      console.log('\n=== Prodotti esistenti ===');
      
      // Mostra alcuni prodotti esistenti
      const prodottiEsempio = await prisma.prodotto.findMany({
        take: 5,
        where: { isDeleted: false },
        include: {
          CategoriaMenu: true,
          Inventario: true
        }
      });
      
      prodottiEsempio.forEach(p => {
        console.log(`\n- ${p.nome} (€${p.prezzo})`);
        console.log(`  Categoria: ${p.CategoriaMenu?.nome || p.categoria}`);
        console.log(`  Postazione: ${p.postazione}`);
        if (p.Inventario) {
          console.log(`  Giacenza: ${p.Inventario.giacenzaAttuale} ${p.Inventario.unitaMisura}`);
        }
        console.log(`  Disponibile: ${p.disponibile ? 'Sì' : 'No'}`);
      });
      
      // Mostra cocktail con ricette
      const cocktails = await prisma.prodotto.findMany({
        where: { 
          isMiscelato: true,
          isDeleted: false 
        },
        include: {
          RicettaMiscelata: {
            include: {
              ComponentiMiscelati: true
            }
          }
        }
      });
      
      if (cocktails.length > 0) {
        console.log('\n=== Cocktail con ricette ===');
        cocktails.forEach(c => {
          console.log(`\n- ${c.nome} (€${c.prezzo})`);
          if (c.RicettaMiscelata) {
            console.log('  Componenti:');
            c.RicettaMiscelata.ComponentiMiscelati.forEach(comp => {
              console.log(`  - ${comp.categoriaIngrediente} x${comp.quantita}`);
            });
          }
        });
      }
    }
    
  } catch (error) {
    console.error('Errore:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAndPopulateProducts();