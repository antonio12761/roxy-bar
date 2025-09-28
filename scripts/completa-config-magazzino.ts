import { PrismaClient, UnitaAcquisto, UnitaVendita, UnitaMisuraContenuto } from '@prisma/client';

const prisma = new PrismaClient();

async function completaConfigMagazzino() {
  try {
    console.log('=== Completamento Configurazione Magazzino ===\n');
    
    // Recupera prodotti e ubicazioni
    const prodotti = await prisma.prodotto.findMany({
      where: { isDeleted: false },
      include: {
        ProdottoMagazzino: true,
        ConfigurazioniConversione: true
      }
    });
    
    console.log(`Trovati ${prodotti.length} prodotti`);
    
    // Per ogni prodotto senza configurazione magazzino, creala
    for (const prodotto of prodotti) {
      if (!prodotto.ProdottoMagazzino) {
        console.log(`\nConfigurando magazzino per: ${prodotto.nome}`);
        
        let configData: any = {};
        
        // Configurazioni in base al nome del prodotto
        if (prodotto.nome.includes('Coca Cola')) {
          configData = {
            unitaAcquisto: UnitaAcquisto.CARTONE,
            quantitaPerUnita: 24,
            unitaMisuraContenuto: UnitaMisuraContenuto.PEZZI,
            unitaVendita: UnitaVendita.BOTTIGLIA,
            fattoreConversione: 24,
            tempoConsegnaGiorni: 2,
            quantitaOrdineMinimoUnita: 1,
            gestisciScorte: true
          };
        } else if (prodotto.nome.includes('Caffè')) {
          configData = {
            unitaAcquisto: UnitaAcquisto.KG,
            quantitaPerUnita: 1000,
            unitaMisuraContenuto: UnitaMisuraContenuto.GRAMMI,
            unitaVendita: UnitaVendita.TAZZINA,
            fattoreConversione: 142.857, // 1000g / 7g
            tempoConsegnaGiorni: 3,
            quantitaOrdineMinimoUnita: 1,
            gestisciScorte: true
          };
        } else if (prodotto.nome.includes('Birra')) {
          configData = {
            unitaAcquisto: UnitaAcquisto.FUSTO,
            quantitaPerUnita: 30,
            unitaMisuraContenuto: UnitaMisuraContenuto.LITRI,
            unitaVendita: UnitaVendita.BICCHIERE,
            fattoreConversione: 75, // 30L / 0.4L
            tempoConsegnaGiorni: 1,
            quantitaOrdineMinimoUnita: 1,
            gestisciScorte: true
          };
        } else if (prodotto.nome.includes('Vino')) {
          configData = {
            unitaAcquisto: UnitaAcquisto.CASSA,
            quantitaPerUnita: 6,
            unitaMisuraContenuto: UnitaMisuraContenuto.PEZZI,
            unitaVendita: UnitaVendita.CALICE,
            fattoreConversione: 30, // 6 bottiglie x 5 calici
            tempoConsegnaGiorni: 7,
            quantitaOrdineMinimoUnita: 1,
            gestisciScorte: true
          };
        } else {
          // Default generico
          configData = {
            unitaAcquisto: UnitaAcquisto.PEZZO,
            quantitaPerUnita: 1,
            unitaMisuraContenuto: UnitaMisuraContenuto.PEZZI,
            unitaVendita: UnitaVendita.PEZZO,
            fattoreConversione: 1,
            tempoConsegnaGiorni: 2,
            quantitaOrdineMinimoUnita: 1,
            gestisciScorte: true
          };
        }
        
        const prodottoMagazzino = await prisma.prodottoMagazzino.create({
          data: {
            prodottoId: prodotto.id,
            ...configData
          }
        });
        
        console.log(`  ✓ Creata config magazzino: ${configData.unitaAcquisto}`);
        
        // Crea anche la conversione se non esiste
        if (prodotto.ConfigurazioniConversione.length === 0) {
          let conversionData: any = {};
          
          if (prodotto.nome.includes('Coca Cola')) {
            conversionData = {
              prodottoId: prodotto.id,
              prodottoMagazzinoId: prodottoMagazzino.id,
              fattoreConversione: 24,
              descrizione: '1 cartone = 24 bottiglie'
            };
          } else if (prodotto.nome.includes('Caffè')) {
            conversionData = {
              prodottoId: prodotto.id,
              prodottoMagazzinoId: prodottoMagazzino.id,
              fattoreConversione: 142.857,
              descrizione: '1 kg = ~143 caffè (7g per tazzina)'
            };
          } else if (prodotto.nome.includes('Birra')) {
            conversionData = {
              prodottoId: prodotto.id,
              prodottoMagazzinoId: prodottoMagazzino.id,
              fattoreConversione: 75,
              descrizione: '1 fusto 30L = 75 birre medie'
            };
          } else if (prodotto.nome.includes('Vino')) {
            conversionData = {
              prodottoId: prodotto.id,
              prodottoMagazzinoId: prodottoMagazzino.id,
              fattoreConversione: 30,
              descrizione: '1 cassa (6 bottiglie) = 30 calici'
            };
          }
          
          if (Object.keys(conversionData).length > 0) {
            // Rimuovi prodottoMagazzinoId e prodottoId dal data e connetti tramite relations
            const { prodottoMagazzinoId, prodottoId, ...dataWithoutRelations } = conversionData;
            
            await prisma.configurazioneConversione.create({
              data: {
                ...dataWithoutRelations,
                ProdottoMagazzino: {
                  connect: { id: prodottoMagazzinoId }
                },
                ProdottoVendita: {
                  connect: { id: prodottoId }
                }
              }
            });
            console.log(`  ✓ Creata conversione: fattore ${conversionData.fattoreConversione}`);
          }
        }
      } else {
        console.log(`\n${prodotto.nome}: già configurato`);
      }
    }
    
    // Verifica finale
    const totConfigMagazzino = await prisma.prodottoMagazzino.count();
    const totConversioni = await prisma.configurazioneConversione.count();
    
    console.log('\n=== Riepilogo ===');
    console.log(`Configurazioni magazzino: ${totConfigMagazzino}`);
    console.log(`Conversioni unità: ${totConversioni}`);
    
    console.log('\n✅ Completamento configurazione riuscito!');
    
  } catch (error) {
    console.error('❌ Errore:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Esegui
completaConfigMagazzino();