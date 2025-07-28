const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function updateTavoliNumerazione() {
  try {
    console.log('🔄 Aggiornamento numerazione tavoli...');
    
    // Elimina tutti i tavoli esistenti
    await prisma.tavolo.deleteMany({});
    console.log('✅ Tavoli esistenti eliminati');
    
    const tavoli = [];
    
    // Dentro - 7 tavoli (T1-T7) - cambiato da D a T
    for (let i = 1; i <= 7; i++) {
      tavoli.push({
        numero: `T${i}`,
        zona: 'Dentro',
        posti: 4,
        stato: 'LIBERO',
        attivo: true
      });
    }
    
    // Marciapiede - 7 tavoli (M1-M7) - rimane uguale
    for (let i = 1; i <= 7; i++) {
      tavoli.push({
        numero: `M${i}`,
        zona: 'Marciapiede',
        posti: 4,
        stato: 'LIBERO', 
        attivo: true
      });
    }
    
    // Prima Fila - 6 tavoli (11-16) - rimossa la F
    for (let i = 1; i <= 6; i++) {
      tavoli.push({
        numero: `1${i}`,
        zona: 'Prima Fila',
        posti: 4,
        stato: 'LIBERO',
        attivo: true
      });
    }
    
    // Seconda Fila - 6 tavoli (21-26) - rimossa la F
    for (let i = 1; i <= 6; i++) {
      tavoli.push({
        numero: `2${i}`,
        zona: 'Seconda Fila', 
        posti: 4,
        stato: 'LIBERO',
        attivo: true
      });
    }
    
    // Terza Fila - 6 tavoli (31-36) - rimossa la F
    for (let i = 1; i <= 6; i++) {
      tavoli.push({
        numero: `3${i}`,
        zona: 'Terza Fila',
        posti: 4,
        stato: 'LIBERO',
        attivo: true
      });
    }
    
    // Piazza - 4 tavoli (P1-P4) - rimane uguale
    for (let i = 1; i <= 4; i++) {
      tavoli.push({
        numero: `P${i}`,
        zona: 'Piazza',
        posti: 4,
        stato: 'LIBERO',
        attivo: true
      });
    }
    
    // Crea tutti i tavoli
    await prisma.tavolo.createMany({
      data: tavoli
    });
    
    console.log(`✅ Creati ${tavoli.length} tavoli con la numerazione aggiornata:`);
    
    // Verifica la distribuzione
    const zones = ['Dentro', 'Marciapiede', 'Prima Fila', 'Seconda Fila', 'Terza Fila', 'Piazza'];
    
    for (const zona of zones) {
      const tables = await prisma.tavolo.findMany({
        where: { zona },
        select: { numero: true },
        orderBy: { numero: 'asc' }
      });
      const numeri = tables.map(t => t.numero).join(', ');
      console.log(`   📍 ${zona}: ${tables.length} tavoli - [${numeri}]`);
    }
    
    const total = await prisma.tavolo.count();
    console.log(`   🎯 Totale: ${total} tavoli`);
    
    console.log('🎉 Aggiornamento numerazione completato!');
    
  } catch (error) {
    console.error('❌ Errore durante l\'aggiornamento:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateTavoliNumerazione();