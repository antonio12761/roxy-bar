import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkTavoliData() {
  try {
    console.log('=== Verifica dati Tavoli e Gruppi ===\n');
    
    // Conta gruppi
    const gruppiCount = await prisma.gruppoTavoli.count();
    console.log(`Totale gruppi: ${gruppiCount}`);
    
    // Mostra gruppi attivi
    const gruppiAttivi = await prisma.gruppoTavoli.findMany({
      where: { attivo: true },
      include: {
        _count: {
          select: { Tavolo: true }
        }
      }
    });
    
    console.log(`\nGruppi attivi: ${gruppiAttivi.length}`);
    gruppiAttivi.forEach(gruppo => {
      console.log(`- ${gruppo.nome} (ID: ${gruppo.id}, Tavoli: ${gruppo._count.Tavolo})`);
    });
    
    // Conta tavoli
    const tavoliCount = await prisma.tavolo.count();
    console.log(`\nTotale tavoli: ${tavoliCount}`);
    
    // Mostra tavoli attivi
    const tavoliAttivi = await prisma.tavolo.findMany({
      where: { attivo: true },
      include: {
        GruppoTavoli: true
      },
      orderBy: [
        { gruppoId: 'asc' },
        { numero: 'asc' }
      ]
    });
    
    console.log(`Tavoli attivi: ${tavoliAttivi.length}`);
    tavoliAttivi.forEach(tavolo => {
      console.log(`- Tavolo ${tavolo.numero} (ID: ${tavolo.id}, Gruppo: ${tavolo.GruppoTavoli?.nome || 'Nessuno'})`);
    });
    
    // Se non ci sono dati, crea alcuni esempi
    if (gruppiCount === 0) {
      console.log('\n\n=== Creazione dati di esempio ===\n');
      
      const salaGruppo = await prisma.gruppoTavoli.create({
        data: {
          nome: 'Sala Principale',
          descrizione: 'Tavoli della sala interna',
          colore: '#3B82F6',
          icona: 'Home',
          ordinamento: 1
        }
      });
      console.log('✓ Gruppo "Sala Principale" creato');
      
      const terrazzaGruppo = await prisma.gruppoTavoli.create({
        data: {
          nome: 'Terrazza',
          descrizione: 'Tavoli all\'aperto',
          colore: '#10B981',
          icona: 'Sun',
          ordinamento: 2
        }
      });
      console.log('✓ Gruppo "Terrazza" creato');
      
      // Crea tavoli per la sala
      for (let i = 1; i <= 5; i++) {
        await prisma.tavolo.create({
          data: {
            numero: i.toString(),
            forma: i % 2 === 0 ? 'ROTONDO' : 'QUADRATO',
            stato: 'LIBERO',
            gruppoId: salaGruppo.id,
            posizioneX: 0,
            posizioneY: 0,
            ordinamento: i
          }
        });
      }
      console.log('✓ 5 tavoli creati per Sala Principale');
      
      // Crea tavoli per la terrazza
      for (let i = 1; i <= 3; i++) {
        await prisma.tavolo.create({
          data: {
            numero: `T${i}`,
            forma: 'ROTONDO',
            stato: 'LIBERO',
            gruppoId: terrazzaGruppo.id,
            posizioneX: 0,
            posizioneY: 0,
            ordinamento: i
          }
        });
      }
      console.log('✓ 3 tavoli creati per Terrazza');
      
      console.log('\nDati di esempio creati con successo!');
    }
    
  } catch (error) {
    console.error('Errore:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTavoliData();