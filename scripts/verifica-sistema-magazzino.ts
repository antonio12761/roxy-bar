import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verificaSistemaMagazzino() {
  try {
    console.log('=== Verifica Sistema Magazzino-Bar ===\n');
    
    // 1. VERIFICA UBICAZIONI
    console.log('1. Ubicazioni nel sistema:');
    const ubicazioni = await prisma.ubicazione.findMany({
      orderBy: { tipo: 'asc' }
    });
    
    if (ubicazioni.length === 0) {
      console.log('   ❌ Nessuna ubicazione trovata');
      console.log('   Esegui: npx tsx scripts/inizializza-sistema-magazzino.ts');
    } else {
      ubicazioni.forEach(u => {
        console.log(`   - ${u.codice}: ${u.nome} (${u.tipo})`);
      });
    }
    
    // 2. VERIFICA PRODOTTI
    console.log('\n2. Prodotti nel sistema:');
    const prodotti = await prisma.prodotto.findMany({
      where: { isDeleted: false },
      include: {
        CategoriaMenu: true,
        ProdottoMagazzino: true,
        ConfigurazioniConversione: true,
        GiacenzeUbicazione: {
          include: {
            Ubicazione: true
          }
        }
      },
      take: 10
    });
    
    console.log(`   Totale prodotti attivi: ${prodotti.length}`);
    
    // 3. ANALISI CONFIGURAZIONI
    console.log('\n3. Stato configurazioni:');
    
    let prodottiConfigurati = 0;
    let prodottiConGiacenze = 0;
    let prodottiConConversioni = 0;
    
    prodotti.forEach(p => {
      if (p.ProdottoMagazzino) prodottiConfigurati++;
      if (p.GiacenzeUbicazione.length > 0) prodottiConGiacenze++;
      if (p.ConfigurazioniConversione && p.ConfigurazioniConversione.length > 0) prodottiConConversioni++;
    });
    
    console.log(`   - Prodotti con config magazzino: ${prodottiConfigurati}/${prodotti.length}`);
    console.log(`   - Prodotti con giacenze: ${prodottiConGiacenze}/${prodotti.length}`);
    console.log(`   - Prodotti con conversioni: ${prodottiConConversioni}/${prodotti.length}`);
    
    // 4. DETTAGLIO PRODOTTI
    if (prodotti.length > 0) {
      console.log('\n4. Dettaglio primi prodotti:');
      
      prodotti.slice(0, 3).forEach(p => {
        console.log(`\n   📦 ${p.nome} (${p.CategoriaMenu?.nome || p.categoria})`);
        console.log(`      Prezzo: €${p.prezzo}`);
        
        if (p.ProdottoMagazzino) {
          console.log(`      Acquisto: ${p.ProdottoMagazzino.unitaAcquisto} (${p.ProdottoMagazzino.pezziPerUnita} pz)`);
        }
        
        if (p.ConfigurazioniConversione && p.ConfigurazioniConversione.length > 0) {
          const conv = p.ConfigurazioniConversione[0];
          console.log(`      Conversione: 1 ${conv.unitaAcquisto} = ${conv.fattoreConversione} ${conv.unitaVendita}`);
        }
        
        if (p.GiacenzeUbicazione.length > 0) {
          console.log('      Giacenze:');
          p.GiacenzeUbicazione.forEach(g => {
            console.log(`        - ${g.Ubicazione.nome}: ${g.quantita}`);
          });
        }
      });
    }
    
    // 5. VERIFICA FATTURE E DISTINTE
    console.log('\n5. Movimenti:');
    const fatture = await prisma.fatturaFornitore.count();
    const distinte = await prisma.distintaPrelievo.count();
    const movimenti = await prisma.movimentoTrasferimento.count();
    
    console.log(`   - Fatture fornitori: ${fatture}`);
    console.log(`   - Distinte prelievo: ${distinte}`);
    console.log(`   - Movimenti trasferimento: ${movimenti}`);
    
    // 6. SUGGERIMENTI
    console.log('\n6. Azioni consigliate:');
    
    if (ubicazioni.length === 0) {
      console.log('   ⚠️  Crea le ubicazioni base (magazzino, bar, cucina)');
    }
    
    if (prodottiConfigurati < prodotti.length) {
      console.log('   ⚠️  Configura i prodotti mancanti per il magazzino');
    }
    
    if (prodottiConConversioni < prodotti.length) {
      console.log('   ⚠️  Imposta le conversioni unità (cartoni→bottiglie, etc.)');
    }
    
    if (prodottiConGiacenze < prodotti.length) {
      console.log('   ⚠️  Inizializza le giacenze per tutti i prodotti');
    }
    
    if (fatture === 0) {
      console.log('   ℹ️  Registra la prima fattura fornitore per testare il carico');
    }
    
    if (distinte === 0 && fatture > 0) {
      console.log('   ℹ️  Crea una distinta di prelievo magazzino→bar');
    }
    
    console.log('\n✅ Verifica completata!');
    
  } catch (error) {
    console.error('❌ Errore durante la verifica:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Esegui verifica
verificaSistemaMagazzino();