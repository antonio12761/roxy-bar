const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function updateTavoliDistribuzione() {
  try {
    console.log('🔄 Aggiornamento distribuzione tavoli...');
    
    // Elimina tutti i tavoli esistenti
    await prisma.tavolo.deleteMany({});
    console.log('✅ Tavoli esistenti eliminati');
    
    const tavoli = [];
    
    // Dentro - 7 tavoli (D1-D7)
    for (let i = 1; i <= 7; i++) {
      tavoli.push({
        numero: `D${i}`,
        zona: 'Dentro',
        posti: 4,
        stato: 'LIBERO',
        attivo: true
      });
    }
    
    // Marciapiede - 7 tavoli (M1-M7)  
    for (let i = 1; i <= 7; i++) {
      tavoli.push({
        numero: `M${i}`,
        zona: 'Marciapiede',
        posti: 4,
        stato: 'LIBERO', 
        attivo: true
      });
    }
    
    // Prima Fila - 6 tavoli (F1-F6)
    for (let i = 1; i <= 6; i++) {
      tavoli.push({
        numero: `F1${i}`,
        zona: 'Prima Fila',
        posti: 4,
        stato: 'LIBERO',
        attivo: true
      });
    }
    
    // Seconda Fila - 6 tavoli (F2-F6)
    for (let i = 1; i <= 6; i++) {
      tavoli.push({
        numero: `F2${i}`,
        zona: 'Seconda Fila', 
        posti: 4,
        stato: 'LIBERO',
        attivo: true
      });
    }
    
    // Terza Fila - 6 tavoli (F3-F6)
    for (let i = 1; i <= 6; i++) {
      tavoli.push({
        numero: `F3${i}`,
        zona: 'Terza Fila',
        posti: 4,
        stato: 'LIBERO',
        attivo: true
      });
    }
    
    // Piazza - 4 tavoli (P1-P4)
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
    
    console.log(`✅ Creati ${tavoli.length} tavoli con la distribuzione corretta:`);
    
    // Verifica la distribuzione
    const zones = ['Dentro', 'Marciapiede', 'Prima Fila', 'Seconda Fila', 'Terza Fila', 'Piazza'];
    
    for (const zona of zones) {
      const count = await prisma.tavolo.count({
        where: { zona }
      });
      console.log(`   📍 ${zona}: ${count} tavoli`);
    }
    
    const total = await prisma.tavolo.count();
    console.log(`   🎯 Totale: ${total} tavoli`);
    
    console.log('🎉 Aggiornamento completato!');
    
  } catch (error) {
    console.error('❌ Errore durante l\'aggiornamento:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateTavoliDistribuzione();