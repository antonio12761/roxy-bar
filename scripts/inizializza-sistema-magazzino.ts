import { PrismaClient, TipoUbicazione, UnitaAcquisto, UnitaVendita, UnitaMisuraContenuto } from '@prisma/client';
import { nanoid } from 'nanoid';

const prisma = new PrismaClient();

async function inizializzaSistemaMagazzino() {
  try {
    console.log('=== Inizializzazione Sistema Magazzino-Bar ===\n');
    
    // 1. CREA UBICAZIONI
    console.log('1. Creazione ubicazioni...');
    
    const ubicazioni = await prisma.ubicazione.createMany({
      data: [
        {
          codice: 'MAG-01',
          nome: 'Magazzino Centrale',
          descrizione: 'Magazzino principale per stoccaggio merce',
          tipo: TipoUbicazione.MAGAZZINO
        },
        {
          codice: 'BAR-01',
          nome: 'Bar Principale',
          descrizione: 'Banco bar per servizio clienti',
          tipo: TipoUbicazione.BAR
        },
        {
          codice: 'CUC-01',
          nome: 'Cucina',
          descrizione: 'Dispensa e frigoriferi cucina',
          tipo: TipoUbicazione.CUCINA
        },
        {
          codice: 'CANT-01',
          nome: 'Cantina Vini',
          descrizione: 'Cantina climatizzata per vini',
          tipo: TipoUbicazione.CANTINA
        }
      ],
      skipDuplicates: true
    });
    
    console.log(`✓ Create ${ubicazioni.count} ubicazioni`);
    
    // Recupera le ubicazioni create
    const magazzino = await prisma.ubicazione.findUnique({ where: { codice: 'MAG-01' } });
    const bar = await prisma.ubicazione.findUnique({ where: { codice: 'BAR-01' } });
    const cucina = await prisma.ubicazione.findUnique({ where: { codice: 'CUC-01' } });
    
    if (!magazzino || !bar || !cucina) {
      throw new Error('Ubicazioni non create correttamente');
    }
    
    // 2. VERIFICA CATEGORIE E PRODOTTI
    console.log('\n2. Verifica prodotti esistenti...');
    
    const prodottiEsistenti = await prisma.prodotto.count({ where: { isDeleted: false } });
    
    if (prodottiEsistenti === 0) {
      console.log('   Nessun prodotto trovato. Creazione prodotti di esempio...');
      
      // Crea o aggiorna categorie menu
      const catBibite = await prisma.categoriaMenu.upsert({
        where: { nome: 'Bibite' },
        update: {
          nomeDisplay: 'Bibite',
          emoji: '🥤',
          descrizione: 'Bibite e soft drink',
          ordinamento: 1,
          coloreHex: '#4169E1',
          updatedAt: new Date()
        },
        create: {
          nome: 'Bibite',
          nomeDisplay: 'Bibite',
          emoji: '🥤',
          descrizione: 'Bibite e soft drink',
          ordinamento: 1,
          coloreHex: '#4169E1',
          updatedAt: new Date()
        }
      });
      
      const catCaffetteria = await prisma.categoriaMenu.upsert({
        where: { nome: 'Caffetteria' },
        update: {
          nomeDisplay: 'Caffetteria',
          emoji: '☕',
          descrizione: 'Caffè e bevande calde',
          ordinamento: 2,
          coloreHex: '#8B4513',
          updatedAt: new Date()
        },
        create: {
          nome: 'Caffetteria',
          nomeDisplay: 'Caffetteria',
          emoji: '☕',
          descrizione: 'Caffè e bevande calde',
          ordinamento: 2,
          coloreHex: '#8B4513',
          updatedAt: new Date()
        }
      });
      
      const catBirre = await prisma.categoriaMenu.upsert({
        where: { nome: 'Birre' },
        update: {
          nomeDisplay: 'Birre',
          emoji: '🍺',
          descrizione: 'Birre alla spina e in bottiglia',
          ordinamento: 3,
          coloreHex: '#FFD700',
          updatedAt: new Date()
        },
        create: {
          nome: 'Birre',
          nomeDisplay: 'Birre',
          emoji: '🍺',
          descrizione: 'Birre alla spina e in bottiglia',
          ordinamento: 3,
          coloreHex: '#FFD700',
          updatedAt: new Date()
        }
      });
      
      const catVini = await prisma.categoriaMenu.upsert({
        where: { nome: 'Vini' },
        update: {
          nomeDisplay: 'Vini',
          emoji: '🍷',
          descrizione: 'Vini e spumanti',
          ordinamento: 4,
          coloreHex: '#8B0000',
          updatedAt: new Date()
        },
        create: {
          nome: 'Vini',
          nomeDisplay: 'Vini',
          emoji: '🍷',
          descrizione: 'Vini e spumanti',
          ordinamento: 4,
          coloreHex: '#8B0000',
          updatedAt: new Date()
        }
      });
      
      // Crea prodotti di esempio
      const cocaCola = await prisma.prodotto.create({
        data: {
          nome: 'Coca Cola 33cl',
          categoria: 'Bibite',
          categoriaMenuId: catBibite.id,
          prezzo: 3.00,
          disponibile: true,
          postazione: 'BANCO',
          updatedAt: new Date()
        }
      });
      
      const caffe = await prisma.prodotto.create({
        data: {
          nome: 'Caffè Espresso',
          categoria: 'Caffetteria',
          categoriaMenuId: catCaffetteria.id,
          prezzo: 1.20,
          disponibile: true,
          postazione: 'BANCO',
          updatedAt: new Date()
        }
      });
      
      const birraMedia = await prisma.prodotto.create({
        data: {
          nome: 'Birra Media 0.4L',
          categoria: 'Birre',
          categoriaMenuId: catBirre.id,
          prezzo: 4.00,
          disponibile: true,
          postazione: 'BANCO',
          updatedAt: new Date()
        }
      });
      
      const vinoCalice = await prisma.prodotto.create({
        data: {
          nome: 'Vino Rosso Casa (calice)',
          categoria: 'Vini',
          categoriaMenuId: catVini.id,
          prezzo: 4.00,
          disponibile: true,
          postazione: 'BANCO',
          updatedAt: new Date()
        }
      });
      
      console.log('✓ Prodotti di esempio creati');
      
      // 3. CREA CONFIGURAZIONI MAGAZZINO
      console.log('\n3. Configurazione prodotti magazzino...');
      
      await prisma.prodottoMagazzino.createMany({
        data: [
          {
            prodottoId: cocaCola.id,
            unitaAcquisto: 'cartone',
            pezziPerUnita: 24,
            stockMinimoMagazzino: 5, // 5 cartoni
            leadTimeGiorni: 2
          },
          {
            prodottoId: caffe.id,
            unitaAcquisto: 'kg',
            pezziPerUnita: 1,
            stockMinimoMagazzino: 10, // 10 kg
            leadTimeGiorni: 3
          },
          {
            prodottoId: birraMedia.id,
            unitaAcquisto: 'fusto',
            pezziPerUnita: 1,
            volumeUnitario: 30,
            stockMinimoMagazzino: 2, // 2 fusti
            leadTimeGiorni: 1,
            temperaturaStoccaggio: 'frigo'
          },
          {
            prodottoId: vinoCalice.id,
            unitaAcquisto: 'cassa',
            pezziPerUnita: 6,
            stockMinimoMagazzino: 3, // 3 casse
            leadTimeGiorni: 7,
            temperaturaStoccaggio: 'cantina'
          }
        ]
      });
      
      console.log('✓ Configurazioni magazzino create');
      
      // 4. CONFIGURA CONVERSIONI
      console.log('\n4. Configurazione conversioni unità...');
      
      // Prima recupera i prodotti con le loro configurazioni magazzino
      const prodottiConMagazzino = await prisma.prodotto.findMany({
        where: {
          id: { in: [cocaCola.id, caffe.id, birraMedia.id, vinoCalice.id] }
        },
        include: { ProdottoMagazzino: true }
      });
      
      // Coca Cola: cartone → bottiglie
      const cocaColaMagazzino = prodottiConMagazzino.find(p => p.id === cocaCola.id)?.ProdottoMagazzino;
      if (cocaColaMagazzino) {
        await prisma.configurazioneConversione.create({
          data: {
            prodottoId: cocaCola.id,
            prodottoMagazzinoId: cocaColaMagazzino.id,
            unitaAcquisto: UnitaAcquisto.CARTONE,
            quantitaAcquisto: 1,
            contenutoAcquisto: 24,
            unitaMisuraContenuto: UnitaMisuraContenuto.PEZZI,
            unitaVendita: UnitaVendita.BOTTIGLIA,
            quantitaVendita: 1,
            fattoreConversione: 24,
            note: '1 cartone = 24 bottiglie'
          }
        });
      }
      
      // Caffè: kg → tazzine
      const caffeMagazzino = prodottiConMagazzino.find(p => p.id === caffe.id)?.ProdottoMagazzino;
      if (caffeMagazzino) {
        await prisma.configurazioneConversione.create({
          data: {
            prodottoId: caffe.id,
            prodottoMagazzinoId: caffeMagazzino.id,
            unitaAcquisto: UnitaAcquisto.KG,
            quantitaAcquisto: 1,
            contenutoAcquisto: 1000,
            unitaMisuraContenuto: UnitaMisuraContenuto.GRAMMI,
            unitaVendita: UnitaVendita.TAZZINA,
            quantitaVendita: 7, // 7 grammi per tazzina
            fattoreConversione: 142.857, // 1000g / 7g
            note: '1 kg = ~143 caffè (7g per tazzina)'
          }
        });
      }
      
      // Birra: fusto → bicchieri
      const birraMagazzino = prodottiConMagazzino.find(p => p.id === birraMedia.id)?.ProdottoMagazzino;
      if (birraMagazzino) {
        await prisma.configurazioneConversione.create({
          data: {
            prodottoId: birraMedia.id,
            prodottoMagazzinoId: birraMagazzino.id,
            unitaAcquisto: UnitaAcquisto.FUSTO,
            quantitaAcquisto: 1,
            contenutoAcquisto: 30,
            unitaMisuraContenuto: UnitaMisuraContenuto.LITRI,
            unitaVendita: UnitaVendita.BICCHIERE,
            quantitaVendita: 0.4, // 0.4L per bicchiere
            fattoreConversione: 75, // 30L / 0.4L
            note: '1 fusto 30L = 75 birre medie'
          }
        });
      }
      
      // Vino: cassa → calici
      const vinoMagazzino = prodottiConMagazzino.find(p => p.id === vinoCalice.id)?.ProdottoMagazzino;
      if (vinoMagazzino) {
        await prisma.configurazioneConversione.create({
          data: {
            prodottoId: vinoCalice.id,
            prodottoMagazzinoId: vinoMagazzino.id,
            unitaAcquisto: UnitaAcquisto.CASSA,
            quantitaAcquisto: 1,
            contenutoAcquisto: 6,
            unitaMisuraContenuto: UnitaMisuraContenuto.PEZZI,
            unitaVendita: UnitaVendita.CALICE,
            quantitaVendita: 0.15, // 150ml per calice
            fattoreConversione: 30, // 6 bottiglie × 5 calici
            note: '1 cassa (6 bottiglie) = 30 calici'
          }
        });
      }
      
      console.log('✓ Configurazioni conversione create');
      
      // 5. INIZIALIZZA GIACENZE
      console.log('\n5. Inizializzazione giacenze ubicazioni...');
      
      // Giacenze bar (operative)
      await prisma.giacenzaUbicazione.createMany({
        data: [
          {
            prodottoId: cocaCola.id,
            ubicazioneId: bar.id,
            quantita: 24, // 1 cartone
            scorteMinime: 12
          },
          {
            prodottoId: caffe.id,
            ubicazioneId: bar.id,
            quantita: 500, // ~3.5 kg = ~3.5 tazzine 
            scorteMinime: 200
          },
          {
            prodottoId: birraMedia.id,
            ubicazioneId: bar.id,
            quantita: 75, // 1 fusto = 75 bicchieri
            scorteMinime: 50
          },
          {
            prodottoId: vinoCalice.id,
            ubicazioneId: bar.id,
            quantita: 30, // 1 cassa = 30 calici
            scorteMinime: 15
          }
        ]
      });
      
      // Giacenze magazzino (scorte)
      await prisma.giacenzaUbicazione.createMany({
        data: [
          {
            prodottoId: cocaCola.id,
            ubicazioneId: magazzino.id,
            quantita: 120, // 5 cartoni = 120 bottiglie
            scorteMinime: 48
          },
          {
            prodottoId: caffe.id,
            ubicazioneId: magazzino.id,
            quantita: 10, // 10 kg
            scorteMinime: 5
          },
          {
            prodottoId: birraMedia.id,
            ubicazioneId: magazzino.id,
            quantita: 3, // 3 fusti
            scorteMinime: 2
          },
          {
            prodottoId: vinoCalice.id,
            ubicazioneId: magazzino.id,
            quantita: 5, // 5 casse
            scorteMinime: 3
          }
        ]
      });
      
      console.log('✓ Giacenze iniziali create');
    } else {
      console.log(`   Trovati ${prodottiEsistenti} prodotti esistenti`);
      
      // Per prodotti esistenti, crea solo giacenze se mancano
      const prodotti = await prisma.prodotto.findMany({
        where: { isDeleted: false },
        take: 10
      });
      
      for (const prodotto of prodotti) {
        // Verifica se ha già giacenze
        const giacenzeEsistenti = await prisma.giacenzaUbicazione.count({
          where: { prodottoId: prodotto.id }
        });
        
        if (giacenzeEsistenti === 0) {
          // Crea giacenza bar di default
          await prisma.giacenzaUbicazione.create({
            data: {
              prodottoId: prodotto.id,
              ubicazioneId: bar.id,
              quantita: 10,
              scorteMinime: 5
            }
          });
        }
      }
    }
    
    // 6. REPORT FINALE
    console.log('\n=== Riepilogo Sistema ===');
    
    const totUbicazioni = await prisma.ubicazione.count();
    const totProdotti = await prisma.prodotto.count({ where: { isDeleted: false } });
    const totGiacenze = await prisma.giacenzaUbicazione.count();
    const totConfigurazioni = await prisma.configurazioneConversione.count();
    
    console.log(`Ubicazioni: ${totUbicazioni}`);
    console.log(`Prodotti: ${totProdotti}`);
    console.log(`Giacenze: ${totGiacenze}`);
    console.log(`Configurazioni conversione: ${totConfigurazioni}`);
    
    console.log('\n✅ Sistema magazzino-bar inizializzato con successo!');
    console.log('\nProssimi passi:');
    console.log('1. Configura i fornitori per i prodotti');
    console.log('2. Crea un ordine fornitore di test');
    console.log('3. Registra una fattura fornitore');
    console.log('4. Crea una distinta di prelievo magazzino → bar');
    console.log('5. Testa la vendita con tracking conversioni');
    
  } catch (error) {
    console.error('❌ Errore durante inizializzazione:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Esegui inizializzazione
inizializzaSistemaMagazzino();